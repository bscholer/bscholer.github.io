export const terrainVertex = /* glsl */ `
  uniform float uHeightScale;
  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vViewDist;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vHeight = position.y / uHeightScale;
    vec4 mv = viewMatrix * world;
    vViewDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const terrainFragment = /* glsl */ `
  uniform float uSize;
  uniform float uSurvey;
  uniform float uStrips;
  uniform float uScan;
  uniform float uCaptured;
  uniform vec2 uDrone;
  uniform vec2 uFootprint;
  uniform vec3 uCursor;
  uniform float uCursorOn;
  uniform float uMinElev;
  uniform float uMaxElev;
  uniform float uNight;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uBg;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uIndex;
  uniform vec3 uAccent;

  varying vec3 vWorld;
  varying vec3 vNormal;
  varying float vHeight;
  varying float vViewDist;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }

  float contour(float value, float interval, float width) {
    float f = value / interval;
    float d = abs(fract(f - 0.5) - 0.5) / fwidth(f);
    return 1.0 - clamp(d - width + 1.0, 0.0, 1.0);
  }

  // Colour of the finished orthomosaic: high desert, pine, volcanic rock, snow.
  vec3 orthoColor(float h, float shade, vec2 p) {
    float grain = vnoise(p * 1.7) * 0.6 + vnoise(p * 6.3) * 0.4;
    vec3 sage = vec3(0.62, 0.60, 0.46);
    vec3 pine = vec3(0.22, 0.31, 0.21);
    vec3 rock = vec3(0.42, 0.38, 0.35);
    vec3 cinder = vec3(0.43, 0.27, 0.22);
    vec3 snow = vec3(0.93, 0.94, 0.95);
    float forest = smoothstep(0.2, 0.3, h + grain * 0.08) * (1.0 - smoothstep(0.5, 0.62, h + grain * 0.1));
    vec3 c = mix(sage, pine, forest * (0.65 + grain * 0.35));
    c = mix(c, rock, smoothstep(0.52, 0.66, h + grain * 0.06));
    c = mix(c, cinder, smoothstep(0.6, 0.75, h) * (1.0 - smoothstep(0.75, 0.85, h)) * grain * 0.6);
    c = mix(c, snow, smoothstep(0.8, 0.88, h + grain * 0.05));
    c *= 0.9 + grain * 0.2;
    return c * (0.35 + 0.8 * shade);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 sun = normalize(vec3(-0.55, 0.62, -0.45));
    float shade = clamp(dot(n, sun), 0.0, 1.0);
    float elev = mix(uMinElev, uMaxElev, vHeight);

    // Topographic map base: paper, hillshade, 40 m contours, 200 m index contours.
    vec3 col = uPaper * mix(0.78, 1.04, shade);
    float minor = contour(elev, 40.0, 0.9);
    float major = contour(elev, 200.0, 1.6);
    col = mix(col, uInk, minor * 0.45);
    col = mix(col, uIndex, major * 0.65);

    // Lawnmower survey: strips along z, serpentine. q is this point's place in flight order.
    float half_ = uSize * 0.5;
    float surveyHalf = uSurvey * 0.5;
    float stripW = uSurvey / uStrips;
    float si = floor((vWorld.x + surveyHalf) / stripW);
    float along = (vWorld.z + surveyHalf) / uSurvey;
    if (mod(si, 2.0) > 0.5) along = 1.0 - along;
    float q = si + along;
    float age = uScan - q;

    if (age > 0.0 && si >= 0.0 && si < uStrips && abs(vWorld.z) < surveyHalf) {
      vec3 ortho = orthoColor(vHeight, shade, vWorld.xz);
      ortho = mix(ortho, ortho * vec3(0.5, 0.56, 0.7), uNight);
      // Sparse tie points first, densifying into the finished orthomosaic.
      vec2 cell = floor(vWorld.xz / 0.9);
      vec2 local = fract(vWorld.xz / 0.9) - 0.5;
      float density = smoothstep(0.0, 0.3, age);
      float isPoint = step(hash(cell), density) * (1.0 - smoothstep(0.18, 0.32, length(local)));
      float solid = smoothstep(0.22, 0.45, age);
      vec3 recon = mix(col, ortho, max(isPoint, solid));
      recon = mix(recon, uIndex, major * 0.25 * solid);
      col = mix(col, recon, uCaptured);
    }

    // Camera footprint of the drone.
    vec2 fd = abs(vWorld.xz - uDrone) - uFootprint;
    float box = max(fd.x, fd.y);
    float inside = step(box, 0.0);
    float edge = 1.0 - smoothstep(0.0, 1.6 * fwidth(box), abs(box));
    col = mix(col, uAccent, inside * 0.12 + edge * 0.9);

    // Cursor: ring plus crosshair.
    if (uCursorOn > 0.5) {
      vec2 dc = vWorld.xz - uCursor.xz;
      float r = length(dc);
      float ring = 1.0 - smoothstep(0.0, 1.5 * fwidth(r), abs(r - 6.0));
      float axis = min(abs(dc.x), abs(dc.y));
      float cross_ = (1.0 - smoothstep(0.0, 1.2 * fwidth(axis), axis)) * step(r, 11.0) * step(2.0, r);
      col = mix(col, uAccent, max(ring, cross_ * 0.8));
    }

    float edgeFade = smoothstep(half_ * 0.99, half_ * 0.8, max(abs(vWorld.x), abs(vWorld.z)));
    float fog = smoothstep(uFogNear, uFogFar, vViewDist);
    col = mix(uBg, col, edgeFade * (1.0 - fog));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPixelRatio;
  varying float vTwinkle;

  void main() {
    vTwinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixelRatio;
    gl_Position = projectionMatrix * mv;
  }
`;

export const starFragment = /* glsl */ `
  uniform float uNight;
  uniform vec3 uColor;
  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vTwinkle * uNight;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

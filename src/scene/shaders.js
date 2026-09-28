
// Photos that see a point, for a serpentine survey with fixed shot spacing.
// Matches the shot positions placed in scene.js.
const coverageChunk = /* glsl */ `
  uniform float uSurvey;
  uniform float uStrips;
  uniform float uScan;
  uniform vec2 uFootprint;
  uniform float uShotSpacing;
  uniform float uShotsPerStrip;

  float coverage(vec2 xz) {
    float stripW = uSurvey / uStrips;
    float fx = (xz.x + uSurvey * 0.5) / stripW - 0.5;
    float span = uFootprint.x / stripW;
    float done = floor(uScan);
    float z = xz.y + uSurvey * 0.5;
    float n = 0.0;
    float s0 = ceil(fx - span);
    for (int i = 0; i < 12; i++) {
      float s = s0 + float(i);
      if (s > fx + span || s > done || s >= uStrips) break;
      if (s < 0.0) continue;
      float along = mod(s, 2.0) > 0.5 ? uSurvey - z : z;
      float kmax = s < done ? uShotsPerStrip - 1.0 : min(uShotsPerStrip - 1.0, floor(fract(uScan) * uSurvey / uShotSpacing));
      float lo = max(0.0, ceil((along - uFootprint.y) / uShotSpacing));
      float hi = min(kmax, floor((along + uFootprint.y) / uShotSpacing));
      n += max(0.0, hi - lo + 1.0);
    }
    return n;
  }
`;

export const terrainVertex = /* glsl */ `
  uniform sampler2D uHeight;
  uniform float uElevToWorld;
  uniform float uCaptured;
  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vViewDist;
  ${coverageChunk}

  void main() {
    vec3 p = position;
    float n = coverage(p.xz) * step(0.5, uCaptured);
    // Few photos give a coarse, blocky model. More overlap refines it to the full lidar surface.
    if (n >= 2.0) {
      float cells = mix(24.0, 256.0, smoothstep(3.0, 10.0, n));
      vec2 g = uv * cells;
      vec2 i = floor(g);
      vec2 f = fract(g);
      float h00 = texture2D(uHeight, i / cells).r;
      float h10 = texture2D(uHeight, (i + vec2(1.0, 0.0)) / cells).r;
      float h01 = texture2D(uHeight, (i + vec2(0.0, 1.0)) / cells).r;
      float h11 = texture2D(uHeight, (i + 1.0) / cells).r;
      float coarse = mix(mix(h00, h10, f.x), mix(h01, h11, f.x), f.y) * uElevToWorld;
      p.y = mix(coarse, p.y, smoothstep(6.0, 11.0, n));
    }
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vUv = uv;
    vec4 mv = viewMatrix * world;
    vViewDist = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const terrainFragment = /* glsl */ `
  uniform sampler2D uHeight;
  uniform sampler2D uOrtho;
  uniform sampler2D uRiver;
  uniform float uTexel;
  uniform float uElevToWorld;
  uniform float uMinElev;
  uniform float uSize;
  uniform float uCaptured;
  uniform float uFlash;
  uniform vec2 uDrone;
  uniform vec3 uCursor;
  uniform float uCursorOn;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform vec3 uAmbient;
  uniform float uNight;
  uniform float uTime;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform vec3 uBg;
  uniform vec3 uPaper;
  uniform vec3 uInk;
  uniform vec3 uIndex;
  uniform vec3 uAccent;
  uniform vec3 uWaterMap;
  uniform int uShadowSteps;

  varying vec3 vWorld;
  varying vec2 vUv;
  varying float vViewDist;
  ${coverageChunk}

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

  float heightWorld(vec2 xz) {
    return texture2D(uHeight, xz / uSize + 0.5).r * uElevToWorld;
  }

  vec3 terrainNormal(vec2 uv, float e) {
    float hl = texture2D(uHeight, uv - vec2(e, 0.0)).r;
    float hr = texture2D(uHeight, uv + vec2(e, 0.0)).r;
    float hd = texture2D(uHeight, uv - vec2(0.0, e)).r;
    float hu = texture2D(uHeight, uv + vec2(0.0, e)).r;
    float cell = e * uSize;
    return normalize(vec3((hl - hr) * uElevToWorld, 2.0 * cell, (hd - hu) * uElevToWorld));
  }

  // Soft shadows by marching toward the sun over the height field.
  float sunShadow(vec3 p) {
    if (uSunDir.y <= 0.0) return 0.0;
    float res = 1.0;
    float t = 0.4;
    for (int i = 0; i < 64; i++) {
      if (i >= uShadowSteps) break;
      vec3 q = p + uSunDir * t;
      if (abs(q.x) > uSize * 0.5 || abs(q.z) > uSize * 0.5 || q.y > uElevToWorld * 520.0) break;
      float d = q.y - heightWorld(q.xz);
      if (d < 0.0) return 0.0;
      res = min(res, 10.0 * d / t);
      t += max(0.35, t * 0.09);
    }
    return clamp(res, 0.0, 1.0);
  }

  float contour(float value, float interval, float width) {
    float f = value / interval;
    float w = fwidth(f);
    float d = abs(fract(f - 0.5) - 0.5) / w;
    // Fade lines where the slope is under a pixel per interval, as on flat ground.
    float fadeFlat = smoothstep(0.002, 0.02, w);
    return (1.0 - clamp(d - width + 1.0, 0.0, 1.0)) * fadeFlat;
  }

  void main() {
    float cov = coverage(vWorld.xz);
    float refine = smoothstep(4.0, 10.0, cov);
    bool rebuilt = cov >= 2.0;
    vec3 n = terrainNormal(vUv, uTexel * (rebuilt ? mix(10.0, 1.0, refine) : 1.0));
    float lambert = max(dot(n, uSunDir), 0.0);
    float shadow = sunShadow(vWorld + n * 0.15);
    float direct = lambert * shadow;
    float sky = 0.5 + 0.5 * n.y;
    // Contours come from a slightly blurred surface so lidar noise on flats does not speckle.
    float b = uTexel * 2.5;
    float elev = (texture2D(uHeight, vUv).r * 2.0
      + texture2D(uHeight, vUv + vec2(b, 0.0)).r + texture2D(uHeight, vUv - vec2(b, 0.0)).r
      + texture2D(uHeight, vUv + vec2(0.0, b)).r + texture2D(uHeight, vUv - vec2(0.0, b)).r) / 6.0 + uMinElev;
    float water = smoothstep(0.35, 0.65, texture2D(uRiver, vUv).r);
    vec3 viewDir = normalize(cameraPosition - vWorld);

    // Topographic map: paper, soft relief shading, 10 m contours, 50 m index contours.
    float relief = mix(0.8, 1.05, mix(sky, lambert * mix(0.55, 1.0, shadow), 0.7));
    vec3 col = uPaper * relief;
    float minor = contour(elev, 10.0, 0.8);
    float major = contour(elev, 50.0, 1.4);
    col = mix(col, uInk, minor * 0.4 * (1.0 - water));
    col = mix(col, uIndex, major * 0.7 * (1.0 - water));
    col = mix(col, uWaterMap, water * 0.9);

    // Photogrammetry needs at least two views. Below that the map stays a map.
    if (rebuilt) {
      float cells = mix(96.0, 2048.0, refine * refine);
      vec2 orthoUv = mix((floor(vUv * cells) + 0.5) / cells, vUv, step(0.999, refine));
      vec3 photo = texture2D(uOrtho, orthoUv).rgb;
      // NAIP already has its own shadows, so relight gently instead of fully.
      vec3 lit = photo * (uAmbient * sky + uSunColor * direct) * 1.25;
      lit = mix(lit, photo * (0.55 + 0.6 * direct), 0.35 * (1.0 - uNight));

      // Nadir photos carry nothing on vertical walls, so cliffs get banded welded tuff instead.
      float steep = smoothstep(0.45, 0.8, 1.0 - n.y);
      if (steep > 0.0) {
        vec3 an = abs(n) + 1e-3;
        float grain = (vnoise(vWorld.zy * vec2(1.2, 3.5)) * an.x + vnoise(vWorld.xy * vec2(1.2, 3.5)) * an.z) / (an.x + an.z);
        float fine = (vnoise(vWorld.zy * 9.0) * an.x + vnoise(vWorld.xy * 9.0) * an.z) / (an.x + an.z);
        float strata = 0.5 + 0.5 * sin(vWorld.y * 2.6 + grain * 3.0);
        vec3 tuff = mix(vec3(0.8, 0.6, 0.42), vec3(0.6, 0.4, 0.28), strata * 0.55 + grain * 0.3 + fine * 0.15);
        vec3 bounce = uAmbient * vec3(1.1, 0.95, 0.8);
        vec3 rock = tuff * (bounce * (0.6 + 0.4 * sky) + uSunColor * direct) * 1.3;
        rock = mix(rock, rock * vec3(0.5, 0.56, 0.7), uNight);
        lit = mix(lit, rock, steep * 0.8);
      }

      if (water > 0.01) {
        vec2 flow = vWorld.xz * 1.8 + vec2(uTime * 0.25, uTime * 0.18);
        vec2 ripple = vec2(vnoise(flow) - 0.5, vnoise(flow + 17.3) - 0.5) * 0.35;
        vec3 wn = normalize(vec3(ripple.x, 1.0, ripple.y));
        vec3 h = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(wn, h), 0.0), 140.0) * 3.0 * step(0.0, uSunDir.y) * shadow;
        float fresnel = pow(1.0 - max(dot(wn, viewDir), 0.0), 4.0);
        vec3 deep = mix(vec3(0.08, 0.17, 0.16), vec3(0.03, 0.06, 0.09), uNight);
        vec3 w = mix(deep, photo * 0.6, 0.35) + fresnel * mix(vec3(0.3, 0.38, 0.42), vec3(0.06, 0.08, 0.13), uNight);
        w += spec * uSunColor;
        lit = mix(lit, w, water);
      }

      // Sparse tie points at 2-3 views, a dense cloud at 4-5, then a surface that sharpens.
      vec2 cell = floor(vWorld.xz / 0.6);
      vec2 local = fract(vWorld.xz / 0.6) - 0.5;
      float density = mix(0.08, 1.0, smoothstep(2.0, 5.0, cov));
      float isPoint = step(hash(cell), density) * (1.0 - smoothstep(0.16, 0.3, length(local)));
      float solid = smoothstep(4.5, 6.5, cov);
      vec3 recon = mix(col, lit, max(isPoint, solid));
      col = mix(col, recon, uCaptured);
    }

    // Camera footprint of the drone, with a flash on each shot.
    vec2 fd = abs(vWorld.xz - uDrone) - uFootprint;
    float box = max(fd.x, fd.y);
    float inside = step(box, 0.0);
    float edge = 1.0 - smoothstep(0.0, 1.6 * fwidth(box), abs(box));
    col = mix(col, uAccent, inside * (0.05 + uFlash * 0.06) + edge * 0.9);

    if (uCursorOn > 0.5) {
      vec2 dc = vWorld.xz - uCursor.xz;
      float r = length(dc);
      float ring = 1.0 - smoothstep(0.0, 1.5 * fwidth(r), abs(r - 3.0));
      float axis = min(abs(dc.x), abs(dc.y));
      float cross_ = (1.0 - smoothstep(0.0, 1.2 * fwidth(axis), axis)) * step(r, 6.0) * step(1.0, r);
      col = mix(col, uAccent, max(ring, cross_ * 0.8));
    }

    float half_ = uSize * 0.5;
    float edgeFade = smoothstep(half_, half_ * 0.82, max(abs(vWorld.x), abs(vWorld.z)));
    float fog = smoothstep(uFogNear, uFogFar, vViewDist);
    col = mix(uBg, col, edgeFade * (1.0 - fog));
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
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

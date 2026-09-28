import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  SIZE, loadTerrain, buildTerrainGeometry, buildHeightTexture, buildRiverTexture, rayHeightfield,
} from './terrain.js';
import { terrainVertex, terrainFragment, starVertex, starFragment } from './shaders.js';
import { buildDrone, animateDrone } from './drone.js';
import { sunPosition, directionFrom } from './sun.js';

// 75 % front and side overlap, as in a real mapping flight.
const OVERLAP = 0.75;
const SURVEY = 220;
const FOOTPRINT = new THREE.Vector2(22, 15.4);
const STRIPS = Math.round(SURVEY / (FOOTPRINT.x * 2 * (1 - OVERLAP)));
const SHOT_SPACING = FOOTPRINT.y * 2 * (1 - OVERLAP);
const SHOTS_PER_STRIP = Math.floor(SURVEY / SHOT_SPACING) + 1;
const SCAN_SECONDS_PER_STRIP = 4.5;
const SCAN_HEAD_START = 7.4;
const SITE = { lat: 44.3683, lon: -121.1394 };
const FALLBACK_SUN = { azimuth: 235, altitude: 26 };
const MOON = { azimuth: 125, altitude: 38 };

function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(value || '#000');
}

function buildStars(count) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = Math.random() * 0.9 + 0.03;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 1200, y * 1200, Math.sin(theta) * r * 1200], i * 3);
    sizes[i] = Math.random() ** 3 * 2.6 + 0.8;
    phases[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return geometry;
}

// Footprint centre at a point in flight order (strip index + fraction along it).
function surveyPosition(scan, out = new THREE.Vector2()) {
  const stripW = SURVEY / STRIPS;
  const s = Math.min(STRIPS - 1, Math.floor(scan));
  const a = Math.min(1, scan - s);
  const along = s % 2 === 0 ? a : 1 - a;
  return out.set(-SURVEY / 2 + (s + 0.5) * stripW, -SURVEY / 2 + along * SURVEY);
}

// Camera poses as pyramids: apex at the lens, base toward the ground.
function buildCameraPoses() {
  const geo = new THREE.ConeGeometry(0.55, 0.7, 4, 1, true);
  geo.rotateY(Math.PI / 4);
  geo.translate(0, -0.35, 0);
  const mat = new THREE.MeshBasicMaterial({ wireframe: true, transparent: true, opacity: 0.45, depthWrite: false });
  const mesh = new THREE.InstancedMesh(geo, mat, STRIPS * SHOTS_PER_STRIP);
  mesh.count = 0;
  mesh.frustumCulled = false;
  return mesh;
}

export async function createScene(canvas, { reducedMotion, labelLayer, onCursor, onSun, onSurvey }) {
  const terrain = await loadTerrain();
  const mobile = matchMedia('(max-width: 720px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 4000);
  // OrbitControls drive the rig. The rendered camera blends from the rig to a top-down view on scroll.
  const rig = new THREE.PerspectiveCamera(42, 1, 0.3, 4000);

  let running = true;
  let scheduled = false;
  function schedule() {
    if (running && !scheduled) {
      scheduled = true;
      requestAnimationFrame(frame);
    }
  }

  // A small preview first, then the full image once the map is on screen.
  const loader = new THREE.TextureLoader();
  function orthoTexture(url, onLoad) {
    const tex = loader.load(url, onLoad);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }
  const ortho = orthoTexture('/terrain/ortho-preview.webp', () => schedule());

  const sunDir = new THREE.Vector3(0, 1, 0);
  const uniforms = {
    uHeight: { value: buildHeightTexture(terrain) },
    uOrtho: { value: ortho },
    uRiver: { value: buildRiverTexture(terrain) },
    uTexel: { value: 1 / (terrain.n - 1) },
    uElevToWorld: { value: terrain.elevToWorld },
    uMinElev: { value: terrain.meta.minElev },
    uSize: { value: SIZE },
    uSurvey: { value: SURVEY },
    uStrips: { value: STRIPS },
    uShotSpacing: { value: SHOT_SPACING },
    uShotsPerStrip: { value: SHOTS_PER_STRIP },
    uScan: { value: 0 },
    uCaptured: { value: 1 },
    uFlash: { value: 0 },
    uDrone: { value: new THREE.Vector2() },
    uFootprint: { value: FOOTPRINT },
    uCursor: { value: new THREE.Vector3() },
    uCursorOn: { value: 0 },
    uSunDir: { value: sunDir },
    uSunColor: { value: new THREE.Color() },
    uAmbient: { value: new THREE.Color() },
    uNight: { value: 0 },
    uTime: { value: 0 },
    uFogNear: { value: 260 },
    uFogFar: { value: 900 },
    uBg: { value: new THREE.Color() },
    uPaper: { value: new THREE.Color() },
    uInk: { value: new THREE.Color() },
    uIndex: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() },
    uWaterMap: { value: new THREE.Color() },
    uShadowSteps: { value: mobile ? 24 : 48 },
  };

  const ground = new THREE.Mesh(
    buildTerrainGeometry(terrain, mobile ? 4 : 2),
    new THREE.ShaderMaterial({ uniforms, vertexShader: terrainVertex, fragmentShader: terrainFragment }),
  );
  scene.add(ground);

  const stars = new THREE.Points(buildStars(mobile ? 700 : 1800), new THREE.ShaderMaterial({
    uniforms: {
      uTime: uniforms.uTime,
      uPixelRatio: { value: renderer.getPixelRatio() },
      uNight: uniforms.uNight,
      uColor: { value: new THREE.Color('#f3ead8') },
    },
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
  }));
  scene.add(stars);

  const hemi = new THREE.HemisphereLight(0xdfe8f2, 0x6b5a45, 1.1);
  const sunLight = new THREE.DirectionalLight(0xffffff, 2.2);
  scene.add(hemi, sunLight);

  const drone = buildDrone();
  drone.scale.setScalar(2.6);
  scene.add(drone);

  const frustumGeo = new THREE.BufferGeometry();
  frustumGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const frustum = new THREE.LineSegments(frustumGeo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.6 }));
  scene.add(frustum);

  const poses = buildCameraPoses();
  scene.add(poses);

  // Labels are HTML so they stay crisp. Occlusion uses the height field, not the mesh.
  const labelDefs = terrain.meta.labels.map((l) => {
    const [x, z] = terrain.toWorld(l.x, l.z);
    return { ...l, pos: new THREE.Vector3(x, terrain.heightAt(x, z), z) };
  });
  {
    let best = null;
    for (const path of terrain.meta.river) {
      for (const [xm, zm] of path) {
        const d = Math.hypot(xm + 780, zm + 380);
        if (!best || d < best.d) best = { d, xm, zm };
      }
    }
    if (best) {
      const [x, z] = terrain.toWorld(best.xm, best.zm);
      labelDefs.push({ name: 'Crooked River', kind: 'water', pos: new THREE.Vector3(x, terrain.heightAt(x, z), z) });
    }
  }
  const labels = labelDefs.map((def) => {
    const el = document.createElement('div');
    el.className = `map-label map-label--${def.kind}`;
    const stack = document.createElement('div');
    stack.className = 'map-label__stack';
    const name = document.createElement('span');
    name.className = 'map-label__name';
    name.textContent = def.name;
    stack.append(name);
    if (def.elev) {
      const elev = document.createElement('span');
      elev.className = 'map-label__elev';
      elev.textContent = `${Math.round(def.elev)} m NAVD88`;
      stack.append(elev);
    }
    el.append(stack);
    labelLayer?.append(el);
    return { ...def, el, visible: true };
  });

  const controls = new OrbitControls(rig, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.panSpeed = 0.8;
  controls.zoomSpeed = 0.9;
  controls.minDistance = 25;
  controls.maxDistance = 520;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.screenSpacePanning = false;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = -0.35;
  // One finger scrolls the page. Two fingers orbit and zoom.
  controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
  canvas.style.touchAction = 'pan-y';

  const home = { target: new THREE.Vector3(-12, 8, -6), offset: new THREE.Vector3(115, 78, 120) };
  const homeScale = mobile ? 1.45 : 1;
  controls.target.copy(home.target);
  rig.position.copy(home.target).addScaledVector(home.offset, homeScale);
  controls.update();

  let flight = null;
  let resumeTimer = 0;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    flight = null;
    clearTimeout(resumeTimer);
  });
  controls.addEventListener('end', () => {
    clearTimeout(resumeTimer);
    if (!reducedMotion) resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 12000);
  });
  controls.addEventListener('change', () => schedule());

  // Plain wheel scrolls the page. Ctrl, cmd, or a trackpad pinch zooms the map.
  addEventListener('wheel', (e) => {
    if (e.target === canvas && !e.ctrlKey && !e.metaKey) e.stopPropagation();
  }, { capture: true, passive: true });

  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  let pointer = null;

  function pick(ndc) {
    raycaster.setFromCamera(ndc, camera);
    return rayHeightfield(terrain, raycaster.ray.origin, raycaster.ray.direction, 2000);
  }

  function flyTo(toTarget, toPos) {
    controls.autoRotate = false;
    flight = {
      t0: performance.now(),
      fromTarget: controls.target.clone(),
      fromPos: rig.position.clone(),
      toTarget,
      toPos,
    };
    schedule();
  }

  canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    const hit = pick(ndc);
    if (!hit) return;
    const offset = rig.position.clone().sub(controls.target).setLength(55);
    flyTo(hit.clone(), hit.clone().add(offset));
  });

  // Shift-click two points to measure between them over the lidar surface.
  const MEASURE_SAMPLES = 200;
  const measureLine = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(MEASURE_SAMPLES * 3), 3)),
    new THREE.LineBasicMaterial({ depthTest: false, transparent: true }),
  );
  measureLine.renderOrder = 10;
  measureLine.visible = false;
  const markerGeo = new THREE.SphereGeometry(0.9, 16, 12);
  const markers = [0, 1].map(() => {
    const m = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ depthTest: false }));
    m.renderOrder = 11;
    m.visible = false;
    scene.add(m);
    return m;
  });
  scene.add(measureLine);
  const measureEl = document.createElement('div');
  measureEl.className = 'measure-label is-hidden';
  labelLayer?.append(measureEl);
  const measurePts = [];
  let measureMid = null;

  function fmtM(v) {
    return `${v.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`;
  }

  function runMeasure() {
    const [a, b] = measurePts;
    const pos = measureLine.geometry.attributes.position;
    let surface = 0;
    let prev = null;
    for (let i = 0; i < MEASURE_SAMPLES; i++) {
      const t = i / (MEASURE_SAMPLES - 1);
      const x = a.x + (b.x - a.x) * t;
      const z = a.z + (b.z - a.z) * t;
      pos.setXYZ(i, x, terrain.heightAt(x, z) + 0.25, z);
      // Real metres, without the display exaggeration.
      const cur = { x: x * terrain.metersPerUnit, z: z * terrain.metersPerUnit, h: terrain.elevationAt(x, z) };
      if (prev) surface += Math.hypot(cur.x - prev.x, cur.z - prev.z, cur.h - prev.h);
      prev = cur;
    }
    pos.needsUpdate = true;
    measureLine.geometry.computeBoundingSphere();
    measureLine.visible = true;
    const horiz = Math.hypot(b.x - a.x, b.z - a.z) * terrain.metersPerUnit;
    const dh = terrain.elevationAt(b.x, b.z) - terrain.elevationAt(a.x, a.z);
    const slope = Math.hypot(horiz, dh);
    measureEl.textContent = `surface ${fmtM(surface)}\nslope   ${fmtM(slope)}\nhoriz   ${fmtM(horiz)}\nΔh      ${dh >= 0 ? '+' : '−'}${fmtM(Math.abs(dh))}`;
    measureMid = new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    measureMid.y = terrain.heightAt(measureMid.x, measureMid.z);
    measureEl.classList.remove('is-hidden');
  }

  function clearMeasure() {
    measurePts.length = 0;
    measureLine.visible = false;
    markers.forEach((m) => { m.visible = false; });
    measureEl.classList.add('is-hidden');
    measureMid = null;
    schedule();
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!e.shiftKey || !downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
    const rect = canvas.getBoundingClientRect();
    const hit = pick(new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1));
    if (!hit) return;
    if (measurePts.length === 2) clearMeasure();
    measurePts.push(hit.clone());
    const m = markers[measurePts.length - 1];
    m.position.copy(hit);
    m.visible = true;
    if (measurePts.length === 2) runMeasure();
    schedule();
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') clearMeasure(); });

  let night = false;
  let sunInfo = null;

  function updateSun() {
    const live = sunPosition(new Date(), SITE.lat, SITE.lon);
    let used;
    let mode;
    if (night) {
      used = MOON;
      mode = 'night';
    } else if (live.altitude > 2) {
      used = live;
      mode = 'live';
    } else {
      used = FALLBACK_SUN;
      mode = 'fallback';
    }
    directionFrom(used.azimuth, used.altitude, sunDir);
    const warm = 1 - THREE.MathUtils.smoothstep(used.altitude, 4, 30);
    if (night) {
      uniforms.uSunColor.value.setRGB(0.32, 0.38, 0.52);
      uniforms.uAmbient.value.setRGB(0.1, 0.12, 0.18);
    } else {
      uniforms.uSunColor.value.setRGB(1.0, 0.97 - warm * 0.25, 0.92 - warm * 0.45);
      uniforms.uAmbient.value.setRGB(0.36, 0.4, 0.48);
    }
    sunLight.position.copy(sunDir).multiplyScalar(100);
    sunLight.color.copy(uniforms.uSunColor.value);
    sunLight.intensity = night ? 0.6 : 2.4;
    hemi.intensity = night ? 0.25 : 1.1;
    sunInfo = { mode, azimuth: live.azimuth, altitude: live.altitude };
    onSun?.(sunInfo);
    schedule();
  }

  function applyPalette() {
    night = document.documentElement.dataset.scheme === 'dark';
    uniforms.uNight.value = night ? 1 : 0;
    uniforms.uBg.value.copy(cssColor('--bg'));
    uniforms.uPaper.value.copy(cssColor('--map-paper'));
    uniforms.uInk.value.copy(cssColor('--map-contour'));
    uniforms.uIndex.value.copy(cssColor('--map-index'));
    uniforms.uAccent.value.copy(cssColor('--accent'));
    uniforms.uWaterMap.value.copy(cssColor('--map-water'));
    renderer.setClearColor(uniforms.uBg.value);
    frustum.material.color.copy(uniforms.uAccent.value);
    poses.material.color.copy(uniforms.uAccent.value);
    measureLine.material.color.copy(uniforms.uAccent.value);
    markers.forEach((m) => m.material.color.copy(uniforms.uAccent.value));
    updateSun();
  }
  applyPalette();
  setInterval(updateSun, 60000);

  let scroll = 0;
  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    for (const cam of [camera, rig]) {
      cam.aspect = w / h;
      cam.fov = cam.aspect < 0.8 ? 55 : 42;
      cam.updateProjectionMatrix();
    }
    schedule();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const nadirPos = new THREE.Vector3();
  const helper = new THREE.PerspectiveCamera();
  function updateCamera() {
    if (flight) {
      const k = THREE.MathUtils.smootherstep((performance.now() - flight.t0) / 1400, 0, 1);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      rig.position.lerpVectors(flight.fromPos, flight.toPos, k);
      if (k >= 1) flight = null;
    }
    const moving = controls.update();
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -SIZE * 0.45, SIZE * 0.45);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -SIZE * 0.45, SIZE * 0.45);
    const floor = terrain.heightAt(rig.position.x, rig.position.z) + 4;
    if (rig.position.y < floor) rig.position.y = floor;

    const k = THREE.MathUtils.smootherstep(scroll, 0, 1);
    nadirPos.set(0, camera.aspect < 0.8 ? 420 : 250, 18);
    helper.position.copy(nadirPos);
    helper.lookAt(0, 0, 0);
    camera.position.lerpVectors(rig.position, nadirPos, k);
    camera.quaternion.slerpQuaternions(rig.quaternion, helper.quaternion, k);
    camera.updateMatrixWorld();
    return moving || flight !== null;
  }

  const dronePos = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const fp = new THREE.Vector2();
  const tmp = new THREE.Vector2();
  const poseMatrix = new THREE.Matrix4();
  let shots = 0;
  let lastScan = 0;
  let lastReported = -1;

  function flightAltitude(x, z) {
    return Math.max(terrain.elevToWorld * 150 + 28, terrain.heightAt(x, z) + 22);
  }

  function updateSurvey(t, dt) {
    const cycle = STRIPS + 2;
    const p = reducedMotion ? STRIPS * 0.62 : (t / SCAN_SECONDS_PER_STRIP + SCAN_HEAD_START) % cycle;
    const scan = Math.min(p, STRIPS);
    uniforms.uScan.value = scan;
    // After the last strip: hold the finished map, then fade it and fly home.
    const fade = THREE.MathUtils.clamp(p - (STRIPS + 1), 0, 1);
    uniforms.uCaptured.value = 1 - fade;
    poses.material.opacity = 0.45 * (1 - fade);

    if (scan < lastScan) {
      shots = 0;
      poses.count = 0;
    }
    lastScan = scan;

    if (fade > 0) surveyPosition(0, fp).lerp(surveyPosition(STRIPS, tmp), 1 - fade);
    else surveyPosition(scan, fp);
    const goalY = flightAltitude(fp.x, fp.y);
    prevPos.copy(dronePos);
    if (dronePos.lengthSq() === 0) dronePos.set(fp.x, goalY, fp.y);
    const follow = reducedMotion ? 1 : 1 - Math.exp(-dt * 3.5);
    dronePos.x += (fp.x - dronePos.x) * follow;
    dronePos.z += (fp.y - dronePos.z) * follow;
    dronePos.y += (goalY - dronePos.y) * follow;
    drone.position.copy(dronePos);
    drone.position.y += Math.sin(t * 2.1) * 0.15;
    vel.copy(dronePos).sub(prevPos);
    if (vel.lengthSq() > 1e-6) {
      const heading = Math.atan2(-vel.x, -vel.z);
      const turn = ((heading - drone.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      drone.rotation.y += turn * Math.min(1, dt * 5);
    }
    animateDrone(drone, t);

    // One camera pose every SHOT_SPACING along the flight line.
    const strip = Math.floor(scan);
    const taken = strip >= STRIPS
      ? STRIPS * SHOTS_PER_STRIP
      : strip * SHOTS_PER_STRIP + Math.min(SHOTS_PER_STRIP, Math.floor(((scan % 1) * SURVEY) / SHOT_SPACING) + 1);
    while (fade === 0 && shots < taken) {
      const s = Math.floor(shots / SHOTS_PER_STRIP);
      const a = Math.min(0.999, ((shots % SHOTS_PER_STRIP) * SHOT_SPACING) / SURVEY);
      surveyPosition(s + a, tmp);
      poseMatrix.makeTranslation(tmp.x, flightAltitude(tmp.x, tmp.y) + 1.5, tmp.y);
      poses.setMatrixAt(shots, poseMatrix);
      shots++;
      poses.count = shots;
      poses.instanceMatrix.needsUpdate = true;
      if (!reducedMotion) uniforms.uFlash.value = 1;
    }
    uniforms.uFlash.value *= Math.exp(-dt * 8);
    if (shots !== lastReported) {
      lastReported = shots;
      onSurvey?.({ photos: shots, strip: Math.min(STRIPS, strip + 1), strips: STRIPS, overlap: OVERLAP });
    }

    uniforms.uDrone.value.set(dronePos.x, dronePos.z);
    const pos = frustumGeo.attributes.position;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
      const cx = dronePos.x + sx * FOOTPRINT.x;
      const cz = dronePos.z + sz * FOOTPRINT.y;
      pos.setXYZ(i * 2, drone.position.x, drone.position.y - 0.8, drone.position.z);
      pos.setXYZ(i * 2 + 1, cx, terrain.heightAt(cx, cz), cz);
    });
    pos.needsUpdate = true;
  }

  let lastCursorEmit = 0;
  function updateCursor(t) {
    if (!pointer) {
      uniforms.uCursorOn.value = 0;
      return;
    }
    const hit = pick(pointerNdc);
    uniforms.uCursorOn.value = hit ? 1 : 0;
    if (!hit) {
      onCursor?.(null);
      return;
    }
    uniforms.uCursor.value.copy(hit);
    if (t - lastCursorEmit > 0.04) {
      lastCursorEmit = t;
      const ll = terrain.toLatLon(hit.x, hit.z);
      const navd88 = terrain.elevationAt(hit.x, hit.z);
      onCursor?.({ lat: ll.lat, lon: ll.lon, navd88, grs80: navd88 + ll.geoidN, clientX: pointer.x, clientY: pointer.y });
    }
  }

  const projected = new THREE.Vector3();
  const rayDir = new THREE.Vector3();
  let frameNo = 0;
  function updateLabels() {
    if (!labelLayer) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const hideAll = scroll > 0.35;
    frameNo++;
    if (measureMid) {
      projected.copy(measureMid).project(camera);
      const on = projected.z < 1 && !hideAll;
      measureEl.classList.toggle('is-hidden', !on);
      measureEl.style.transform = `translate3d(${((projected.x * 0.5 + 0.5) * w).toFixed(1)}px, ${((-projected.y * 0.5 + 0.5) * h).toFixed(1)}px, 0)`;
    }
    for (const label of labels) {
      projected.copy(label.pos).project(camera);
      const onScreen = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      if (frameNo % 6 === 0 && onScreen) {
        rayDir.copy(label.pos).sub(camera.position);
        const dist = rayDir.length();
        rayDir.normalize();
        const hit = rayHeightfield(terrain, camera.position, rayDir, dist);
        label.visible = !hit || hit.distanceTo(label.pos) < 3;
      }
      label.el.classList.toggle('is-hidden', !(onScreen && label.visible && !hideAll));
      if (onScreen) {
        const x = (projected.x * 0.5 + 0.5) * w;
        const y = (-projected.y * 0.5 + 0.5) * h;
        label.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      }
    }
  }

  const t0 = performance.now();
  let lastT = 0;
  function frame() {
    scheduled = false;
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    const dt = Math.min(0.1, t - lastT);
    lastT = t;
    uniforms.uTime.value = t;
    stars.rotation.y = t * 0.004;
    const cameraMoving = updateCamera();
    updateSurvey(t, dt);
    updateCursor(t);
    updateLabels();
    renderer.render(scene, camera);
    if (!reducedMotion || cameraMoving) schedule();
  }
  schedule();
  const loadFullOrtho = () => {
    const full = orthoTexture('/terrain/ortho.webp', () => {
      uniforms.uOrtho.value = full;
      ortho.dispose();
      schedule();
    });
  };
  if ('requestIdleCallback' in window) requestIdleCallback(loadFullOrtho, { timeout: 1500 });
  else setTimeout(loadFullOrtho, 300);

  return {
    start() {
      running = true;
      schedule();
    },
    stop() {
      running = false;
    },
    setScroll(v) {
      scroll = v;
      controls.enabled = v < 0.5;
      schedule();
    },
    setPointer(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      pointer = { x: clientX, y: clientY };
      schedule();
    },
    clearPointer() {
      pointer = null;
      onCursor?.(null);
      schedule();
    },
    applyPalette,
    goHome() {
      flyTo(home.target.clone(), home.target.clone().addScaledVector(home.offset, homeScale));
    },
    corners: terrain.meta.corners,
  };
}

import * as THREE from 'three';
import {
  SIZE, HEIGHT_SCALE, MIN_ELEV_M, MAX_ELEV_M,
  buildHeightGrid, heightAt, elevationMeters,
} from './terrain.js';
import { terrainVertex, terrainFragment, starVertex, starFragment } from './shaders.js';

const STRIPS = 5;
const SURVEY = 200;
const SCAN_SECONDS_PER_STRIP = 9;
const SCAN_HEAD_START = 1.4;
const FLIGHT_ALT = HEIGHT_SCALE * 1.2;
const FOOTPRINT = new THREE.Vector2(SURVEY / STRIPS / 2, SURVEY * 0.07);

// Survey area in the real world, so cursor readouts look like Bend-area coordinates.
const BBOX = { west: -121.78, east: -121.56, south: 43.93, north: 44.09 };

function cssColor(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(value || '#000');
}

function buildTerrainGeometry(segments) {
  const n = segments + 1;
  const heights = buildHeightGrid(segments);
  const positions = new Float32Array(n * n * 3);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      positions[k * 3] = (i / segments - 0.5) * SIZE;
      positions[k * 3 + 1] = heights[k] * HEIGHT_SCALE;
      positions[k * 3 + 2] = (j / segments - 0.5) * SIZE;
    }
  }
  const index = [];
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildDrone(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color });
  group.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 1.4), mat));
  const arm = new THREE.BoxGeometry(4.2, 0.15, 0.25);
  for (const angle of [Math.PI / 4, -Math.PI / 4]) {
    const m = new THREE.Mesh(arm, mat);
    m.rotation.y = angle;
    group.add(m);
  }
  const rotorGeo = new THREE.RingGeometry(0.55, 0.85, 24);
  rotorGeo.rotateX(-Math.PI / 2);
  const rotors = [];
  for (const [x, z] of [[1.5, 1.5], [-1.5, 1.5], [1.5, -1.5], [-1.5, -1.5]]) {
    const r = new THREE.Mesh(rotorGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
    }));
    r.position.set(x, 0.25, z);
    group.add(r);
    rotors.push(r);
  }
  group.userData.rotors = rotors;
  group.scale.setScalar(1.3);
  return group;
}

function buildStars(count) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const y = Math.random() * 0.9 + 0.02;
    const r = Math.sqrt(1 - y * y);
    positions.set([Math.cos(theta) * r * 900, y * 900, Math.sin(theta) * r * 900], i * 3);
    sizes[i] = Math.random() ** 3 * 2.6 + 0.8;
    phases[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return geometry;
}

// Where the drone's footprint centre is at a given point in flight order.
function surveyPosition(scan) {
  const stripW = SURVEY / STRIPS;
  const s = Math.min(STRIPS - 1, Math.floor(scan));
  const a = Math.min(1, scan - s);
  const along = s % 2 === 0 ? a : 1 - a;
  return new THREE.Vector2(-SURVEY / 2 + (s + 0.5) * stripW, -SURVEY / 2 + along * SURVEY);
}

export function toLatLon(x, z) {
  const u = x / SIZE + 0.5;
  const v = z / SIZE + 0.5;
  return {
    lat: BBOX.north - v * (BBOX.north - BBOX.south),
    lon: BBOX.west + u * (BBOX.east - BBOX.west),
  };
}

export function createScene(canvas, { reducedMotion, onCursor }) {
  const mobile = matchMedia('(max-width: 720px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 2000);

  const uniforms = {
    uHeightScale: { value: HEIGHT_SCALE },
    uSize: { value: SIZE },
    uSurvey: { value: SURVEY },
    uStrips: { value: STRIPS },
    uScan: { value: 0 },
    uCaptured: { value: 1 },
    uDrone: { value: new THREE.Vector2() },
    uFootprint: { value: FOOTPRINT },
    uCursor: { value: new THREE.Vector3() },
    uCursorOn: { value: 0 },
    uMinElev: { value: MIN_ELEV_M },
    uMaxElev: { value: MAX_ELEV_M },
    uNight: { value: 0 },
    uFogNear: { value: 240 },
    uFogFar: { value: 560 },
    uBg: { value: new THREE.Color() },
    uPaper: { value: new THREE.Color() },
    uInk: { value: new THREE.Color() },
    uIndex: { value: new THREE.Color() },
    uAccent: { value: new THREE.Color() },
  };

  const terrain = new THREE.Mesh(
    buildTerrainGeometry(mobile ? 180 : 320),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      extensions: { derivatives: true },
    }),
  );
  scene.add(terrain);

  const starUniforms = {
    uTime: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uNight: uniforms.uNight,
    uColor: { value: new THREE.Color('#f3ead8') },
  };
  const stars = new THREE.Points(buildStars(mobile ? 700 : 1600), new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: starVertex,
    fragmentShader: starFragment,
    transparent: true,
    depthWrite: false,
  }));
  scene.add(stars);

  const drone = buildDrone(0xffffff);
  scene.add(drone);

  const frustumGeo = new THREE.BufferGeometry();
  frustumGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const frustum = new THREE.LineSegments(frustumGeo, new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 }));
  scene.add(frustum);

  function applyPalette() {
    const dark = document.documentElement.dataset.scheme === 'dark';
    uniforms.uNight.value = dark ? 1 : 0;
    uniforms.uBg.value.copy(cssColor('--bg'));
    uniforms.uPaper.value.copy(cssColor('--map-paper'));
    uniforms.uInk.value.copy(cssColor('--map-contour'));
    uniforms.uIndex.value.copy(cssColor('--map-index'));
    uniforms.uAccent.value.copy(cssColor('--accent'));
    renderer.setClearColor(uniforms.uBg.value);
    drone.traverse((o) => o.material?.color?.copy(uniforms.uAccent.value));
    frustum.material.color.copy(uniforms.uAccent.value);
  }
  applyPalette();

  const pointer = new THREE.Vector2(0, 0);
  const pointerNdc = new THREE.Vector2();
  let pointerActive = false;
  let scroll = 0;
  const raycaster = new THREE.Raycaster();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.8 ? 58 : 42;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const oblique = new THREE.Vector3();
  const nadir = new THREE.Vector3();
  const target = new THREE.Vector3();
  const dronePos = new THREE.Vector3();
  const cursorHit = new THREE.Vector3();
  let lastCursorEmit = 0;

  function updateCamera(t) {
    const orbit = reducedMotion ? 0.35 : 0.35 + Math.sin(t * 0.03) * 0.25;
    const radius = camera.aspect < 0.8 ? 330 : 250;
    oblique.set(Math.sin(orbit) * radius, 95, Math.cos(orbit) * radius);
    nadir.set(0, camera.aspect < 0.8 ? 380 : 215, 20);
    const k = THREE.MathUtils.smootherstep(scroll, 0, 1);
    camera.position.lerpVectors(oblique, nadir, k);
    camera.position.x += pointer.x * 10 * (1 - k);
    camera.position.y += pointer.y * 6 * (1 - k);
    target.set(0, HEIGHT_SCALE * 0.25 * (1 - k), 0);
    camera.lookAt(target);
  }

  function updateSurvey(t) {
    const cycle = STRIPS + 2;
    const p = reducedMotion ? STRIPS * 0.62 : (t / SCAN_SECONDS_PER_STRIP + SCAN_HEAD_START) % cycle;
    const scan = Math.min(p, STRIPS);
    uniforms.uScan.value = scan;
    // After the last strip: hold the finished map, then fade it and fly home.
    const fade = THREE.MathUtils.clamp(p - (STRIPS + 1), 0, 1);
    uniforms.uCaptured.value = 1 - fade;

    const fp = fade > 0 ? surveyPosition(0).lerp(surveyPosition(STRIPS), 1 - fade) : surveyPosition(scan);
    const goal = new THREE.Vector3(fp.x, FLIGHT_ALT + HEIGHT_SCALE * 0.05, fp.y);
    if (dronePos.lengthSq() === 0) dronePos.copy(goal);
    dronePos.lerp(goal, reducedMotion ? 1 : 0.06);
    drone.position.copy(dronePos);
    drone.position.y += Math.sin(t * 2.1) * 0.25;
    drone.rotation.y = Math.sin(t * 0.7) * 0.05;
    for (const r of drone.userData.rotors) r.material.opacity = 0.35 + 0.3 * Math.abs(Math.sin(t * 40 + r.position.x));

    uniforms.uDrone.value.set(dronePos.x, dronePos.z);
    const pos = frustumGeo.attributes.position;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    corners.forEach(([sx, sz], i) => {
      const cx = dronePos.x + sx * FOOTPRINT.x;
      const cz = dronePos.z + sz * FOOTPRINT.y;
      pos.setXYZ(i * 2, drone.position.x, drone.position.y - 0.4, drone.position.z);
      pos.setXYZ(i * 2 + 1, cx, heightAt(cx, cz) * HEIGHT_SCALE, cz);
    });
    pos.needsUpdate = true;
  }

  function updateCursor(t) {
    if (!pointerActive) {
      uniforms.uCursorOn.value = 0;
      return;
    }
    raycaster.setFromCamera(pointerNdc, camera);
    const hit = raycaster.intersectObject(terrain, false)[0];
    uniforms.uCursorOn.value = hit ? 1 : 0;
    if (!hit) {
      onCursor?.(null);
      return;
    }
    cursorHit.copy(hit.point);
    uniforms.uCursor.value.copy(cursorHit);
    if (t - lastCursorEmit > 0.05) {
      lastCursorEmit = t;
      const { lat, lon } = toLatLon(cursorHit.x, cursorHit.z);
      onCursor?.({ lat, lon, elev: elevationMeters(cursorHit.y / HEIGHT_SCALE) });
    }
  }

  let running = true;
  let scheduled = false;
  const t0 = performance.now();
  function schedule() {
    if (running && !scheduled) {
      scheduled = true;
      requestAnimationFrame(frame);
    }
  }
  function frame() {
    scheduled = false;
    if (!running) return;
    const t = (performance.now() - t0) / 1000;
    starUniforms.uTime.value = t;
    stars.rotation.y = t * 0.004;
    updateCamera(t);
    updateSurvey(t);
    updateCursor(t);
    renderer.render(scene, camera);
    if (!reducedMotion) schedule();
  }

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
      schedule();
    },
    setPointer(x, y, clientX, clientY) {
      pointer.set(x, y);
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      pointerActive = true;
      schedule();
    },
    clearPointer() {
      pointerActive = false;
      onCursor?.(null);
      schedule();
    },
    applyPalette() {
      applyPalette();
      schedule();
    },
  };
}

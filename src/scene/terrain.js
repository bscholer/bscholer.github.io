import * as THREE from 'three';

// World units across the terrain. The real extent comes from meta.json.
export const SIZE = 320;
export const EXAGGERATION = 1.3;

export async function loadTerrain(base = '/terrain') {
  const [meta, buffer] = await Promise.all([
    fetch(`${base}/meta.json`).then((r) => r.json()),
    fetch(`${base}/smith-rock.u16`).then((r) => {
      if (!r.ok) throw new Error(`terrain fetch ${r.status}`);
      return r.arrayBuffer();
    }),
  ]);
  const n = meta.grid;
  const raw = new Uint16Array(buffer);
  const metersPerUnit = meta.extent / SIZE;
  const elevToWorld = EXAGGERATION / metersPerUnit;

  // Height above the lowest point, in metres. Row 0 is the north edge.
  const heights = new Float32Array(n * n);
  for (let i = 0; i < raw.length; i++) heights[i] = raw[i] / 10 - meta.minElev;

  const cell = SIZE / (n - 1);
  function heightMeters(x, z) {
    const fx = THREE.MathUtils.clamp((x + SIZE / 2) / cell, 0, n - 1.001);
    const fz = THREE.MathUtils.clamp((z + SIZE / 2) / cell, 0, n - 1.001);
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    const k = j * n + i;
    const top = heights[k] * (1 - tx) + heights[k + 1] * tx;
    const bottom = heights[k + n] * (1 - tx) + heights[k + n + 1] * tx;
    return top * (1 - tz) + bottom * tz;
  }

  // Corners NW, NE, SW, SE. Bilinear across all four keeps the grid convergence.
  const [nw, ne, sw, se] = meta.corners;
  const bilinear = (u, v, a, b, c, d) => (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;

  return {
    meta,
    n,
    heights,
    elevToWorld,
    metersPerUnit,
    heightAt: (x, z) => heightMeters(x, z) * elevToWorld,
    elevationAt: (x, z) => heightMeters(x, z) + meta.minElev,
    toWorld: (xm, zm) => [xm / metersPerUnit, zm / metersPerUnit],
    toLatLon(x, z) {
      const u = x / SIZE + 0.5;
      const v = z / SIZE + 0.5;
      return {
        lon: bilinear(u, v, nw[0], ne[0], sw[0], se[0]),
        lat: bilinear(u, v, nw[1], ne[1], sw[1], se[1]),
        geoidN: bilinear(u, v, ...meta.geoidN),
      };
    },
  };
}

export function buildTerrainGeometry(terrain, step) {
  const { n, heights, elevToWorld } = terrain;
  const segs = Math.floor((n - 1) / step);
  const m = segs + 1;
  const positions = new Float32Array(m * m * 3);
  const uvs = new Float32Array(m * m * 2);
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const k = j * m + i;
      const src = j * step * n + i * step;
      positions[k * 3] = (i / segs - 0.5) * SIZE;
      positions[k * 3 + 1] = heights[src] * elevToWorld;
      positions[k * 3 + 2] = (j / segs - 0.5) * SIZE;
      uvs[k * 2] = i / segs;
      uvs[k * 2 + 1] = j / segs;
    }
  }
  const index = new Uint32Array(segs * segs * 6);
  let p = 0;
  for (let j = 0; j < segs; j++) {
    for (let i = 0; i < segs; i++) {
      const a = j * m + i;
      const b = a + 1;
      const c = a + m;
      const d = c + 1;
      index.set([a, c, b, b, c, d], p);
      p += 6;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(index, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

// Half-float so WebGL2 can filter it linearly without an extension.
export function buildHeightTexture(terrain) {
  const { n, heights } = terrain;
  const data = new Uint16Array(n * n);
  for (let i = 0; i < data.length; i++) data[i] = THREE.DataUtils.toHalfFloat(heights[i]);
  const tex = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.HalfFloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// River mask drawn from the NHD centreline at the river's real width.
export function buildRiverTexture(terrain, widthMeters = 22, px = 2048) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  const scale = px / terrain.meta.extent;
  const half = terrain.meta.extent / 2;
  ctx.filter = 'blur(2px)';
  ctx.strokeStyle = '#fff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = widthMeters * scale;
  for (const path of terrain.meta.river) {
    ctx.beginPath();
    path.forEach(([x, z], i) => {
      const cx = (x + half) * scale;
      const cz = (z + half) * scale;
      if (i === 0) ctx.moveTo(cx, cz);
      else ctx.lineTo(cx, cz);
    });
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = false;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

// March a ray over the height field. Returns the hit point or null.
export function rayHeightfield(terrain, origin, dir, maxDist = 900) {
  let t = 0;
  let prevT = 0;
  let step = 0.8;
  const p = new THREE.Vector3();
  while (t < maxDist) {
    p.copy(origin).addScaledVector(dir, t);
    if (Math.abs(p.x) > SIZE / 2 + 1 || Math.abs(p.z) > SIZE / 2 + 1) {
      if (dir.y > 0 && p.y > 200) return null;
    } else if (p.y <= terrain.heightAt(p.x, p.z)) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        p.copy(origin).addScaledVector(dir, mid);
        if (p.y <= terrain.heightAt(p.x, p.z)) hi = mid;
        else lo = mid;
      }
      return p.copy(origin).addScaledVector(dir, hi);
    }
    prevT = t;
    t += step;
    step = Math.min(step * 1.02, 3);
  }
  return null;
}

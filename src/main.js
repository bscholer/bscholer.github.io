import '@fontsource-variable/fraunces/full.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './style.css';
import { createScene } from './scene/scene.js';

const root = document.documentElement;
const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = document.getElementById('terrain');

function resolveScheme() {
  const forced = root.dataset.theme;
  root.dataset.scheme = forced || (darkQuery.matches ? 'dark' : 'light');
}
resolveScheme();

document.querySelector('.year').textContent = new Date().getFullYear();

const readout = document.querySelector('.readout');
const readoutValue = readout.querySelector('.readout__value');
const tip = document.querySelector('.cursor-tip');
const sunLine = document.querySelector('.sun-line');
const surveyLine = document.querySelector('.survey-line');

function deg(value, pos, neg) {
  return `${Math.abs(value).toFixed(5)}° ${value >= 0 ? pos : neg}`;
}

function dms(value, pos, neg) {
  const a = Math.abs(value);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  return `${d}°${String(m).padStart(2, '0')}′${String(s).padStart(2, '0')}″${value >= 0 ? pos : neg}`;
}

function showCursor(info) {
  readout.classList.toggle('is-live', Boolean(info));
  tip.classList.toggle('is-live', Boolean(info));
  if (!info) {
    readoutValue.textContent = '';
    return;
  }
  readoutValue.textContent = `${deg(info.lat, 'N', 'S')}\n${deg(info.lon, 'E', 'W')}`;
  tip.textContent = `grs80:  ${info.grs80.toFixed(1)} m\nnavd88: ${info.navd88.toFixed(1)} m`;
  tip.style.transform = `translate3d(${info.clientX + 16}px, ${info.clientY + 16}px, 0)`;
}

function showSun(sun) {
  const where = `az ${Math.round(sun.azimuth)}°, alt ${Math.round(sun.altitude)}°`;
  sunLine.textContent = {
    live: `Sun at Smith Rock now: ${where}`,
    fallback: `Sun is down at Smith Rock (${where}). Showing afternoon light.`,
    night: 'Night view. Moonlight is not live.',
  }[sun.mode];
}

function showSurvey(s) {
  const pct = Math.round(s.overlap * 100);
  surveyLine.textContent = `Strip ${s.strip}/${s.strips} · ${s.photos} photos · ${pct}% front, ${pct}% side overlap`;
}

let scene = null;

function wireScene(s) {
  scene = s;
  const [nw, ne, sw, se] = s.corners;
  for (const [cls, [lon, lat]] of [['tl', nw], ['tr', ne], ['bl', sw], ['br', se]]) {
    document.querySelector(`.tick.${cls}`).innerHTML = `${dms(lat, 'N', 'S')}<br>${dms(lon, 'E', 'W')}`;
  }
  root.classList.add('scene-ready');

  const onScroll = () => s.setScroll(Math.min(1, scrollY / (innerHeight * 1.1)));
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || e.buttons) {
      s.clearPointer();
      return;
    }
    s.setPointer(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerleave', () => s.clearPointer());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) s.stop();
    else s.start();
  });
}

createScene(canvas, {
  reducedMotion,
  labelLayer: document.querySelector('.labels'),
  onCursor: showCursor,
  onSun: showSun,
  onSurvey: showSurvey,
}).then(wireScene).catch((err) => {
  // No WebGL or no terrain data: the page still reads fine on the plain background.
  console.warn('Terrain disabled:', err);
});

document.querySelector('.theme-toggle').addEventListener('click', () => {
  const next = root.dataset.scheme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch {}
  resolveScheme();
  scene?.applyPalette();
});

darkQuery.addEventListener('change', () => {
  resolveScheme();
  scene?.applyPalette();
});

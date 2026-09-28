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

function resolveScheme() {
  const forced = root.dataset.theme;
  root.dataset.scheme = forced || (darkQuery.matches ? 'dark' : 'light');
}
resolveScheme();

document.querySelector('.year').textContent = new Date().getFullYear();

const readout = document.querySelector('.readout');
const readoutValue = readout.querySelector('.readout__value');

function fmt(value, pos, neg) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? pos : neg}`;
}

function showCursor(info) {
  readout.classList.toggle('is-live', Boolean(info));
  readoutValue.textContent = info
    ? `${fmt(info.lat, 'N', 'S')}  ${fmt(info.lon, 'E', 'W')}\nElev ${Math.round(info.elev).toLocaleString()} m`
    : '';
}

let scene = null;
try {
  scene = createScene(document.getElementById('terrain'), { reducedMotion, onCursor: showCursor });
  scene.start();
} catch (err) {
  // No WebGL: the page still reads fine on the plain background.
  console.warn('Terrain disabled:', err);
}

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

if (scene) {
  const onScroll = () => scene.setScroll(Math.min(1, scrollY / (innerHeight * 1.1)));
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const overUi = e.target.closest('.legend, .sheet, .title-block a, button');
    if (overUi) {
      scene.clearPointer();
      return;
    }
    scene.setPointer((e.clientX / innerWidth) * 2 - 1, -((e.clientY / innerHeight) * 2 - 1), e.clientX, e.clientY);
  });
  document.addEventListener('pointerleave', () => scene.clearPointer());

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) scene.stop();
    else scene.start();
  });
}

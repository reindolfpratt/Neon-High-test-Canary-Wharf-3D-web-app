import * as THREE from 'three';
import './style.css';
import { createProceduralTextures } from './scene/textures';
import { buildWaterAndTerrain } from './scene/waterAndTerrain';
import { buildStreetscape } from './scene/streetscape';
import { buildCanaryWharfBuildings } from './scene/buildings';
import { buildTrafficSystem } from './scene/traffic';
import { buildCrowdSystem } from './scene/crowds';
import { EnvironmentController } from './scene/environment';
import { PlayerController } from './controls/playerController';
import { CityAudioEngine } from './audio/cityAudio';
import { MinimapOverlay } from './ui/minimap';
import {
  QualityPreset,
  TimeOfDay,
  VIEWPOINTS,
  getZoneName
} from './scene/layout';

const viewportShell = document.getElementById('viewport-shell') as HTMLDivElement;
const canvas = document.getElementById('scene-canvas') as HTMLCanvasElement;
const zoneBadge = document.getElementById('zone-badge') as HTMLSpanElement;
const altBadge = document.getElementById('alt-badge') as HTMLSpanElement;
const fpsBadge = document.getElementById('fps-badge') as HTMLSpanElement;

const btnTod = document.getElementById('btn-tod') as HTMLButtonElement;
const btnMode = document.getElementById('btn-mode') as HTMLButtonElement;
const btnQuality = document.getElementById('btn-quality') as HTMLButtonElement;
const btnDof = document.getElementById('btn-dof') as HTMLButtonElement;
const btnAudio = document.getElementById('btn-audio') as HTMLButtonElement;
const btnHelp = document.getElementById('btn-help') as HTMLButtonElement;
const btnEnter = document.getElementById('btn-enter') as HTMLButtonElement;
const btnOrbitStart = document.getElementById('btn-orbit-start') as HTMLButtonElement;
const overlay = document.getElementById('welcome-overlay') as HTMLElement;
const minimapCanvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;

// 1. WebGL2 High-Precision HDR Renderer
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // Handled cleanly by EffectComposer + SMAA pass
  powerPreference: 'high-performance'
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// 2. Scene & Human-Scale Perspective Camera (1 unit = 1 meter, eye height = 1.7m)
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.15,
  1400
);

// Start at hero Cabot Square street-level vantage framing One Canada Square, DLR, and Fountain!
const startVp = VIEWPOINTS[0];
camera.position.set(...startVp.position);
camera.lookAt(...startVp.lookAt);

// 3. Build Canary Wharf Systems Incrementally
const textures = createProceduralTextures();

const waterTerrain = buildWaterAndTerrain(textures);
scene.add(waterTerrain.group);

const streetscape = buildStreetscape(textures);
scene.add(streetscape.group);

const buildings = buildCanaryWharfBuildings(textures);
scene.add(buildings.group);

const traffic = buildTrafficSystem(streetscape.signalLights, textures);
scene.add(traffic.group);

const crowds = buildCrowdSystem(220);
scene.add(crowds.group);

// 4. Lighting, Physically-Based Sky, Real Skyline IBL & GT6 Post-Processing Pipeline
const env = new EnvironmentController(renderer, scene, camera);

function syncEnvironmentLook(): void {
  waterTerrain.setWaterAppearance(
    env.sunDirection,
    env.sunColor,
    env.waterColor,
    env.waterDistortion
  );
  // Pre-warm building & lamp emissive factors before baking CubeCamera IBL so reflections match Time of Day!
  buildings.update(0, env.nightFactor);
  streetscape.update(0, 0.016, env.nightFactor);
  for (const bm of waterTerrain.bridgeLights) {
    bm.emissiveIntensity = 0.25 + env.nightFactor * 2.4;
  }
  env.bakeSkylineReflections();
}
syncEnvironmentLook();

// 5. Controls, Colliders, Audio & Minimap
const allBoxes = [...waterTerrain.colliders, ...streetscape.colliders, ...buildings.colliders];
const player = new PlayerController(camera, canvas, allBoxes, streetscape.cylColliders);
const audio = new CityAudioEngine();
const minimap = new MinimapOverlay(minimapCanvas);

// 6. HUD Wiring
const todLabel = (t: TimeOfDay): string =>
  t === 'day' ? 'Day (N)' : t === 'golden' ? 'Golden Hour (N)' : 'Night (N)';

const qualityLabel = (q: QualityPreset): string =>
  q === 'low' ? 'Low (Q)' : q === 'high' ? 'High (Q)' : 'Ultra (Q)';

function refreshHUD(): void {
  btnTod.textContent = todLabel(env.timeOfDay);
  btnMode.textContent =
    player.mode === 'walk' ? 'Walk (F)' : player.mode === 'fly' ? 'Fly (F)' : 'Orbit (F)';
  btnQuality.textContent = qualityLabel(env.quality);
  btnDof.setAttribute('aria-pressed', String(env.dofEnabled));
  btnAudio.textContent = audio.muted ? 'Sound Off (M)' : 'Sound On (M)';
  btnAudio.setAttribute('aria-pressed', String(!audio.muted));
}
refreshHUD();

player.onLockChange = (locked) => {
  document.body.classList.toggle('locked', locked);
  if (locked) {
    overlay.classList.add('hidden');
    audio.startOnGesture();
  }
};
player.onModeChange = () => refreshHUD();

btnEnter.addEventListener('click', () => {
  overlay.classList.add('hidden');
  audio.setMuted(false);
  refreshHUD();
  player.lock();
});

btnOrbitStart.addEventListener('click', () => {
  overlay.classList.add('hidden');
  player.setMode('orbit');
  refreshHUD();
});

canvas.addEventListener('click', () => {
  if (player.mode !== 'orbit' && !player.isLocked && overlay.classList.contains('hidden')) {
    player.lock();
  }
});

btnTod.addEventListener('click', () => {
  env.cycleTimeOfDay();
  syncEnvironmentLook();
  refreshHUD();
});

btnMode.addEventListener('click', () => {
  player.cycleMode();
  refreshHUD();
});

btnQuality.addEventListener('click', () => {
  const order: QualityPreset[] = ['low', 'high', 'ultra'];
  const next = order[(order.indexOf(env.quality) + 1) % order.length];
  env.setQuality(next);
  refreshHUD();
});

btnDof.addEventListener('click', () => {
  env.toggleDoF();
  refreshHUD();
});

btnAudio.addEventListener('click', () => {
  audio.toggle();
  refreshHUD();
});

btnHelp.addEventListener('click', () => {
  if (player.isLocked) player.unlock();
  overlay.classList.toggle('hidden');
});

document.querySelectorAll<HTMLButtonElement>('.vp-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.vp;
    const vp = VIEWPOINTS.find((v) => v.id === id);
    if (!vp) return;
    overlay.classList.add('hidden');
    player.teleport(vp.position, vp.lookAt, Boolean(vp.fly));
    refreshHUD();
  });
});

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyN') {
    env.cycleTimeOfDay();
    syncEnvironmentLook();
    refreshHUD();
  } else if (e.code === 'KeyF') {
    player.cycleMode();
    refreshHUD();
  } else if (e.code === 'KeyQ') {
    const order: QualityPreset[] = ['low', 'high', 'ultra'];
    const next = order[(order.indexOf(env.quality) + 1) % order.length];
    env.setQuality(next);
    refreshHUD();
  } else if (e.code === 'KeyB') {
    env.toggleDoF();
    refreshHUD();
  } else if (e.code === 'KeyM') {
    audio.toggle();
    refreshHUD();
  } else if (e.code === 'KeyH') {
    if (player.isLocked) player.unlock();
    overlay.classList.toggle('hidden');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  env.resize(window.innerWidth, window.innerHeight);
});

// 7. Efficient Background Processing (pause WebGL loop when skipped/hidden)
let paused = false;
let rafId = 0;

function setPaused(shouldPause: boolean): void {
  if (paused === shouldPause) return;
  paused = shouldPause;
  if (paused) {
    cancelAnimationFrame(rafId);
  } else {
    lastTime = performance.now();
    rafId = requestAnimationFrame(animate);
  }
}

document.addEventListener('visibilitychange', () => {
  setPaused(document.hidden);
});

viewportShell.addEventListener('contentvisibilityautostatechange', (ev: Event) => {
  const skipped = (ev as Event & { skipped?: boolean }).skipped;
  if (typeof skipped === 'boolean') {
    setPaused(skipped);
  }
});

// 8. Main Real-Time Simulation & HDR Render Loop
let lastTime = performance.now();
let elapsed = 0;
let fpsFrames = 0;
let fpsTimer = 0;
const lookDir = new THREE.Vector3();

function animate(now: number): void {
  if (paused) return;
  rafId = requestAnimationFrame(animate);

  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) * 0.001));
  lastTime = now;
  elapsed += dt;

  player.update(dt);
  waterTerrain.update(dt);
  streetscape.update(elapsed, dt, env.nightFactor);
  buildings.update(elapsed, env.nightFactor);
  traffic.update(elapsed, dt, env.nightFactor);
  crowds.update(elapsed, dt);
  audio.updateSpatialAmbience(camera.position.x, camera.position.z);

  env.render();

  // Telemetry & Minimap updates
  fpsFrames++;
  fpsTimer += dt;
  if (fpsTimer >= 0.4) {
    const fps = Math.round(fpsFrames / fpsTimer);
    fpsBadge.textContent = `${fps} FPS`;
    zoneBadge.textContent = getZoneName(camera.position.x, camera.position.z, camera.position.y);
    altBadge.textContent = `${camera.position.y.toFixed(1)} m`;
    fpsFrames = 0;
    fpsTimer = 0;
  }

  camera.getWorldDirection(lookDir);
  const yaw = Math.atan2(-lookDir.x, -lookDir.z);
  minimap.render(camera.position.x, camera.position.z, yaw, traffic.getVehiclePositions());
}

// Expose lightweight debug handle for automated visual QA & inspection
(window as unknown as Record<string, unknown>).__CANARY_WHARF__ = {
  setTimeOfDay: (mode: TimeOfDay) => {
    env.setTimeOfDay(mode, true);
    syncEnvironmentLook();
    refreshHUD();
  },
  setQuality: (q: QualityPreset) => {
    env.setQuality(q);
    refreshHUD();
  },
  teleport: (id: string) => {
    const vp = VIEWPOINTS.find((v) => v.id === id);
    if (vp) {
      overlay.classList.add('hidden');
      player.teleport(vp.position, vp.lookAt, Boolean(vp.fly));
      refreshHUD();
    }
  }
};

rafId = requestAnimationFrame(animate);

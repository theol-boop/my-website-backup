// tilt — step 1+2: isometric line-drawing scene + heavy rolling sphere on a fixed platform.
// Three.js draws, Rapier simulates. Units are metres, kilograms, seconds.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

// ---------------------------------------------------------------------------
// Tunable parameters (the panel edits these; saved per browser)
// ---------------------------------------------------------------------------
const PARAM_SPECS = [
  { group: 'world' },
  { key: 'gravity',   label: 'gravity',        min: 0,  max: 30,  step: 0.1,  def: 9.81, unit: 'm/s²' },
  { group: 'ball' },
  { key: 'mass',      label: 'mass',           min: 1,  max: 50,  step: 0.5,  def: 8,    unit: 'kg' },
  { key: 'friction',  label: 'grip (friction)',min: 0,  max: 2,   step: 0.05, def: 0.9 },
  { key: 'bounce',    label: 'bounce',         min: 0,  max: 1,   step: 0.05, def: 0.1 },
  { key: 'rollDamp',  label: 'rolling resistance', min: 0, max: 3, step: 0.05, def: 0.15 },
  { key: 'airDrag',   label: 'air drag',       min: 0,  max: 2,   step: 0.01, def: 0.02 },
  { group: 'steering' },
  { key: 'torque',    label: 'roll torque',    min: 0,  max: 150, step: 1,    def: 18,   unit: 'N·m' },
  { key: 'push',      label: 'push force',     min: 0,  max: 150, step: 1,    def: 8,    unit: 'N' },
  { key: 'maxSpeed',  label: 'top speed',      min: 1,  max: 30,  step: 0.5,  def: 7,    unit: 'm/s' },
  { key: 'brake',     label: 'brake (shift)',  min: 0,  max: 20,  step: 0.5,  def: 4 },
  { key: 'jump',      label: 'jump',           min: 0,  max: 12,  step: 0.1,  def: 4.5,  unit: 'm/s' },
];
const DEFAULTS = Object.fromEntries(PARAM_SPECS.filter(s => s.key).map(s => [s.key, s.def]));
const STORE_KEY = 'tilt.params.v1';
const params = { ...DEFAULTS };
try {
  const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
  for (const k in DEFAULTS) if (typeof saved[k] === 'number' && isFinite(saved[k])) params[k] = saved[k];
} catch (e) { /* storage unavailable: use defaults */ }
function saveParams() { try { localStorage.setItem(STORE_KEY, JSON.stringify(params)); } catch (e) {} }

// ---------------------------------------------------------------------------
// Fixed world dimensions
// ---------------------------------------------------------------------------
const PLATFORM = { size: 10, thick: 0.4 };          // 10 m square slab, top surface at y = 0
const BALL_R = 0.5;
const SPAWN = { x: 0, y: 2.5, z: 0 };
const FALL_LIMIT = -20;                             // below this, respawn
const DT = 1 / 120;                                 // physics step

// ---------------------------------------------------------------------------
// Rendering helpers: white faces + black edges
// ---------------------------------------------------------------------------
const INK = 0x000000, PAPER = 0xffffff, GRID = 0xa0a0a0;
const faceMat = new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const edgeMat = new THREE.LineBasicMaterial({ color: INK });
const gridMat = new THREE.LineBasicMaterial({ color: GRID });

function outlinedBox(w, h, d) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  g.add(new THREE.Mesh(geo, faceMat));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  return g;
}

function gridLines(size, spacing, y) {
  const pts = [];
  const h = size / 2;
  for (let v = -h + spacing; v < h - 1e-6; v += spacing) {
    pts.push(v, y, -h, v, y, h);
    pts.push(-h, y, v, h, y, v);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, gridMat);
}

function circleLine(radius, segments = 64) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineLoop(geo, edgeMat);
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(PAPER, 1);

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

// Platform: slab with grid on top, and a pivot post underneath (fixed for now; it becomes the tilt axis in step 3)
const platformVis = new THREE.Group();
const slab = outlinedBox(PLATFORM.size, PLATFORM.thick, PLATFORM.size);
slab.position.y = -PLATFORM.thick / 2;
platformVis.add(slab);
platformVis.add(gridLines(PLATFORM.size, 1, 0.002));
scene.add(platformVis);

const POST = { w: 0.6, h: 6 };
const postVis = outlinedBox(POST.w, POST.h, POST.w);
postVis.position.y = -PLATFORM.thick - POST.h / 2;
scene.add(postVis);

// Ball: white sphere, a black "inverted hull" silhouette, and three great circles so you can see it spin
const ballVis = new THREE.Group();
const ballBody = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), faceMat);
const ballHull = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32),
  new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
ballVis.add(ballBody, ballHull);
const ringR = BALL_R * 1.004;
const ringA = circleLine(ringR);                               // equator
const ringB = circleLine(ringR); ringB.rotation.x = Math.PI / 2; // meridian
const ringC = circleLine(ringR); ringC.rotation.z = Math.PI / 2; // meridian, perpendicular
ballVis.add(ringA, ringB, ringC);
scene.add(ballVis);

// Contact shadow: a faint disc dropped straight down onto whatever is below the ball
const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 0.9, 40),
  new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.12, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
scene.add(shadow);

// ---------------------------------------------------------------------------
// Camera: true isometric, rotatable in 90° steps (Q/E)
// ---------------------------------------------------------------------------
const ISO_ELEV = Math.atan(1 / Math.SQRT2);     // 35.264°
const CAM_DIST = 60;
let camYaw = Math.PI / 4, camYawTarget = camYaw;
const camTarget = new THREE.Vector3(0, -0.5, 0);
let unitsPerPixel = 0.02;

function placeCamera() {
  const c = Math.cos(ISO_ELEV);
  camera.position.set(
    camTarget.x + CAM_DIST * c * Math.sin(camYaw),
    camTarget.y + CAM_DIST * Math.sin(ISO_ELEV),
    camTarget.z + CAM_DIST * c * Math.cos(camYaw));
  camera.lookAt(camTarget);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  const aspect = w / h;
  // Keep the whole platform (≈ 14.1 m across in iso) in view with some margin
  const halfH = Math.max(7.5, 8.5 / aspect);
  const halfW = halfH * aspect;
  camera.left = -halfW; camera.right = halfW; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  unitsPerPixel = (2 * halfH) / h;
  // Silhouette thickness: ~1.5 css px regardless of zoom
  const s = 1 + (1.5 * unitsPerPixel) / BALL_R;
  ballHull.scale.setScalar(s);
}
window.addEventListener('resize', resize);
resize();
placeCamera();

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = new Set();
let jumpQueued = false;
const panel = document.getElementById('panel');

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', ' ', 'shift'].includes(k)) e.preventDefault();
  if (e.repeat) { keys.add(k); return; }
  keys.add(k);
  if (k === ' ') jumpQueued = true;
  if (k === 'q') camYawTarget -= Math.PI / 2;
  if (k === 'e') camYawTarget += Math.PI / 2;
  if (k === 'r') respawn();
  if (k === 't') togglePanel();
});
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function togglePanel(force) {
  panel.hidden = force === undefined ? !panel.hidden : !force;
}

// ---------------------------------------------------------------------------
// Tuning panel
// ---------------------------------------------------------------------------
const sliders = document.getElementById('sliders');
const sliderEls = {};
function fmt(spec, v) {
  const dec = spec.step < 0.1 ? 2 : spec.step < 1 ? 1 : 0;
  return v.toFixed(dec) + (spec.unit ? ' ' + spec.unit : '');
}
for (const spec of PARAM_SPECS) {
  if (spec.group) {
    const h = document.createElement('h3'); h.textContent = spec.group; sliders.appendChild(h); continue;
  }
  const row = document.createElement('div'); row.className = 'row';
  const id = 'p-' + spec.key;
  row.innerHTML = `<label for="${id}">${spec.label}</label><output></output>
    <input id="${id}" type="range" min="${spec.min}" max="${spec.max}" step="${spec.step}">`;
  const input = row.querySelector('input'), out = row.querySelector('output');
  input.value = params[spec.key]; out.textContent = fmt(spec, params[spec.key]);
  input.addEventListener('input', () => {
    params[spec.key] = parseFloat(input.value);
    out.textContent = fmt(spec, params[spec.key]);
    applyParams(); saveParams();
  });
  sliderEls[spec.key] = { input, out, spec };
  sliders.appendChild(row);
}
document.getElementById('tune-btn').addEventListener('click', () => togglePanel());
document.getElementById('panel-close').addEventListener('click', () => togglePanel(false));
document.getElementById('reset-ball').addEventListener('click', () => respawn());
document.getElementById('reset-defaults').addEventListener('click', () => {
  Object.assign(params, DEFAULTS);
  for (const k in sliderEls) {
    const s = sliderEls[k]; s.input.value = params[k]; s.out.textContent = fmt(s.spec, params[k]);
  }
  applyParams(); saveParams();
});

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------
await RAPIER.init();
document.getElementById('loading').remove();

const world = new RAPIER.World({ x: 0, y: -params.gravity, z: 0 });
world.timestep = DT;

// Platform (fixed for now)
const platformBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -PLATFORM.thick / 2, 0));
world.createCollider(
  RAPIER.ColliderDesc.cuboid(PLATFORM.size / 2, PLATFORM.thick / 2, PLATFORM.size / 2).setFriction(1).setRestitution(0.1),
  platformBody);

// Pivot post (fixed)
const postBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, postVis.position.y, 0));
world.createCollider(RAPIER.ColliderDesc.cuboid(POST.w / 2, POST.h / 2, POST.w / 2), postBody);

// Ball
const ballRb = world.createRigidBody(
  RAPIER.RigidBodyDesc.dynamic().setTranslation(SPAWN.x, SPAWN.y, SPAWN.z).setCcdEnabled(true).setCanSleep(false));
const ballCol = world.createCollider(RAPIER.ColliderDesc.ball(BALL_R), ballRb);

function applyParams() {
  world.gravity = { x: 0, y: -params.gravity, z: 0 };
  ballCol.setMass(params.mass);
  ballCol.setFriction(params.friction);
  ballCol.setRestitution(params.bounce);
  ballRb.setLinearDamping(params.airDrag);
  ballRb.setAngularDamping(params.rollDamp);
}
applyParams();

function respawn() {
  ballRb.setTranslation(SPAWN, true);
  ballRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballRb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  ballRb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
}

// Ground check: short ray straight down from the ball's centre
const downRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
function groundHit(maxDist) {
  const p = ballRb.translation();
  downRay.origin = { x: p.x, y: p.y, z: p.z };
  return world.castRayAndGetNormal(downRay, maxDist, true, undefined, undefined, undefined, ballRb);
}

let grounded = false;
const tmpFwd = new THREE.Vector3(), tmpRight = new THREE.Vector3(), tmpDir = new THREE.Vector3();

function physicsStep() {
  grounded = !!groundHit(BALL_R + 0.06);

  // Screen-relative steering: W = away from the camera, D = screen right
  tmpFwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  tmpRight.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
  tmpDir.set(0, 0, 0);
  if (keys.has('w')) tmpDir.add(tmpFwd);
  if (keys.has('s')) tmpDir.sub(tmpFwd);
  if (keys.has('d')) tmpDir.add(tmpRight);
  if (keys.has('a')) tmpDir.sub(tmpRight);

  if (tmpDir.lengthSq() > 0) {
    tmpDir.normalize();
    // Spin axis that rolls the ball along tmpDir: up × dir
    const ax = tmpDir.z, az = -tmpDir.x;
    const w = ballRb.angvel(), v = ballRb.linvel();
    const spinAlong = w.x * ax + w.z * az;                   // rad/s around that axis
    const maxSpin = params.maxSpeed / BALL_R;
    if (spinAlong < maxSpin) {
      ballRb.applyTorqueImpulse({ x: ax * params.torque * DT, y: 0, z: az * params.torque * DT }, true);
    }
    // A little direct shove, only with ground under the ball (no air control)
    const speedAlong = v.x * tmpDir.x + v.z * tmpDir.z;
    if (grounded && speedAlong < params.maxSpeed) {
      ballRb.applyImpulse({ x: tmpDir.x * params.push * DT, y: 0, z: tmpDir.z * params.push * DT }, true);
    }
  }

  // Brake: extra rolling resistance while shift is held
  ballRb.setAngularDamping(keys.has('shift') ? params.rollDamp + params.brake : params.rollDamp);

  if (jumpQueued) {
    jumpQueued = false;
    if (grounded) {
      const v = ballRb.linvel();
      const dv = Math.max(0, params.jump - v.y);           // jump sets upward speed, never stacks
      ballRb.applyImpulse({ x: 0, y: dv * params.mass, z: 0 }, true);
    }
  }

  world.step();

  if (ballRb.translation().y < FALL_LIMIT) respawn();
}

// ---------------------------------------------------------------------------
// Main loop: fixed-step physics, render every frame
// ---------------------------------------------------------------------------
const readout = document.getElementById('readout');
let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 0;

function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;                                    // tab was hidden: don't spiral
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 12) { physicsStep(); acc -= DT; n++; }
  if (n === 12) acc = 0;

  // Smooth camera turn
  camYaw += (camYawTarget - camYaw) * Math.min(1, dt * 10);
  if (Math.abs(camYawTarget - camYaw) < 1e-4) camYaw = camYawTarget;
  placeCamera();

  // Sync visuals
  const p = ballRb.translation(), q = ballRb.rotation();
  ballVis.position.set(p.x, p.y, p.z);
  ballVis.quaternion.set(q.x, q.y, q.z, q.w);

  const hit = groundHit(40);
  if (hit) {
    const h = hit.timeOfImpact;
    shadow.visible = true;
    shadow.position.set(p.x, p.y - h + 0.004, p.z);
    const k = Math.max(0, 1 - (h - BALL_R) / 6);
    shadow.material.opacity = 0.12 * k;
    shadow.scale.setScalar(0.6 + 0.4 * k);
  } else {
    shadow.visible = false;
  }

  renderer.render(scene, camera);

  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  const v = ballRb.linvel();
  const speed = Math.hypot(v.x, v.z);
  readout.textContent =
    `speed ${speed.toFixed(1)} m/s\n` +
    `height ${p.y.toFixed(2)} m\n` +
    `${grounded ? 'on ground' : 'airborne'}\n` +
    `${fps.toFixed(0)} fps`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

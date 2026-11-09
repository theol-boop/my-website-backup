// tilt — main: renderer, camera, input, the ball, the course run (checkpoints, timer), and the game loop.
// Three.js draws, Rapier simulates. Units are metres, kilograms, seconds.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { params, buildPanel } from 'tilt-params';
import { INK, PAPER, outlinedSphere, circleLine, updateOutlineScale } from 'tilt-draw';
import { buildCourse } from 'tilt-pieces';
import { COURSE } from 'tilt-course';

const BALL_R = 0.5;
const DT = 1 / 120;                                 // physics step

// ---------------------------------------------------------------------------
// Scene and camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(PAPER, 1);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);

// True isometric, rotatable in 90° steps (Q/E). The camera follows a target that chases the ball.
const ISO_ELEV = Math.atan(1 / Math.SQRT2);         // 35.264°
const CAM_DIST = 120;
let camYaw = Math.PI / 4, camYawTarget = camYaw;
const camTarget = new THREE.Vector3();
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
  // `zoom` is roughly how many metres fit across the narrower screen dimension
  const halfH = aspect >= 1 ? params.zoom / 2 : params.zoom / 2 / aspect;
  camera.left = -halfH * aspect; camera.right = halfH * aspect; camera.top = halfH; camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  unitsPerPixel = (2 * halfH) / h;
  updateOutlineScale(unitsPerPixel);
  xray.scale.setScalar(1 + (0.75 * unitsPerPixel) / BALL_R);
}

// ---------------------------------------------------------------------------
// Ball visuals: outlined sphere with three great circles, an x-ray outline, and a contact shadow
// ---------------------------------------------------------------------------
const ballVis = outlinedSphere(BALL_R);
const ringR = BALL_R * 1.004;
const ringA = circleLine(ringR);
const ringB = circleLine(ringR); ringB.rotation.x = Math.PI / 2;
const ringC = circleLine(ringR); ringC.rotation.z = Math.PI / 2;
ballVis.add(ringA, ringB, ringC);
scene.add(ballVis);

// X-ray: a dashed circle drawn on top of everything, facing the camera. Where the ball is visible it sits
// exactly on the solid silhouette; where something hides the ball, only the dashes show through.
const xray = (() => {
  const pts = [];
  for (let i = 0; i <= 72; i++) { const a = (i / 72) * Math.PI * 2; pts.push(Math.cos(a) * BALL_R, Math.sin(a) * BALL_R, 0); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: INK, dashSize: 0.11, gapSize: 0.09, depthTest: false, depthWrite: false }));
  line.computeLineDistances();
  line.renderOrder = 10;
  return line;
})();
scene.add(xray);

const shadow = new THREE.Mesh(new THREE.CircleGeometry(BALL_R * 0.9, 40),
  new THREE.MeshBasicMaterial({ color: INK, transparent: true, opacity: 0.12, depthWrite: false }));
scene.add(shadow);
const Z_AXIS = new THREE.Vector3(0, 0, 1), tmpNormal = new THREE.Vector3();

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = new Set();
let jumpQueued = false;
const panel = document.getElementById('panel');
const ARROWS = { arrowup: 'w', arrowleft: 'a', arrowdown: 's', arrowright: 'd' };
const keyName = (e) => { const k = e.key.toLowerCase(); return ARROWS[k] || k; };

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement) return;
  const k = keyName(e);
  if (['w', 'a', 's', 'd', ' ', 'shift'].includes(k)) e.preventDefault();
  keys.add(k);
  if (e.repeat) return;
  if (k === ' ') jumpQueued = true;
  if (k === 'q') camYawTarget -= Math.PI / 2;
  if (k === 'e') camYawTarget += Math.PI / 2;
  if (k === 'r') restartCourse();
  if (k === 'c') respawnAtCheckpoint();
  if (k === 't') togglePanel();
});
window.addEventListener('keyup', (e) => keys.delete(keyName(e)));
window.addEventListener('blur', () => keys.clear());
function togglePanel(force) { panel.hidden = force === undefined ? !panel.hidden : !force; }

// ---------------------------------------------------------------------------
// Physics world, course, ball
// ---------------------------------------------------------------------------
await RAPIER.init();
document.getElementById('loading').remove();

const world = new RAPIER.World({ x: 0, y: -params.gravity, z: 0 });
world.timestep = DT;
const staticBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

const bounds = { minY: Infinity };
const ctx = {
  world, scene, staticBody, params,
  extendBounds(p, size) { bounds.minY = Math.min(bounds.minY, p.y - size); },
};
const { gates, dynamic } = buildCourse(COURSE, ctx);
const FALL_LIMIT = bounds.minY - 12;
const checkpoints = gates;                                  // in course order: start, checkpoints..., finish
const platforms = dynamic.filter(d => d.type === 'tiltPlatform');

const SPAWN = new THREE.Vector3(...COURSE.spawn);
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
  for (const d of dynamic) d.applyParams && d.applyParams();
  resize();
}

// ---------------------------------------------------------------------------
// The run: checkpoints, falls, timer, finish
// ---------------------------------------------------------------------------
const run = { checkpoint: 0, falls: 0, started: false, finished: false, t0: 0, time: 0 };
const banner = document.getElementById('banner');

function placeBall(p) {
  ballRb.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
  ballRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
  ballRb.setAngvel({ x: 0, y: 0, z: 0 }, true);
  ballRb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  camTarget.set(p.x, p.y, p.z);
}
function respawnAtCheckpoint() {
  for (const d of dynamic) d.reset && d.reset();
  const cp = run.checkpoint > 0 ? checkpoints[run.checkpoint].pos.clone().setY(checkpoints[run.checkpoint].pos.y + 0.8) : SPAWN;
  placeBall(cp);
}
function restartCourse() {
  run.checkpoint = 0; run.falls = 0; run.started = false; run.finished = false; run.time = 0;
  for (const g of checkpoints) g.setReached(false);
  banner.hidden = true;
  respawnAtCheckpoint();
}
function fmtTime(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
function checkGates(p) {
  for (let i = run.checkpoint + 1; i < checkpoints.length; i++) {
    if (!checkpoints[i].contains(p)) continue;
    run.checkpoint = i;
    for (let j = 1; j <= i; j++) checkpoints[j].setReached(true);
    if (checkpoints[i].kind === 'finish' && !run.finished) {
      run.finished = true;
      banner.textContent = `finished in ${fmtTime(run.time)} · ${run.falls} fall${run.falls === 1 ? '' : 's'} · R to run again`;
      banner.hidden = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Ground contact: the most upward-facing contact under the ball (works on slopes, platforms and the cube)
// ---------------------------------------------------------------------------
function groundContact() {
  const c = ballRb.translation();
  let best = null, bestUp = 0.35;
  world.contactPairsWith(ballCol, (other) => {
    world.contactPair(ballCol, other, (m) => {
      for (let i = 0; i < m.numSolverContacts(); i++) {
        const p = m.solverContactPoint(i);
        const nx = c.x - p.x, ny = c.y - p.y, nz = c.z - p.z;
        const len = Math.hypot(nx, ny, nz) || 1;
        if (ny / len > bestUp) { bestUp = ny / len; best = { collider: other, point: { x: p.x, y: p.y, z: p.z } }; }
      }
    });
  });
  return best;
}

// Push whatever the ball stands on the opposite way when it pushes off (Newton's third law)
function reactOn(ground, ix, iy, iz) {
  const body = ground && ground.collider.parent();
  if (!body || !body.isDynamic()) return;
  body.applyImpulseAtPoint({ x: -ix, y: -iy, z: -iz }, ground.point, true);
}

// Shadow ray
const downRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
function castDown(maxDist) {
  const p = ballRb.translation();
  downRay.origin = { x: p.x, y: p.y, z: p.z };
  return world.castRayAndGetNormal(downRay, maxDist, true, undefined, undefined, undefined, ballRb);
}

// ---------------------------------------------------------------------------
// Physics step
// ---------------------------------------------------------------------------
let grounded = false;
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), dir = new THREE.Vector3();
function updateViewAxes() {
  fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  right.set(Math.cos(camYaw), 0, -Math.sin(camYaw));
}

function physicsStep() {
  const bp = ballRb.translation();
  for (const d of dynamic) d.preStep && d.preStep(DT, bp);
  const ground = groundContact();
  grounded = !!ground;

  // Screen-relative steering: W = up the screen, D = screen right
  updateViewAxes();
  dir.set(0, 0, 0);
  if (keys.has('w')) dir.add(fwd);
  if (keys.has('s')) dir.sub(fwd);
  if (keys.has('d')) dir.add(right);
  if (keys.has('a')) dir.sub(right);

  if (dir.lengthSq() > 0) {
    dir.normalize();
    if (!run.started) { run.started = true; run.t0 = performance.now(); }
    const ax = dir.z, az = -dir.x;                          // spin axis that rolls the ball along dir: up × dir
    const w = ballRb.angvel(), v = ballRb.linvel();
    if (w.x * ax + w.z * az < params.maxSpeed / BALL_R) {
      ballRb.applyTorqueImpulse({ x: ax * params.torque * DT, y: 0, z: az * params.torque * DT }, true);
    }
    if (grounded && v.x * dir.x + v.z * dir.z < params.maxSpeed) {
      const ix = dir.x * params.push * DT, iz = dir.z * params.push * DT;
      ballRb.applyImpulse({ x: ix, y: 0, z: iz }, true);
      reactOn(ground, ix, 0, iz);
    }
  }

  ballRb.setAngularDamping(keys.has('shift') ? params.rollDamp + params.brake : params.rollDamp);

  if (jumpQueued) {
    jumpQueued = false;
    if (grounded) {
      const dv = Math.max(0, params.jump - ballRb.linvel().y);
      ballRb.applyImpulse({ x: 0, y: dv * params.mass, z: 0 }, true);
      reactOn(ground, 0, dv * params.mass, 0);
    }
  }

  world.step();
  for (const d of dynamic) d.postStep && d.postStep();

  const p = ballRb.translation();
  checkGates(p);
  if (p.y < FALL_LIMIT) { run.falls++; respawnAtCheckpoint(); }
}

// ---------------------------------------------------------------------------
// HUD: tuning panel, readout, tilt dial
// ---------------------------------------------------------------------------
const resetToDefaults = buildPanel(document.getElementById('sliders'), applyParams);
document.getElementById('tune-btn').addEventListener('click', () => togglePanel());
document.getElementById('panel-close').addEventListener('click', () => togglePanel(false));
document.getElementById('reset-defaults').addEventListener('click', () => resetToDefaults());
document.getElementById('restart').addEventListener('click', () => restartCourse());
document.getElementById('to-checkpoint').addEventListener('click', () => respawnAtCheckpoint());

const readoutText = document.getElementById('readout-text');
const dial = document.getElementById('dial'), dctx = dial.getContext('2d');

// Tilt dial for the nearest awake platform: a top-down map turned to match the view; the dot is the downhill side.
function drawDial(pl) {
  dial.hidden = !pl;
  if (!pl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2), S = 64;
  if (dial.width !== S * dpr) { dial.width = dial.height = S * dpr; }
  dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dctx.clearRect(0, 0, S, S);
  const c = S / 2, R = S / 2 - 4;
  dctx.lineWidth = 1;
  dctx.strokeStyle = '#000';
  dctx.beginPath(); dctx.arc(c, c, R, 0, Math.PI * 2); dctx.stroke();
  dctx.strokeStyle = '#bbb';
  dctx.beginPath(); dctx.moveTo(c - R, c); dctx.lineTo(c + R, c); dctx.moveTo(c, c - R); dctx.lineTo(c, c + R); dctx.stroke();
  const { up, tiltAngle } = pl.state;
  const maxT = Math.max(1e-3, params.maxTilt * Math.PI / 180);
  const s = Math.hypot(up.x, up.z), f = Math.min(1, tiltAngle / maxT);
  let sx = 0, sy = 0;
  if (s > 1e-6) {
    const dx = up.x / s, dz = up.z / s;
    sx = dx * right.x + dz * right.z;
    sy = -(dx * fwd.x + dz * fwd.z);
  }
  const x = c + sx * f * R, y = c + sy * f * R;
  dctx.strokeStyle = '#000';
  dctx.beginPath(); dctx.moveTo(c, c); dctx.lineTo(x, y); dctx.stroke();
  dctx.fillStyle = '#000';
  dctx.beginPath(); dctx.arc(x, y, 3.5, 0, Math.PI * 2); dctx.fill();
}

// ---------------------------------------------------------------------------
// Main loop: fixed-step physics, render every frame
// ---------------------------------------------------------------------------
window.addEventListener('resize', resize);
applyParams();
restartCourse();
placeCamera();

let last = performance.now(), acc = 0, fpsT = 0, fpsN = 0, fps = 0;
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 12) { physicsStep(); acc -= DT; n++; }
  if (n === 12) acc = 0;
  if (run.started && !run.finished) run.time = (performance.now() - run.t0) / 1000;

  // Camera: turn smoothly; chase the ball with a little lag
  camYaw += (camYawTarget - camYaw) * Math.min(1, dt * 10);
  if (Math.abs(camYawTarget - camYaw) < 1e-4) camYaw = camYawTarget;
  const p = ballRb.translation(), q = ballRb.rotation();
  const k = 1 - Math.exp(-params.follow * dt);
  camTarget.x += (p.x - camTarget.x) * k;
  camTarget.y += (p.y - camTarget.y) * k;
  camTarget.z += (p.z - camTarget.z) * k;
  placeCamera();

  // Sync visuals
  for (const d of dynamic) d.sync && d.sync();
  ballVis.position.set(p.x, p.y, p.z);
  ballVis.quaternion.set(q.x, q.y, q.z, q.w);
  xray.position.set(p.x, p.y, p.z);
  xray.quaternion.copy(camera.quaternion);

  const hit = castDown(40);
  if (hit) {
    const h = hit.timeOfImpact;
    tmpNormal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    shadow.visible = true;
    shadow.quaternion.setFromUnitVectors(Z_AXIS, tmpNormal);
    shadow.position.set(p.x, p.y - h, p.z).addScaledVector(tmpNormal, 0.004);
    const f = Math.max(0, 1 - (h - BALL_R) / 6);
    shadow.material.opacity = 0.12 * f;
    shadow.scale.setScalar(0.6 + 0.4 * f);
  } else {
    shadow.visible = false;
  }

  renderer.render(scene, camera);

  // HUD
  updateViewAxes();
  const pl = platforms.find(d => d.state.awake);
  drawDial(pl);
  fpsN++; fpsT += dt;
  if (fpsT >= 0.5) { fps = fpsN / fpsT; fpsN = 0; fpsT = 0; }
  const v = ballRb.linvel();
  const lines = [
    `time ${fmtTime(run.time)}`,
    `checkpoint ${Math.min(run.checkpoint, checkpoints.length - 2)}/${checkpoints.length - 2}`,
    `falls ${run.falls}`,
    `speed ${Math.hypot(v.x, v.z).toFixed(1)} m/s`,
  ];
  if (pl) lines.unshift(`tilt ${(pl.state.tiltAngle * 180 / Math.PI).toFixed(1)}°` + (pl.state.cubeFalls ? ` · cube fell ${pl.state.cubeFalls}×` : ''));
  lines.push(`${fps.toFixed(0)} fps`);
  readoutText.textContent = lines.join('\n');

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Test hook: only with ?debug in the URL
if (new URLSearchParams(location.search).has('debug')) {
  window.__tilt = { ballRb, run, checkpoints, placeBall: (x, y, z) => placeBall(new THREE.Vector3(x, y, z)) };
}

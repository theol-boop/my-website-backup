// Course pieces. Each builder turns one entry of the course data into physics colliders plus line drawings.
// Static geometry all hangs off one fixed rigid body. Dynamic set pieces return an object with hooks that
// the main loop calls: preStep (before each physics step), postStep, sync (before drawing), reset, applyParams.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { outlinedBox, outlinedSphere, inkFaceMat, faceMat } from 'tilt-draw';

// Collision groups. The tilting platform never touches static course geometry or its own post:
// it may swing through them freely, and only balls and loose objects ride on it.
export const G = { STATIC: 0x0001, PLATFORM: 0x0002, POST: 0x0004 };
const groups = (member, filter) => (member << 16) | filter;
export const STATIC_GROUPS = groups(G.STATIC, 0xffff & ~G.PLATFORM);
const PLATFORM_GROUPS = groups(G.PLATFORM, 0xffff & ~(G.STATIC | G.POST));
const POST_GROUPS = groups(G.POST, 0xffff & ~G.PLATFORM);

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const UP = new THREE.Vector3(0, 1, 0), Y_AXIS = UP, Z_AXIS = new THREE.Vector3(0, 0, 1);
const IDQ = new THREE.Quaternion();
const rq = (q) => ({ x: q.x, y: q.y, z: q.z, w: q.w });

function staticBox(ctx, center, size, quat = IDQ, { grid = false, friction = 1 } = {}) {
  const [w, h, d] = size;
  ctx.world.createCollider(
    RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2)
      .setTranslation(center.x, center.y, center.z).setRotation(rq(quat))
      .setFriction(friction).setCollisionGroups(STATIC_GROUPS),
    ctx.staticBody);
  const vis = outlinedBox(w, h, d, { grid });
  vis.position.copy(center); vis.quaternion.copy(quat);
  ctx.scene.add(vis);
  ctx.extendBounds(center, Math.max(w, h, d));
  return vis;
}

// ---------------------------------------------------------------------------
// path: a run of track through a list of points. Segments must run along X or Z (so every turn is a sharp
// 90° corner). Each point gets a square pad; segments between pads can climb or drop (they become ramps).
// rails: false | true (low rails) — railH controls height, so tall rails make walled passages.
// ---------------------------------------------------------------------------
function path(spec, ctx) {
  const { width = 3, thick = 0.5, rails = true, railH = 0.5, railW = 0.2, capStart = false, capEnd = false } = spec;
  const pts = spec.points.map(V);
  const n = pts.length;
  const dirTo = (a, b) => {
    const d = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    if (Math.abs(d.x) > 1e-6 && Math.abs(d.z) > 1e-6) throw new Error(`path segment ${a.toArray()} → ${b.toArray()} is diagonal`);
    return d.normalize();
  };
  const SIDES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1)];

  // Pads
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const open = [];
    if (i > 0) open.push(dirTo(p, pts[i - 1]));
    if (i < n - 1) open.push(dirTo(p, pts[i + 1]));
    if (n > 1 && i === 0 && !capStart) open.push(dirTo(pts[1], p));          // track continues behind the start
    if (n > 1 && i === n - 1 && !capEnd) open.push(dirTo(pts[n - 2], p));     // ...and past the end
    staticBox(ctx, new THREE.Vector3(p.x, p.y - thick / 2, p.z), [width, thick, width], IDQ, { grid: true });
    if (!rails) continue;
    for (const s of SIDES) {
      if (open.some(o => o.dot(s) > 0.9)) continue;
      const c = p.clone().addScaledVector(s, width / 2 - railW / 2).addScaledVector(UP, railH / 2);
      const size = Math.abs(s.x) > 0 ? [railW, railH, width] : [width, railH, railW];
      staticBox(ctx, c, size);
    }
  }

  // Segments (flat or sloped) between pad edges
  for (let i = 0; i < n - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const d = dirTo(a, b);
    const horiz = Math.hypot(b.x - a.x, b.z - a.z);
    const L = horiz - width;
    if (L <= 1e-3) continue;
    const A = a.clone().addScaledVector(d, width / 2);
    const B = b.clone().addScaledVector(d, -width / 2);
    const dy = B.y - A.y;
    const S = Math.hypot(L, dy);
    const q = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.atan2(-d.z, d.x))
      .multiply(new THREE.Quaternion().setFromAxisAngle(Z_AXIS, Math.atan2(dy, L)));
    const normal = UP.clone().applyQuaternion(q);
    const across = Z_AXIS.clone().applyQuaternion(q);
    const mid = A.clone().add(B).multiplyScalar(0.5);
    staticBox(ctx, mid.clone().addScaledVector(normal, -thick / 2), [S, thick, width], q, { grid: true });
    if (!rails) continue;
    for (const side of [1, -1]) {
      const c = mid.clone().addScaledVector(across, side * (width / 2 - railW / 2)).addScaledVector(normal, railH / 2);
      staticBox(ctx, c, [S, railH, railW], q);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// gate: start / checkpoint / finish. Two posts and a crossbar standing across the track; the ball rolling
// through it is detected by `contains`. Reached gates turn solid black.
// ---------------------------------------------------------------------------
function gate(spec, ctx) {
  const { kind = 'checkpoint', dir = 'z', width = 3 } = spec;
  const pos = V(spec.pos);
  const H = 2.4, P = 0.16;
  const across = dir === 'z' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
  const g = new THREE.Group();
  g.position.copy(pos);
  const half = width / 2 + 0.25;
  const parts = [];
  for (const s of [1, -1]) {
    const post = outlinedBox(P, H, P);
    post.position.copy(across).multiplyScalar(s * half).setY(H / 2);
    g.add(post); parts.push(post);
  }
  const barLen = 2 * half + P;
  const bar = outlinedBox(dir === 'z' ? barLen : P, P, dir === 'z' ? P : barLen);
  bar.position.y = H;
  g.add(bar); parts.push(bar);
  if (kind === 'finish') {
    const bar2 = outlinedBox(dir === 'z' ? barLen : P, P, dir === 'z' ? P : barLen);
    bar2.position.y = H - 0.4;
    g.add(bar2); parts.push(bar2);
  }
  ctx.scene.add(g);
  return {
    kind, pos, dir, width,
    contains(p) {
      const along = dir === 'z' ? p.z - pos.z : p.x - pos.x;
      const side = dir === 'z' ? p.x - pos.x : p.z - pos.z;
      const up = p.y - pos.y;
      return Math.abs(along) < 0.8 && Math.abs(side) < width / 2 + 0.3 && up > -0.5 && up < 3;
    },
    setReached(on) { for (const part of parts) part.userData.face.material = on ? inkFaceMat : faceMat; },
  };
}

// ---------------------------------------------------------------------------
// tiltPlatform: a square slab balanced on a central pivot, tipped by whatever weight is on it, with a loose
// cube. It sits locked and level until the ball comes near, so the cube can't slide off before you arrive.
// ---------------------------------------------------------------------------
function tiltPlatform(spec, ctx) {
  const { size = 10, thick = 0.4, cube = [2.5, 0], wakeRadius = 8, cubeSize = 1 } = spec;
  const pos = V(spec.pos);                                   // centre of the top surface when level
  const pivot = pos.clone().setY(pos.y - thick / 2);
  const { world, scene, params } = ctx;

  // Drawing
  const vis = new THREE.Group();
  vis.position.copy(pivot);
  vis.add(outlinedBox(size, thick, size, { grid: true }));
  scene.add(vis);
  const POST = { w: 0.6, h: 6, top: pivot.y - 0.6 };
  const postVis = outlinedBox(POST.w, POST.h, POST.w);
  postVis.position.set(pivot.x, POST.top - POST.h / 2, pivot.z);
  scene.add(postVis);
  const knuckle = outlinedSphere(0.25);
  knuckle.position.set(pivot.x, pivot.y - 0.45, pivot.z);
  scene.add(knuckle);
  const cubeVis = outlinedBox(cubeSize, cubeSize, cubeSize);
  scene.add(cubeVis);
  ctx.extendBounds(pos, size);

  // Physics: a dynamic body pinned at its centre of mass (= the pivot). Tips on X and Z, never spins.
  const rb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pivot.x, pivot.y, pivot.z)
    .enabledTranslations(false, false, false)
    .setCanSleep(false));
  const col = world.createCollider(
    RAPIER.ColliderDesc.cuboid(size / 2, thick / 2, size / 2)
      .setFriction(1).setRestitution(0.1).setCollisionGroups(PLATFORM_GROUPS), rb);
  const postBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(postVis.position.x, postVis.position.y, postVis.position.z));
  world.createCollider(RAPIER.ColliderDesc.cuboid(POST.w / 2, POST.h / 2, POST.w / 2).setCollisionGroups(POST_GROUPS), postBody);

  // Cube: "Min" friction rule so its grip alone decides when it slides (tan(tilt) > grip)
  const cubeStart = new THREE.Vector3(pos.x + cube[0], pos.y + cubeSize / 2 + 0.01, pos.z + cube[1]);
  const cubeRb = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(cubeStart.x, cubeStart.y, cubeStart.z).setCcdEnabled(true).setCanSleep(false));
  const cubeCol = world.createCollider(
    RAPIER.ColliderDesc.cuboid(cubeSize / 2, cubeSize / 2, cubeSize / 2)
      .setRestitution(0).setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min), cubeRb);

  const state = { awake: false, tiltAngle: 0, up: new THREE.Vector3(0, 1, 0), cubeFalls: 0 };
  const q = new THREE.Quaternion();

  function lock(locked) { rb.setEnabledRotations(!locked, false, !locked, true); }
  function placeCube(y) {
    cubeRb.setTranslation({ x: cubeStart.x, y, z: cubeStart.z }, true);
    cubeRb.setLinvel({ x: 0, y: 0, z: 0 }, true);
    cubeRb.setAngvel({ x: 0, y: 0, z: 0 }, true);
    cubeRb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
  }
  function readTilt() {
    const r = rb.rotation();
    q.set(r.x, r.y, r.z, r.w);
    state.up.copy(UP).applyQuaternion(q);
    state.tiltAngle = Math.acos(Math.min(1, Math.max(-1, state.up.y)));
  }
  function forces(DT) {
    readTilt();
    const u = state.up, s = Math.hypot(u.x, u.z);
    const nx = s > 1e-6 ? -u.z / s : 0, nz = s > 1e-6 ? u.x / s : 0;   // axis that levels it
    const w = rb.angvel();
    let tx = params.spring * state.tiltAngle * nx - params.platDamp * w.x;
    let tz = params.spring * state.tiltAngle * nz - params.platDamp * w.z;
    const maxT = params.maxTilt * Math.PI / 180;
    if (state.tiltAngle > maxT) {
      const over = state.tiltAngle - maxT;
      tx += 6000 * over * nx; tz += 6000 * over * nz;
      const tipping = -(w.x * nx + w.z * nz);
      if (tipping > 0) rb.setAngvel({ x: w.x + tipping * nx, y: 0, z: w.z + tipping * nz }, true);
    }
    rb.applyTorqueImpulse({ x: tx * DT, y: 0, z: tz * DT }, true);
  }

  const self = {
    type: 'tiltPlatform', state, pos,
    applyParams() {
      col.setMass(params.platMass);
      cubeCol.setMass(params.cubeMass);
      cubeCol.setFriction(params.cubeGrip);
    },
    reset() {
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      lock(true);
      state.awake = false; state.cubeFalls = 0;
      placeCube(cubeStart.y);
      readTilt();
    },
    level() { rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true); rb.setAngvel({ x: 0, y: 0, z: 0 }, true); },
    preStep(DT, ballPos) {
      if (!state.awake) {
        const dx = ballPos.x - pos.x, dz = ballPos.z - pos.z;
        if (Math.hypot(dx, dz) < wakeRadius && Math.abs(ballPos.y - pos.y) < 4) { state.awake = true; lock(false); }
        else return;
      }
      forces(DT);
    },
    postStep() {
      if (cubeRb.translation().y < pos.y - 15) { state.cubeFalls++; placeCube(pos.y + 4); }
    },
    sync() {
      readTilt();
      vis.quaternion.copy(q);
      const cp = cubeRb.translation(), cq = cubeRb.rotation();
      cubeVis.position.set(cp.x, cp.y, cp.z);
      cubeVis.quaternion.set(cq.x, cq.y, cq.z, cq.w);
    },
  };
  self.applyParams();
  self.reset();
  return self;
}

const BUILDERS = { path, gate, tiltPlatform };

export function buildCourse(course, ctx) {
  const gates = [], dynamic = [];
  for (const spec of course.pieces) {
    const build = BUILDERS[spec.type];
    if (!build) throw new Error('unknown piece type: ' + spec.type);
    const out = build(spec, ctx);
    if (!out) continue;
    if (spec.type === 'gate') gates.push(out); else dynamic.push(out);
  }
  return { gates, dynamic };
}

// Course pieces. Each builder turns one entry of the course data into physics colliders plus line drawings.
// Static geometry all hangs off one fixed rigid body. Dynamic set pieces return an object with hooks that
// the main loop calls: preStep (before each physics step), postStep, sync (before drawing), reset, applyParams.

import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { outlinedBox, outlinedSphere, outlinedCylinder, outlinedMesh, greyLines, inkFaceMat, faceMat } from 'tilt-draw';

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
// strip: a solid ribbon of track swept along a curve. `at(u)` (u from 0 to 1) returns the centre of the
// top surface and the horizontal direction of travel. Built as a closed, outward-facing triangle mesh so
// Rapier can smooth over the internal edges (no bumps on curves). Returns sample points for drawing lines.
// ---------------------------------------------------------------------------
function strip(ctx, at, n, width, thick, { offset = 0, raise = 0, collide = true } = {}) {
  const pos = [], idx = [], rows = [];
  const tmpR = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const { c, t } = at(i / n);
    const r = tmpR.set(-t.z, 0, t.x).normalize();               // to the right of travel
    const mid = c.clone().addScaledVector(r, offset).addScaledVector(UP, raise);
    const TL = mid.clone().addScaledVector(r, -width / 2), TR = mid.clone().addScaledVector(r, width / 2);
    const BL = TL.clone().addScaledVector(UP, -thick), BR = TR.clone().addScaledVector(UP, -thick);
    const base = pos.length / 3;
    pos.push(...TL.toArray(), ...TR.toArray(), ...BL.toArray(), ...BR.toArray());
    rows.push({ base, TL, TR, BL, BR, r: r.clone(), t: t.clone(), c: mid });
  }
  const P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
  // Add a quad, flipping it if needed so its normal points along `out`
  function quad(a, b, c, d, out) {
    const nrm = P(b).sub(P(a)).cross(P(c).sub(P(a)));
    if (nrm.dot(out) < 0) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
  }
  for (let i = 0; i < n; i++) {
    const A = rows[i], B = rows[i + 1];
    const out = A.r.clone().add(B.r);
    quad(A.base + 0, A.base + 1, B.base + 1, B.base + 0, UP);                   // top
    quad(A.base + 2, B.base + 2, B.base + 3, A.base + 3, UP.clone().negate());  // bottom
    quad(A.base + 1, A.base + 3, B.base + 3, B.base + 1, out);                  // right side
    quad(A.base + 0, B.base + 0, B.base + 2, A.base + 2, out.clone().negate()); // left side
  }
  const f = rows[0], l = rows[n];
  quad(f.base + 0, f.base + 2, f.base + 3, f.base + 1, f.t.clone().negate());   // start cap
  quad(l.base + 0, l.base + 1, l.base + 3, l.base + 2, l.t);                    // end cap

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  ctx.scene.add(outlinedMesh(geo));
  if (collide) {
    ctx.world.createCollider(
      RAPIER.ColliderDesc.trimesh(new Float32Array(pos), new Uint32Array(idx), RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES)
        .setFriction(1).setCollisionGroups(STATIC_GROUPS),
      ctx.staticBody);
  }
  for (const r of rows) ctx.extendBounds(r.c, 1);
  return rows;
}

// A grey line across the top of a strip at fractional row position k (between sample rows)
function crossLine(rows, k, out) {
  const i = Math.min(rows.length - 2, Math.floor(k)), f = k - i;
  const a = rows[i], b = rows[i + 1];
  const L = a.TL.clone().lerp(b.TL, f), R = a.TR.clone().lerp(b.TR, f);
  out.push(L.x, L.y + 0.004, L.z, R.x, R.y + 0.004, R.z);
}

// Rails for a strip: two thin strips riding on its edges
function stripRails(ctx, at, n, width, { railH = 0.5, railW = 0.2, left = railH, right = railH } = {}) {
  if (left > 0) strip(ctx, at, n, railW, left, { offset: -(width / 2 - railW / 2), raise: left });
  if (right > 0) strip(ctx, at, n, railW, right, { offset: width / 2 - railW / 2, raise: right });
}

const DIRS = { '+x': [1, 0], '-x': [-1, 0], '+z': [0, 1], '-z': [0, -1] };

// ---------------------------------------------------------------------------
// hill: a smooth hump in a straight run of track (shape 'hump'), or a smooth climb from one level to
// another (shape 'rise'; negative height drops). Grey contour lines every 0.25 m of height, so steeper
// slopes show tighter lines. Starts and ends flat so it joins ordinary track without a kink.
// Steepest slope: hump atan(π·h/L), rise atan(π·h/2L).
// ---------------------------------------------------------------------------
function hill(spec, ctx) {
  const { length, height, width = 3, thick = 0.5, rails = true, railH = 0.5, shape = 'hump' } = spec;
  const start = V(spec.start);
  const [dx, dz] = DIRS[spec.dir];
  const t = new THREE.Vector3(dx, 0, dz);
  const n = Math.max(24, Math.ceil(length * 6));
  const at = (u) => ({
    c: start.clone().addScaledVector(t, length * u)
      .add(new THREE.Vector3(0, height * (1 - Math.cos((shape === 'rise' ? 1 : 2) * Math.PI * u)) / 2, 0)),
    t,
  });
  const rows = strip(ctx, at, n, width, thick);
  if (rails) stripRails(ctx, at, n, width, { railH });
  // Contours: wherever the surface crosses a 0.25 m level
  const lines = [], step = 0.25, top = Math.abs(height);
  for (let i = 0; i < n; i++) {
    const y0 = Math.abs(rows[i].c.y - start.y), y1 = Math.abs(rows[i + 1].c.y - start.y);
    for (let lev = step; lev < top; lev += step) {
      if ((y0 - lev) * (y1 - lev) < 0) crossLine(rows, i + (lev - y0) / (y1 - y0), lines);
    }
  }
  ctx.scene.add(greyLines(lines));
  return null;
}

// ---------------------------------------------------------------------------
// spiral: a corkscrew ramp around a central column, dropping `drop` metres per turn.
// Angles: 0° = +x, 90° = +z. With the default start of 180° the ramp is entered heading -z.
// Grey lines cross it every metre so you can read its speed and slope.
// ---------------------------------------------------------------------------
function spiral(spec, ctx) {
  const { radius = 4, width = 2.4, thick = 0.4, turns = 1.75, drop = 3.6, startDeg = 180, innerRail = 0.4, outerRail = 1.0 } = spec;
  const centre = V(spec.center);
  const a0 = startDeg * Math.PI / 180, span = turns * 2 * Math.PI;
  const n = Math.ceil(turns * 72);
  const at = (u) => {
    const a = a0 + span * u;
    return {
      c: new THREE.Vector3(centre.x + radius * Math.cos(a), centre.y - drop * turns * u, centre.z + radius * Math.sin(a)),
      t: new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)),
    };
  };
  const rows = strip(ctx, at, n, width, thick);
  // Increasing angle curves toward the right of travel (y is up), so the column is on the right
  stripRails(ctx, at, n, width, { left: outerRail, right: innerRail });
  const arc = radius * span, lines = [];
  for (let m = 1; m < arc; m += 1) crossLine(rows, (m / arc) * n, lines);
  ctx.scene.add(greyLines(lines));

  // Central column, solid, from below the bottom turn to above the top
  const colR = radius - width / 2 - 0.5;
  const top = centre.y + 1.5, bottom = centre.y - drop * turns - 3;
  const h = top - bottom;
  const col = outlinedCylinder(colR, h);
  col.position.set(centre.x, bottom + h / 2, centre.z);
  ctx.scene.add(col);
  ctx.world.createCollider(RAPIER.ColliderDesc.cylinder(h / 2, colR)
    .setTranslation(centre.x, bottom + h / 2, centre.z).setCollisionGroups(STATIC_GROUPS), ctx.staticBody);
  return null;
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

const BUILDERS = { path, gate, tiltPlatform, hill, spiral };

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

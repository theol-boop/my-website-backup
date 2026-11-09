// Line-drawing helpers: everything is white faces with black edges on a white page.

import * as THREE from 'three';

export const INK = 0x000000, PAPER = 0xffffff, GRID = 0xa0a0a0;

// White faces are pushed slightly back in depth so their own edge lines always win.
export const faceMat = new THREE.MeshBasicMaterial({ color: PAPER, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
export const inkFaceMat = new THREE.MeshBasicMaterial({ color: INK, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
export const edgeMat = new THREE.LineBasicMaterial({ color: INK });
export const gridMat = new THREE.LineBasicMaterial({ color: GRID });
const hullMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

// Box with black edges. `grid` draws 1 m grid lines on the top face (in the box's own frame, so it follows slopes).
export function outlinedBox(w, h, d, { grid = false, spacing = 1 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(w, h, d);
  const face = new THREE.Mesh(geo, faceMat);
  g.add(face);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
  if (grid) g.add(gridLines(w, d, spacing, h / 2 + 0.002));
  g.userData.face = face;
  return g;
}

export function gridLines(w, d, spacing, y) {
  const pts = [];
  const hw = w / 2, hd = d / 2;
  for (let x = -hw + spacing; x < hw - 1e-6; x += spacing) pts.push(x, y, -hd, x, y, hd);
  for (let z = -hd + spacing; z < hd - 1e-6; z += spacing) pts.push(-hw, y, z, hw, y, z);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineSegments(geo, gridMat);
}

export function circleLine(radius, segments = 64, mat = edgeMat) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return new THREE.LineLoop(geo, mat);
}

// Sphere with a black silhouette: the back faces of a slightly bigger black sphere ("inverted hull").
const outlinedSpheres = [];
export function outlinedSphere(r) {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), hullMat);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), faceMat), hull);
  outlinedSpheres.push({ hull, r });
  return g;
}

// Keep silhouettes ~1.5 css px thick whatever the zoom.
export function updateOutlineScale(unitsPerPixel) {
  for (const o of outlinedSpheres) o.hull.scale.setScalar(1 + (1.5 * unitsPerPixel) / o.r);
}

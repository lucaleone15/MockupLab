// Builds a small test device as a .glb, the way Blender would export it:
// metres, a mesh named "Screen" whose UVs start at the top of the image (glTF convention).
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function makeKiosk(): Promise<ArrayBuffer> {
  const scene = new THREE.Scene();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.56, 0.03), new THREE.MeshStandardMaterial({ name: 'Body', color: '#2b2d33', roughness: 0.35, metalness: 0.6 }));
  body.name = 'Body';
  body.position.set(0, 0.62, 0);
  const screenGeo = new THREE.PlaneGeometry(0.31, 0.53);
  const uv = screenGeo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
  const screen = new THREE.Mesh(screenGeo, new THREE.MeshStandardMaterial({ name: 'ScreenMat', color: '#000000' }));
  screen.name = 'Screen';
  screen.position.set(0, 0.62, 0.0155);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.34, 24), new THREE.MeshStandardMaterial({ name: 'Metal', color: '#c9cbd0', roughness: 0.25, metalness: 1 }));
  pole.position.set(0, 0.17, -0.02);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.02, 48), new THREE.MeshStandardMaterial({ name: 'Metal', color: '#c9cbd0', roughness: 0.25, metalness: 1 }));
  foot.position.set(0, 0.01, -0.02);
  scene.add(body, screen, pole, foot);
  return (await new GLTFExporter().parseAsync(scene, { binary: true })) as ArrayBuffer;
}

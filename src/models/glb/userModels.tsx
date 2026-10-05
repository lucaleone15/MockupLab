import { useEffect, useMemo, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { createStore, del, get, keys, set } from 'idb-keyval';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { t } from '@/i18n';
import { useScreenMaterial } from '@/scene/useScreenMaterial';
import { useProject } from '@/store/project';
import { toast } from '@/store/toasts';
import { getModel, registerUserModule, unregisterUserModule } from '../registry';
import type { DeviceFinish, DeviceModule, DeviceProps } from '../types';

/*
 * Models imported by the user (.glb, glTF binary). On import the file is
 * analysed once: its size (glTF metres become centimetres; an implausible
 * size is brought back to 15 cm), how to centre it on the floor, and which
 * mesh is the screen — by convention a mesh or material whose name contains
 * "screen" / "display" / "écran". That mesh receives the user's images like
 * the built-in devices; everything else keeps the file's own materials.
 * Files stay in the browser (IndexedDB) and travel inside project files.
 */

export interface UserModelMeta {
  /** Size in cm after scaling: width, height, depth. */
  size: [number, number, number];
  scale: number;
  /** Translation applied after scaling (centred, resting on y = 0). */
  offset: [number, number, number];
  screen: { aspect: number } | null;
  focus: [number, number, number];
}

export interface UserModelRecord {
  id: string;
  name: string;
  createdAt: number;
  blob: Blob;
  meta: UserModelMeta;
}

const db = createStore('mockuplab-models', 'kv');
const MAX_BYTES = 60 * 1024 * 1024;
const SCREEN_NAME = /screen|display|[ée]cran|lcd|monitor/i;

const isScreen = (o: THREE.Object3D) => {
  const mesh = o as THREE.Mesh;
  if (!mesh.isMesh) return false;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return SCREEN_NAME.test(o.name) || mats.some((m) => SCREEN_NAME.test(m?.name ?? ''));
};

const parse = async (blob: Blob) => (await new GLTFLoader().parseAsync(await blob.arrayBuffer(), '')).scene;

/** Size, scale and screen of a glTF scene. */
export function analyse(scene: THREE.Object3D): UserModelMeta {
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  if (box.isEmpty()) throw new Error('empty');
  const raw = box.getSize(new THREE.Vector3());
  const longest = Math.max(raw.x, raw.y, raw.z);
  // glTF is in metres; a model that would end up tiny or huge is a unit mix-up
  let scale = 100;
  if (longest * scale < 1 || longest * scale > 400) scale = 15 / longest;
  const centre = box.getCenter(new THREE.Vector3());
  const offset: [number, number, number] = [-centre.x * scale, -box.min.y * scale, -centre.z * scale];
  const size: [number, number, number] = [raw.x * scale, raw.y * scale, raw.z * scale];

  let screen: UserModelMeta['screen'] = null;
  let focus: [number, number, number] = [0, size[1] / 2, 0];
  const screenBox = new THREE.Box3();
  scene.traverse((o) => {
    if (isScreen(o)) screenBox.expandByObject(o);
  });
  if (!screenBox.isEmpty()) {
    const e = screenBox.getSize(new THREE.Vector3());
    // the thinnest axis is the screen's normal; height runs along Y unless Y is the normal
    const axes = [e.x, e.y, e.z];
    const normal = axes.indexOf(Math.min(...axes));
    const height = normal === 1 ? e.z : e.y;
    const width = normal === 0 ? e.z : e.x;
    screen = { aspect: width / Math.max(1e-6, height) };
    const c = screenBox.getCenter(new THREE.Vector3());
    focus = [c.x * scale + offset[0], c.y * scale + offset[1], c.z * scale + offset[2]];
  }
  return { size, scale, offset, screen, focus };
}

/* ------------------------------------------------------------ rendering */

const scenes = new Map<string, Promise<THREE.Object3D>>();
const urls = new Map<string, Blob>();

function loadScene(id: string) {
  let p = scenes.get(id);
  if (!p) {
    const blob = urls.get(id);
    if (!blob) return Promise.reject(new Error('missing model'));
    p = parse(blob).then((scene) => {
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (isScreen(o)) {
          // glTF UVs start at the top of the image, the screen material's images at the bottom
          const g = mesh.geometry.clone();
          const uv = g.getAttribute('uv');
          if (uv) {
            for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
            uv.needsUpdate = true;
          }
          mesh.geometry = g;
          mesh.userData.screen = true;
        }
      });
      return scene;
    });
    scenes.set(id, p);
  }
  return p;
}

const NEUTRAL: DeviceFinish[] = [{ id: 'default', name: { fr: 'D’origine', en: 'Original' }, swatch: '#9a9a9a', colors: {} }];

function makeModule(rec: Pick<UserModelRecord, 'id' | 'name' | 'meta'>): DeviceModule {
  const { meta } = rec;
  function UserModel({ surfaces, screen }: DeviceProps) {
    const invalidate = useThree((s) => s.invalidate);
    const [scene, setScene] = useState<THREE.Object3D | null>(null);
    const material = useScreenMaterial(surfaces.screen, meta.screen?.aspect ?? 1, screen);
    useEffect(() => {
      let alive = true;
      loadScene(rec.id)
        .then((s) => {
          if (alive) setScene(s.clone(true));
        })
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []);
    useEffect(() => {
      if (!scene) return;
      scene.traverse((o) => {
        if (o.userData.screen) (o as THREE.Mesh).material = material;
      });
      invalidate();
    }, [scene, material, invalidate]);
    const position = useMemo(() => meta.offset, []);
    if (!scene) return null;
    return (
      <group position={position} scale={meta.scale}>
        <primitive object={scene} />
      </group>
    );
  }
  UserModel.displayName = `UserModel(${rec.name})`;
  return {
    id: rec.id,
    name: { fr: rec.name, en: rec.name },
    category: 'custom',
    anchor: 'bottom',
    size: meta.size,
    sizeFor: () => ({ size: meta.size, focus: meta.focus }),
    focus: meta.focus,
    surfaces: meta.screen ? [{ id: 'screen', label: { fr: 'Écran', en: 'Screen' }, aspect: meta.screen.aspect }] : [],
    finishes: NEUTRAL,
    defaultFinish: 'default',
    view: { target: [0, meta.size[1] / 2, 0], offset: [meta.size[0], meta.size[1] * 0.4, Math.max(...meta.size) * 2.6] },
    yaw: -0.32,
    Component: UserModel,
  };
}

function register(rec: UserModelRecord) {
  urls.set(rec.id, rec.blob);
  registerUserModule(makeModule(rec));
}

/* ------------------------------------------------------------ library */

/** Registers the models saved in this browser (before the project is restored). */
export async function loadUserModels() {
  const ids = (await keys(db)).map(String);
  for (const id of ids) {
    const rec = (await get(id, db)) as UserModelRecord | undefined;
    if (rec) register(rec);
  }
}

/** Imports a .glb file: analyses it, keeps it, and puts it in the scene in place of the selected device. */
export async function importModelFile(file: File, opts: { add?: boolean } = {}) {
  if (!/\.glb$/i.test(file.name)) {
    toast.error(t(/\.gltf$/i.test(file.name) ? 'glb.gltf' : 'glb.invalid', { name: file.name }));
    return null;
  }
  if (file.size > MAX_BYTES) {
    toast.error(t('glb.tooBig', { name: file.name }));
    return null;
  }
  try {
    const meta = analyse(await parse(file));
    const rec: UserModelRecord = {
      id: `glb:${Math.random().toString(36).slice(2, 10)}`,
      name: file.name.replace(/\.glb$/i, ''),
      createdAt: Date.now(),
      blob: file,
      meta,
    };
    await set(rec.id, rec, db);
    register(rec);
    const s = useProject.getState();
    if (opts.add || !s.selectedId) s.addItem(rec.id);
    else s.replaceModel(s.selectedId, rec.id);
    toast.success(t(meta.screen ? 'glb.imported' : 'glb.importedNoScreen', { name: rec.name }));
    return rec.id;
  } catch {
    toast.error(t('glb.invalid', { name: file.name }));
    return null;
  }
}

export function pickModelFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.glb,model/gltf-binary';
  input.onchange = () => input.files?.[0] && void importModelFile(input.files[0]);
  input.click();
}

/** Forgets an imported model; devices using it become the default phone. */
export async function deleteUserModel(id: string) {
  const s = useProject.getState();
  for (const it of s.items) if (it.modelId === id) s.replaceModel(it.id, 'phone-pro');
  await del(id, db);
  scenes.delete(id);
  urls.delete(id);
  unregisterUserModule(id);
}

/* ------------------------------------------------------------ project files */

export async function userModelRecord(id: string) {
  return (await get(id, db)) as UserModelRecord | undefined;
}

/** Registers (and keeps) a model that came inside a project file. */
export async function adoptUserModel(rec: UserModelRecord) {
  if (getModel(rec.id).id === rec.id) return;
  await set(rec.id, rec, db);
  register(rec);
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PORTAL_SCALE = 0.42;
const PORTAL_OFFSET = new THREE.Vector3(0, 0.01, -1.72);
const PORTAL_TRIGGER_DISTANCE = 0.8;

export function createLevelThree({
  scene,
  camera,
  portalModelUrl,
  levelCopy,
  completeCopy,
  onStatusChange,
}) {
  let active = false;
  let completed = false;
  let portalObject = null;
  let anchorMatrix = null;

  function start(matrix) {
    active = true;
    completed = false;
    anchorMatrix = matrix.clone();
    onStatusChange(levelCopy);
    spawnPortal();
  }

  function stop() {
    active = false;
    completed = false;
    if (portalObject) {
      scene.remove(portalObject);
      portalObject = null;
    }
  }

  function update() {
    if (!active || completed || !portalObject) {
      return;
    }

    if (getHorizontalDistance(camera.position, portalObject.position) <= PORTAL_TRIGGER_DISTANCE) {
      completed = true;
      onStatusChange(completeCopy);
    }
  }

  function spawnPortal() {
    if (!anchorMatrix) {
      return;
    }

    const fallbackPortal = createFallbackPortal(anchorMatrix);
    portalObject = fallbackPortal;
    scene.add(fallbackPortal);

    const loader = new GLTFLoader();
    loader.load(
      portalModelUrl,
      (gltf) => {
        scene.remove(fallbackPortal);

        portalObject = gltf.scene;
        portalObject.scale.setScalar(PORTAL_SCALE);
        applyPlacementFromMatrix(portalObject, anchorMatrix);
        const offset = PORTAL_OFFSET.clone().applyQuaternion(portalObject.quaternion);
        portalObject.position.add(offset);
        scene.add(portalObject);
      },
      undefined,
      (error) => {
        console.error(`Portal load failed for ${portalModelUrl}`, error);
      }
    );
  }

  return {
    start,
    stop,
    update,
  };
}

function createFallbackPortal(matrix) {
  const portal = new THREE.Mesh(
    new THREE.RingGeometry(0.58, 0.95, 56),
    new THREE.MeshBasicMaterial({ color: 0x4cd7ff, side: THREE.DoubleSide })
  );

  applyPlacementFromMatrix(portal, matrix);
  const offset = PORTAL_OFFSET.clone().applyQuaternion(portal.quaternion);
  portal.position.add(offset);
  portal.rotation.x -= Math.PI / 2;
  return portal;
}

function applyPlacementFromMatrix(object, matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(position, quaternion, scale);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

function getHorizontalDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

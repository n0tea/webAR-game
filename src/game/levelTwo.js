import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const PART_SCALE = 0.045;
const PART_SPAWN_OFFSETS = [
  new THREE.Vector3(1.6, 0.05, -1.8),
  new THREE.Vector3(-1.4, 0.05, -2.1),
];

export function createLevelTwo({
  scene,
  controller,
  camera,
  ringPartModelUrl,
  radarSoundUrl,
  ringHalf1ImageUrl,
  ringHalf2ImageUrl,
  levelCopy,
  firstFoundCopy,
  completeCopy,
  onStatusChange,
  onCollectPart,
}) {
  const raycaster = new THREE.Raycaster();
  const radarSound = new Audio(radarSoundUrl);
  radarSound.volume = 0.55;

  let active = false;
  let currentPartIndex = -1;
  let anchorMatrix = null;
  let lastPingAt = 0;
  let spawnedPart = null;

  function start(matrix) {
    active = true;
    anchorMatrix = matrix.clone();
    currentPartIndex = 0;
    lastPingAt = 0;
    onStatusChange(levelCopy);
    spawnPart(currentPartIndex);
  }

  function stop() {
    active = false;
    lastPingAt = 0;
    if (spawnedPart) {
      scene.remove(spawnedPart);
      spawnedPart = null;
    }
    radarSound.pause();
    radarSound.currentTime = 0;
  }

  function update() {
    if (!active || !spawnedPart) {
      return;
    }

    const distance = camera.position.distanceTo(spawnedPart.position);
    const intervalMs = THREE.MathUtils.clamp(distance * 520, 180, 1300);
    const now = performance.now();

    if (now - lastPingAt >= intervalMs) {
      radarSound.currentTime = 0;
      radarSound.play().catch(() => {});
      lastPingAt = now;
    }
  }

  function handleSelect() {
    if (!active || !spawnedPart) {
      return false;
    }

    const selected = intersectInteractiveObject([spawnedPart]);
    if (selected !== spawnedPart) {
      return false;
    }

    collectPart();
    return true;
  }

  function collectPart() {
    scene.remove(spawnedPart);
    spawnedPart = null;

    if (currentPartIndex === 0) {
      onCollectPart({ imageUrl: ringHalf1ImageUrl, label: 'Часть кольца I' });
      onStatusChange(firstFoundCopy);
      currentPartIndex = 1;
      spawnPart(currentPartIndex);
      return;
    }

    onCollectPart({ imageUrl: ringHalf2ImageUrl, label: 'Часть кольца II' });
    onStatusChange(completeCopy);
    active = false;
  }

  function spawnPart(partIndex) {
    if (!anchorMatrix) {
      return;
    }

    const fallbackPart = createFallbackPart(anchorMatrix, partIndex);
    spawnedPart = fallbackPart;
    scene.add(fallbackPart);

    const loader = new GLTFLoader();
    loader.load(
      ringPartModelUrl,
      (gltf) => {
        scene.remove(fallbackPart);

        spawnedPart = gltf.scene;
        spawnedPart.userData.rootObject = spawnedPart;
        spawnedPart.traverse((child) => {
          child.userData.rootObject = spawnedPart;
        });
        spawnedPart.scale.setScalar(PART_SCALE);
        applyPlacementFromMatrix(spawnedPart, anchorMatrix);
        spawnedPart.position.add(PART_SPAWN_OFFSETS[partIndex].clone());
        scene.add(spawnedPart);
      },
      undefined,
      (error) => {
        console.error(`Ring part load failed for ${ringPartModelUrl}`, error);
        onStatusChange(`${levelCopy} Не удалось загрузить фрагмент артефакта, показана тестовая заглушка.`);
      }
    );
  }

  function intersectInteractiveObject(objects) {
    const targets = objects.filter(Boolean);
    if (targets.length === 0) {
      return null;
    }

    const tempMatrix = new THREE.Matrix4();
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);

    const intersections = raycaster.intersectObjects(targets, true);
    return intersections[0]?.object?.userData?.rootObject ?? intersections[0]?.object ?? null;
  }

  return {
    handleSelect,
    start,
    stop,
    update,
  };
}

function createFallbackPart(matrix, partIndex) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.022, 20, 48, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xceb36a, metalness: 0.75, roughness: 0.3 })
  );

  mesh.userData.rootObject = mesh;
  applyPlacementFromMatrix(mesh, matrix);
  mesh.position.add(PART_SPAWN_OFFSETS[partIndex].clone());
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function applyPlacementFromMatrix(object, matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(position, quaternion, scale);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

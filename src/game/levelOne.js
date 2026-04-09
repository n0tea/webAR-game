import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export function createLevelOne({
  scene,
  controller,
  chestModelUrl,
  paperModelUrl,
  levelCopy,
  noteFoundCopy,
  onStatusChange,
  onPinDiscovered,
}) {
  const raycaster = new THREE.Raycaster();
  let chestObject = null;
  let noteObject = null;

  function place(matrix) {
    onStatusChange(levelCopy);
    loadChest(matrix);
  }

  function handleSelect() {
    const selected = intersectInteractiveObject([noteObject]);
    if (selected !== noteObject) {
      return false;
    }

    onPinDiscovered();
    onStatusChange(noteFoundCopy);
    return true;
  }

  function loadChest(matrix) {
    const fallbackCube = createFallbackChest(matrix);
    chestObject = fallbackCube;
    scene.add(fallbackCube);

    const loader = new GLTFLoader();
    loader.load(
      chestModelUrl,
      (gltf) => {
        scene.remove(fallbackCube);

        chestObject = gltf.scene;
        chestObject.scale.setScalar(0.05);
        applyPlacementFromMatrix(chestObject, matrix);
        scene.add(chestObject);
        loadPaper(matrix);
      },
      undefined,
      (error) => {
        console.error(`Chest load failed for ${chestModelUrl}`, error);
        onStatusChange(`${levelCopy} Модель сундука не загрузилась, поэтому показан тестовый куб.`);
        loadPaper(matrix);
      }
    );
  }

  function loadPaper(matrix) {
    const fallbackNote = createFallbackPaper(matrix);
    noteObject = fallbackNote;
    scene.add(fallbackNote);

    const loader = new GLTFLoader();
    loader.load(
      paperModelUrl,
      (gltf) => {
        scene.remove(fallbackNote);

        noteObject = gltf.scene;
        noteObject.userData.rootObject = noteObject;
        noteObject.traverse((child) => {
          child.userData.rootObject = noteObject;
        });
        noteObject.scale.setScalar(0.12);
        applyPlacementFromMatrix(noteObject, matrix);

        const offset = new THREE.Vector3(0.28, 0.02, -0.55);
        offset.applyQuaternion(noteObject.quaternion);
        noteObject.position.add(offset);
        scene.add(noteObject);
      },
      undefined,
      (error) => {
        console.error(`Paper load failed for ${paperModelUrl}`, error);
        onStatusChange(`${levelCopy} Записка не загрузилась, поэтому показана тестовая заглушка.`);
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
    place,
    handleSelect,
  };
}

function createFallbackChest(matrix) {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xb22222, metalness: 0.2, roughness: 0.7 })
  );

  applyPlacementFromMatrix(cube, matrix);
  cube.position.y += 0.06;
  return cube;
}

function createFallbackPaper(matrix) {
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xd7d1b0, side: THREE.DoubleSide })
  );

  note.userData.rootObject = note;
  applyPlacementFromMatrix(note, matrix);
  const offset = new THREE.Vector3(0.28, 0.02, -0.55);
  offset.applyQuaternion(note.quaternion);
  note.position.add(offset);
  return note;
}

function applyPlacementFromMatrix(object, matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(position, quaternion, scale);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

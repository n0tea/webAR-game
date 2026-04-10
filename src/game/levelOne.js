import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const SUITCASE_SCALE = 0.15;
const PAPER_SCALE = 0.04;
const HELD_RADAR_SCALE = 0.06;
const HELD_RADAR_OFFSET = new THREE.Vector3(0.08, -0.12, -0.42);
const HELD_RADAR_TILT_X = 0.18;

export function createLevelOne({
  scene,
  controller,
  camera,
  suitcaseModelUrl,
  suitcaseOpenModelUrl,
  suitcaseNoRadarModelUrl,
  paperModelUrl,
  radarModelUrl,
  levelCopy,
  noteFoundCopy,
  openSuitcaseCopy,
  radarTakenCopy,
  onStatusChange,
  onPinDiscovered,
  onRadarTaken,
}) {
  const raycaster = new THREE.Raycaster();
  let currentPhase = 'find_note';
  let suitcaseAnchorMatrix = null;
  let suitcaseObject = null;
  let noteObject = null;
  let heldRadarObject = null;

  function place(matrix) {
    suitcaseAnchorMatrix = matrix.clone();
    onStatusChange(levelCopy);
    loadSuitcase(suitcaseModelUrl, matrix, { spawnPaperAfterLoad: true });
  }

  function handleSelect() {
    if (currentPhase === 'find_note') {
      const selected = intersectInteractiveObject([noteObject]);
      if (selected !== noteObject) {
        return false;
      }

      onPinDiscovered();
      onStatusChange(noteFoundCopy);
      return true;
    }

    if (currentPhase === 'take_radar') {
      const selected = intersectInteractiveObject([suitcaseObject]);
      if (selected !== suitcaseObject) {
        return false;
      }

      takeRadar();
      return true;
    }

    return false;
  }

  function handleCorrectPin() {
    currentPhase = 'take_radar';
    replaceSuitcase(suitcaseOpenModelUrl);
    onStatusChange(openSuitcaseCopy);
  }

  function update() {
    if (!heldRadarObject) {
      return;
    }

    const offset = HELD_RADAR_OFFSET.clone().applyQuaternion(camera.quaternion);
    heldRadarObject.position.copy(camera.position).add(offset);
    heldRadarObject.quaternion.copy(camera.quaternion);
    heldRadarObject.rotateX(HELD_RADAR_TILT_X);
  }

  function loadSuitcase(modelUrl, matrix, options = {}) {
    const fallbackCube = createFallbackSuitcase(matrix);
    suitcaseObject = fallbackCube;
    scene.add(fallbackCube);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        scene.remove(fallbackCube);

        suitcaseObject = gltf.scene;
        suitcaseObject.userData.rootObject = suitcaseObject;
        suitcaseObject.traverse((child) => {
          child.userData.rootObject = suitcaseObject;
        });
        suitcaseObject.scale.setScalar(SUITCASE_SCALE);
        applyPlacementFromMatrix(suitcaseObject, matrix);
        scene.add(suitcaseObject);

        if (options.spawnPaperAfterLoad) {
          loadPaper(matrix);
        }
      },
      undefined,
      (error) => {
        console.error(`Suitcase load failed for ${modelUrl}`, error);
        onStatusChange(`${levelCopy} Модель чемодана не загрузилась, поэтому показан тестовый куб.`);

        if (options.spawnPaperAfterLoad) {
          loadPaper(matrix);
        }
      }
    );
  }

  function replaceSuitcase(modelUrl) {
    if (!suitcaseAnchorMatrix) {
      return;
    }

    if (suitcaseObject) {
      scene.remove(suitcaseObject);
    }

    const fallbackCube = createFallbackSuitcase(suitcaseAnchorMatrix);
    suitcaseObject = fallbackCube;
    scene.add(fallbackCube);

    const loader = new GLTFLoader();
    loader.load(
      modelUrl,
      (gltf) => {
        scene.remove(fallbackCube);

        suitcaseObject = gltf.scene;
        suitcaseObject.userData.rootObject = suitcaseObject;
        suitcaseObject.traverse((child) => {
          child.userData.rootObject = suitcaseObject;
        });
        suitcaseObject.scale.setScalar(SUITCASE_SCALE);
        applyPlacementFromMatrix(suitcaseObject, suitcaseAnchorMatrix);
        scene.add(suitcaseObject);
      },
      undefined,
      (error) => {
        console.error(`Suitcase replace failed for ${modelUrl}`, error);
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
        noteObject.scale.setScalar(PAPER_SCALE);
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

  function takeRadar() {
    currentPhase = 'radar_taken';
    replaceSuitcase(suitcaseNoRadarModelUrl);
    spawnHeldRadar();
    onStatusChange(radarTakenCopy);
    onRadarTaken?.({ anchorMatrix: suitcaseAnchorMatrix.clone() });
  }

  function spawnHeldRadar() {
    if (heldRadarObject) {
      scene.remove(heldRadarObject);
      heldRadarObject = null;
    }

    const fallbackRadar = createFallbackRadar(camera);
    heldRadarObject = fallbackRadar;
    scene.add(fallbackRadar);

    const loader = new GLTFLoader();
    loader.load(
      radarModelUrl,
      (gltf) => {
        scene.remove(fallbackRadar);

        heldRadarObject = gltf.scene;
        heldRadarObject.scale.setScalar(HELD_RADAR_SCALE);
        scene.add(heldRadarObject);
        update();
      },
      undefined,
      (error) => {
        console.error(`Radar load failed for ${radarModelUrl}`, error);
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
    cleanupScene() {
      if (suitcaseObject) {
        scene.remove(suitcaseObject);
      }
      if (noteObject) {
        scene.remove(noteObject);
      }
    },
    place,
    handleCorrectPin,
    handleSelect,
    update,
  };
}

function createFallbackSuitcase(matrix) {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xb22222, metalness: 0.2, roughness: 0.7 })
  );

  applyPlacementFromMatrix(cube, matrix);
  cube.scale.setScalar(3);
  cube.position.y += 0.06;
  cube.userData.rootObject = cube;
  return cube;
}

function createFallbackPaper(matrix) {
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xd7d1b0, side: THREE.DoubleSide })
  );

  note.userData.rootObject = note;
  applyPlacementFromMatrix(note, matrix);
  note.scale.setScalar(0.33);
  const offset = new THREE.Vector3(0.28, 0.02, -0.55);
  offset.applyQuaternion(note.quaternion);
  note.position.add(offset);
  return note;
}

function createFallbackRadar(camera) {
  const radar = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x2f3a44, metalness: 0.3, roughness: 0.6 })
  );

  const offset = HELD_RADAR_OFFSET.clone().applyQuaternion(camera.quaternion);
  radar.position.copy(camera.position).add(offset);
  radar.quaternion.copy(camera.quaternion);
  radar.rotateX(HELD_RADAR_TILT_X);
  return radar;
}

function applyPlacementFromMatrix(object, matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(position, quaternion, scale);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

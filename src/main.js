import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import './style.css';

const CHEST_MODEL_URL = `${import.meta.env.BASE_URL}models/radar.glb`;
const MUSIC_URL = `${import.meta.env.BASE_URL}Spaceouters-Fireflies.mp3`;
const PIN_CODE = '1234';
const LEVEL_ONE_COPY =
  'Перед вами сундук со снаряжением. Пин-код спрятан рядом. Осмотритесь, найдите записку и откройте сундук.';
const LEVEL_ZERO_COPY = 'Для старта игры нажмите на кнопку Start AR.';
const SCAN_COPY = 'Наведите камеру на пол для сканирования.';

let container;
let scene;
let camera;
let renderer;
let controller;
let reticle;
let raycaster;
let currentLevel = 0;
let hitTestSource = null;
let hitTestSourceRequested = false;
let chestObject = null;
let noteObject = null;
let scanStableFrames = 0;
let levelPlaced = false;
let noteFound = false;
let musicEnabled = true;
let items = [];

const music = new Audio(MUSIC_URL);
music.loop = true;
music.volume = 0.45;

init();
animate();

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);
  raycaster = new THREE.Raycaster();

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1.1);
  scene.add(light);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  container.appendChild(renderer.domElement);

  const arButton = ARButton.createButton(renderer, {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: document.body },
  });
  document.body.appendChild(arButton);

  reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pointerdown', resumeMusic, { passive: true });
  document.addEventListener('visibilitychange', syncMusicState);

  const pinSubmit = document.getElementById('pin-submit');
  const pinInput = document.getElementById('pin-input');
  const musicToggle = document.getElementById('music-toggle');

  pinSubmit.addEventListener('click', () => {
    const value = pinInput.value.trim();

    if (value === PIN_CODE) {
      document.getElementById('pin-panel').style.display = 'none';
      currentLevel = 2;
      showStatus('Код принят. Следующий уровень подготовим, когда загрузите новые модели и звук радара.');
      return;
    }

    showStatus('Неверный код. Осмотритесь внимательнее и найдите правильную записку.');
  });

  musicToggle.addEventListener('click', () => {
    musicEnabled = !musicEnabled;
    updateMusicToggle();
    syncMusicState();
  });

  renderer.xr.addEventListener('sessionstart', () => {
    showStatus(SCAN_COPY);
    resumeMusic();
  });

  renderer.xr.addEventListener('sessionend', () => {
    hitTestSourceRequested = false;
    hitTestSource = null;
    reticle.visible = false;
    scanStableFrames = 0;
    showStatus(LEVEL_ZERO_COPY);
  });

  updateMusicToggle();
  showStatus(LEVEL_ZERO_COPY);
  syncMusicState();
}

function onSelect() {
  if (currentLevel === 1) {
    const selected = intersectInteractiveObject([noteObject]);
    if (selected === noteObject) {
      noteFound = true;
      document.getElementById('pin-panel').style.display = 'block';
      showStatus(`Записка найдена. Код: ${PIN_CODE}. Вернитесь к сундуку и откройте его.`);
    }
    return;
  }

  if (currentLevel === 2) {
    checkItemClick();
  }
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

function placeLevelOne(matrix) {
  levelPlaced = true;
  currentLevel = 1;
  showStatus(LEVEL_ONE_COPY);
  loadChest(matrix);
  noteObject = createCodeNote(matrix);
  scene.add(noteObject);
}

function loadChest(matrix) {
  const fallbackCube = createFallbackChest(matrix);
  chestObject = fallbackCube;
  scene.add(fallbackCube);

  const loader = new GLTFLoader();
  loader.load(
    CHEST_MODEL_URL,
    (gltf) => {
      scene.remove(fallbackCube);

      chestObject = gltf.scene;
      chestObject.scale.setScalar(0.05);
      applyPlacementFromMatrix(chestObject, matrix);
      scene.add(chestObject);
    },
    undefined,
    (error) => {
      console.error(`Chest load failed for ${CHEST_MODEL_URL}`, error);
      showStatus(`${LEVEL_ONE_COPY} Модель сундука не загрузилась, поэтому показан тестовый куб.`);
    }
  );
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

function createCodeNote(matrix) {
  const note = new THREE.Group();
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(0.18, 0.12),
    new THREE.MeshBasicMaterial({ map: createNoteTexture(), transparent: true })
  );
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(0.19, 0.13),
    new THREE.MeshBasicMaterial({ color: 0x0c120f, transparent: true, opacity: 0.85 })
  );

  note.add(back);
  note.add(board);
  note.userData.rootObject = note;
  board.userData.rootObject = note;
  back.userData.rootObject = note;

  applyPlacementFromMatrix(note, matrix);
  const offset = new THREE.Vector3(0.28, 0.1, -0.55);
  offset.applyQuaternion(note.quaternion);
  note.position.add(offset);
  note.lookAt(camera.position.x, note.position.y, camera.position.z);

  return note;
}

function createNoteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 320;

  const context = canvas.getContext('2d');
  context.fillStyle = '#d7d1b0';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#101710';
  context.font = 'bold 56px sans-serif';
  context.textAlign = 'center';
  context.fillText('PIN', canvas.width / 2, 100);
  context.font = 'bold 96px monospace';
  context.fillStyle = '#00ff88';
  context.fillText(PIN_CODE, canvas.width / 2, 220);
  context.font = '28px sans-serif';
  context.fillStyle = '#101710';
  context.fillText('Нажмите, чтобы прочитать', canvas.width / 2, 280);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function applyPlacementFromMatrix(object, matrix) {
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  matrix.decompose(position, quaternion, scale);
  object.position.copy(position);
  object.quaternion.copy(quaternion);
}

function startLevel2() {
  currentLevel = 2;
  showStatus('Level 2: scan the room and look for hidden particles.');

  for (let index = 0; index < 3; index += 1) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.1, 0),
      new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x003300 })
    );

    mesh.position.set(
      camera.position.x + (Math.random() - 0.5) * 4,
      camera.position.y,
      camera.position.z + (Math.random() - 0.5) * 4
    );
    mesh.visible = false;
    scene.add(mesh);
    items.push(mesh);
  }
}

function checkItemClick() {
  showStatus('Второй уровень пока не реализован до конца.');
}

function resumeMusic() {
  if (!musicEnabled || document.hidden) {
    return;
  }

  music.play().catch(() => {});
}

function syncMusicState() {
  if (musicEnabled && !document.hidden) {
    music.play().catch(() => {});
    return;
  }

  music.pause();
}

function updateMusicToggle() {
  const musicToggle = document.getElementById('music-toggle');
  musicToggle.textContent = musicEnabled ? '♫' : '✕';
  musicToggle.setAttribute('aria-label', musicEnabled ? 'Выключить музыку' : 'Включить музыку');
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(_timestamp, frame) {
  if (frame) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const session = renderer.xr.getSession();

    if (!hitTestSourceRequested) {
      session.requestReferenceSpace('viewer').then((viewerSpace) => {
        session.requestHitTestSource({ space: viewerSpace }).then((source) => {
          hitTestSource = source;
        });
      });
      hitTestSourceRequested = true;
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

        if (!levelPlaced) {
          reticle.visible = true;
          scanStableFrames += 1;
          if (scanStableFrames > 20) {
            placeLevelOne(reticle.matrix.clone());
            reticle.visible = false;
          }
        } else {
          reticle.visible = false;
        }
      } else {
        reticle.visible = false;
        scanStableFrames = 0;
      }
    }
  }

  if (currentLevel === 2) {
    items.forEach((item) => {
      const distance = camera.position.distanceTo(item.position);
      if (distance < 0.7) {
        item.visible = true;
      }
    });
  }

  renderer.render(scene, camera);
}

function showStatus(text) {
  const element = document.getElementById('status-text');
  if (element) {
    element.innerText = text;
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

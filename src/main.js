import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MODEL_URL = `${import.meta.env.BASE_URL}models/radar.glb`;
const MUSIC_URL = `${import.meta.env.BASE_URL}Spaceouters-Fireflies.mp3`;
const PIN_CODE = '1234';

let container;
let scene;
let camera;
let renderer;
let controller;
let reticle;
let currentLevel = 0;
let hitTestSource = null;
let hitTestSourceRequested = false;
let suitcase = null;
let items = [];
let music = new Audio(MUSIC_URL);

init();
animate();

function init() {
  container = document.createElement('div');
  document.body.appendChild(container);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
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

  document.getElementById('pin-submit').addEventListener('click', () => {
    const value = document.getElementById('pin-input').value;

    if (value === PIN_CODE) {
      showStatus('Code accepted. Scanner unlocked.');
      document.getElementById('pin-panel').style.display = 'none';
      startLevel2();
      return;
    }

    showStatus('Wrong code.');
  });

  renderer.xr.addEventListener('sessionend', () => {
    hitTestSourceRequested = false;
    hitTestSource = null;
    reticle.visible = false;
  });
}

function onSelect() {
  if (reticle.visible && currentLevel === 0) {
    loadSuitcase(reticle.matrix.clone());
    currentLevel = 1;
    music.play().catch(() => {});
    showStatus('Level 1: inspect the object and enter the code.');
    return;
  }

  if (currentLevel === 2) {
    checkItemClick();
  }
}

function loadSuitcase(matrix) {
  const fallbackCube = createFallbackCube(matrix);
  scene.add(fallbackCube);
  showStatus(`Loading model: ${MODEL_URL}`);

  const loader = new GLTFLoader();
  loader.load(
    MODEL_URL,
    (gltf) => {
      scene.remove(fallbackCube);

      suitcase = gltf.scene;
      suitcase.scale.setScalar(0.05);
      applyPlacementFromMatrix(suitcase, matrix);
      scene.add(suitcase);

      document.getElementById('pin-panel').style.display = 'block';
      showStatus('Model loaded. Enter the code.');
    },
    undefined,
    (error) => {
      console.error(`Model load failed for ${MODEL_URL}`, error);
      showStatus(`Model failed to load. Showing fallback cube. URL: ${MODEL_URL}`);
    }
  );
}

function createFallbackCube(matrix) {
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );

  applyPlacementFromMatrix(cube, matrix);
  return cube;
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
  showStatus('Level 2 interaction is not implemented yet.');
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
        reticle.visible = true;
        reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
      } else {
        reticle.visible = false;
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

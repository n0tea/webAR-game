import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import './style.css';

import {
  LEVEL_ONE_COPY,
  LEVEL_ZERO_COPY,
  MUSIC_URL,
  NOTE_FOUND_COPY,
  PAPER_MODEL_URL,
  PIN_CODE,
  RADAR_MODEL_URL,
  RADAR_TAKEN_COPY,
  SCAN_COPY,
  SUITCASE_OPEN_COPY,
  SUITCASE_MODEL_URL,
  SUITCASE_NOR_MODEL_URL,
  SUITCASE_OPEN_MODEL_URL,
  WRONG_PIN_COPY,
} from './config.js';
import { createLevelOne } from './game/levelOne.js';
import { createHud } from './ui/hud.js';

let camera;
let controller;
let currentLevel = 0;
let hitTestSource = null;
let hitTestSourceRequested = false;
let hud;
let items = [];
let levelOne;
let levelPlaced = false;
let musicEnabled = true;
let renderer;
let reticle;
let scanStableFrames = 0;
let scene;

const music = new Audio(MUSIC_URL);
music.loop = true;
music.volume = 0.45;

init();
animate();

function init() {
  const container = document.createElement('div');
  document.body.appendChild(container);

  hud = createHud();

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

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

  reticle = createReticle();
  scene.add(reticle);

  controller = renderer.xr.getController(0);
  controller.addEventListener('select', onSelect);
  scene.add(controller);

  levelOne = createLevelOne({
    scene,
    controller,
    camera,
    suitcaseModelUrl: SUITCASE_MODEL_URL,
    suitcaseOpenModelUrl: SUITCASE_OPEN_MODEL_URL,
    suitcaseNoRadarModelUrl: SUITCASE_NOR_MODEL_URL,
    paperModelUrl: PAPER_MODEL_URL,
    radarModelUrl: RADAR_MODEL_URL,
    levelCopy: LEVEL_ONE_COPY,
    noteFoundCopy: NOTE_FOUND_COPY,
    openSuitcaseCopy: SUITCASE_OPEN_COPY,
    radarTakenCopy: RADAR_TAKEN_COPY,
    onStatusChange: (text) => hud.setStatus(text),
    onPinDiscovered: () => {
      hud.showPinPanel();
    },
  });

  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pointerdown', resumeMusic, { passive: true });
  document.addEventListener('visibilitychange', syncMusicState);

  hud.bindPinSubmit(handlePinSubmit);
  hud.bindMusicToggle(() => {
    musicEnabled = !musicEnabled;
    hud.updateMusicToggle(musicEnabled);
    syncMusicState();
  });

  renderer.xr.addEventListener('sessionstart', () => {
    hud.setMusicToggleVisible(true);
    hud.setStatus(SCAN_COPY);
    resumeMusic();
  });

  renderer.xr.addEventListener('sessionend', () => {
    hud.setMusicToggleVisible(false);
    hitTestSourceRequested = false;
    hitTestSource = null;
    reticle.visible = false;
    scanStableFrames = 0;
    hud.setStatus(LEVEL_ZERO_COPY);
  });

  hud.updateMusicToggle(musicEnabled);
  hud.setStatus(LEVEL_ZERO_COPY);
  syncMusicState();
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(_timestamp, frame) {
  if (frame) {
    updateHitTest(frame);
  }

  levelOne.update();

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

function handlePinSubmit() {
  const value = hud.getPinValue();

  if (value === PIN_CODE) {
    hud.hidePinPanel();
    currentLevel = 2;
    levelOne.handleCorrectPin();
    return;
  }

  hud.setStatus(WRONG_PIN_COPY);
}

function onSelect() {
  if (currentLevel === 1 || currentLevel === 2) {
    const handled = levelOne.handleSelect();
    if (handled) {
      return;
    }
  }

  if (currentLevel === 2) {
    checkItemClick();
  }
}

function updateHitTest(frame) {
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

  if (!hitTestSource) {
    return;
  }

  const hitTestResults = frame.getHitTestResults(hitTestSource);
  if (hitTestResults.length === 0) {
    reticle.visible = false;
    scanStableFrames = 0;
    return;
  }

  const hit = hitTestResults[0];
  reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);

  if (!levelPlaced) {
    reticle.visible = true;
    scanStableFrames += 1;
    if (scanStableFrames > 20) {
      levelPlaced = true;
      currentLevel = 1;
      levelOne.place(reticle.matrix.clone());
      reticle.visible = false;
    }
    return;
  }

  reticle.visible = false;
}

function createReticle() {
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  mesh.matrixAutoUpdate = false;
  mesh.visible = false;
  return mesh;
}

function checkItemClick() {
  hud.setStatus(RADAR_TAKEN_COPY);
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

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

let container, scene, camera, renderer, controller;
let reticle; // Прицел для поиска пола
let currentLevel = 0; // 0 - сканирование, 1 - чемодан, 2 - поиск улик, 3 - финал
let hitTestSource = null;
let hitTestSourceRequested = false;

let suitcase = null;
let items = []; // Улики для 2 уровня
let music = new Audio('Spaceouters-Fireflies.mp3'); // Фоновая музыка

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

    // Добавляем кнопку AR
    const arButton = ARButton.createButton(renderer, { 
        requiredFeatures: ['hit-test'],
        optionalFeatures: ['dom-overlay'],
        domOverlay: { root: document.body } 
    });
    document.body.appendChild(arButton);


    // Прицел (кольцо на полу)
    reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Контроллер клика
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    window.addEventListener('resize', onWindowResize);

    // Добавьте обработчик кнопки (можно в init)
    document.getElementById("pin-submit").addEventListener("click", () => {
    const val = document.getElementById("pin-input").value;
    if (val === "1234") {
        // Ваш секретный код
        showStatus("Код принят! Поиск частиц активирован.");
        document.getElementById("pin-panel").style.display = "none";

        // Здесь можно вызвать анимацию открытия (если она есть)
        // И переходим ко 2 уровню
        startLevel2();
    } else {
        showStatus("НЕВЕРНЫЙ КОД");
    }
    });

    // В самом конце функции init()
    renderer.xr.addEventListener('sessionend', () => {
        hitTestSourceRequested = false;
        hitTestSource = null;
        reticle.visible = false;
        // Опционально: перезагрузить страницу, если черный экран не уходит
        // window.location.reload(); 
    });
}

function onSelect() {
    if (reticle.visible && currentLevel === 0) {
        // УРОВЕНЬ 1: Спавним чемодан
        loadSuitcase(reticle.matrix);
        currentLevel = 1;
        music.play();
        showStatus("Уровень 1: Введите код на чемодане");
    } else if (currentLevel === 2) {
        // Проверка клика по уликам во 2 уровне будет здесь (Raycaster)
        checkItemClick();
    }
}

/*function loadSuitcase(matrix) {
    const loader = new GLTFLoader();
    // Путь относительно папки public
    loader.load('/models/radar.glb', (gltf) => {
        suitcase = gltf.scene;
        
        // Масштабируем модель (многие модели из Blender слишком велики)
        // 0.1 — это 10% от оригинала. Подбери значение экспериментально
        suitcase.scale.set(0.1, 0.1, 0.1); 

        // Копируем положение и поворот из ретикла (кольца на полу)
        suitcase.position.setFromMatrixPosition(matrix);
        suitcase.quaternion.setFromRotationMatrix(matrix);
        
        scene.add(suitcase);
        
        showStatus("Радар активирован! Введите код.");
        // Здесь можно вызвать функцию открытия UI с пин-кодом
    }, undefined, (error) => {
        console.error('Ошибка загрузки модели:', error);
    });
}*/

// ТЕСТОВАЯ

function loadSuitcase(matrix) {
    // 1. Попробуем создать обычный красный куб, если модель не загрузится
    const testGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const testMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const testCube = new THREE.Mesh(testGeo, testMat);
    testCube.position.setFromMatrixPosition(matrix);
    scene.add(testCube); // Этот куб должен появиться В ЛЮБОМ СЛУЧАЕ

    // 2. А теперь пытаемся загрузить реальную модель
    const loader = new GLTFLoader();
    loader.load('models/radar.glb', (gltf) => { // убираю первый слеш чтобы сдеать путь относительно папки public
        scene.remove(testCube); // Убираем куб, если модель загрузилась
        suitcase = gltf.scene;
        suitcase.scale.set(0.05, 0.05, 0.05); // Делаем еще меньше (5 см) для теста
        suitcase.position.setFromMatrixPosition(matrix);
        suitcase.quaternion.setFromRotationMatrix(matrix);
        scene.add(suitcase);
        // В функции loadSuitcase, после scene.add(suitcase):
        document.getElementById('pin-panel').style.display = 'block'; // вывести панель ввода кода
    }, undefined, (err) => {
        showStatus("Ошибка модели: " + err.message);
    });
}


// Функция перехода на 2 уровень (вызывать, когда код введен)
function startLevel2() {
    currentLevel = 2;
    showStatus("Уровень 2: Сканер зафиксировал частицы. Ищите их в комнате!");
    
    // Спавним 3 сферы вокруг игрока
    for (let i = 0; i < 3; i++) {
        const geo = new THREE.IcosahedronGeometry(0.1, 0);
        const mat = new THREE.MeshPhongMaterial({ color: 0x00ff00, emissive: 0x003300 });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.position.set(
            camera.position.x + (Math.random() - 0.5) * 4,
            camera.position.y,
            camera.position.z + (Math.random() - 0.5) * 4
        );
        mesh.visible = false; // Изначально невидимы
        scene.add(mesh);
        items.push(mesh);
    }
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (hitTestSourceRequested === false) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                    hitTestSource = source;
                });
            });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const hitTestResults = frame.getHitTestResults(hitTestSource);
            if (hitTestResults.length) {
                const hit = hitTestResults[0];
                reticle.visible = true;
                reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
            } else {
                reticle.visible = false;
            }
        }
    }

    // ЛОГИКА ТЕПЛО-ХОЛОДНО (Уровень 2)
    if (currentLevel === 2) {
        items.forEach(item => {
            const dist = camera.position.distanceTo(item.position);
            if (dist < 0.7) {
                item.visible = true; // Проявляем, если подошли близко
            }
        });
    }

    renderer.render(scene, camera);
}

function showStatus(text) {
    // Простая функция для вывода текста на экран (нужно создать div в HTML)
    const el = document.getElementById('status-text');
    if (el) el.innerText = text;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { AlvaAR } from './alva_ar.js';
import { AlvaARConnectorTHREE } from './alva_ar_three.js';
import { Camera, onFrame, resize2cover } from './utils.js';

function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window);
}

class PortalApp {
    constructor() {
        this.container = document.getElementById('container');
        this.overlay = document.getElementById('overlay');
        this.startButton = document.getElementById('start_button');
        this.instructions = document.getElementById('instructions');
        this.splash = document.getElementById('splash');

        this.isMobileDevice = isMobile();
        this.portalPlaced = false;
        this.videoStarted = false;
        this.spawnDirection = null;

        // Получаем параметр video из URL
        const urlParams = new URLSearchParams(window.location.search);
        this.videoParam = urlParams.get('video');

        this.init();
    }

    init() {
        const splashFadeTime = 800;

        this.splash.style.transition = `opacity ${splashFadeTime / 1000}s ease`;
        this.splash.style.opacity = 0;

        setTimeout(() => {
            this.splash.remove();
            this.startButton.addEventListener('click', () => this.startApp(), { once: true });
        }, splashFadeTime);
    }

    async startApp() {
        this.overlay.remove();

        if (this.isMobileDevice) {
            await this.startARMode();
        } else {
            this.startDesktopMode();
        }
    }

    startDesktopMode() {
        // ПК режим: OrbitControls, камера внутри сферы
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        this.camera.position.set(0, 0, 0.1);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        // OrbitControls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // Освещение
        this.scene.add(new THREE.AmbientLight(0x404040));

        // Создаем сферу с 360 видео
        this.create360Sphere();

        // Рендер цикл
        const render = () => {
            requestAnimationFrame(render);
            this.controls.update();
            this.renderer.render(this.scene, this.camera);
        };
        render();

        // Запускаем видео сразу для ПК
        this.startVideo();
    }

    async startARMode() {
        const config = {
            video: {
                facingMode: 'environment',
                aspectRatio: 16 / 9,
                width: { ideal: 1280 }
            },
            audio: false
        };

        try {
            const media = await Camera.Initialize(config);
            await this.initARScene(media);
        } catch (error) {
            alert('Ошибка доступа к камере: ' + error);
        }
    }

    async initARScene(media) {
        const $video = media.el;
        const size = resize2cover($video.videoWidth, $video.videoHeight, this.container.clientWidth, this.container.clientHeight);

        const $canvas = document.createElement('canvas');
        const $view = document.createElement('div');

        $canvas.width = this.container.clientWidth;
        $canvas.height = this.container.clientHeight;
        $video.style.width = size.width + 'px';
        $video.style.height = size.height + 'px';

        const ctx = $canvas.getContext('2d', { alpha: false, desynchronized: true });
        this.alva = await AlvaAR.Initialize($canvas.width, $canvas.height);
        const applyPose = AlvaARConnectorTHREE.Initialize(THREE);

        // Three.js сцена
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, $canvas.width / $canvas.height, 0.1, 1000);
        this.camera.rotation.reorder('YXZ');

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setClearColor(0, 0);
        this.renderer.setSize($canvas.width, $canvas.height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Stencil Buffer настройки
        this.renderer.autoClear = false;
        if (this.renderer.capabilities.isWebGL2) {
            // WebGL2 поддержка
        }

        // Освещение
        this.scene.add(new THREE.AmbientLight(0x808080));
        this.scene.add(new THREE.HemisphereLight(0x404040, 0xf0f0f0, 1));

        // Raycaster для размещения портала
        this.raycaster = new THREE.Raycaster();

        // Создаем ground plane для размещения портала
        this.createGroundPlane();

        this.container.appendChild($canvas);
        this.container.appendChild($view);
        $view.appendChild(this.renderer.domElement);

        // Показываем инструкции
        this.instructions.classList.add('show');

        // Обработчик тапа для размещения портала
        let tapTimeout;
        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (tapTimeout) clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => {
                if (!this.portalPlaced) {
                    this.placePortal(event.touches[0].clientX, event.touches[0].clientY);
                }
            }, 200);
        });

        // Рендер цикл
        onFrame(() => {
            ctx.clearRect(0, 0, $canvas.width, $canvas.height);

            if (!document['hidden']) {
                ctx.drawImage($video, 0, 0, $video.videoWidth, $video.videoHeight, size.x, size.y, size.width, size.height);
                const frame = ctx.getImageData(0, 0, $canvas.width, $canvas.height);
                const cameraPose = this.alva.findCameraPose(frame);

                if (cameraPose) {
                    applyPose(cameraPose, this.camera.quaternion, this.camera.position);

                    // Обновляем позицию ground plane
                    this.ground.position.x = this.camera.position.x;
                    this.ground.position.z = this.camera.position.z;

                    // Управляем видимостью сферы на основе угла камеры
                    if (this.sphere360 && this.spawnDirection) {
                        const currentDirection = new THREE.Vector3().copy(this.camera.getWorldDirection(new THREE.Vector3()));
                        const angle = this.spawnDirection.angleTo(currentDirection);
                        this.sphere360.visible = angle < Math.PI / 3; // 60 градусов
                    }

                    if (!this.portalPlaced) {
                        // Показываем точки трекинга
                        const points = this.alva.getFramePoints();
                        this.showTrackingPoints(ctx, points);
                    }
                } else {
                    // Потеря трекинга
                    this.hideTrackingPoints();
                }
            }

            this.renderer.clear();
            this.renderer.render(this.scene, this.camera);

            return true;
        }, 30);
    }



    create360Sphere() {
        // Для ПК режима - сфера вокруг камеры (уменьшенные полигоны)
        const sphereGeometry = new THREE.SphereGeometry(100, 16, 8);
        this.videoTexture = this.createVideoTexture();
        const sphereMaterial = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.BackSide
        });
        this.sphere360 = new THREE.Mesh(sphereGeometry, sphereMaterial);
        this.scene.add(this.sphere360);
    }

    createVideoTexture() {
        const video = document.createElement('video');
        // Используем videoParam из URL или fallback
        video.src = this.videoParam ? `/assets/videos/${this.videoParam}` : './assets/vr-video-sample.mp4';
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.webkitPlaysInline = true;
        video.preload = 'auto'; // Предварительная загрузка

        // Event listeners для отладки и контроля загрузки
        video.addEventListener('loadstart', () => console.log('Video: load start'));
        video.addEventListener('loadedmetadata', () => console.log('Video: metadata loaded'));
        video.addEventListener('loadeddata', () => {
            console.log('Video: data loaded, readyState:', video.readyState);
            // Создаем текстуру только после загрузки данных
            if (!this.videoTexture) {
                this.createVideoTextureInternal(video);
            }
        });
        video.addEventListener('canplay', () => console.log('Video: can play'));
        video.addEventListener('canplaythrough', () => console.log('Video: can play through'));
        video.addEventListener('error', (e) => console.error('Video error:', e, 'Network state:', video.networkState, 'Ready state:', video.readyState));
        video.addEventListener('progress', () => console.log('Video progress, buffered:', video.buffered.length > 0 ? video.buffered.end(0) : 0));

        this.video = video;
        // Возвращаем placeholder текстуру, которая будет обновлена позже
        const placeholderTexture = new THREE.Texture();
        placeholderTexture.minFilter = THREE.LinearFilter;
        placeholderTexture.magFilter = THREE.LinearFilter;
        return placeholderTexture;
    }

    createVideoTextureInternal(video) {
        console.log('Creating VideoTexture...');
        const texture = new THREE.VideoTexture(video);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.mapping = THREE.EquirectangularReflectionMapping;

        this.videoTexture = texture;

        // Обновляем материал сферы, если она уже создана
        if (this.sphere360 && this.sphere360.material) {
            this.sphere360.material.map = texture;
            this.sphere360.material.needsUpdate = true;
            console.log('VideoTexture assigned to sphere material');
        }

        return texture;
    }

    startVideo() {
        if (this.video && !this.videoStarted) {
            // Принудительная загрузка перед воспроизведением
            this.video.load();
            this.video.play().then(() => {
                this.videoStarted = true;
                console.log('Video started successfully');
                // Создаем VideoTexture после успешного запуска, если ещё не создана
                if (!this.videoTexture || !(this.videoTexture instanceof THREE.VideoTexture)) {
                    this.createVideoTextureInternal(this.video);
                }
            }).catch(error => {
                console.error('Ошибка воспроизведения видео:', error);
                // Fallback: заменяем на цветную текстуру
                this.createFallbackTexture();
            });
        }
    }

    createFallbackTexture() {
        console.log('Creating fallback texture...');
        // Создаем простую цветную текстуру вместо видео
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Градиент для имитации 360 сцены
        const gradient = ctx.createLinearGradient(0, 0, 512, 256);
        gradient.addColorStop(0, '#ff6b6b');
        gradient.addColorStop(0.5, '#4ecdc4');
        gradient.addColorStop(1, '#45b7d1');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 256);

        // Добавляем текст
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('360 Video Fallback', 256, 128);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.mapping = THREE.EquirectangularReflectionMapping;

        this.videoTexture = texture;

        // Обновляем материал сферы
        if (this.sphere360 && this.sphere360.material) {
            this.sphere360.material.map = texture;
            this.sphere360.material.needsUpdate = true;
            console.log('Fallback texture assigned to sphere');
        }
    }

    createGroundPlane() {
        // Создаем ground plane для размещения портала
        this.ground = new THREE.Mesh(
            new THREE.CircleGeometry(1000, 64),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                depthTest: true,
                opacity: 0.0, // Невидимый, но для raycasting
                side: THREE.DoubleSide
            })
        );
        this.ground.rotation.x = Math.PI / 2; // 90 deg
        this.ground.position.y = -10;
        this.scene.add(this.ground);
    }

    showTrackingPoints(ctx, points) {
        ctx.fillStyle = 'white';
        for (const p of points) {
            ctx.fillRect(p.x, p.y, 2, 2);
        }
    }

    hideTrackingPoints() {
        // Очистка точек происходит в рендер цикле через clearRect
    }

    placePortal(x, y) {
        // Преобразуем координаты тапа в нормализованные координаты устройства
        const el = this.renderer.domElement;
        const coord = new THREE.Vector2(
            (x / el.offsetWidth) * 2 - 1,
            -(y / el.offsetHeight) * 2 + 1
        );

        // Raycast от камеры через точку тапа
        this.raycaster.setFromCamera(coord, this.camera);
        const intersections = this.raycaster.intersectObjects([this.ground]);

        if (intersections.length > 0) {
            const point = intersections[0].point;

            // Создаем портал в точке пересечения
            this.createPortalAt(point);
            this.portalPlaced = true;
            this.instructions.classList.remove('show');

            // Запускаем видео после первого взаимодействия
            this.startVideo();

            // Добавляем обработчик второго тапа для перехода к стандартному просмотрщику
            this.addSecondTapHandler();
        }
    }

    addSecondTapHandler() {
        let tapTimeout;
        this.renderer.domElement.addEventListener('touchstart', (event) => {
            if (tapTimeout) clearTimeout(tapTimeout);
            tapTimeout = setTimeout(() => {
                if (this.portalPlaced && this.videoStarted) {
                    // Второй тап - перенаправляем на стандартный просмотрщик
                    const viewerUrl = this.videoParam ? `/viewer.html?video=${encodeURIComponent(this.videoParam)}` : '/viewer.html';
                    window.location.href = viewerUrl;
                }
            }, 200);
        });
    }

    createPortalAt(position) {
        // Запоминаем направление камеры при спавне для управления видимостью
        this.spawnDirection = new THREE.Vector3().copy(this.camera.getWorldDirection(new THREE.Vector3()));

        // Сфера 360 видео (уменьшенный размер, меньше полигонов)
        const sphereGeometry = new THREE.SphereGeometry(3, 16, 8);
        this.videoTexture = this.createVideoTexture();
        const sphereMaterial = new THREE.MeshBasicMaterial({
            map: this.videoTexture,
            side: THREE.BackSide
        });
        this.sphere360 = new THREE.Mesh(sphereGeometry, sphereMaterial);
        // Размещаем напротив камеры на расстоянии 20
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.multiplyScalar(10);
        this.sphere360.position.copy(this.camera.position).add(direction);
        this.scene.add(this.sphere360);
    }
}

// Запуск приложения
window.addEventListener('load', () => {
    new PortalApp();
});

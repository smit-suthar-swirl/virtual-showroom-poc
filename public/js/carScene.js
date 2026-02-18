import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class CarScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd8dce0); // light grey fallback while mall loads

    // Camera — side view matching the BYD showroom reference
    const container = canvas.parentElement;
    this.camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    this.camera.position.set(11, 2.2, 0); // side view: zoomed out
    this.camera.lookAt(0, 0.8, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.setupLights();
    this.setupEnvironment();
    this.setupControls();
    this.setupGround();
    this.resize();

    window.addEventListener("resize", () => this.resize());
    this.animate();
  }

  // ── Load Mall GLB from local public/models folder ──
  loadMallBackground() {
    const loader = new GLTFLoader();
    loader.load(
      "/models/Mall_4K.glb",
      (gltf) => {
        const mall = gltf.scene;

        // Inspect the mall's bounding box to understand its scale
        const mallBbox = new THREE.Box3().setFromObject(mall);
        const mallSize = new THREE.Vector3();
        mallBbox.getSize(mallSize);
        const mallCenter = new THREE.Vector3();
        mallBbox.getCenter(mallCenter);

        console.log(
          "[CarScene] Mall size:",
          mallSize.toArray().map((v) => v.toFixed(2)),
        );
        console.log(
          "[CarScene] Mall center:",
          mallCenter.toArray().map((v) => v.toFixed(2)),
        );

        // Scale the mall so it looks like a real showroom around the car
        // Car is ~4.5 units long. A real showroom is ~30m wide, so scale = 30/mallSize.x
        const targetWidth = 30;
        const mallScale = targetWidth / Math.max(mallSize.x, mallSize.z);
        mall.scale.setScalar(mallScale);

        // Re-measure after scale
        const scaledBbox = new THREE.Box3().setFromObject(mall);
        const scaledMin = scaledBbox.min;

        // Center horizontally, sit on Y=0
        mall.position.x -= mallCenter.x * mallScale;
        mall.position.z -= mallCenter.z * mallScale;
        mall.position.y -= scaledMin.y; // floor at Y=0

        mall.traverse((child) => {
          if (child.isMesh) {
            child.receiveShadow = true;
            child.castShadow = false;
          }
        });

        this.scene.add(mall);
        this.scene.background = null;
        console.log("[CarScene] Mall background loaded ✓");
      },
      (progress) => {
        if (progress.total > 0) {
          console.log(
            `[CarScene] Mall loading: ${Math.round((progress.loaded / progress.total) * 100)}%`,
          );
        }
      },
      (error) => {
        console.error("[CarScene] Failed to load mall background:", error);
        this.scene.background = new THREE.Color(0xd8dce0);
        this.setupGround();
      },
    );
  }

  // ── Environment Map — Premium Studio (Softboxes) ──
  setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x222222); // Dark Grey

    // 1. Large Overhead Softbox (Key Reflection)
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    const topLight = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    topLight.position.set(0, 8, 0);
    topLight.scale.set(12, 0.2, 8);
    envScene.add(topLight);

    // 2. Side Panels for Contour Lines (The "Z" shape reflections)
    const leftPanel = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    leftPanel.position.set(-10, 2, 2);
    leftPanel.scale.set(0.5, 4, 10);
    envScene.add(leftPanel);

    const rightPanel = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    rightPanel.position.set(10, 2, -2);
    rightPanel.scale.set(0.5, 4, 10);
    envScene.add(rightPanel);

    // 3. Warm/Cool Contrast
    const warmLight = new THREE.Mesh(
      boxGeo,
      new THREE.MeshBasicMaterial({ color: 0xffddaa, toneMapped: false }),
    );
    warmLight.position.set(8, 5, 8);
    warmLight.scale.set(4, 4, 0.5);
    warmLight.lookAt(0, 0, 0);
    envScene.add(warmLight);

    // Generate
    const envMap = pmremGenerator.fromScene(envScene).texture;
    this.scene.environment = envMap;

    pmremGenerator.dispose();

    // Cleanup
    topLight.geometry.dispose();
    topLight.material.dispose();
    leftPanel.geometry.dispose();
    leftPanel.material.dispose();
    rightPanel.geometry.dispose();
    rightPanel.material.dispose();
    warmLight.geometry.dispose();
    warmLight.material.dispose();
  }

  setupLights() {
    // 1. Soft Key Light (Top-Left)
    const keyLight = new THREE.RectAreaLight(0xffffff, 2, 10, 10);
    keyLight.position.set(-5, 8, 5);
    keyLight.lookAt(0, 0, 0);
    this.scene.add(keyLight);

    // 2. Fill Light (Right, Soft Warm)
    const fillLight = new THREE.SpotLight(0xffedd5, 8);
    fillLight.position.set(6, 4, 4);
    fillLight.angle = Math.PI / 3;
    fillLight.penumbra = 1;
    this.scene.add(fillLight);

    // 3. Back/Rim Light (For separation)
    const rimLight = new THREE.SpotLight(0xddeeff, 10);
    rimLight.position.set(0, 5, -10); // Behind car
    rimLight.lookAt(0, 0, 0);
    rimLight.penumbra = 0.5;
    rimLight.castShadow = true; // Cast shadow forward
    rimLight.shadow.bias = -0.0001;
    rimLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(rimLight);

    // 4. Subtle Ambient
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  }

  // ── Helper: Generate Procedural Textures for Realism ──
  generateNoiseTexture({
    width = 512,
    height = 512,
    opacity = 0.2,
    density = 1,
  } = {}) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const val = Math.random() * 255;
      const noise = (Math.random() - 0.5) * density * 50;
      const final = Math.min(255, Math.max(0, val + noise));

      data[i] = final; // r
      data[i + 1] = final; // g
      data[i + 2] = final; // b
      data[i + 3] = 255 * opacity; // alpha
    }

    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  setupGround() {
    // 1. Sleek Studio Background (Gradient-like Grey)
    const bgColor = 0x222326; // Anthracite Grey
    this.scene.background = new THREE.Color(bgColor);
    this.scene.fog = new THREE.Fog(bgColor, 15, 50);

    // Generate procedural maps
    const roughMap = this.generateNoiseTexture({ opacity: 0.5, density: 1.5 });
    roughMap.repeat.set(8, 8);

    // 2. Floor: Polished Concrete (Lighter for contrast)
    const floorGeo = new THREE.PlaneGeometry(200, 200);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x333333, // Lighter Grey
      roughness: 0.4, // Semi-gloss
      roughnessMap: roughMap,
      metalness: 0.1,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // 3. The Stage: Modern Podium
    // Main Pedestal
    const stageGeo = new THREE.CylinderGeometry(3.8, 4.0, 0.5, 128);
    const stageMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a, // Darker Grey accent
      roughness: 0.2,
      metalness: 0.5,
    });
    const stage = new THREE.Mesh(stageGeo, stageMat);
    stage.position.y = -0.25;
    stage.receiveShadow = true;
    this.scene.add(stage);

    // Top Surface (Slightly lighter than pedestal to show car)
    const topGeo = new THREE.CylinderGeometry(3.8, 3.8, 0.05, 128);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x333333, // Slightly lighter dark grey
      roughness: 0.2,
      metalness: 0.4,
    });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = 0.025;
    top.receiveShadow = true;
    this.scene.add(top);

    // Elegant White Rim Light (Neutral)
    const rimGeo = new THREE.TorusGeometry(4.0, 0.03, 16, 128);
    const rimMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, // White accent
      toneMapped: false,
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.48;
    this.scene.add(rim);

    // 4. Large Ceiling Softbox (Visual) - REMOVED to clear top view
    // (Lighting comes from Environment Map, so we don't need this blocking mesh)

    console.log("[CarScene] Premium Grey Studio loaded");
  }

  setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;
    this.controls.target.set(0, 0.7, 0);
  }

  setControlLimits({
    minDistance,
    maxDistance,
    maxPolarAngle,
    minPolarAngle,
    enablePan,
  } = {}) {
    if (minDistance !== undefined) this.controls.minDistance = minDistance;
    if (maxDistance !== undefined) this.controls.maxDistance = maxDistance;
    if (maxPolarAngle !== undefined)
      this.controls.maxPolarAngle = maxPolarAngle;
    if (minPolarAngle !== undefined)
      this.controls.minPolarAngle = minPolarAngle;
    if (enablePan !== undefined) this.controls.enablePan = enablePan;
  }

  resize() {
    const container = this.canvas.parentElement;
    const w = container.clientWidth;
    const h = container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  onRender(callback) {
    if (!this._renderCallbacks) this._renderCallbacks = [];
    this._renderCallbacks.push(callback);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this._renderCallbacks) {
      this._renderCallbacks.forEach((cb) => cb());
    }
  }
}

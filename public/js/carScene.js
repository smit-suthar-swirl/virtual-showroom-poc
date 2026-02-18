import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export class CarScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xd8dce0);

    const container = canvas.parentElement;
    this.camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      500,
    );
    this.camera.position.set(11, 2.2, 0);
    this.camera.lookAt(0, 0.8, 0);

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

  _envPanel(pos, scl, color = 0xffffff) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color, toneMapped: false }),
    );
    m.position.set(...pos);
    m.scale.set(...scl);
    return m;
  }

  setupEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x222222);
    const panels = [
      this._envPanel([0, 8, 0], [12, 0.2, 8]),
      this._envPanel([-10, 2, 2], [0.5, 4, 10]),
      this._envPanel([10, 2, -2], [0.5, 4, 10]),
      this._envPanel([8, 5, 8], [4, 4, 0.5], 0xffddaa),
    ];
    panels[3].lookAt(0, 0, 0);
    panels.forEach((p) => env.add(p));
    this.scene.environment = pmrem.fromScene(env).texture;
    pmrem.dispose();
    panels.forEach((p) => {
      p.geometry.dispose();
      p.material.dispose();
    });
  }

  setupLights() {
    const keyLight = new THREE.RectAreaLight(0xffffff, 2, 10, 10);
    keyLight.position.set(-5, 8, 5);
    keyLight.lookAt(0, 0, 0);
    this.scene.add(keyLight);

    const fillLight = new THREE.SpotLight(0xffedd5, 8);
    fillLight.position.set(6, 4, 4);
    fillLight.angle = Math.PI / 3;
    fillLight.penumbra = 1;
    this.scene.add(fillLight);

    const rimLight = new THREE.SpotLight(0xddeeff, 10);
    rimLight.position.set(0, 5, -10);
    rimLight.lookAt(0, 0, 0);
    rimLight.penumbra = 0.5;
    rimLight.castShadow = true;
    rimLight.shadow.bias = -0.0001;
    rimLight.shadow.mapSize.set(2048, 2048);
    this.scene.add(rimLight);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  }

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
      data[i] = data[i + 1] = data[i + 2] = final;
      data[i + 3] = 255 * opacity;
    }
    ctx.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  setupGround() {
    const bgColor = 0x222326;
    this.scene.background = new THREE.Color(bgColor);
    this.scene.fog = new THREE.Fog(bgColor, 15, 50);

    const roughMap = this.generateNoiseTexture({ opacity: 0.5, density: 1.5 });
    roughMap.repeat.set(8, 8);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.4,
        roughnessMap: roughMap,
        metalness: 0.1,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.55;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 4.0, 0.5, 128),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a1a,
        roughness: 0.2,
        metalness: 0.5,
      }),
    );
    stage.position.y = -0.25;
    stage.receiveShadow = true;
    this.scene.add(stage);

    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 0.05, 128),
      new THREE.MeshStandardMaterial({
        color: 0x333333,
        roughness: 0.2,
        metalness: 0.4,
      }),
    );
    top.position.y = 0.025;
    top.receiveShadow = true;
    this.scene.add(top);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(4.0, 0.03, 16, 128),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.48;
    this.scene.add(rim);
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
    const { clientWidth: w, clientHeight: h } = this.canvas.parentElement;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  onRender(callback) {
    (this._renderCallbacks ||= []).push(callback);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this._renderCallbacks?.forEach((cb) => cb());
  }
}

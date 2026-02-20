import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const DEFAULT_GLB = "./models/BYD_Seal_GLB-v1.glb";

const NODE_PATTERNS = [
  [["door"], "doors"],
  [["trunk", "tailgate", "boot"], "trunk"],
  [["hood", "bonnet", "frunk"], "hood"],
  [["engine", "motor"], "engine"],
  [["screen", "display"], "infotainment_screen"],
  [["dashboard", "dash"], "dashboard"],
  [["seat"], "seats"],
  [["steering", "wheel_st"], "steering_wheel"],
  [["console", "center_console"], "center_console"],
  [["instrument", "cluster"], "instrument_cluster"],
  [["wheel", "tire", "tyre", "rim"], "wheels"],
];

const MAT_MAP = {
  wheels: "wheels",
  headlights: "headlights",
  glass_lamp_01: "headlights",
  red_light: "taillights",
  mirror: "mirrors",
  chrome: "trim",
  logo: "trim",
  plate: "trim",
  carpaint: "body",
  black_plastic: "body",
  black_matt: "body",
  black_metal: "body",
  belt: "interior_controls",
  push_button: "interior_controls",
  screen: "infotainment_screen",
};

function classifyMesh(nodeName, materialName) {
  const node = (nodeName || "").toLowerCase();
  const mat = (materialName || "").toLowerCase();
  const nodeMatch = NODE_PATTERNS.find(([keys]) =>
    keys.some((k) => node.includes(k)),
  );
  if (nodeMatch) return nodeMatch[1];
  if (MAT_MAP[mat]) return MAT_MAP[mat];
  if (mat.includes("glass")) return "side_windows";
  if (
    mat.includes("leather") ||
    mat.includes("carpet") ||
    mat.includes("fabric")
  )
    return "interior_trim";
  return "body";
}

export class CarModel {
  constructor(carScene) {
    this.carScene = carScene;
    this.group = new THREE.Group();
    this.bodyPanels = [];
    this.bonnetGroup = null;
    this.engineGroup = null;
    this.wheelGroups = [];
    this.allMeshes = [];
    this.parts = {};
    this.loaded = false;
    this.group.visible = false;
    carScene.scene.add(this.group);
    this.loadPromise = this.loadModel(DEFAULT_GLB);
  }

  async loadModel(path = DEFAULT_GLB) {
    const loader = new GLTFLoader();
    if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    return new Promise((resolve, reject) => {
      loader.load(
        path,
        (gltf) => {
          this.processModel(gltf);
          this.loaded = true;
          resolve();
        },
        undefined,
        reject,
      );
    });
  }

  async loadCar(path) {
    while (this.group.children.length)
      this.group.remove(this.group.children[0]);
    this.bodyPanels = [];
    this.bonnetGroup = null;
    this.engineGroup = null;
    this.wheelGroups = [];
    this.allMeshes = [];
    this.parts = {};
    this.loaded = false;
    this.group.visible = false;
    this.loadPromise = this.loadModel(path);
    return this.loadPromise;
  }

  processModel(gltf) {
    const model = gltf.scene;
    const bbox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const scale = 4.5 / Math.max(size.x, size.y, size.z);
    model.scale.setScalar(scale);

    const scaledBbox = new THREE.Box3().setFromObject(model);
    const center = new THREE.Vector3();
    scaledBbox.getCenter(center);
    model.position.x -= center.x;
    model.position.z -= center.z;

    // Compute Y floor. Priority: Wheels > robust mesh scan > bbox min
    const scaledWidth = scaledBbox.max.x - scaledBbox.min.x;
    let yFloor = 0;

    // We need to classify meshes first to find wheels
    const partGroups = {};
    const envMap = this.carScene.scene.environment;

    model.traverse((child) => {
      if (!child.isMesh) return;
      this.allMeshes.push(child);
      child.castShadow = child.receiveShadow = true;
      const mats = Array.isArray(child.material)
        ? child.material
        : [child.material];
      if (envMap)
        mats.forEach((m) => {
          m.envMap = envMap;
          m.envMapIntensity ||= 1;
          m.needsUpdate = true;
        });
      const nodeName = child.name || child.parent?.name || "";
      const matName =
        (Array.isArray(child.material)
          ? child.material[0]?.name
          : child.material?.name) || "";
      const partName = classifyMesh(nodeName, matName);
      (partGroups[partName] ||= []).push(child);
      if (matName.toLowerCase() === "carpaint") this.bodyPanels.push(child);
      if (partName === "wheels") this.wheelGroups.push(child);
    });

    // Populate parts
    for (const [partName, meshes] of Object.entries(partGroups)) {
      const pg = new THREE.Group();
      pg.userData.partName = partName;
      pg.userData.meshRefs = meshes;
      this.parts[partName] = pg;
    }

    if (this.wheelGroups.length > 0) {
      // If we found wheels, use them as the absolute ground truth
      const wBbox = new THREE.Box3();
      this.wheelGroups.forEach((m) => wBbox.expandByObject(m));
      yFloor = wBbox.min.y;
    } else {
      // Fallback: collect all mesh minimums
      const yMins = [];
      model.traverse((child) => {
        if (!child.isMesh) return;
        const b = new THREE.Box3().setFromObject(child);
        const meshH = b.max.y - b.min.y;
        const meshW = Math.max(b.max.x - b.min.x, b.max.z - b.min.z);

        // Explicitly skip matches for shadow/ground/floor in name
        const n = child.name.toLowerCase();
        if (
          n.includes("shadow") ||
          n.includes("ground") ||
          n.includes("floor") ||
          n.includes("plane")
        )
          return;

        // Skip large flat ground planes or extremely thin objects (shadow planes)
        if (meshH < 0.1 && meshW > scaledWidth * 0.3) return;

        yMins.push(b.min.y);
      });

      if (yMins.length > 0) {
        yMins.sort((a, b) => a - b);
        let bestY = yMins[0];
        // If the lowest point is an outlier (far below the next), skip it
        if (yMins.length > 3 && yMins[1] - yMins[0] > 0.05) {
          bestY = yMins[1];
        }
        yFloor = bestY;
      } else {
        yFloor = scaledBbox.min.y;
      }
    }

    model.position.y -= yFloor;

    this.bonnetGroup = this.bonnetGroup || new THREE.Group();
    this.group.add(this.bonnetGroup);
    this.engineGroup = new THREE.Group();
    this.engineGroup.visible = false;
    this.group.add(this.engineGroup);
    this.group.add(model);
  }

  async whenReady() {
    return this.loadPromise;
  }

  setColor(colorName) {
    const palette = {
      white: 0xd0d4dc,
      black: 0x222228,
      silver: 0xb8bcc5,
      blue: 0x2255aa,
      red: 0xbb1830,
    };
    const c = new THREE.Color(palette[colorName.toLowerCase()] ?? colorName);
    this.bodyPanels.forEach((mesh) => {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      mats.forEach((m, i) => {
        const cloned = m.clone();
        cloned.color.copy(c);
        Array.isArray(mesh.material)
          ? (mesh.material[i] = cloned)
          : (mesh.material = cloned);
      });
    });
  }

  highlightPart(partName) {
    this.resetHighlight();
    const part = this.parts[partName];
    if (!part?.userData.meshRefs) return null;
    const meshes = part.userData.meshRefs;
    meshes.forEach((mesh) => {
      if (!mesh.isMesh) return;
      mesh.userData.originalMaterial = mesh.material;
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const cloned = mats.map((m) => {
        const c = m.clone();
        c.emissive = new THREE.Color(0xe63946);
        c.emissiveIntensity = 0.5;
        return c;
      });
      mesh.material = cloned.length === 1 ? cloned[0] : cloned;
    });
    const bbox = new THREE.Box3();
    meshes.forEach((m) => bbox.expandByObject(m));
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    return center;
  }

  resetHighlight() {
    Object.values(this.parts).forEach((part) => {
      part.userData?.meshRefs?.forEach((mesh) => {
        if (mesh.isMesh && mesh.userData.originalMaterial) {
          mesh.material = mesh.userData.originalMaterial;
          delete mesh.userData.originalMaterial;
        }
      });
    });
  }

  getPartNames() {
    return Object.keys(this.parts);
  }
}

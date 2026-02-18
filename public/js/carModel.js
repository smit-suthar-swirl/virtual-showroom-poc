import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
// Removed unused loaders
// import { DRACOLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const GLB_PATH = "./models/BYD_Seal_GLB-v1.glb";

// ── Part classifier for this BYD Seal GLB ──
// Node names: BYD_Seal_DoorBL_*, BYD_Seal_Body_*, BYD_Seal_DoorFR_*, etc.
// Material names: CarPaint, Wheels, Headlights, Glass, Chrome, Mirror, etc.
function classifyMesh(nodeName, materialName) {
  const node = (nodeName || "").toLowerCase();
  const mat = (materialName || "").toLowerCase();

  // Classify by node name first
  if (node.includes("door")) return "doors";
  if (
    node.includes("trunk") ||
    node.includes("tailgate") ||
    node.includes("boot")
  )
    return "trunk";
  if (
    node.includes("hood") ||
    node.includes("bonnet") ||
    node.includes("frunk")
  )
    return "hood";
  if (node.includes("engine") || node.includes("motor")) return "engine";

  // Interior-specific parts
  if (node.includes("screen") || mat.includes("screen"))
    return "infotainment_screen";
  if (node.includes("display")) return "infotainment_screen";
  if (node.includes("dashboard") || node.includes("dash")) return "dashboard";
  if (node.includes("seat")) return "seats";
  if (node.includes("steering") || node.includes("wheel_st"))
    return "steering_wheel";
  if (node.includes("console") || node.includes("center_console"))
    return "center_console";
  if (node.includes("instrument") || node.includes("cluster"))
    return "instrument_cluster";

  // For Body nodes, classify by material
  if (mat === "wheels") return "wheels";
  if (mat === "headlights" || mat === "glass_lamp_01") return "headlights";
  if (mat === "red_light" || mat === "red_light") return "taillights";
  if (mat === "mirror") return "mirrors";
  if (mat === "chrome") return "trim";
  if (mat === "logo") return "trim";
  if (mat === "plate") return "trim";
  if (mat.includes("glass")) return "side_windows";

  // Interior materials
  if (
    mat.includes("leather") ||
    mat.includes("leather_pref") ||
    mat.includes("leatherwhitedfs")
  )
    return "interior_trim";
  if (mat.includes("carpet") || mat.includes("fabric")) return "interior_trim";
  if (mat === "belt" || mat === "push_button") return "interior_controls";
  if (mat === "screen") return "infotainment_screen";

  if (mat === "carpaint") return "body";
  if (mat === "black_plastic" || mat === "black_matt" || mat === "black_metal")
    return "body";

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
    this.loadPromise = null;

    this.group.visible = false;
    carScene.scene.add(this.group);

    this.loadPromise = this.loadModel();
  }

  async loadModel() {
    const loader = new GLTFLoader();

    // Meshopt decoder — REQUIRED for this GLB (uses EXT_meshopt_compression)
    console.log("[CarModel] MeshoptDecoder:", MeshoptDecoder);
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    } else {
      console.error("[CarModel] MeshoptDecoder is undefined!");
    }

    return new Promise((resolve, reject) => {
      loader.load(
        GLB_PATH,
        (gltf) => {
          console.log("[CarModel] GLB loaded — processing...");
          this.processModel(gltf);
          this.loaded = true;
          console.log("[CarModel] Ready! Meshes:", this.allMeshes.length);
          resolve();
        },
        (progress) => {
          if (progress.total > 0) {
            console.log(
              `[CarModel] Loading: ${Math.round((progress.loaded / progress.total) * 100)}%`,
            );
          }
        },
        (error) => {
          console.error("[CarModel] Failed to load:", error);
          reject(error);
        },
      );
    });
  }

  processModel(gltf) {
    const model = gltf.scene;

    // ── Debug: log model tree ──────────────
    console.log("[CarModel] Scene children:", model.children.length);
    model.traverse((child) => {
      if (child.isMesh) {
        const matName =
          child.material?.name ||
          (Array.isArray(child.material) ? child.material[0]?.name : "");
        console.log(`  Mesh: "${child.name}" mat: "${matName}"`);
      }
    });

    // ── Measure and normalize ───────────────────
    const bbox = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    console.log(
      `[CarModel] Original size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`,
    );

    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim === 0) {
      console.error("[CarModel] Model has zero size!");
      return;
    }
    const targetSize = 4.5;
    const scale = targetSize / maxDim;
    model.scale.setScalar(scale);

    // Re-center
    const scaledBbox = new THREE.Box3().setFromObject(model);
    const scaledCenter = new THREE.Vector3();
    scaledBbox.getCenter(scaledCenter);
    const scaledMin = scaledBbox.min;

    model.position.x -= scaledCenter.x;
    model.position.z -= scaledCenter.z;
    model.position.y -= scaledMin.y;

    const finalSize = new THREE.Vector3();
    new THREE.Box3().setFromObject(model).getSize(finalSize);
    console.log(
      `[CarModel] Final size: ${finalSize.x.toFixed(2)} x ${finalSize.y.toFixed(2)} x ${finalSize.z.toFixed(2)}`,
    );

    // ── Process every mesh ──────────────────────
    const partGroups = {};
    const envMap = this.carScene.scene.environment;

    model.traverse((child) => {
      if (!child.isMesh) return;

      this.allMeshes.push(child);
      child.castShadow = true;
      child.receiveShadow = true;

      // Ensure materials use the environment map
      if (child.material) {
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach((mat) => {
          if (envMap) {
            mat.envMap = envMap;
            mat.envMapIntensity = mat.envMapIntensity || 1.0;
          }
          mat.needsUpdate = true;
        });
      }

      // Classify using both node name and material name
      const nodeName = child.name || child.parent?.name || "unnamed";
      const matName =
        child.material?.name ||
        (Array.isArray(child.material) ? child.material[0]?.name : "") ||
        "";
      const partName = classifyMesh(nodeName, matName);

      if (!partGroups[partName]) partGroups[partName] = [];
      partGroups[partName].push(child);

      // Track body panels for color change — only "CarPaint" material meshes
      if (matName.toLowerCase() === "carpaint") {
        this.bodyPanels.push(child);
      }

      if (partName === "wheels") this.wheelGroups.push(child);
    });

    // Create part group references
    for (const [partName, meshes] of Object.entries(partGroups)) {
      const pg = new THREE.Group();
      pg.userData.partName = partName;
      pg.userData.meshRefs = meshes;
      this.parts[partName] = pg;
    }

    console.log(
      "[CarModel] Parts:",
      Object.keys(partGroups)
        .map((k) => `${k}(${partGroups[k].length})`)
        .join(", "),
    );
    console.log("[CarModel] Body panels (CarPaint):", this.bodyPanels.length);

    // Dummy bonnet/engine groups so animations don't crash
    this.bonnetGroup = this.bonnetGroup || new THREE.Group();
    this.group.add(this.bonnetGroup);

    this.engineGroup = new THREE.Group();
    this.engineGroup.visible = false;
    this.group.add(this.engineGroup);

    // Add the model
    this.group.add(model);
  }

  async whenReady() {
    return this.loadPromise;
  }

  // ── Color Change ──────────────────────────────
  setColor(colorName) {
    const bydPalette = {
      white: 0xd0d4dc,
      black: 0x222228,
      silver: 0xb8bcc5,
      blue: 0x2255aa,
      red: 0xbb1830,
    };

    let newColor;
    if (bydPalette[colorName.toLowerCase()]) {
      newColor = new THREE.Color(bydPalette[colorName.toLowerCase()]);
    } else {
      try {
        newColor = new THREE.Color(colorName);
      } catch (e) {
        newColor = new THREE.Color(bydPalette.white);
      }
    }

    this.bodyPanels.forEach((mesh) => {
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      mats.forEach((mat, i) => {
        const cloned = mat.clone();
        cloned.color.copy(newColor);
        if (Array.isArray(mesh.material)) {
          mesh.material[i] = cloned;
        } else {
          mesh.material = cloned;
        }
      });
    });
  }

  // ── Part Highlight ────────────────────────────
  highlightPart(partName) {
    this.resetHighlight();

    const part = this.parts[partName];
    if (!part || !part.userData.meshRefs) return null;

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

    // Bounding box of highlighted meshes
    const bbox = new THREE.Box3();
    meshes.forEach((m) => bbox.expandByObject(m));
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    return center;
  }

  resetHighlight() {
    Object.values(this.parts).forEach((part) => {
      if (!part.userData?.meshRefs) return;
      part.userData.meshRefs.forEach((mesh) => {
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

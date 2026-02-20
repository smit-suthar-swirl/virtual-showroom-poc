import { CarScene } from "./carScene.js";
import { CarModel } from "./carModel.js";
import { CarAnimations } from "./carAnimations.js";

const CARS = {
  seal: { name: "Seal",      file: "/models/BYD_Seal_GLB-v1.glb" },
  atto: { name: "Atto 3",    file: "/models/BYD_ATTO-v11.glb" },
  han:  { name: "Han EV",    file: "/models/BYD_Han_EV-v4.glb" },
  song: { name: "Song Plus", file: "/models/BYD_SongPlus-v1.glb" },
  qin:  { name: "Qin",       file: "/models/BYD_Quin_GLB-v1.glb" },
};

const PRESETS = {
  front:         { pos: { x: 0,   y: 1.4,  z: 6.5  }, look: { x: 0, y: 0.6, z: 0 } },
  rear:          { pos: { x: 0,   y: 1.4,  z: -6.5 }, look: { x: 0, y: 0.6, z: 0 } },
  side:          { pos: { x: 6.5, y: 1.5,  z: 0    }, look: { x: 0, y: 0.6, z: 0 } },
  quarter:       { pos: { x: 4.5, y: 2.0,  z: 5.5  }, look: { x: 0, y: 0.6, z: 0 } },
  top:           { pos: { x: 0,   y: 8,    z: 0.2  }, look: { x: 0, y: 0,   z: 0 } },
  default:       { pos: { x: 5,   y: 2.5,  z: 6    }, look: { x: 0, y: 0.6, z: 0 } },
  interior_row1: { pos: { x: 0,   y: 1.15, z: -0.2 }, look: { x: 0, y: 1.15, z: -0.19 } },
  interior_row2: { pos: { x: 0,   y: 1.15, z: -0.8 }, look: { x: 0, y: 1.15, z: -0.79 } },
};

let scene, model, anim;
let currentCar = "seal", currentMode = "exterior", activePart = null;

// ─── Utilities ───────────────────────────────────────────────────────────────

function setActive(sel, value, attr) {
  document.querySelectorAll(sel).forEach(b => b.classList.toggle("active", b.dataset[attr] === value));
}

function clearPartActive() {
  document.querySelectorAll(".part-btn").forEach(b => b.classList.remove("active"));
  activePart = null;
}

function showLoading(msg = "Loading…") {
  let el = document.getElementById("loading");
  if (!el) {
    el = document.createElement("div");
    el.id = "loading";
    el.className = "loading-overlay";
    document.getElementById("viewport").appendChild(el);
  }
  el.innerHTML = `<div class="loading-spinner"></div><div class="loading-text">${msg}</div>`;
}

function hideLoading() { document.getElementById("loading")?.remove(); }

// ─── View modes ───────────────────────────────────────────────────────────────

function goExterior() {
  currentMode = "exterior";
  scene.setControlLimits({ minDistance: 2, maxDistance: 16, maxPolarAngle: Math.PI / 2.05, minPolarAngle: 0.1, enablePan: true });
  const p = PRESETS.default;
  anim.animateCamera(p.pos, p.look, 1.5);
  setActive(".view-btn", "exterior", "view");
  clearPartActive();
}

function goInterior(row = 1) {
  currentMode = "interior";
  scene.setControlLimits({ minDistance: 0.01, maxDistance: 0.2, maxPolarAngle: Math.PI * 0.9, minPolarAngle: 0.1, enablePan: false });
  const key = row === 2 ? "interior_row2" : "interior_row1";
  const p = PRESETS[key];
  anim.animateCamera(p.pos, p.look, 1.8);
  setActive(".view-btn", `interior-${row}`, "view");
  clearPartActive();
}

// ─── Camera preset ────────────────────────────────────────────────────────────

function goPreset(name) {
  if (name === "360") { anim.show360View(); return; }
  if (currentMode === "interior") {
    scene.setControlLimits({ minDistance: 2, maxDistance: 16, maxPolarAngle: Math.PI / 2.05, minPolarAngle: 0.1, enablePan: true });
    currentMode = "exterior";
    setActive(".view-btn", "exterior", "view");
  }
  const p = PRESETS[name];
  if (p) anim.animateCamera(p.pos, p.look, 1.5);
  setActive(".preset-btn", name, "preset");
  clearPartActive();
}

// ─── Car switching ────────────────────────────────────────────────────────────

async function switchCar(key) {
  if (key === currentCar) return;
  currentCar = key;
  const car = CARS[key];
  document.getElementById("car-name").textContent = car.name;
  showLoading(`Loading ${car.name}…`);
  anim = null;
  clearPartActive();
  await model.loadCar(car.file);
  hideLoading();
  anim = new CarAnimations(scene, model);
  anim.revealCar();
  if (currentMode === "interior") setTimeout(() => goInterior(1), 1600);
  setActive(".car-btn", key, "car");
}

// ─── Part highlight ───────────────────────────────────────────────────────────

const INTERIOR_PARTS = new Set(["dashboard","seats","infotainment_screen","steering_wheel","center_console","instrument_cluster"]);

function highlightPart(part, btn) {
  if (activePart === part) { model.resetHighlight(); clearPartActive(); return; }
  if (INTERIOR_PARTS.has(part) && currentMode !== "interior") goInterior(1);
  anim.highlightPart(part);
  activePart = part;
  document.querySelectorAll(".part-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
}

// ─── Setup buttons ────────────────────────────────────────────────────────────

function setupButtons() {
  document.querySelectorAll(".car-btn").forEach(b =>
    b.addEventListener("click", () => switchCar(b.dataset.car)));

  document.querySelectorAll(".view-btn").forEach(b =>
    b.addEventListener("click", () => {
      if (b.dataset.view === "exterior") goExterior();
      else goInterior(b.dataset.view === "interior-2" ? 2 : 1);
    }));

  document.querySelectorAll(".preset-btn").forEach(b =>
    b.addEventListener("click", () => goPreset(b.dataset.preset)));

  document.querySelectorAll(".action-btn").forEach(b =>
    b.addEventListener("click", () => {
      const a = b.dataset.action;
      if (a === "open_hood")   anim.openBonnet();
      if (a === "close_hood")  anim.closeBonnet();
      if (a === "open_doors")  anim.openAllDoors();
      if (a === "close_doors") anim.closeAllDoors();
    }));

  document.querySelectorAll(".part-btn").forEach(b =>
    b.addEventListener("click", () => highlightPart(b.dataset.part, b)));

  document.querySelectorAll(".color-btn").forEach(b =>
    b.addEventListener("click", () => {
      model.setColor(b.dataset.color);
      setActive(".color-btn", b.dataset.color, "color");
    }));
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  showLoading("Loading BYD Seal…");
  scene = new CarScene(document.getElementById("three-canvas"));
  model = new CarModel(scene);
  await model.whenReady();
  hideLoading();
  anim = new CarAnimations(scene, model);
  anim.revealCar();
  setupButtons();
}

init();

import * as THREE from "three";

// ── Hotspot data: positions are in model-local coords ──
const HOTSPOT_DATA = [
  // Exterior hotspots
  {
    id: "headlights",
    worldPos: { x: 0.8, y: 0.7, z: 2.0 },
    title: "Crystal LED Headlights",
    body: "Adaptive LED headlights with sequential turn signals, automatic high beam, and distinctive DRL signature.",
    view: "exterior",
  },
  {
    id: "taillights",
    worldPos: { x: 0.8, y: 0.8, z: -2.0 },
    title: "Through-Type LED Taillights",
    body: "Full-width LED light bar with dynamic turn signals and elegant ocean-inspired design.",
    view: "exterior",
  },
  {
    id: "wheels",
    worldPos: { x: 1.6, y: 0.35, z: 1.0 },
    title: '20" Sport Alloy Wheels',
    body: "Aerodynamically optimized multi-spoke alloy wheels with low rolling resistance tires for maximum range.",
    view: "exterior",
  },
  {
    id: "charging",
    worldPos: { x: -1.6, y: 0.75, z: 0.6 },
    title: "Fast Charging Port",
    body: "Supports DC fast charging up to 150kW. 30% to 80% in approximately 26 minutes.",
    view: "exterior",
  },
  {
    id: "hood",
    worldPos: { x: 0, y: 1.1, z: 1.8 },
    title: "Ocean Aesthetic Front Design",
    body: "Sleek, aerodynamic front profile with 0.219 Cd drag coefficient - one of the lowest in its class.",
    view: "exterior",
  },
  {
    id: "trunk_ext",
    worldPos: { x: 0, y: 1.0, z: -2.1 },
    title: "Electric Trunk",
    body: "Power-operated trunk with hands-free kick sensor. 400L cargo capacity with flat floor.",
    view: "exterior",
  },
  // Interior hotspots
  {
    id: "infotainment",
    worldPos: { x: 0.05, y: 1.05, z: 0.85 },
    title: "15.6\" Rotating Touchscreen",
    body: "BYD DiLink smart system with Apple CarPlay & Android Auto. The screen rotates between portrait and landscape orientation.",
    view: "interior",
  },
  {
    id: "steering",
    worldPos: { x: -0.4, y: 0.95, z: 0.7 },
    title: "Multi-Function Steering Wheel",
    body: "Leather-wrapped flat-bottom steering with media controls, voice activation, and adaptive cruise control buttons.",
    view: "interior",
  },
  {
    id: "seats_int",
    worldPos: { x: -0.5, y: 0.85, z: 0.0 },
    title: "Ventilated & Heated Seats",
    body: "Full Nappa leather seats with 12-way power adjustment, 3-stage heating and ventilation (Flagship trim).",
    view: "interior",
  },
  {
    id: "console",
    worldPos: { x: 0, y: 0.8, z: 0.4 },
    title: "Center Console",
    body: "Wireless phone charging pad, electronic gear selector, and hidden storage compartment with USB-C ports.",
    view: "interior",
  },
];

export class HotspotSystem {
  constructor(carScene, carModel) {
    this.scene = carScene;
    this.model = carModel;
    this.container = document.getElementById("hotspot-container");
    this.popup = document.getElementById("hotspot-popup");
    this.viewport = document.getElementById("viewport");

    this.markerElements = [];
    this.visible = false;
    this.currentView = "exterior";
    this._vec = new THREE.Vector3(); // reusable vector

    this._setupCloseButton();
  }

  // ── Show hotspots for a given view mode ───────────

  show(viewMode = "exterior") {
    this.visible = true;
    this.currentView = viewMode;
    this._clearMarkers();

    const filtered = HOTSPOT_DATA.filter((h) => h.view === viewMode);

    filtered.forEach((h) => {
      const marker = document.createElement("div");
      marker.className = "hotspot-marker" + (viewMode === "interior" ? " interior-marker" : "");
      marker.textContent = "i";
      marker.dataset.hotspotId = h.id;
      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        this._showPopup(h, marker);
      });
      this.container.appendChild(marker);
      this.markerElements.push({ element: marker, data: h });
    });
  }

  hide() {
    this.visible = false;
    this._clearMarkers();
    this.closePopup();
  }

  // ── Called each frame from carScene's render loop ──

  update() {
    if (!this.visible || this.markerElements.length === 0) return;

    const camera = this.scene.camera;
    const canvas = this.scene.canvas;
    const rect = canvas.getBoundingClientRect();

    this.markerElements.forEach(({ element, data }) => {
      this._vec.set(data.worldPos.x, data.worldPos.y, data.worldPos.z);

      // Apply car group's world transform
      if (this.model.group) {
        this._vec.applyMatrix4(this.model.group.matrixWorld);
      }

      this._vec.project(camera);

      // Behind camera or outside frustum
      if (this._vec.z > 1 || Math.abs(this._vec.x) > 1.2 || Math.abs(this._vec.y) > 1.2) {
        element.style.display = "none";
        return;
      }

      const x = (this._vec.x * 0.5 + 0.5) * rect.width;
      const y = (-this._vec.y * 0.5 + 0.5) * rect.height;

      element.style.display = "flex";
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
    });
  }

  // ── Popup ─────────────────────────────────────────

  _showPopup(hotspot, markerEl) {
    const titleEl = document.getElementById("hotspot-popup-title");
    const bodyEl = document.getElementById("hotspot-popup-body");
    titleEl.textContent = hotspot.title;
    bodyEl.textContent = hotspot.body;

    // Position popup near the marker
    const markerRect = markerEl.getBoundingClientRect();
    const viewportRect = this.viewport.getBoundingClientRect();

    let left = markerRect.left - viewportRect.left + 36;
    let top = markerRect.top - viewportRect.top - 10;

    // Keep within viewport
    if (left + 270 > viewportRect.width) {
      left = markerRect.left - viewportRect.left - 280;
    }
    if (top + 120 > viewportRect.height) {
      top = viewportRect.height - 140;
    }
    if (top < 10) top = 10;

    this.popup.style.left = `${left}px`;
    this.popup.style.top = `${top}px`;
    this.popup.classList.remove("hidden");
  }

  closePopup() {
    this.popup?.classList.add("hidden");
  }

  // ── Internal ──────────────────────────────────────

  _clearMarkers() {
    this.markerElements.forEach(({ element }) => element.remove());
    this.markerElements = [];
  }

  _setupCloseButton() {
    document.getElementById("hotspot-popup-close")?.addEventListener("click", () => {
      this.closePopup();
    });

    // Close popup on canvas click
    this.scene.canvas.addEventListener("click", () => {
      this.closePopup();
    });
  }
}

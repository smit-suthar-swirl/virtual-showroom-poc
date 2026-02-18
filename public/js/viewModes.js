const CAMERA_PRESETS = {
  default:           { pos: { x: 5,   y: 2.5,  z: 6    }, target: { x: 0, y: 0.6,  z: 0    } },
  front:             { pos: { x: 0,   y: 1.4,  z: 6.5  }, target: { x: 0, y: 0.6,  z: 0    } },
  rear:              { pos: { x: 0,   y: 1.4,  z: -6.5 }, target: { x: 0, y: 0.6,  z: 0    } },
  side_left:         { pos: { x: -6.5,y: 1.5,  z: 0    }, target: { x: 0, y: 0.6,  z: 0    } },
  side_right:        { pos: { x: 6.5, y: 1.5,  z: 0    }, target: { x: 0, y: 0.6,  z: 0    } },
  three_quarter:     { pos: { x: 4.5, y: 2.0,  z: 5.5  }, target: { x: 0, y: 0.6,  z: 0    } },
  top:               { pos: { x: 0,   y: 8,    z: 0.2  }, target: { x: 0, y: 0,    z: 0    } },
  doors_open:        { pos: { x: 4,   y: 4,    z: 5    }, target: { x: 0, y: 0.4,  z: 0    } },
  interior_1st_row:  { pos: { x: 0.0, y: 1.15, z: -0.2 }, target: { x: 0.0, y: 1.15, z: -0.19 } },
  interior_2nd_row:  { pos: { x: 0.0, y: 1.15, z: -0.8 }, target: { x: 0.0, y: 1.15, z: -0.79 } },
};

export class ViewModes {
  constructor(carScene, carAnimations, carModel, uiController) {
    this.scene = carScene;
    this.animations = carAnimations;
    this.model = carModel;
    this.ui = uiController;
    this.currentMode = "exterior";
    this.currentPreset = "default";
    this.currentSeatingRow = 1;
    this._setupListeners();
  }

  switchToExterior() {
    if (this.currentMode === "exterior") return;
    this.currentMode = "exterior";
    this.currentPreset = "default";
    if (this.animations.doorsOpen) this.animations.closeAllDoors();
    this.scene.setControlLimits({ minDistance: 2, maxDistance: 16, maxPolarAngle: Math.PI / 2.05, minPolarAngle: 0.1, enablePan: true });
    const p = CAMERA_PRESETS.default;
    this.animations.animateCamera(p.pos, p.target, 1.5);
    this.ui.setViewMode("exterior");
  }

  switchToInterior(row = 1) {
    this.currentMode = "interior";
    this.currentSeatingRow = row;
    this.currentPreset = row === 2 ? "interior_2nd_row" : "interior_1st_row";
    if (!this.animations.carVisible) { this.animations.revealCar(); setTimeout(() => this._enterInterior(row), 3400); return; }
    this._enterInterior(row);
  }

  _enterInterior(row) {
    this.scene.setControlLimits({ minDistance: 0.01, maxDistance: 0.2, maxPolarAngle: Math.PI * 0.9, minPolarAngle: 0.1, enablePan: false });
    const p = CAMERA_PRESETS[row === 2 ? "interior_2nd_row" : "interior_1st_row"];
    this.animations.animateCamera(p.pos, p.target, 1.8);
    this.ui.setViewMode("interior", row);
    const hint = document.getElementById("interior-hint");
    if (hint) { hint.classList.remove("hidden"); setTimeout(() => hint.classList.add("hidden"), 3000); }
  }

  setSeatingRow(row) {
    if (this.currentMode !== "interior") return;
    this.currentSeatingRow = row;
    const p = CAMERA_PRESETS[row === 2 ? "interior_2nd_row" : "interior_1st_row"];
    this.animations.animateCamera(p.pos, p.target, 1.5);
    const label = document.getElementById("seating-rows-label");
    if (label) label.textContent = `Seating Rows - ${row === 1 ? "1st" : "2nd"} Row`;
    document.querySelectorAll(".seating-row-option").forEach(btn => btn.classList.toggle("active", parseInt(btn.dataset.row) === row));
  }

  goToPreset(presetName) {
    if (presetName === "doors_open") { this.animations.openAllDoors(); return; }
    if (presetName === "360") { this.animations.show360View(); return; }
    const p = CAMERA_PRESETS[presetName];
    if (!p) return;
    if (presetName.startsWith("interior_")) { this.switchToInterior(presetName.includes("2nd") ? 2 : 1); return; }
    if (this.currentMode === "interior") {
      this.currentMode = "exterior";
      this.scene.setControlLimits({ minDistance: 2, maxDistance: 16, maxPolarAngle: Math.PI / 2.05, minPolarAngle: 0.1, enablePan: true });
      this.ui.setViewMode("exterior");
    }
    this.currentPreset = presetName;
    this.animations.animateCamera(p.pos, p.target, 1.5);
    document.querySelectorAll(".bottom-nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.preset === presetName));
  }

  showUI() { this.ui.showViewportUI(); }
  hideUI() { this.ui.hideViewportUI(); }

  _setupListeners() {
    document.getElementById("btn-exterior")?.addEventListener("click", () => this.switchToExterior());
    document.getElementById("btn-interior")?.addEventListener("click", () => this.switchToInterior(this.currentSeatingRow));
    const seatingBtn = document.getElementById("seating-rows-btn");
    const seatingMenu = document.getElementById("seating-rows-menu");
    seatingBtn?.addEventListener("click", () => seatingMenu?.classList.toggle("hidden"));
    document.querySelectorAll(".seating-row-option").forEach(btn =>
      btn.addEventListener("click", () => { this.setSeatingRow(parseInt(btn.dataset.row)); seatingMenu?.classList.add("hidden"); })
    );
    document.querySelectorAll(".bottom-nav-btn").forEach(btn =>
      btn.addEventListener("click", () => this.goToPreset(btn.dataset.preset))
    );
    document.addEventListener("click", e => { if (!e.target.closest(".seating-dropdown")) seatingMenu?.classList.add("hidden"); });
  }
}

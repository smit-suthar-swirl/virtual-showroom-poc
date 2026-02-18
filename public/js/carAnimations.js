import * as THREE from "three";

// ── Tween Engine ────────────────────────────────────
class Tween {
  constructor(obj, prop, from, to, duration, ease = "easeInOutCubic") {
    this.obj = obj;
    this.prop = prop;
    this.from = from;
    this.to = to;
    this.duration = duration;
    this.ease = ease;
    this.elapsed = 0;
    this.done = false;
    this.onComplete = null;
  }

  update(dt) {
    if (this.done) return;
    this.elapsed += dt;
    let t = Math.min(this.elapsed / this.duration, 1);
    t = Tween.easings[this.ease](t);
    this.obj[this.prop] = this.from + (this.to - this.from) * t;
    if (this.elapsed >= this.duration) {
      this.done = true;
      if (this.onComplete) this.onComplete();
    }
  }

  static easings = {
    linear: (t) => t,
    easeInOutCubic: (t) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
    easeOutBack: (t) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    easeInCubic: (t) => t * t * t,
  };
}

export class CarAnimations {
  constructor(carScene, carModel) {
    this.scene = carScene;
    this.car = carModel;
    this.tweens = [];
    this.bonnetOpen = false;
    this.doorsOpen = false;
    this.carVisible = false;
    this.idleEnabled = false;
    this.idleTime = 0;
    this.highlightTimeout = null;
    this.baseY = 0;
    this.doorPivots = []; // { pivot, mesh, isLeft }
    this.trunkPivots = []; // { pivot, mesh }
    this.hoodPivots = []; // { pivot, mesh }
    this.pivotsReady = false;

    this.clock = new THREE.Clock();
    this._tick = this.tick.bind(this);
    this.tick();
  }

  tick() {
    requestAnimationFrame(this._tick);
    const dt = this.clock.getDelta();

    this.tweens = this.tweens.filter((tw) => {
      tw.update(dt);
      return !tw.done;
    });

    if (this.idleEnabled && this.carVisible) {
      this.idleTime += dt;
      this.car.group.position.y =
        this.baseY + Math.sin(this.idleTime * 1.2) * 0.015;
    }
  }

  addTween(obj, prop, from, to, duration, ease) {
    const tw = new Tween(obj, prop, from, to, duration, ease);
    this.tweens.push(tw);
    return tw;
  }

  // ── Reveal Car ────────────────────────────────
  revealCar() {
    if (this.carVisible) return;
    if (!this.car.loaded) {
      this.car.whenReady().then(() => this.revealCar());
      return;
    }
    this.carVisible = true;

    const g = this.car.group;
    g.visible = true;
    g.scale.set(0.01, 0.01, 0.01);
    g.position.y = -1.5;
    g.rotation.y = 0;
    this.baseY = 0;

    this.addTween(g.scale, "x", 0.01, 1, 1.2, "easeOutBack");
    this.addTween(g.scale, "y", 0.01, 1, 1.2, "easeOutBack");
    this.addTween(g.scale, "z", 0.01, 1, 1.2, "easeOutBack");
    this.addTween(g.position, "y", -1.5, this.baseY, 1.2, "easeOutCubic");

    const rotTw = this.addTween(
      g.rotation,
      "y",
      0,
      Math.PI * 2,
      3.0,
      "easeInOutCubic",
    );
    rotTw.onComplete = () => {
      g.rotation.y = 0;
      this.idleEnabled = true;
    };

    this.animateCamera({ x: 11, y: 2.2, z: 0 }, { x: 0, y: 0.8, z: 0 }, 1.5);
  }

  // ── Hide Car ──────────────────────────────────
  hideCar() {
    if (!this.carVisible) return;
    this.idleEnabled = false;

    if (this.bonnetOpen) this.closeBonnet();
    this.car.resetHighlight();

    const g = this.car.group;
    this.addTween(g.scale, "x", 1, 0.01, 0.8, "easeInCubic");
    this.addTween(g.scale, "y", 1, 0.01, 0.8, "easeInCubic");
    this.addTween(g.scale, "z", 1, 0.01, 0.8, "easeInCubic");
    const posTw = this.addTween(
      g.position,
      "y",
      g.position.y,
      -1.5,
      0.8,
      "easeInCubic",
    );

    posTw.onComplete = () => {
      g.visible = false;
      this.carVisible = false;
    };
  }

  // ── Open Bonnet (highlights hood + engine area for GLB) ──
  openBonnet() {
    if (this.bonnetOpen) return;
    this.bonnetOpen = true;

    if (!this.carVisible) {
      this.revealCar();
      setTimeout(() => this._doBonnetOpen(), 3400);
      return;
    }
    this._doBonnetOpen();
  }

  _doBonnetOpen() {
    this._waitForCarReady(() => {
      // Stage 1: Move to front view first
      this.animateCamera({ x: 0, y: 2, z: 6 }, { x: 0, y: 0.8, z: 0 }, 1.5);

      // Stage 2: After reaching front view, open bonnet via pivots
      setTimeout(() => {
        this.car.highlightPart("hood");

        // Negative X rotation: front of hood lifts up (hinge at rear/windshield edge)
        this.hoodPivots.forEach(({ pivot }) => {
          this.addTween(
            pivot.rotation,
            "x",
            pivot.rotation.x,
            -Math.PI / 3,
            1.5,
            "easeOutCubic",
          );
        });

        // Stage 3: Zoom into engine area after bonnet starts opening
        setTimeout(() => {
          this.animateCamera(
            { x: 0, y: 1.8, z: 2.5 },
            { x: 0, y: 0.8, z: 0 },
            1.2,
          );
        }, 800);
      }, 1600);
    });
  }

  // ── Close Bonnet ──────────────────────────────
  closeBonnet() {
    if (!this.bonnetOpen) return;
    this.bonnetOpen = false;

    this.car.resetHighlight();

    // Close hood pivots back to 0
    this.hoodPivots.forEach(({ pivot }) => {
      this.addTween(
        pivot.rotation,
        "x",
        pivot.rotation.x,
        0,
        0.8,
        "easeInOutCubic",
      );
    });

    this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.2);
  }

  // ── Wait for car to be fully at scale 1 before preparing pivots ──
  // This ensures bounding boxes are computed at the correct scale.
  _waitForCarReady(callback) {
    const checkReady = () => {
      const scale = this.car.group.scale.x;
      if (scale >= 0.99) {
        // Car is at full scale — safe to prepare pivots
        this._preparePivots();
        callback();
      } else {
        // Still scaling in — check again in 100ms
        setTimeout(checkReady, 100);
      }
    };
    checkReady();
  }

  // ── Highlight Part ────────────────────────────
  highlightPart(partName) {
    if (!this.car.loaded) {
      this.car.whenReady().then(() => this.highlightPart(partName));
      return;
    }

    if (!this.carVisible) {
      this.revealCar();
      setTimeout(() => this._doHighlight(partName), 3400);
      return;
    }
    this._doHighlight(partName);
  }

  _doHighlight(partName) {
    if (this.highlightTimeout) clearTimeout(this.highlightTimeout);

    const center = this.car.highlightPart(partName);
    if (!center) return;

    // Calculate optimal camera position based on part location
    const dist = 6.0;
    let camTarget = { x: 0, y: 0, z: 0 };

    // Determine which side of the car the part is on
    const isRear = center.z < -0.5;
    const isFront = center.z > 0.5;
    const isLeft = center.x < -0.3;
    const isRight = center.x > 0.3;
    const isInterior =
      partName.includes("screen") ||
      partName.includes("dashboard") ||
      partName.includes("seat") ||
      partName.includes("steering") ||
      partName.includes("console") ||
      partName.includes("instrument") ||
      partName.includes("interior");

    if (isInterior) {
      // Interior parts: position camera INSIDE the car from driver/passenger perspective
      // For infotainment screen and dashboard - view from driver's seat
      if (
        partName.includes("screen") ||
        partName.includes("dashboard") ||
        partName.includes("instrument")
      ) {
        camTarget = {
          x: -0.5, // Slightly left (driver position)
          y: center.y + 0.2, // At eye level
          z: center.z - 0.8, // Behind the screen/dashboard (looking forward)
        };
      }
      // For steering wheel - view from driver's perspective
      else if (partName.includes("steering")) {
        camTarget = {
          x: -0.3,
          y: center.y + 0.3,
          z: center.z - 1.0,
        };
      }
      // For center console - view from above/side
      else if (partName.includes("console")) {
        camTarget = {
          x: -0.5,
          y: center.y + 0.8,
          z: center.z - 0.3,
        };
      }
      // For seats - view from inside
      else if (partName.includes("seat")) {
        camTarget = {
          x: center.x + (isRight ? -1.2 : 1.2),
          y: center.y + 0.5,
          z: center.z + 0.5,
        };
      }
      // Generic interior - close up view
      else {
        camTarget = {
          x: center.x + (isRight ? -1.0 : 1.0),
          y: center.y + 0.3,
          z: center.z - 0.5,
        };
      }
    } else if (isFront) {
      // Front parts (headlights, grille, front bumper, hood)
      camTarget = {
        x: center.x * 0.5,
        y: center.y + 1.0,
        z: center.z + dist,
      };
    } else if (isRear) {
      // Rear parts (taillights, trunk, rear bumper)
      camTarget = {
        x: center.x * 0.5,
        y: center.y + 1.0,
        z: center.z - dist,
      };
    } else if (isLeft) {
      // Left side parts
      camTarget = {
        x: center.x - dist,
        y: center.y + 1.2,
        z: center.z,
      };
    } else if (isRight) {
      // Right side parts
      camTarget = {
        x: center.x + dist,
        y: center.y + 1.2,
        z: center.z,
      };
    } else {
      // Default: position camera at an angle
      camTarget = {
        x: center.x + dist * 0.7,
        y: center.y + dist * 0.6,
        z: center.z + dist * 0.7,
      };
    }

    this.animateCamera(
      camTarget,
      { x: center.x, y: center.y, z: center.z },
      1.5,
    );

    // Auto-reset after 8 seconds
    this.highlightTimeout = setTimeout(() => {
      this.car.resetHighlight();
      this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.5);
    }, 8000);
  }

  // ── Pivot Group System ──────────────────────────────────────────────────
  // Uses Object3D.attach() which correctly handles all world-space transforms.
  // This is the ONLY correct way to reparent in Three.js when parents have
  // non-identity scale/rotation (like our GLTF model).
  _preparePivots() {
    if (this.pivotsReady) return;
    this.pivotsReady = true;

    // Group door meshes by door identity (FL, FR, BL, BR)
    const doorGroups = {}; // { "FL": [mesh,...], "FR": [...], ... }
    const doorPart = this.car.parts["doors"];
    if (doorPart && doorPart.userData.meshRefs) {
      doorPart.userData.meshRefs.forEach((mesh) => {
        if (!mesh.isMesh) return;
        const n = (mesh.name || "").toUpperCase();
        let key = "UNKNOWN";
        if (n.includes("DOORFL") || n.includes("DOOR_FL")) key = "FL";
        else if (n.includes("DOORFR") || n.includes("DOOR_FR")) key = "FR";
        else if (n.includes("DOORBL") || n.includes("DOOR_BL")) key = "BL";
        else if (n.includes("DOORBR") || n.includes("DOOR_BR")) key = "BR";
        else if (n.includes("DOOR")) {
          // Fallback: classify by X position
          const bbox = new THREE.Box3().setFromObject(mesh);
          const cx = (bbox.min.x + bbox.max.x) / 2;
          const cz = (bbox.min.z + bbox.max.z) / 2;
          key = cx < 0 ? (cz > 0 ? "FL" : "BL") : cz > 0 ? "FR" : "BR";
        }
        if (!doorGroups[key]) doorGroups[key] = [];
        doorGroups[key].push(mesh);
      });
    }

    // For each door group, compute combined bbox and create one pivot
    Object.entries(doorGroups).forEach(([key, meshes]) => {
      if (meshes.length === 0) return;

      // Combined world bbox for all meshes of this door
      const combinedBbox = new THREE.Box3();
      meshes.forEach((m) => combinedBbox.expandByObject(m));

      const isLeft = key === "FL" || key === "BL";

      // ── NORMAL CAR DOOR HINGE (vertical Y-axis at A/B-pillar) ──
      // Car front = +Z. Hinge at FRONT edge = max.z (A-pillar / B-pillar).
      // Inner X edge (body side): left doors = min.x, right doors = max.x
      // Left doors: -Y swings free end (rear/min.z) outward to left ✓
      // Right doors: +Y swings free end outward to right ✓
      const hingeWorld = new THREE.Vector3(
        isLeft ? combinedBbox.min.x : combinedBbox.max.x, // inner edge (body side)
        (combinedBbox.min.y + combinedBbox.max.y) / 2, // mid-height
        combinedBbox.max.z, // FRONT edge (A or B pillar)
      );

      const pivot = this._createPivotAt(hingeWorld, meshes);
      if (pivot) {
        this.doorPivots.push({ pivot, key, isLeft });
        console.log(
          `[Pivots] Door ${key}: hinge at`,
          hingeWorld.toArray().map((v) => v.toFixed(3)),
          `meshes: ${meshes.length}`,
        );
      }
    });

    // ── Hood pivots ──
    const hoodPart = this.car.parts["hood"];
    if (hoodPart && hoodPart.userData.meshRefs) {
      const meshes = hoodPart.userData.meshRefs.filter((m) => m.isMesh);
      if (meshes.length > 0) {
        const bbox = new THREE.Box3();
        meshes.forEach((m) => bbox.expandByObject(m));
        // Hood hinge: rear edge (min Z in BYD Seal coords where front = +Z), top of hood
        const hingeWorld = new THREE.Vector3(
          (bbox.min.x + bbox.max.x) / 2,
          bbox.max.y,
          bbox.min.z,
        );
        const pivot = this._createPivotAt(hingeWorld, meshes);
        if (pivot) {
          this.hoodPivots.push({ pivot });
          console.log(
            `[Pivots] Hood: hinge at`,
            hingeWorld,
            `meshes: ${meshes.length}`,
          );
        }
      }
    }

    // ── Trunk pivots ──
    const trunkPart = this.car.parts["trunk"];
    if (trunkPart && trunkPart.userData.meshRefs) {
      const meshes = trunkPart.userData.meshRefs.filter((m) => m.isMesh);
      if (meshes.length > 0) {
        const bbox = new THREE.Box3();
        meshes.forEach((m) => bbox.expandByObject(m));
        // Trunk hinge: top edge at the FRONT of the trunk lid (closest to rear window = max.z)
        const hingeWorld = new THREE.Vector3(
          (bbox.min.x + bbox.max.x) / 2,
          bbox.max.y,
          bbox.max.z,
        );
        const pivot = this._createPivotAt(hingeWorld, meshes);
        if (pivot) {
          this.trunkPivots.push({ pivot });
          console.log(
            `[Pivots] Trunk: hinge at`,
            hingeWorld,
            `meshes: ${meshes.length}`,
          );
        }
      }
    }

    console.log(
      `[Pivots] Ready — Doors: ${this.doorPivots.length}, Hood: ${this.hoodPivots.length}, Trunk: ${this.trunkPivots.length}`,
    );
  }

  // Create a pivot Group at hingeWorld (world coords) and attach all meshes to it.
  // Uses Object3D.attach() which correctly preserves world-space transforms.
  _createPivotAt(hingeWorld, meshes) {
    if (!meshes || meshes.length === 0) return null;

    // Find the common parent (all meshes in a GLTF door group share a parent)
    const parent = meshes[0].parent;
    if (!parent) return null;

    // Create pivot group in the scene at the hinge world position
    const pivot = new THREE.Group();
    this.car.group.add(pivot);

    // Position pivot at hinge in world space
    // We need to convert hingeWorld to car.group local space
    const hingeLocal = this.car.group.worldToLocal(hingeWorld.clone());
    pivot.position.copy(hingeLocal);

    // Attach each mesh to the pivot using attach() which preserves world transform
    meshes.forEach((mesh) => {
      pivot.attach(mesh);
    });

    return pivot;
  }

  // ── Open All Doors ──────────────────────────────
  openAllDoors() {
    if (this.doorsOpen) return;
    this.doorsOpen = true;

    if (!this.carVisible) {
      this.revealCar();
      setTimeout(() => this._doOpenAllDoors(), 3400);
      return;
    }
    this._doOpenAllDoors();
  }

  _doOpenAllDoors() {
    this._waitForCarReady(() => {
      // ── Normal car door swing: Y-axis rotation at front-edge vertical hinge ──
      // All doors hinge at their front edge (max Z = A-pillar or B-pillar).
      // Left doors: negative Y = swings outward away from car (toward +X then forward)
      // Right doors: positive Y = swings outward away from car (toward -X then forward)
      this.doorPivots.forEach(({ pivot, isLeft }) => {
        // Hinge at max.z (front edge, car front = +Z).
        // Left doors: -Y swings free rear end outward ✓
        // Right doors: +Y swings free rear end outward ✓
        const openAngle = isLeft ? -Math.PI / 2.4 : Math.PI / 2.4;
        this.addTween(
          pivot.rotation,
          "y",
          pivot.rotation.y,
          openAngle,
          1.6,
          "easeOutCubic",
        );
      });

      // Animate trunk pivots (open upward — positive X lifts trunk lid backward)
      this.trunkPivots.forEach(({ pivot }) => {
        this.addTween(
          pivot.rotation,
          "x",
          pivot.rotation.x,
          Math.PI / 4,
          1.5,
          "easeOutCubic",
        );
      });

      // Camera: side-angled view to see doors swinging open
      this.animateCamera({ x: 8, y: 3.5, z: 8 }, { x: 0, y: 0.5, z: 0 }, 1.5);
    });
  }

  // ── Close All Doors ─────────────────────────────
  closeAllDoors() {
    if (!this.doorsOpen) return;
    this.doorsOpen = false;

    // Animate door pivots back to 0 (Y axis for normal side-hinge)
    this.doorPivots.forEach(({ pivot }) => {
      this.addTween(
        pivot.rotation,
        "y",
        pivot.rotation.y,
        0,
        1.0,
        "easeInOutCubic",
      );
    });

    // Close trunk pivots
    this.trunkPivots.forEach(({ pivot }) => {
      this.addTween(
        pivot.rotation,
        "x",
        pivot.rotation.x,
        0,
        1.0,
        "easeInOutCubic",
      );
    });

    // Close hood
    if (this.bonnetOpen) {
      this.bonnetOpen = false;
      this.hoodPivots.forEach(({ pivot }) => {
        this.addTween(
          pivot.rotation,
          "x",
          pivot.rotation.x,
          0,
          1.0,
          "easeInOutCubic",
        );
      });
    }

    // Return to default view
    this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.2);
  }

  // ── 360 Degree View ────────────────────────────
  show360View() {
    if (!this.carVisible) {
      this.revealCar();
      setTimeout(() => this.show360View(), 1500);
      return;
    }

    // Calculate orbit parameters
    const radius = 8;
    const height = 2.5;
    const duration = 8; // 8 seconds for full rotation
    const startAngle = Math.atan2(
      this.scene.camera.position.z,
      this.scene.camera.position.x,
    );

    // Create a custom animation for smooth 360 rotation
    const startTime = performance.now();
    const animate360 = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);

      if (progress < 1) {
        const angle = startAngle + progress * Math.PI * 2;
        this.scene.camera.position.x = Math.cos(angle) * radius;
        this.scene.camera.position.z = Math.sin(angle) * radius;
        this.scene.camera.position.y = height;

        this.scene.controls.target.set(0, 0.6, 0);
        this.scene.controls.update();

        requestAnimationFrame(animate360);
      } else {
        // Return to default view after 360
        this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.5);
      }
    };

    animate360();
  }

  // ── Camera Animation ──────────────────────────
  animateCamera(targetPos, targetLookAt, duration) {
    const cam = this.scene.camera;
    const ctrl = this.scene.controls;

    this.addTween(
      cam.position,
      "x",
      cam.position.x,
      targetPos.x,
      duration,
      "easeInOutCubic",
    );
    this.addTween(
      cam.position,
      "y",
      cam.position.y,
      targetPos.y,
      duration,
      "easeInOutCubic",
    );
    this.addTween(
      cam.position,
      "z",
      cam.position.z,
      targetPos.z,
      duration,
      "easeInOutCubic",
    );

    this.addTween(
      ctrl.target,
      "x",
      ctrl.target.x,
      targetLookAt.x,
      duration,
      "easeInOutCubic",
    );
    this.addTween(
      ctrl.target,
      "y",
      ctrl.target.y,
      targetLookAt.y,
      duration,
      "easeInOutCubic",
    );
    this.addTween(
      ctrl.target,
      "z",
      ctrl.target.z,
      targetLookAt.z,
      duration,
      "easeInOutCubic",
    );
  }
}

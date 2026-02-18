import * as THREE from "three";

class Tween {
  constructor(obj, prop, from, to, duration, ease = "easeInOutCubic") {
    this.obj = obj; this.prop = prop; this.from = from; this.to = to;
    this.duration = duration; this.ease = ease; this.elapsed = 0; this.done = false; this.onComplete = null;
  }
  update(dt) {
    if (this.done) return;
    this.elapsed += dt;
    let t = Math.min(this.elapsed / this.duration, 1);
    t = Tween.easings[this.ease](t);
    this.obj[this.prop] = this.from + (this.to - this.from) * t;
    if (this.elapsed >= this.duration) { this.done = true; this.onComplete?.(); }
  }
  static easings = {
    linear: t => t,
    easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeOutBack: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    easeInCubic: t => t * t * t,
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
    this.doorPivots = [];
    this.trunkPivots = [];
    this.hoodPivots = [];
    this.pivotsReady = false;
    this.clock = new THREE.Clock();
    this._tick = this.tick.bind(this);
    this.tick();
  }

  tick() {
    requestAnimationFrame(this._tick);
    const dt = this.clock.getDelta();
    this.tweens = this.tweens.filter(tw => { tw.update(dt); return !tw.done; });
    if (this.idleEnabled && this.carVisible) {
      this.idleTime += dt;
      this.car.group.position.y = this.baseY + Math.sin(this.idleTime * 1.2) * 0.015;
    }
  }

  addTween(obj, prop, from, to, duration, ease) {
    const tw = new Tween(obj, prop, from, to, duration, ease);
    this.tweens.push(tw);
    return tw;
  }

  animateCamera(pos, look, dur) {
    const cam = this.scene.camera, ctrl = this.scene.controls;
    ["x", "y", "z"].forEach(a => {
      this.addTween(cam.position, a, cam.position[a], pos[a], dur, "easeInOutCubic");
      this.addTween(ctrl.target, a, ctrl.target[a], look[a], dur, "easeInOutCubic");
    });
  }

  _tweenPivots(pivots, axis, to, dur, ease = "easeInOutCubic") {
    pivots.forEach(({ pivot }) => this.addTween(pivot.rotation, axis, pivot.rotation[axis], to, dur, ease));
  }

  revealCar() {
    if (this.carVisible) return;
    if (!this.car.loaded) { this.car.whenReady().then(() => this.revealCar()); return; }
    this.carVisible = true;
    const g = this.car.group;
    g.visible = true;
    g.scale.set(0.01, 0.01, 0.01);
    g.position.y = -1.5;
    g.rotation.y = 0;
    this.baseY = 0;
    ["x", "y", "z"].forEach(a => this.addTween(g.scale, a, 0.01, 1, 1.2, "easeOutBack"));
    this.addTween(g.position, "y", -1.5, this.baseY, 1.2, "easeOutCubic");
    const rotTw = this.addTween(g.rotation, "y", 0, Math.PI * 2, 3.0, "easeInOutCubic");
    rotTw.onComplete = () => { g.rotation.y = 0; this.idleEnabled = true; };
    this.animateCamera({ x: 11, y: 2.2, z: 0 }, { x: 0, y: 0.8, z: 0 }, 1.5);
  }

  hideCar() {
    if (!this.carVisible) return;
    this.idleEnabled = false;
    if (this.bonnetOpen) this.closeBonnet();
    this.car.resetHighlight();
    const g = this.car.group;
    ["x", "y", "z"].forEach(a => this.addTween(g.scale, a, 1, 0.01, 0.8, "easeInCubic"));
    const tw = this.addTween(g.position, "y", g.position.y, -1.5, 0.8, "easeInCubic");
    tw.onComplete = () => { g.visible = false; this.carVisible = false; };
  }

  openBonnet() {
    if (this.bonnetOpen) return;
    this.bonnetOpen = true;
    if (!this.carVisible) { this.revealCar(); setTimeout(() => this._doBonnetOpen(), 3400); return; }
    this._doBonnetOpen();
  }

  _doBonnetOpen() {
    this._waitForCarReady(() => {
      this.animateCamera({ x: 0, y: 2, z: 6 }, { x: 0, y: 0.8, z: 0 }, 1.5);
      setTimeout(() => {
        this.car.highlightPart("hood");
        this._tweenPivots(this.hoodPivots, "x", -Math.PI / 3, 1.5, "easeOutCubic");
        setTimeout(() => this.animateCamera({ x: 0, y: 1.8, z: 2.5 }, { x: 0, y: 0.8, z: 0 }, 1.2), 800);
      }, 1600);
    });
  }

  closeBonnet() {
    if (!this.bonnetOpen) return;
    this.bonnetOpen = false;
    this.car.resetHighlight();
    this._tweenPivots(this.hoodPivots, "x", 0, 0.8);
    this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.2);
  }

  _waitForCarReady(callback) {
    const check = () => this.car.group.scale.x >= 0.99 ? (this._preparePivots(), callback()) : setTimeout(check, 100);
    check();
  }

  highlightPart(partName) {
    if (!this.car.loaded) { this.car.whenReady().then(() => this.highlightPart(partName)); return; }
    if (!this.carVisible) { this.revealCar(); setTimeout(() => this._doHighlight(partName), 3400); return; }
    this._doHighlight(partName);
  }

  _doHighlight(partName) {
    if (this.highlightTimeout) clearTimeout(this.highlightTimeout);
    const center = this.car.highlightPart(partName);
    if (!center) return;

    const dist = 6;
    const isInterior = /screen|dashboard|seat|steering|console|instrument|interior/.test(partName);
    let cam;

    if (isInterior) {
      const IC = {
        screen:     { x: -0.5, dy: 0.2, dz: -0.8 },
        dashboard:  { x: -0.5, dy: 0.2, dz: -0.8 },
        instrument: { x: -0.5, dy: 0.2, dz: -0.8 },
        steering:   { x: -0.3, dy: 0.3, dz: -1.0 },
        console:    { x: -0.5, dy: 0.8, dz: -0.3 },
      };
      const k = Object.keys(IC).find(k => partName.includes(k));
      if (k) {
        const c = IC[k];
        cam = { x: c.x, y: center.y + c.dy, z: center.z + c.dz };
      } else if (partName.includes("seat")) {
        cam = { x: center.x + (center.x > 0.3 ? -1.2 : 1.2), y: center.y + 0.5, z: center.z + 0.5 };
      } else {
        cam = { x: center.x + (center.x > 0 ? -1 : 1), y: center.y + 0.3, z: center.z - 0.5 };
      }
    } else {
      const rules = [
        [center.z > 0.5,  { x: center.x * 0.5, y: center.y + 1, z: center.z + dist }],
        [center.z < -0.5, { x: center.x * 0.5, y: center.y + 1, z: center.z - dist }],
        [center.x < -0.3, { x: center.x - dist, y: center.y + 1.2, z: center.z }],
        [center.x > 0.3,  { x: center.x + dist, y: center.y + 1.2, z: center.z }],
      ];
      cam = rules.find(([cond]) => cond)?.[1] ?? { x: center.x + dist * 0.7, y: center.y + dist * 0.6, z: center.z + dist * 0.7 };
    }

    this.animateCamera(cam, center, 1.5);
    this.highlightTimeout = setTimeout(() => {
      this.car.resetHighlight();
      this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.5);
    }, 8000);
  }

  _preparePivots() {
    if (this.pivotsReady) return;
    this.pivotsReady = true;

    const doorGroups = {};
    const doorPart = this.car.parts["doors"];
    if (doorPart?.userData.meshRefs) {
      doorPart.userData.meshRefs.forEach(mesh => {
        if (!mesh.isMesh) return;
        const n = (mesh.name || "").toUpperCase();
        let key = "UNKNOWN";
        if (n.includes("DOORFL") || n.includes("DOOR_FL")) key = "FL";
        else if (n.includes("DOORFR") || n.includes("DOOR_FR")) key = "FR";
        else if (n.includes("DOORBL") || n.includes("DOOR_BL")) key = "BL";
        else if (n.includes("DOORBR") || n.includes("DOOR_BR")) key = "BR";
        else if (n.includes("DOOR")) {
          const bbox = new THREE.Box3().setFromObject(mesh);
          const cx = (bbox.min.x + bbox.max.x) / 2, cz = (bbox.min.z + bbox.max.z) / 2;
          key = cx < 0 ? (cz > 0 ? "FL" : "BL") : cz > 0 ? "FR" : "BR";
        }
        (doorGroups[key] ||= []).push(mesh);
      });
    }

    Object.entries(doorGroups).forEach(([key, meshes]) => {
      if (!meshes.length) return;
      const bbox = new THREE.Box3();
      meshes.forEach(m => bbox.expandByObject(m));
      const isLeft = key === "FL" || key === "BL";
      const hinge = new THREE.Vector3(
        isLeft ? bbox.min.x : bbox.max.x,
        (bbox.min.y + bbox.max.y) / 2,
        bbox.max.z
      );
      const pivot = this._createPivotAt(hinge, meshes);
      if (pivot) this.doorPivots.push({ pivot, key, isLeft });
    });

    this._buildHingePivot("hood",  b => new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, b.min.z))
      .forEach(p => this.hoodPivots.push({ pivot: p }));
    this._buildHingePivot("trunk", b => new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, b.max.z))
      .forEach(p => this.trunkPivots.push({ pivot: p }));
  }

  _buildHingePivot(partName, computeHinge) {
    const part = this.car.parts[partName];
    if (!part?.userData.meshRefs) return [];
    const meshes = part.userData.meshRefs.filter(m => m.isMesh);
    if (!meshes.length) return [];
    const bbox = meshes.reduce((b, m) => b.expandByObject(m), new THREE.Box3());
    const pivot = this._createPivotAt(computeHinge(bbox), meshes);
    return pivot ? [pivot] : [];
  }

  _createPivotAt(hingeWorld, meshes) {
    if (!meshes?.length) return null;
    const parent = meshes[0].parent;
    if (!parent) return null;
    const pivot = new THREE.Group();
    this.car.group.add(pivot);
    pivot.position.copy(this.car.group.worldToLocal(hingeWorld.clone()));
    meshes.forEach(mesh => pivot.attach(mesh));
    return pivot;
  }

  openAllDoors() {
    if (this.doorsOpen) return;
    this.doorsOpen = true;
    if (!this.carVisible) { this.revealCar(); setTimeout(() => this._doOpenAllDoors(), 3400); return; }
    this._doOpenAllDoors();
  }

  _doOpenAllDoors() {
    this._waitForCarReady(() => {
      this.doorPivots.forEach(({ pivot, isLeft }) => {
        const angle = isLeft ? -Math.PI / 2.4 : Math.PI / 2.4;
        this.addTween(pivot.rotation, "y", pivot.rotation.y, angle, 1.6, "easeOutCubic");
      });
      this._tweenPivots(this.trunkPivots, "x", Math.PI / 4, 1.5, "easeOutCubic");
      this.animateCamera({ x: 8, y: 3.5, z: 8 }, { x: 0, y: 0.5, z: 0 }, 1.5);
    });
  }

  closeAllDoors() {
    if (!this.doorsOpen) return;
    this.doorsOpen = false;
    this._tweenPivots(this.doorPivots, "y", 0, 1.0);
    this._tweenPivots(this.trunkPivots, "x", 0, 1.0);
    if (this.bonnetOpen) {
      this.bonnetOpen = false;
      this._tweenPivots(this.hoodPivots, "x", 0, 1.0);
    }
    this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.2);
  }

  show360View() {
    if (!this.carVisible) { this.revealCar(); setTimeout(() => this.show360View(), 1500); return; }
    const radius = 8, height = 2.5, duration = 8;
    const startAngle = Math.atan2(this.scene.camera.position.z, this.scene.camera.position.x);
    const startTime = performance.now();
    const animate = () => {
      const progress = Math.min((performance.now() - startTime) / 1000 / duration, 1);
      if (progress < 1) {
        const angle = startAngle + progress * Math.PI * 2;
        this.scene.camera.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
        this.scene.controls.target.set(0, 0.6, 0);
        this.scene.controls.update();
        requestAnimationFrame(animate);
      } else {
        this.animateCamera({ x: 8, y: 3.0, z: 8 }, { x: 0, y: 0.6, z: 0 }, 1.5);
      }
    };
    animate();
  }
}

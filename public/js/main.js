import { CarScene } from "./carScene.js";
import { CarModel } from "./carModel.js";
import { CarAnimations } from "./carAnimations.js";
import { CarSounds } from "./carSounds.js";
import { AudioPlayer, WebSocketManager } from "./websocket.js";
import { UIController } from "./uiController.js";
import { KeywordDetector } from "./keywordDetector.js";
import { ViewModes } from "./viewModes.js";
import { HotspotSystem } from "./hotspotSystem.js";

const canvas = document.getElementById("three-canvas");
const carScene = new CarScene(canvas);
const carModel = new CarModel(carScene);
const sounds = new CarSounds();
const audioPlayer = new AudioPlayer();
const ui = new UIController();
const mainEl = document.querySelector(".main");
const toggleBtn = document.getElementById("showroom-toggle-btn");
let idleCount = 0;

const openShowroom = () => {
  idleCount = -1;
  toggleBtn.classList.add("active");
  if (mainEl.classList.contains("showroom-open")) return;
  mainEl.classList.add("showroom-open");
  document.getElementById("viewport").addEventListener("transitionend", () => window.dispatchEvent(new Event("resize")), { once: true });
};
const closeShowroom = () => {
  idleCount = 0;
  toggleBtn.classList.remove("active");
  mainEl.classList.remove("showroom-open");
};

toggleBtn.addEventListener("click", () => mainEl.classList.contains("showroom-open") ? closeShowroom() : openShowroom());

let animations = null, viewModes = null, hotspotSystem = null, keywordDetector = null;

ui.setLoadingState(true);

carModel.whenReady().then(() => {
  animations = new CarAnimations(carScene, carModel);
  viewModes = new ViewModes(carScene, animations, carModel, ui);
  hotspotSystem = new HotspotSystem(carScene, carModel);
  keywordDetector = new KeywordDetector(handleCommand);
  carScene.onRender(() => hotspotSystem.update());
  ui.setLoadingState(false);
}).catch(() => ui.setLoadingState(false));

const CMD = {
  show_car_model:     () => { openShowroom(); animations.revealCar(); setTimeout(() => { viewModes?.showUI(); hotspotSystem?.show("exterior"); }, 1500); },
  hide_car_model:     () => { closeShowroom(); animations.hideCar(); viewModes?.hideUI(); hotspotSystem?.hide(); },
  show_trim_info:     a => { openShowroom(); ui.showTrimPanel(a?.trim || "all"); },
  open_bonnet:        () => { openShowroom(); animations.openBonnet(); },
  close_bonnet:       () => { openShowroom(); animations.closeBonnet(); },
  play_engine_start:  () => sounds.playStartup(),
  play_engine_running:() => sounds.playRunning(),
  change_car_color:   a => { if (a?.color) { openShowroom(); carModel.setColor(a.color); } },
  highlight_part:     a => { if (a?.part) { openShowroom(); animations.highlightPart(a.part); } },
  show_360_view:      () => { openShowroom(); animations.show360View(); },
  switch_to_interior: a => { openShowroom(); viewModes?.switchToInterior(a?.row || 1); hotspotSystem?.hide(); hotspotSystem?.show("interior"); },
  switch_to_exterior: () => { openShowroom(); viewModes?.switchToExterior(); hotspotSystem?.hide(); hotspotSystem?.show("exterior"); },
  camera_preset:      a => { if (a?.preset) { openShowroom(); viewModes?.goToPreset(a.preset); } },
  open_all_doors:     () => { openShowroom(); animations.openAllDoors(); },
  close_all_doors:    () => { openShowroom(); animations.closeAllDoors(); },
  toggle_hotspots:    a => { openShowroom(); a?.visible ? hotspotSystem?.show(viewModes?.currentMode || "exterior") : hotspotSystem?.hide(); },
  show_tech_specs:    a => { openShowroom(); ui.showTechSpecs(a?.visible !== false); },
};

function handleCommand(tool, args) {
  if (!animations) {
    carModel.whenReady().then(() => { if (!animations) animations = new CarAnimations(carScene, carModel); handleCommand(tool, args); });
    return;
  }
  CMD[tool]?.(args);
}

const ws = new WebSocketManager({
  onAudioDelta:    base64 => { audioPlayer.resume(); audioPlayer.enqueue(base64); },
  onTranscript:    (text, role, isDone) => {
    ui.addMessage(text, role, isDone);
    if (role === "user" && isDone) {
      if (keywordDetector) keywordDetector.process(text);
      if (mainEl.classList.contains("showroom-open") && ++idleCount >= 3) closeShowroom();
    }
  },
  onStatus:        status => ui.setStatus(status),
  onUICommand:     (tool, args) => handleCommand(tool, args),
  onSpeechStarted: () => { audioPlayer.flush(); sounds.stop(); },
  onError:         msg => console.error("[Error]", msg),
});

const micBtn = document.getElementById("mic-btn");
const chatInput = document.getElementById("chat-input");
let isRecording = false;

function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  audioPlayer.flush();
  ws.sendText(text);
  const detected = keywordDetector?.process(text);
  if (!detected && mainEl.classList.contains("showroom-open") && ++idleCount >= 3) closeShowroom();
  chatInput.value = "";
}

const toggleRec = on => {
  isRecording = on;
  if (on) audioPlayer.flush();
  ws.setRecording(on);
};

document.getElementById("send-btn").addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", e => e.key === "Enter" && sendMessage());
micBtn.addEventListener("mousedown", () => toggleRec(true));
window.addEventListener("mouseup", () => toggleRec(false));
micBtn.addEventListener("touchstart", e => { e.preventDefault(); toggleRec(true); }, { passive: false });
micBtn.addEventListener("touchend", e => { e.preventDefault(); toggleRec(false); }, { passive: false });
document.addEventListener("keydown", e => e.code === "Space" && e.target === document.body && (e.preventDefault(), toggleRec(true)));
document.addEventListener("keyup", e => e.code === "Space" && toggleRec(false));

ws.connect();

import { CarScene } from "./carScene.js";
import { CarModel } from "./carModel.js";
import { CarAnimations } from "./carAnimations.js";
import { CarSounds } from "./carSounds.js";
import { AudioPlayer } from "./audioPlayer.js";
import { WebSocketManager } from "./websocket.js";
import { UIController } from "./uiController.js";
import { KeywordDetector } from "./keywordDetector.js";
import { ViewModes } from "./viewModes.js";
import { HotspotSystem } from "./hotspotSystem.js";

// ── Initialize systems ──────────────────────────────
const canvas = document.getElementById("three-canvas");
const carScene = new CarScene(canvas);
const carModel = new CarModel(carScene);
const sounds = new CarSounds();
const audioPlayer = new AudioPlayer();
const ui = new UIController();

// Systems that need the model loaded first
let animations = null;
let viewModes = null;
let hotspotSystem = null;
let keywordDetector = null;

// Show loading state
ui.setLoadingState(true);

carModel
  .whenReady()
  .then(() => {
    console.log("Car model loaded — initializing all systems");
    animations = new CarAnimations(carScene, carModel);
    viewModes = new ViewModes(carScene, animations, carModel, ui);
    hotspotSystem = new HotspotSystem(carScene, carModel);
    keywordDetector = new KeywordDetector(handleCommand);

    // Hook hotspot updates into the render loop
    carScene.onRender(() => hotspotSystem.update());

    ui.setLoadingState(false);
  })
  .catch((err) => {
    console.error("Failed to load car model:", err);
    ui.setLoadingState(false);
  });

// ── WebSocket with event handlers ───────────────────
const ws = new WebSocketManager({
  onAudioDelta: (base64) => {
    audioPlayer.resume();
    audioPlayer.enqueue(base64);
  },

  onTranscript: (text, role, isDone) => {
    ui.addMessage(text, role, isDone);

    // Detect keywords in user input and auto-trigger commands
    if (role === "user" && isDone && keywordDetector) {
      keywordDetector.process(text);
    }
  },

  onStatus: (status) => {
    ui.setStatus(status);
  },

  onUICommand: (tool, args) => {
    handleCommand(tool, args);
  },

  onSpeechStarted: () => {
    audioPlayer.flush();
    sounds.stop();
  },

  onError: (msg) => {
    console.error("[Error]", msg);
  },
});

// ── Command Dispatcher ──────────────────────────────
window.handleCommand = handleCommand;
function handleCommand(tool, args) {
  if (!animations) {
    console.warn("Model not loaded yet, queuing command:", tool);
    carModel.whenReady().then(() => {
      if (!animations) animations = new CarAnimations(carScene, carModel);
      handleCommand(tool, args);
    });
    return;
  }

  switch (tool) {
    case "show_car_model":
      animations.revealCar();
      // Show all viewport UI overlays after reveal
      setTimeout(() => {
        if (viewModes) viewModes.showUI();
        if (hotspotSystem) hotspotSystem.show("exterior");
      }, 1500);
      break;

    case "hide_car_model":
      animations.hideCar();
      if (viewModes) viewModes.hideUI();
      if (hotspotSystem) hotspotSystem.hide();
      break;

    case "show_trim_info":
      ui.showTrimPanel(args?.trim || "all");
      break;

    case "open_bonnet":
      animations.openBonnet();
      break;

    case "close_bonnet":
      animations.closeBonnet();
      break;

    case "play_engine_start":
      sounds.playStartup();
      break;

    case "play_engine_running":
      sounds.playRunning();
      break;

    case "change_car_color":
      if (args?.color) {
        carModel.setColor(args.color);
      }
      break;

    case "highlight_part":
      if (args?.part) {
        animations.highlightPart(args.part);
      }
      break;

    case "show_360_view":
      animations.show360View();
      break;

    // ── New commands ──────────────────────────────

    case "switch_to_interior":
      if (viewModes) {
        viewModes.switchToInterior(args?.row || 1);
        if (hotspotSystem) {
          hotspotSystem.hide();
          hotspotSystem.show("interior");
        }
      }
      break;

    case "switch_to_exterior":
      if (viewModes) {
        viewModes.switchToExterior();
        if (hotspotSystem) {
          hotspotSystem.hide();
          hotspotSystem.show("exterior");
        }
      }
      break;

    case "camera_preset":
      if (viewModes && args?.preset) {
        viewModes.goToPreset(args.preset);
      }
      break;

    case "open_all_doors":
      animations.openAllDoors();
      break;

    case "close_all_doors":
      animations.closeAllDoors();
      break;

    case "toggle_hotspots":
      if (hotspotSystem) {
        if (args?.visible) {
          hotspotSystem.show(viewModes?.currentMode || "exterior");
        } else {
          hotspotSystem.hide();
        }
      }
      break;

    case "show_tech_specs":
      ui.showTechSpecs(args?.visible !== false);
      break;
  }
}

// ── Text Input & Push to Speak ──────────────────────
const micBtn = document.getElementById("mic-btn");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");

function sendMessage() {
  const text = chatInput.value.trim();
  if (text) {
    audioPlayer.flush(); // Stop previous assistant speech
    ws.sendText(text);

    // Also detect keywords in typed text
    if (keywordDetector) {
      keywordDetector.process(text);
    }

    chatInput.value = "";
  }
}

sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

let isRecording = false;

function startRecording() {
  if (!isRecording) {
    isRecording = true;
    audioPlayer.flush(); // Stop previous assistant speech
    micBtn.classList.add("active");
    ws.setRecording(true);
  }
}

function stopRecording() {
  if (isRecording) {
    isRecording = false;
    micBtn.classList.remove("active");
    ws.setRecording(false);
  }
}

micBtn.addEventListener("mousedown", startRecording);
window.addEventListener("mouseup", stopRecording);
micBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
  startRecording();
});
micBtn.addEventListener("touchend", (e) => {
  e.preventDefault();
  stopRecording();
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && e.target === document.body) {
    e.preventDefault();
    startRecording();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") stopRecording();
});

// ── Auto-connect on page load ────────────────────────
ws.connect();

console.log("BYD Seal Voice Assistant initialized");

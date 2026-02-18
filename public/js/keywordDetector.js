// ── Keyword Detection System ────────────────────────
// Automatically triggers visual commands based on user input
// This ensures visual feedback even if AI doesn't call tools

export class KeywordDetector {
  constructor(handleCommand) {
    this.handleCommand = handleCommand;

    // Part keywords mapped to command arguments
    this.partKeywords = {
      // Interior parts
      infotainment_screen: [
        "infotainment",
        "screen",
        "display",
        "music system",
        "touchscreen",
        "entertainment system",
      ],
      dashboard: ["dashboard", "dash"],
      seats: ["seat", "seating"],
      steering_wheel: ["steering wheel", "steering", "wheel controls"],
      center_console: ["center console", "console", "armrest"],
      instrument_cluster: [
        "instrument cluster",
        "gauge cluster",
        "instrument panel",
        "digital display",
      ],
      interior_trim: [
        "interior trim",
        "leather trim",
        "interior finish",
        "interior material",
      ],
      interior_controls: ["interior controls", "door controls", "buttons"],

      // Exterior parts
      headlights: ["headlight", "front light", "led headlight"],
      taillights: ["taillight", "rear light", "back light", "tail light"],
      front_bumper: ["front bumper", "front end"],
      rear_bumper: ["rear bumper", "back bumper"],
      grille: ["grille", "front grille", "grill"],
      hood: ["hood", "bonnet", "engine cover"],
      doors: ["door", "car door"],
      trunk: ["trunk", "tailgate", "boot", "cargo area"],
      wheels: ["wheel", "rim", "alloy wheel", "tire", "tyre"],
      mirrors: ["mirror", "side mirror", "wing mirror"],
      windshield: ["windshield", "front glass", "windscreen"],
      rear_window: ["rear window", "back glass", "back window"],
      side_windows: ["side window", "window"],
      body: ["body", "exterior", "overall design"],
      engine: ["engine", "motor", "under the hood", "engine bay"],
    };

    // Special commands
    this.specialCommands = {
      show_car: [
        "show me the car",
        "let me see the car",
        "display the car",
        "reveal the car",
      ],
      hide_car: ["hide the car", "close the car", "remove the car"],
      show_360: [
        "360 view",
        "360 degree",
        "rotate the car",
        "spin the car",
        "show all angles",
        "show from every side",
        "spin it around",
      ],
      open_bonnet: [
        "open the hood",
        "open bonnet",
        "open the bonnet",
        "show engine",
        "show me the engine",
      ],
      close_bonnet: ["close the hood", "close bonnet", "close the bonnet"],
      engine_start: [
        "engine start",
        "startup sound",
        "start sound",
        "hear the engine start",
      ],
      engine_running: [
        "engine running",
        "running sound",
        "hear the engine",
        "engine sound",
      ],
      // New view mode commands
      show_interior: [
        "show me the interior",
        "inside of the car",
        "show me inside",
        "cabin view",
        "show the cabin",
        "interior view",
        "show interior",
        "view interior",
        "look inside",
      ],
      show_exterior: [
        "show exterior",
        "outside view",
        "exterior view",
        "show outside",
        "view exterior",
        "back to exterior",
      ],
      show_rear_seats: [
        "rear seats",
        "back seats",
        "second row",
        "2nd row",
        "rear seat view",
        "back seat view",
      ],
      open_doors: [
        "open all doors",
        "open the doors",
        "doors open view",
        "show doors open",
        "open doors",
      ],
      close_doors: ["close all doors", "close the doors", "close doors"],
      front_view: [
        "front view",
        "show from front",
        "view from front",
        "see the front",
      ],
      rear_view: [
        "rear view",
        "show from back",
        "view from behind",
        "back view",
        "see the back",
      ],
      side_view: [
        "side view",
        "show from side",
        "view from side",
        "see the side",
      ],
      show_specs: [
        "show specs",
        "technical specifications",
        "performance numbers",
        "show performance",
        "tech specs",
      ],
      show_hotspots: [
        "show hotspots",
        "show info points",
        "interactive markers",
        "show information points",
      ],
    };

    // Color keywords
    this.colorKeywords = [
      "red",
      "blue",
      "white",
      "black",
      "silver",
      "grey",
      "gray",
      "green",
      "yellow",
      "orange",
      "purple",
      "brown",
    ];
  }

  detect(text) {
    if (!text) return null;

    const lowerText = text.toLowerCase().trim();

    // 1. Check for special commands first
    for (const [commandKey, keywords] of Object.entries(this.specialCommands)) {
      for (const keyword of keywords) {
        if (lowerText.includes(keyword)) {
          const result = this.getCommandForSpecial(commandKey);
          if (result) return result;
        }
      }
    }

    // 2. Check for color change
    if (
      lowerText.includes("change") ||
      lowerText.includes("make it") ||
      lowerText.includes("color") ||
      lowerText.includes("paint") ||
      lowerText.includes("show it in")
    ) {
      for (const color of this.colorKeywords) {
        if (lowerText.includes(color)) {
          return { tool: "change_car_color", args: { color } };
        }
      }
    }

    // 3. Check for part highlighting
    // Matches: "show me the [part]", "look at [part]", "zoom to [part]", "where is [part]"
    const isShowRequest =
      lowerText.includes("show") ||
      lowerText.includes("see") ||
      lowerText.includes("look") ||
      lowerText.includes("zoom") ||
      lowerText.includes("view") ||
      lowerText.includes("where is") ||
      lowerText.includes("check out");

    if (isShowRequest) {
      for (const [partName, keywords] of Object.entries(this.partKeywords)) {
        for (const keyword of keywords) {
          if (lowerText.includes(keyword)) {
            // Return strictly the format expected by handleCommand(tool, args)
            return { tool: "highlight_part", args: { part: partName } };
          }
        }
      }
    }

    return null;
  }

  getCommandForSpecial(command) {
    const commandMap = {
      show_car: { command: "show_car_model", args: {} },
      hide_car: { command: "hide_car_model", args: {} },
      show_360: { command: "show_360_view", args: {} },
      open_bonnet: { command: "open_bonnet", args: {} },
      close_bonnet: { command: "close_bonnet", args: {} },
      engine_start: { command: "play_engine_start", args: {} },
      engine_running: { command: "play_engine_running", args: {} },
      // New commands
      show_interior: { command: "switch_to_interior", args: { row: 1 } },
      show_exterior: { command: "switch_to_exterior", args: {} },
      show_rear_seats: { command: "switch_to_interior", args: { row: 2 } },
      open_doors: { command: "open_all_doors", args: {} },
      close_doors: { command: "close_all_doors", args: {} },
      front_view: { command: "camera_preset", args: { preset: "front" } },
      rear_view: { command: "camera_preset", args: { preset: "rear" } },
      side_view: { command: "camera_preset", args: { preset: "side_right" } },
      show_specs: { command: "show_tech_specs", args: { visible: true } },
      show_hotspots: { command: "toggle_hotspots", args: { visible: true } },
    };
    return commandMap[command] || null;
  }

  // Process user input and trigger command if detected
  process(text) {
    const detected = this.detect(text);
    if (detected) {
      // The detect function returns { tool: "...", args: {...} } OR { command: "...", args: {...} } depending on where fit
      // Standardize to tool
      const tool = detected.tool || detected.command;
      const args = detected.args;

      console.log(`[KeywordDetector] Detected: ${tool}`, args);
      this.handleCommand(tool, args);
      return true;
    }
    return false;
  }
}

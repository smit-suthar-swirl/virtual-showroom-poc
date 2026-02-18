const PART_MAP = {
  infotainment_screen: ["infotainment", "screen", "display", "music system", "touchscreen", "entertainment system"],
  dashboard: ["dashboard", "dash"],
  seats: ["seat", "seating"],
  steering_wheel: ["steering wheel", "steering", "wheel controls"],
  center_console: ["center console", "console", "armrest"],
  instrument_cluster: ["instrument cluster", "gauge cluster", "instrument panel", "digital display"],
  interior_trim: ["interior trim", "leather trim", "interior finish", "interior material"],
  interior_controls: ["interior controls", "door controls", "buttons"],
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

const SPECIAL_MAP = {
  show_car:       { kw: ["show me the car", "let me see the car", "display the car", "reveal the car"],     r: { command: "show_car_model", args: {} } },
  hide_car:       { kw: ["hide the car", "close the car", "remove the car"],                                 r: { command: "hide_car_model", args: {} } },
  show_360:       { kw: ["360 view", "360 degree", "rotate the car", "spin the car", "show all angles", "show from every side", "spin it around"], r: { command: "show_360_view", args: {} } },
  open_bonnet:    { kw: ["open the hood", "open bonnet", "open the bonnet", "show engine", "show me the engine"], r: { command: "open_bonnet", args: {} } },
  close_bonnet:   { kw: ["close the hood", "close bonnet", "close the bonnet"],                              r: { command: "close_bonnet", args: {} } },
  engine_start:   { kw: ["engine start", "startup sound", "start sound", "hear the engine start"],           r: { command: "play_engine_start", args: {} } },
  engine_running: { kw: ["engine running", "running sound", "hear the engine", "engine sound"],              r: { command: "play_engine_running", args: {} } },
  show_interior:  { kw: ["show me the interior", "inside of the car", "show me inside", "cabin view", "show the cabin", "interior view", "show interior", "view interior", "look inside"], r: { command: "switch_to_interior", args: { row: 1 } } },
  show_exterior:  { kw: ["show exterior", "outside view", "exterior view", "show outside", "view exterior", "back to exterior"], r: { command: "switch_to_exterior", args: {} } },
  show_rear_seats:{ kw: ["rear seats", "back seats", "second row", "2nd row", "rear seat view", "back seat view"], r: { command: "switch_to_interior", args: { row: 2 } } },
  open_doors:     { kw: ["open all doors", "open the doors", "doors open view", "show doors open", "open doors"], r: { command: "open_all_doors", args: {} } },
  close_doors:    { kw: ["close all doors", "close the doors", "close doors"],                               r: { command: "close_all_doors", args: {} } },
  front_view:     { kw: ["front view", "show from front", "view from front", "see the front"],               r: { command: "camera_preset", args: { preset: "front" } } },
  rear_view:      { kw: ["rear view", "show from back", "view from behind", "back view", "see the back"],    r: { command: "camera_preset", args: { preset: "rear" } } },
  side_view:      { kw: ["side view", "show from side", "view from side", "see the side"],                   r: { command: "camera_preset", args: { preset: "side_right" } } },
  show_specs:     { kw: ["show specs", "technical specifications", "performance numbers", "show performance", "tech specs"], r: { command: "show_tech_specs", args: { visible: true } } },
  show_hotspots:  { kw: ["show hotspots", "show info points", "interactive markers", "show information points"], r: { command: "toggle_hotspots", args: { visible: true } } },
};

const COLORS = ["red", "blue", "white", "black", "silver", "grey", "gray", "green", "yellow", "orange", "purple", "brown"];
const COLOR_TRIGGERS = ["change", "make it", "color", "paint", "show it in"];
const SHOW_TRIGGERS = ["show", "see", "look", "zoom", "view", "where is", "check out"];

export class KeywordDetector {
  constructor(handleCommand) {
    this.handleCommand = handleCommand;
  }

  detect(text) {
    if (!text) return null;
    const t = text.toLowerCase().trim();
    const special = Object.values(SPECIAL_MAP).find(({ kw }) => kw.some(k => t.includes(k)));
    if (special) return special.r;
    if (COLOR_TRIGGERS.some(c => t.includes(c))) {
      const color = COLORS.find(c => t.includes(c));
      if (color) return { tool: "change_car_color", args: { color } };
    }
    if (SHOW_TRIGGERS.some(s => t.includes(s))) {
      for (const [part, kws] of Object.entries(PART_MAP)) {
        if (kws.some(k => t.includes(k))) return { tool: "highlight_part", args: { part } };
      }
    }
    return null;
  }

  process(text) {
    const d = this.detect(text);
    if (!d) return false;
    this.handleCommand(d.tool || d.command, d.args);
    return true;
  }
}

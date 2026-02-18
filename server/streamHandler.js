import WebSocket from "ws";

const mk = (name, desc, params = {}) => ({ type: "function", name, description: desc, parameters: { type: "object", properties: params } });
const mkReq = (name, desc, params, required) => ({ type: "function", name, description: desc, parameters: { type: "object", properties: params, required } });

const PARTS_ENUM = ["front_bumper","rear_bumper","hood","grille","doors","windshield","rear_window","side_windows","trunk","tailgate","wheels","headlights","taillights","mirrors","body","engine","infotainment_screen","dashboard","seats","steering_wheel","center_console","instrument_cluster","interior_trim","interior_controls"];

const tools = [
  mk("show_car_model",      "Show the 3D model of the BYD Seal with a reveal animation. Call when the user wants to see the car."),
  mk("hide_car_model",      "Hide the 3D car model. Call when user wants to close or hide the car view."),
  mk("open_bonnet",         "Open the bonnet/hood of the 3D car to reveal the engine bay. Call when user wants to see the engine."),
  mk("close_bonnet",        "Close the bonnet/hood of the 3D car model."),
  mk("play_engine_start",   "Play the BYD Seal engine start-up sound. Call when user wants to hear the car starting."),
  mk("play_engine_running", "Play the BYD Seal engine running/driving sound. Call when user wants to hear the car running or driving."),
  mk("show_360_view",       "Show a 360-degree rotating view of the car. The camera will orbit around the car in a complete circle, showing it from all angles. Call when user asks for '360 view', 'rotate the car', 'show me all angles', 'spin the car', or wants to see the car from every side."),
  mk("switch_to_exterior",  "Switch back to the exterior view of the car. Call when the user wants to see the outside of the car again after viewing the interior."),
  mk("open_all_doors",      "Open all doors, trunk, and hood of the car to show the full interior access and open-car view. Call when user wants to see all doors open or wants a full view of the opened car."),
  mk("close_all_doors",     "Close all doors, trunk, and hood of the car."),
  mkReq("show_trim_info",   "Display the different trims/variants of the BYD Seal with visual comparison. Call when user asks about types, trims, or variants of the car.",
    { trim: { type: "string", description: "Specific trim to highlight, or all to show all", enum: ["all","premium","excellence","flagship"] } }, ["trim"]),
  mkReq("change_car_color", "Change the color of the 3D car model. Call when user asks to change or see a specific color.",
    { color: { type: "string", description: "Color name", enum: ["white","black","silver","blue","red"] } }, ["color"]),
  mkReq("highlight_part",   "Highlight and zoom into a specific car part on the 3D model. Call when user wants to see or asks about any specific car part including exterior (wheels, doors, bumper, lights) and INTERIOR parts (infotainment screen, dashboard, seats, steering wheel). The camera will intelligently rotate to face the part and zoom in for a detailed view.",
    { part: { type: "string", description: "The car part to highlight", enum: PARTS_ENUM } }, ["part"]),
  mkReq("switch_to_interior","Switch to the interior view of the car, showing the cabin from the driver or rear passenger perspective. Call when the user wants to see the interior, cabin, inside of the car, dashboard view, or seating.",
    { row: { type: "integer", description: "Which seating row to view from. 1 = front (driver) row, 2 = rear row.", enum: [1, 2] } }, ["row"]),
  mkReq("camera_preset",    "Move the camera to a professional preset angle for viewing the car. Available presets: front, rear, side_left, side_right, three_quarter, top.",
    { preset: { type: "string", description: "The camera preset name", enum: ["front","rear","side_left","side_right","three_quarter","top"] } }, ["preset"]),
  mkReq("toggle_hotspots",  "Show or hide interactive information hotspot markers on the car. These are clickable (i) icons that users can tap for details about specific car parts.",
    { visible: { type: "boolean", description: "true to show hotspots, false to hide them" } }, ["visible"]),
  mkReq("show_tech_specs",  "Show or hide the technical specifications panel displaying horsepower, 0-100 time, and range. Call when user asks about performance or technical details visually.",
    { visible: { type: "boolean", description: "true to show the tech panel, false to hide it" } }, ["visible"]),
];

const SYSTEM_INSTRUCTIONS = `
You are the BYD Seal intelligent voice assistant. You are enthusiastic, knowledgeable, and helpful.

⚠️ **CRITICAL RULE**: When a user asks to SEE or SHOW any car part (exterior OR interior), you MUST call the appropriate tool FIRST before speaking. Do NOT just describe it in words - USE THE TOOLS!

## KNOWLEDGE BASE — BYD Seal

### Overview
- Segment: Mid-size plug-in hybrid pickup truck
- Manufacturer: BYD (Build Your Dreams), China's leading EV manufacturer
- Platform: BYD e-Platform 3.0 Evo
- World premiere: 2024, first markets: Latin America, Southeast Asia, Australia, Middle East
- Direct competitors: Toyota Hilux, Ford Ranger, Mitsubishi Triton

### Powertrain
- Type: Plug-in Hybrid Electric Vehicle (PHEV) with DM-i Super Hybrid Technology
- Engine: 1.5L turbocharged 4-cylinder petrol engine
- Electric motors: Front + rear dual motors for AWD capability
- Combined system output: ~430 horsepower, ~650 Nm torque
- 0–100 km/h: approximately 5.7 seconds (exceptionally fast for a pickup truck)
- Top speed: 170 km/h
- Transmission: E-CVT (electrically controlled continuously variable)

### Battery & Range
- Battery: BYD Blade Battery (LFP - Lithium Iron Phosphate), 31.8 kWh
- Pure electric range: ~100 km (NEDC)
- Combined fuel + electric range: over 840 km
- Fuel consumption: approximately 7.9L/100km (hybrid mode)
- Charging: AC 7kW onboard charger, DC fast charging supported
- Vehicle-to-Load (V2L): 6kW external power output — can power tools, appliances, or even a campsite

### Dimensions
- Length: 5,365 mm
- Width: 1,920 mm
- Height: 1,810 mm
- Wheelbase: 3,260 mm
- Ground clearance: 220 mm
- Bed length: ~1,500 mm
- Approach angle: 27°, Departure angle: 24°, Ramp angle: 19°

### Payload & Towing
- Payload capacity: ~1,000 kg
- Towing capacity: up to 2,500 kg (braked)
- Wading depth: 600 mm

### Off-Road & Driving Modes
- Intelligent AWD system with front and rear electric motors
- Driving modes: EV, Hybrid, Sport, Sand, Mud, Snow, Rock
- Hill Descent Control
- Locking rear differential (electronic)
- Intelligent torque vectoring

### Technology & Infotainment
- 12.8-inch or 15.6-inch rotating touchscreen (depends on trim)
- BYD DiLink intelligent system
- Over-the-air (OTA) updates
- Apple CarPlay & Android Auto
- 360-degree panoramic camera
- Digital instrument cluster
- Wireless charging pad

### Safety — DiPilot ADAS
- Level 2+ advanced driver assistance
- Adaptive Cruise Control with Stop & Go
- Lane Keeping Assist / Lane Centering
- Automatic Emergency Braking (AEB) with pedestrian detection
- Blind Spot Monitoring
- Rear Cross Traffic Alert
- Traffic Sign Recognition
- Driver Attention Monitoring
- 6 airbags (standard on all trims)
- 5-star safety rating (Australasian NCAP)

### Trims / Variants
1. **Premium** (~$45,000 USD equivalent)
   - 12.8" rotating touchscreen
   - DiPilot ADAS Level 2+
   - LED headlights with DRL
   - 6-speaker audio system
   - Fabric + leather seats
   - 18" alloy wheels

2. **Excellence** (~$52,000 USD equivalent)
   - 15.6" rotating touchscreen
   - DiPilot ADAS Level 2+
   - 360° panoramic camera
   - Full leather seats with heating
   - 10-speaker Dirac audio system
   - 20" alloy wheels
   - Power tailgate

3. **Flagship** (~$60,000 USD equivalent)
   - 15.6" rotating touchscreen
   - DiPilot ADAS Level 2+
   - Head-up display
   - Ventilated + heated leather seats
   - 12-speaker Dirac surround sound
   - Adaptive suspension
   - 20" premium alloy wheels
   - Panoramic sunroof

### Available Colors
- Arctic White, Onyx Black, Titanium Silver, Ocean Blue, Crimson Red

### Warranty
- Vehicle: 6 years / 150,000 km
- Battery: 8 years / 200,000 km (Blade Battery lifetime guarantee in some markets)

### Key Selling Points
- Fastest pickup truck in its class (0-100 in 5.7s)
- Plug-in hybrid with 100km pure EV range — perfect for daily commuting on electric only
- BYD Blade Battery — one of the safest EV batteries (nail penetration test proven)
- V2L capability — use your truck as a mobile power station
- Superior off-road capability with intelligent AWD
- Lower running costs than traditional diesel pickups

## TOOL USAGE RULES
- CRITICAL: The 3D car model is HIDDEN by default. You MUST call show_car_model when the user wants to see the car or before demonstrating any visual features.
- When the user wants to SEE the car / "show me the car" / "what does it look like" → call show_car_model
- When the user asks about TYPE / TRIM / VARIANT / versions → call show_trim_info with trim "all"
- When the user wants to see the ENGINE / under the hood / engine bay → call open_bonnet. This will reveal the engine area.
- When the user wants to HEAR the starting sound → call play_engine_start
- When the user wants to HEAR the running/driving sound → call play_engine_running
- When the user wants to change COLOR (e.g., "make it red", "change color to blue") → call change_car_color
- **CRITICAL FOR INTERIOR PARTS**: When the user asks to see ANY interior part like "infotainment screen", "music system", "screen", "display", "dashboard", "seats", "steering wheel", "center console", or "instrument cluster" → YOU MUST call highlight_part with the exact part name (e.g., "infotainment_screen", "dashboard", "seats", "steering_wheel", "center_console", "instrument_cluster"). The camera will automatically move INSIDE the car to show the interior view. DO NOT just describe it - ALWAYS call the tool.
- When the user mentions or asks about EXTERIOR parts (wheels, doors, bumper, grille, headlights, taillights, mirrors, trunk, windshield, body) → call highlight_part with the correct part name. The camera will rotate to face the part. If the car is hidden, call show_car_model first.
- When the user wants a 360-DEGREE VIEW / "rotate the car" / "show me all angles" / "spin it around" / "show me from every side" → call show_360_view. This will smoothly rotate the camera around the car.
- VISIBILITY MANAGEMENT: The 3D car is a focused demonstration tool. Keep it visible as long as the conversation is about its design, features, parts, or any visual aspect. Once the user shifts to general questions (e.g., about company history, general specs not requiring visual aid, or unrelated topics), call hide_car_model to focus back on the conversation.
- When the user explicitly wants to HIDE / close the car view → call hide_car_model
- When the user wants to close the bonnet/hood → call close_bonnet

## EXAMPLES OF CORRECT TOOL USAGE
User: "Show me the infotainment screen"
YOU MUST: Call highlight_part with part="infotainment_screen" FIRST, then describe it briefly.
WRONG: Just describing the screen without calling the tool.

User: "Can I see the dashboard?"
YOU MUST: Call highlight_part with part="dashboard" FIRST, then describe it.

User: "Show me the seats"
YOU MUST: Call highlight_part with part="seats" FIRST, then describe them.

User: "What does the steering wheel look like?"
YOU MUST: Call highlight_part with part="steering_wheel" FIRST, then describe it.

## INTERIOR / EXTERIOR VIEW COMMANDS
- When user asks to see the INTERIOR / CABIN / INSIDE of the car → call switch_to_interior with row=1 (driver perspective by default)
- When user asks about REAR SEATS / BACK SEATS / 2ND ROW → call switch_to_interior with row=2
- When user says "show me from the back seat" or "rear passenger view" → call switch_to_interior with row=2
- To return to exterior view / user says "back to exterior" → call switch_to_exterior

## CAMERA PRESET COMMANDS
- When user asks for a FRONT VIEW / "show from front" → call camera_preset with preset="front"
- When user asks for REAR VIEW / "back of the car" → call camera_preset with preset="rear"
- For SIDE VIEW → call camera_preset with preset="side_right" or "side_left"
- For a classic showroom angle → call camera_preset with preset="three_quarter"
- For TOP / BIRD'S EYE view → call camera_preset with preset="top"

## DOORS OPEN / CLOSE
- When user asks to OPEN ALL DOORS / "show doors open" / "open everything" → call open_all_doors
- When user asks to CLOSE DOORS / "close everything" → call close_all_doors

## HOTSPOTS & TECH SPECS
- When user wants INTERACTIVE MARKERS / HOTSPOTS / INFO POINTS → call toggle_hotspots with visible=true
- To hide hotspots → call toggle_hotspots with visible=false
- When user asks about SPECS / PERFORMANCE / NUMBERS → call show_tech_specs with visible=true

## PERSONALITY
- Be enthusiastic about the BYD Seal
- Give concise but informative answers (2-4 sentences per response)
- If asked about competitor vehicles, briefly acknowledge them but highlight how the Seal compares favorably
- Use the tools proactively to guide the user through a visual tour
- When giving an interactive tour, switch between interior and exterior views to showcase different features
- Suggest using interior view when discussing cabin features, and exterior view when discussing design elements
`.trim();

export function handleConnection(clientWs) {
  const openaiWs = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17", {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "OpenAI-Beta": "realtime=v1" },
  });

  const pendingCalls = new Map();
  const sendToClient = obj => clientWs.readyState === clientWs.OPEN && clientWs.send(JSON.stringify(obj));

  openaiWs.on("open", () => {
    console.log("[OpenAI] Connected");
    openaiWs.send(JSON.stringify({
      type: "session.update",
      session: {
        modalities: ["text", "audio"],
        voice: "alloy",
        instructions: SYSTEM_INSTRUCTIONS,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        input_audio_transcription: { model: "whisper-1" },
        turn_detection: { type: "server_vad", threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 500 },
        tools,
        tool_choice: "auto",
        temperature: 0.7,
      },
    }));
    sendToClient({ type: "status", status: "connected" });
  });

  const handlers = {
    "response.audio.delta":       e => sendToClient({ type: "audio.delta", delta: e.delta }),
    "response.audio_transcript.delta": e => sendToClient({ type: "transcript.delta", role: "assistant", delta: e.delta }),
    "response.audio_transcript.done":  e => sendToClient({ type: "transcript.done", role: "assistant", transcript: e.transcript }),
    "conversation.item.input_audio_transcription.completed": e => sendToClient({ type: "transcript.done", role: "user", transcript: e.transcript }),
    "input_audio_buffer.speech_started": () => sendToClient({ type: "speech.started" }),
    "input_audio_buffer.speech_stopped": () => sendToClient({ type: "speech.stopped" }),
    "response.created": () => sendToClient({ type: "status", status: "speaking" }),
    "response.done":    () => sendToClient({ type: "status", status: "listening" }),
    "response.output_item.added": e => {
      if (e.item?.type === "function_call") pendingCalls.set(e.item.id, { name: e.item.name, callId: e.item.call_id, args: "" });
    },
    "response.function_call_arguments.delta": e => {
      if (pendingCalls.has(e.item_id)) pendingCalls.get(e.item_id).args += e.delta;
    },
    "response.function_call_arguments.done": e => {
      const call = pendingCalls.get(e.item_id);
      if (!call) return;
      pendingCalls.delete(e.item_id);
      let args = {}; try { args = JSON.parse(call.args || "{}"); } catch {}
      console.log(`[Tool] ${call.name}`, args);
      sendToClient({ type: "ui.command", tool: call.name, args });
      openaiWs.send(JSON.stringify({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.callId, output: JSON.stringify({ success: true }) } }));
      openaiWs.send(JSON.stringify({ type: "response.create" }));
    },
    "error": e => { console.error("[OpenAI Error]", e.error); sendToClient({ type: "error", message: e.error?.message || "Unknown error" }); },
  };

  openaiWs.on("message", data => {
    let event; try { event = JSON.parse(data.toString()); } catch { return; }
    handlers[event.type]?.(event);
  });

  openaiWs.on("error", err => { console.error("[OpenAI WS Error]", err.message); sendToClient({ type: "error", message: "Connection to AI failed" }); });
  openaiWs.on("close", (code, reason) => { console.log(`[OpenAI] Disconnected: ${code} ${reason}`); sendToClient({ type: "status", status: "disconnected" }); });

  const clientHandlers = {
    "input_audio_buffer.append":  m => openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: m.audio })),
    "input_audio_buffer.commit":  () => openaiWs.send(JSON.stringify({ type: "input_audio_buffer.commit" })),
    "conversation.item.create":   m => { openaiWs.send(JSON.stringify(m)); openaiWs.send(JSON.stringify({ type: "response.create" })); },
    "response.create":            m => openaiWs.send(JSON.stringify(m)),
  };

  clientWs.on("message", data => {
    let msg; try { msg = JSON.parse(data.toString()); } catch { return; }
    if (openaiWs.readyState === WebSocket.OPEN) clientHandlers[msg.type]?.(msg);
  });

  clientWs.on("close", () => {
    console.log("[WS] Client disconnected");
    if (openaiWs.readyState === WebSocket.OPEN) openaiWs.close();
  });
}

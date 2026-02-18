const trims = {
  premium: {
    name: "Seal Premium", price: "$45,000", power: "430 hp combined", evRange: "100 km EV range",
    features: ['12.8" rotating touchscreen', "DiPilot ADAS Level 2+", "LED headlights with DRL", "6-speaker audio system", "Fabric + leather seats", '18" alloy wheels'],
    accent: "#e63946",
  },
  excellence: {
    name: "Seal Excellence", price: "$52,000", power: "430 hp combined", evRange: "100 km EV range",
    features: ['15.6" rotating touchscreen', "DiPilot ADAS Level 2+", "360° panoramic camera", "Full leather heated seats", "10-speaker Dirac audio", '20" alloy wheels', "Power tailgate"],
    accent: "#3a86ff",
  },
  flagship: {
    name: "Seal Flagship", price: "$60,000", power: "430 hp combined", evRange: "100 km EV range",
    features: ['15.6" rotating touchscreen', "DiPilot ADAS Level 2+", "Head-up display", "Ventilated + heated leather seats", "12-speaker Dirac surround", "Adaptive suspension", '20" premium alloy wheels', "Panoramic sunroof"],
    accent: "#4ecdc4",
  },
};

export class UIController {
  constructor() {
    this.chatEl = document.getElementById("chat");
    this.statusEl = document.getElementById("status");
    this.statusTextEl = document.getElementById("status-text");
    this.visualizerEl = document.getElementById("visualizer");
    this.micBtn = document.getElementById("mic-btn");
    this.micHint = document.getElementById("mic-hint");
    this.trimPanel = document.getElementById("trim-panel");
    this.viewportToolbar = document.getElementById("viewport-toolbar");
    this.techDetailsPanel = document.getElementById("tech-details-panel");
    this.bottomNav = document.getElementById("bottom-nav");
    this.interiorHint = document.getElementById("interior-hint");
    this.currentAssistantBubble = null;
    this.welcomeShown = true;
    this.loadingEl = null;
  }

  setLoadingState(loading) {
    if (loading && !this.loadingEl) {
      this.loadingEl = document.createElement("div");
      this.loadingEl.className = "car-info-overlay";
      this.loadingEl.style.cssText = "top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:24px 32px;";
      this.loadingEl.innerHTML = `<div style="font-size:1.1rem;font-weight:600;margin-bottom:8px;">Loading 3D Model...</div><div style="font-size:0.8rem;color:#7a8299;">BYD Seal</div>`;
      document.getElementById("viewport").appendChild(this.loadingEl);
    } else if (!loading && this.loadingEl) {
      this.loadingEl.remove();
      this.loadingEl = null;
    }
  }

  setStatus(status) {
    this.statusEl.className = `status ${status}`;
    const labels = { disconnected: "Disconnected", connected: "Connected", listening: "Listening", speaking: "Speaking" };
    const hints = { listening: "I am listening...", speaking: "Assistant is speaking" };
    this.statusTextEl.textContent = labels[status] || status;
    this.micBtn.classList.toggle("active", status === "listening" || status === "speaking");
    this.micHint.textContent = hints[status] || "Hold mic or type below";
    this.visualizerEl.classList.toggle("active", status === "speaking");
  }

  addMessage(text, role, isDone) {
    if (this.welcomeShown) {
      this.chatEl.querySelector(".chat-welcome")?.remove();
      this.welcomeShown = false;
    }
    if (role === "user" && isDone) {
      const div = document.createElement("div");
      div.className = "msg user";
      div.innerHTML = `<div class="msg-label">You</div><div>${this.escapeHtml(text)}</div>`;
      this.chatEl.appendChild(div);
      this.currentAssistantBubble = null;
      this.scrollChat();
      return;
    }
    if (role === "assistant") {
      if (isDone) {
        this.currentAssistantBubble?.querySelector(".msg-text")?.textContent === undefined
          ? null
          : (this.currentAssistantBubble.querySelector(".msg-text").textContent = text);
        this.currentAssistantBubble = null;
        this.scrollChat();
        return;
      }
      if (!this.currentAssistantBubble) {
        const div = document.createElement("div");
        div.className = "msg assistant";
        div.innerHTML = `<div class="msg-label">BYD Assistant</div><div class="msg-text"></div>`;
        this.chatEl.appendChild(div);
        this.currentAssistantBubble = div;
      }
      this.currentAssistantBubble.querySelector(".msg-text").textContent += text;
      this.scrollChat();
    }
  }

  scrollChat() { this.chatEl.scrollTop = this.chatEl.scrollHeight; }

  escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  showTrimPanel(trimKey) {
    const list = trimKey === "all" ? Object.values(trims) : [trims[trimKey]].filter(Boolean);
    if (!list.length) return;
    this.trimPanel.innerHTML = `<div style="position:relative"><button class="trim-card-close" id="trim-close-btn">&times;</button>${
      list.map(t => `<div class="trim-card" style="border-color:${t.accent}">
        <div class="trim-card-name" style="color:${t.accent}">${t.name}</div>
        <div class="trim-card-price">${t.price}</div>
        <div style="font-size:0.75rem;color:#7a8299;margin-bottom:8px">${t.power} &middot; ${t.evRange}</div>
        <ul class="trim-card-specs">${t.features.map(f => `<li>${f}</li>`).join("")}</ul>
      </div>`).join("")
    }</div>`;
    this.trimPanel.classList.remove("hidden");
    document.getElementById("trim-close-btn").addEventListener("click", () => this.hideTrimPanel());
  }

  hideTrimPanel() {
    this.trimPanel.classList.add("hidden");
    this.trimPanel.innerHTML = "";
  }

  _toggle(ids, show) {
    ids.forEach(id => document.getElementById(id)?.classList.toggle("hidden", !show));
  }

  showViewportUI() { this._toggle(["viewport-toolbar", "bottom-nav", "tech-details-panel"], true); }

  hideViewportUI() {
    this._toggle(["viewport-toolbar", "bottom-nav", "tech-details-panel", "seating-rows-dropdown", "interior-hint"], false);
  }

  showTechSpecs(visible) {
    this.techDetailsPanel?.classList.toggle("hidden", !visible);
  }

  setViewMode(mode, row) {
    const isInt = mode === "interior";
    document.getElementById("btn-exterior")?.classList.toggle("active", !isInt);
    document.getElementById("btn-interior")?.classList.toggle("active", isInt);
    document.getElementById("seating-rows-dropdown")?.classList.toggle("hidden", !isInt);
    if (isInt && row) {
      document.getElementById("seating-rows-label").textContent = `Seating Rows - ${row === 1 ? "1st" : "2nd"} Row`;
    }
    if (!isInt) this.interiorHint?.classList.add("hidden");
  }
}

import { trims } from "./trimData.js";

export class UIController {
  constructor() {
    this.chatEl = document.getElementById("chat");
    this.statusEl = document.getElementById("status");
    this.statusTextEl = document.getElementById("status-text");
    this.visualizerEl = document.getElementById("visualizer");
    this.micBtn = document.getElementById("mic-btn");
    this.micHint = document.getElementById("mic-hint");
    this.trimPanel = document.getElementById("trim-panel");

    this.currentAssistantBubble = null;
    this.welcomeShown = true;
    this.loadingEl = null;

    // New overlay refs
    this.viewportToolbar = document.getElementById("viewport-toolbar");
    this.techDetailsPanel = document.getElementById("tech-details-panel");
    this.bottomNav = document.getElementById("bottom-nav");
    this.interiorHint = document.getElementById("interior-hint");
  }

  // ── Loading State ───────────────────────────
  setLoadingState(loading) {
    if (loading) {
      if (!this.loadingEl) {
        this.loadingEl = document.createElement("div");
        this.loadingEl.className = "car-info-overlay";
        this.loadingEl.style.cssText =
          "top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;padding:24px 32px;";
        this.loadingEl.innerHTML = `
          <div style="font-size:1.1rem;font-weight:600;margin-bottom:8px;">Loading 3D Model...</div>
          <div style="font-size:0.8rem;color:#7a8299;">BYD Seal</div>
        `;
        document.getElementById("viewport").appendChild(this.loadingEl);
      }
    } else {
      if (this.loadingEl) {
        this.loadingEl.remove();
        this.loadingEl = null;
      }
    }
  }

  // ── Status ────────────────────────────────────
  setStatus(status) {
    this.statusEl.className = `status ${status}`;

    const labels = {
      disconnected: "Disconnected",
      connected: "Connected",
      listening: "Listening",
      speaking: "Speaking",
    };
    this.statusTextEl.textContent = labels[status] || status;

    // Mic button state
    if (status === "listening" || status === "speaking") {
      this.micBtn.classList.add("active");
    } else {
      this.micBtn.classList.remove("active");
    }

    if (status === "disconnected") {
      this.micHint.textContent = "Hold mic or type below";
    } else if (status === "listening") {
      this.micHint.textContent = "I am listening...";
    } else if (status === "speaking") {
      this.micHint.textContent = "Assistant is speaking";
    } else {
      this.micHint.textContent = "Hold mic or type below";
    }

    // Visualizer
    if (status === "speaking") {
      this.visualizerEl.classList.add("active");
    } else {
      this.visualizerEl.classList.remove("active");
    }
  }

  // ── Chat Messages ─────────────────────────────
  addMessage(text, role, isDone) {
    // Remove welcome on first message
    if (this.welcomeShown) {
      const welcome = this.chatEl.querySelector(".chat-welcome");
      if (welcome) welcome.remove();
      this.welcomeShown = false;
    }

    if (role === "user" && isDone) {
      // Complete user message
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
        // Finalize current assistant bubble
        if (this.currentAssistantBubble) {
          this.currentAssistantBubble.querySelector(".msg-text").textContent =
            text;
        }
        this.currentAssistantBubble = null;
        this.scrollChat();
        return;
      }

      // Streaming delta
      if (!this.currentAssistantBubble) {
        const div = document.createElement("div");
        div.className = "msg assistant";
        div.innerHTML = `<div class="msg-label">BYD Assistant</div><div class="msg-text"></div>`;
        this.chatEl.appendChild(div);
        this.currentAssistantBubble = div;
      }
      const textEl = this.currentAssistantBubble.querySelector(".msg-text");
      textEl.textContent += text;
      this.scrollChat();
    }
  }

  scrollChat() {
    this.chatEl.scrollTop = this.chatEl.scrollHeight;
  }

  escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Trim Panel ────────────────────────────────
  showTrimPanel(trimKey) {
    const trimsToShow =
      trimKey === "all"
        ? Object.values(trims)
        : [trims[trimKey]].filter(Boolean);

    if (!trimsToShow.length) return;

    let html = '<div style="position:relative">';
    html += `<button class="trim-card-close" id="trim-close-btn">&times;</button>`;

    trimsToShow.forEach((t) => {
      html += `
        <div class="trim-card" style="border-color: ${t.accent}">
          <div class="trim-card-name" style="color: ${t.accent}">${t.name}</div>
          <div class="trim-card-price">${t.price}</div>
          <div style="font-size:0.75rem;color:#7a8299;margin-bottom:8px">
            ${t.power} &middot; ${t.evRange}
          </div>
          <ul class="trim-card-specs">
            ${t.features.map((f) => `<li>${f}</li>`).join("")}
          </ul>
        </div>
      `;
    });

    html += "</div>";
    this.trimPanel.innerHTML = html;
    this.trimPanel.classList.remove("hidden");

    document.getElementById("trim-close-btn").addEventListener("click", () => {
      this.hideTrimPanel();
    });
  }

  hideTrimPanel() {
    this.trimPanel.classList.add("hidden");
    this.trimPanel.innerHTML = "";
  }

  // ── Viewport Overlays ─────────────────────────

  showViewportUI() {
    this.viewportToolbar?.classList.remove("hidden");
    this.bottomNav?.classList.remove("hidden");
    this.techDetailsPanel?.classList.remove("hidden");
  }

  hideViewportUI() {
    this.viewportToolbar?.classList.add("hidden");
    this.bottomNav?.classList.add("hidden");
    this.techDetailsPanel?.classList.add("hidden");
    this.interiorHint?.classList.add("hidden");
    document.getElementById("seating-rows-dropdown")?.classList.add("hidden");
  }

  showTechSpecs(visible) {
    if (visible) {
      this.techDetailsPanel?.classList.remove("hidden");
    } else {
      this.techDetailsPanel?.classList.add("hidden");
    }
  }

  setViewMode(mode, row) {
    const extBtn = document.getElementById("btn-exterior");
    const intBtn = document.getElementById("btn-interior");
    const seatingDropdown = document.getElementById("seating-rows-dropdown");

    if (mode === "interior") {
      extBtn?.classList.remove("active");
      intBtn?.classList.add("active");
      seatingDropdown?.classList.remove("hidden");

      // Update row label
      const label = document.getElementById("seating-rows-label");
      if (label && row) {
        label.textContent = `Seating Rows - ${row === 1 ? "1st" : "2nd"} Row`;
      }
    } else {
      extBtn?.classList.add("active");
      intBtn?.classList.remove("active");
      seatingDropdown?.classList.add("hidden");
      this.interiorHint?.classList.add("hidden");
    }
  }
}

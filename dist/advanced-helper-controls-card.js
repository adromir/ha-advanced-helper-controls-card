/**
 * Advanced Helper Controls Card for Home Assistant
 * Author: Adromir (https://github.com/adromir)
 * License: MIT
 */

const CARD_VERSION = "1.0.1";

const GRADIENT_PRESETS = {
  "green-yellow-red": ["#10b981", "#eab308", "#ef4444"],
  "cold-warm": ["#38bdf8", "#fbbf24", "#f97316", "#ef4444"],
  "blue-cyan": ["#3b82f6", "#06b6d4", "#22d3ee"],
  "purple-pink": ["#8b5cf6", "#d946ef", "#ec4899"],
  "amber-fire": ["#f59e0b", "#f97316", "#dc2626"],
  "primary": ["var(--primary-color, #0284c7)"],
};

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string" || !hex.startsWith("#")) {
    return { r: 2, g: 132, b: 199 };
  }
  const clean = hex.replace("#", "");
  const num = parseInt(clean.length === 3 ? clean.split("").map(c => c + c).join("") : clean, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function interpolateColors(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return `rgb(${r}, ${g}, ${b})`;
}

function getColorAtPercent(presetOrList, percent) {
  const pct = Math.max(0, Math.min(1, percent));
  let list = GRADIENT_PRESETS[presetOrList];
  if (!list && Array.isArray(presetOrList)) {
    list = presetOrList;
  }
  if (!list || list.length === 0) {
    list = GRADIENT_PRESETS["primary"];
  }
  if (list.length === 1) {
    return list[0];
  }
  const segCount = list.length - 1;
  const segIndex = Math.min(Math.floor(pct * segCount), segCount - 1);
  const localFactor = (pct - segIndex / segCount) * segCount;
  return interpolateColors(list[segIndex], list[segIndex + 1], localFactor);
}

class AdvancedHelperControlsCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._activeTimers = new Map();
    this._dragState = null;
    this._boundOnPointerMove = this._onPointerMove.bind(this);
    this._boundOnPointerUp = this._onPointerUp.bind(this);
  }

  static getStubConfig() {
    return {
      title: "Advanced Helper Controls",
      columns: 2,
      entities: [
        {
          entity: "input_number.temperature",
          control: "open-arc",
          name: "Thermostat Target",
          min: 16,
          max: 28,
          step: 0.5,
          unit: "°C",
          gradient: "cold-warm"
        },
        {
          entity: "input_number.volume",
          control: "wedge-slider",
          name: "Volume",
          min: 0,
          max: 100,
          step: 1,
          unit: "%",
          gradient: "green-yellow-red"
        },
        {
          entity: "input_number.dimmer",
          control: "vertical-slider",
          name: "Vertical Dimmer",
          min: 0,
          max: 100,
          step: 1,
          unit: "%",
          gradient: "blue-cyan"
        },
        {
          entity: "input_number.dial",
          control: "rotary-knob",
          name: "Rotary Knob",
          min: 0,
          max: 100,
          step: 1,
          gradient: "purple-pink"
        }
      ]
    };
  }

  static async getConfigElement() {
    return document.createElement("advanced-helper-controls-card-editor");
  }

  setConfig(config) {
    if (!config || !config.entities || !Array.isArray(config.entities)) {
      throw new Error("Please specify at least one entity in 'entities'.");
    }
    this._config = {
      title: config.title || "",
      columns: config.columns || 2,
      entities: config.entities.map(e => (typeof e === "string" ? { entity: e } : e))
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._updateStates();
  }

  connectedCallback() {
    window.addEventListener("pointermove", this._boundOnPointerMove);
    window.addEventListener("pointerup", this._boundOnPointerUp);
    window.addEventListener("pointercancel", this._boundOnPointerUp);
  }

  disconnectedCallback() {
    window.removeEventListener("pointermove", this._boundOnPointerMove);
    window.removeEventListener("pointerup", this._boundOnPointerUp);
    window.removeEventListener("pointercancel", this._boundOnPointerUp);
    this._activeTimers.forEach(timer => clearInterval(timer));
    this._activeTimers.clear();
  }

  _getEntityState(entityId) {
    if (!this._hass || !entityId) return null;
    return this._hass.states[entityId] || null;
  }

  _getNumericValue(stateObj, conf) {
    if (!stateObj) return conf.min || 0;
    const domain = conf.entity.split(".")[0];
    if (domain === "climate" && stateObj.attributes.temperature !== undefined) {
      return parseFloat(stateObj.attributes.temperature);
    }
    if (domain === "light" && stateObj.attributes.brightness !== undefined) {
      return Math.round((stateObj.attributes.brightness / 255) * 100);
    }
    if (domain === "media_player" && stateObj.attributes.volume_level !== undefined) {
      return Math.round(stateObj.attributes.volume_level * 100);
    }
    const val = parseFloat(stateObj.state);
    return isNaN(val) ? conf.min || 0 : val;
  }

  _setEntityValue(conf, value) {
    if (!this._hass || !conf.entity) return;
    const domain = conf.entity.split(".")[0];
    const val = Math.max(conf.min !== undefined ? conf.min : 0, Math.min(conf.max !== undefined ? conf.max : 100, value));

    if (domain === "input_number") {
      this._hass.callService("input_number", "set_value", {
        entity_id: conf.entity,
        value: val
      });
    } else if (domain === "number") {
      this._hass.callService("number", "set_value", {
        entity_id: conf.entity,
        value: val
      });
    } else if (domain === "climate") {
      this._hass.callService("climate", "set_temperature", {
        entity_id: conf.entity,
        temperature: val
      });
    } else if (domain === "light") {
      this._hass.callService("light", "turn_on", {
        entity_id: conf.entity,
        brightness: Math.round((val / 100) * 255)
      });
    } else if (domain === "media_player") {
      this._hass.callService("media_player", "volume_set", {
        entity_id: conf.entity,
        volume_level: val / 100
      });
    }
  }

  _render() {
    if (!this._config) return;

    const cols = this._config.columns;
    let gridTemplate = "repeat(auto-fit, minmax(260px, 1fr))";
    if (cols === 1) gridTemplate = "1fr";
    else if (cols === 2) gridTemplate = "repeat(auto-fit, minmax(240px, 1fr))";
    else if (cols === 3) gridTemplate = "repeat(auto-fit, minmax(200px, 1fr))";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        ha-card {
          padding: 16px;
          background: var(--ha-card-background, var(--card-background-color, #ffffff));
          border-radius: var(--ha-card-border-radius, 16px);
          border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, rgba(125, 125, 125, 0.15));
          color: var(--primary-text-color, #1e293b);
          box-sizing: border-box;
          user-select: none;
          -webkit-user-select: none;
        }
        .card-header {
          font-size: 1.15rem;
          font-weight: 600;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary-text-color, #1e293b);
        }
        .controls-grid {
          display: grid;
          grid-template-columns: ${gridTemplate};
          gap: 16px;
        }
        .control-cell {
          background: var(--secondary-background-color, rgba(125, 125, 125, 0.06));
          border: 1px solid var(--ha-card-border-color, rgba(125, 125, 125, 0.12));
          border-radius: 14px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 140px;
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
        }
        .cell-title {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--secondary-text-color, #64748b);
          margin-bottom: 8px;
          text-align: center;
          width: 100%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cell-value-display {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--primary-text-color, #0f172a);
          margin-top: 4px;
        }

        /* 1. ROTARY KNOB */
        .rotary-container {
          position: relative;
          width: 120px;
          height: 120px;
          touch-action: none;
          cursor: grab;
        }
        .rotary-container:active {
          cursor: grabbing;
        }
        .rotary-svg {
          width: 100%;
          height: 100%;
          transform: rotate(-90deg);
        }
        .rotary-bg-arc {
          fill: none;
          stroke: var(--ha-card-border-color, rgba(125, 125, 125, 0.2));
          stroke-width: 10;
          stroke-linecap: round;
        }
        .rotary-val-arc {
          fill: none;
          stroke-width: 10;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.08s ease;
        }
        .rotary-center-val {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .rotary-num {
          font-size: 1.35rem;
          font-weight: 800;
          line-height: 1.1;
        }
        .rotary-unit {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--secondary-text-color, #64748b);
        }

        /* 2. VERTICAL SLIDER */
        .vslider-container {
          position: relative;
          width: 44px;
          height: 150px;
          background: var(--ha-card-border-color, rgba(125, 125, 125, 0.18));
          border-radius: 22px;
          overflow: hidden;
          touch-action: none;
          cursor: pointer;
          box-shadow: inset 0 2px 5px rgba(0,0,0,0.12);
        }
        .vslider-fill {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          border-radius: 22px;
          transition: height 0.06s ease;
        }
        .vslider-handle {
          position: absolute;
          width: 36px;
          height: 10px;
          left: 4px;
          border-radius: 5px;
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          pointer-events: none;
        }

        /* 3. WEDGE / TRIANGLE SLIDER */
        .wedge-container {
          width: 100%;
          max-width: 220px;
          height: 70px;
          position: relative;
          touch-action: none;
          cursor: pointer;
        }
        .wedge-svg {
          width: 100%;
          height: 100%;
        }

        /* 4. OPEN THERMOSTAT ARC (270°) */
        .openarc-container {
          position: relative;
          width: 130px;
          height: 130px;
          touch-action: none;
          cursor: grab;
        }
        .openarc-container:active {
          cursor: grabbing;
        }
        .openarc-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        /* 5. HALF-CIRCLE (180°) */
        .halfcircle-container {
          position: relative;
          width: 150px;
          height: 85px;
          touch-action: none;
          cursor: grab;
        }

        /* 6. STEPPER WITH PRESETS */
        .stepper-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 10px;
        }
        .step-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid var(--ha-card-border-color, rgba(125, 125, 125, 0.25));
          background: var(--ha-card-background, #ffffff);
          color: var(--primary-text-color, #1e293b);
          font-size: 1.25rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0,0,0,0.06);
          transition: transform 0.1s ease, background 0.15s ease;
        }
        .step-btn:active {
          transform: scale(0.92);
          background: var(--secondary-background-color, #f1f5f9);
        }
        .presets-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
        }
        .preset-pill {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
          border: 1px solid var(--ha-card-border-color, rgba(125, 125, 125, 0.25));
          background: var(--ha-card-background, #ffffff);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .preset-pill.active {
          background: var(--primary-color, #0284c7);
          color: #ffffff;
          border-color: var(--primary-color, #0284c7);
        }

        /* 7. SEGMENTED PILLS */
        .segmented-container {
          display: flex;
          background: var(--ha-card-border-color, rgba(125, 125, 125, 0.15));
          padding: 4px;
          border-radius: 16px;
          gap: 4px;
          width: 100%;
          box-sizing: border-box;
          overflow-x: auto;
        }
        .seg-item {
          flex: 1;
          min-width: 50px;
          padding: 6px 12px;
          border-radius: 12px;
          text-align: center;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s ease, color 0.18s ease;
          white-space: nowrap;
        }
        .seg-item.active {
          background: var(--ha-card-background, #ffffff);
          color: var(--primary-color, #0284c7);
          box-shadow: 0 2px 5px rgba(0,0,0,0.12);
        }

        /* 8. CIRCULAR TIMER */
        .timer-container {
          position: relative;
          width: 120px;
          height: 120px;
        }
        .timer-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .timer-btns {
          display: flex;
          gap: 6px;
          margin-top: 8px;
        }
        .timer-micro-btn {
          padding: 4px 8px;
          border-radius: 8px;
          font-size: 0.7rem;
          font-weight: 600;
          border: 1px solid var(--ha-card-border-color, rgba(125, 125, 125, 0.2));
          background: var(--ha-card-background, #ffffff);
          cursor: pointer;
        }

        /* 9. ROCKER SWITCH */
        .rocker-container {
          display: flex;
          width: 100px;
          height: 44px;
          background: #cbd5e1;
          border-radius: 22px;
          padding: 3px;
          box-sizing: border-box;
          cursor: pointer;
          position: relative;
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.15);
        }
        .rocker-half {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          z-index: 2;
        }
        .rocker-pill {
          position: absolute;
          width: 47px;
          height: 38px;
          top: 3px;
          left: 3px;
          background: #ffffff;
          border-radius: 19px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.22);
          transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .rocker-container.is-on .rocker-pill {
          transform: translateX(47px);
          background: var(--primary-color, #0284c7);
        }
        .rocker-container.is-on .rocker-half.half-on {
          color: #ffffff;
        }

        /* 10. HOLD BUTTON */
        .hold-btn-container {
          position: relative;
          width: 90px;
          height: 90px;
          touch-action: none;
          cursor: pointer;
        }
        .hold-btn-bg {
          position: absolute;
          inset: 6px;
          border-radius: 50%;
          background: var(--secondary-background-color, rgba(125, 125, 125, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
          border: 1px solid var(--ha-card-border-color, rgba(125, 125, 125, 0.2));
        }
      </style>

      <ha-card>
        ${this._config.title ? `<div class="card-header">${this._config.title}</div>` : ""}
        <div class="controls-grid" id="controls-grid"></div>
      </ha-card>
    `;

    this._renderCells();
    this._updateStates();
  }

  _renderCells() {
    const grid = this.shadowRoot.getElementById("controls-grid");
    if (!grid) return;
    grid.innerHTML = "";

    this._config.entities.forEach((conf, idx) => {
      const cell = document.createElement("div");
      cell.className = "control-cell";
      cell.dataset.index = idx;

      const controlType = conf.control || "rotary-knob";
      const name = conf.name || (this._getEntityState(conf.entity)?.attributes?.friendly_name || conf.entity);

      cell.innerHTML = `
        <div class="cell-title">${name}</div>
        <div class="control-widget" id="widget-${idx}"></div>
        <div class="cell-value-display" id="val-display-${idx}">--</div>
      `;

      grid.appendChild(cell);
      this._buildWidget(cell.querySelector(`#widget-${idx}`), conf, idx);
    });
  }

  _buildWidget(container, conf, idx) {
    const type = conf.control || "rotary-knob";

    if (type === "rotary-knob") {
      container.innerHTML = `
        <div class="rotary-container" id="rotary-${idx}">
          <svg class="rotary-svg" viewBox="0 0 100 100">
            <circle class="rotary-bg-arc" cx="50" cy="50" r="40" stroke-dasharray="251.2" stroke-dashoffset="0"></circle>
            <circle class="rotary-val-arc" id="arc-${idx}" cx="50" cy="50" r="40" stroke-dasharray="251.2" stroke-dashoffset="251.2"></circle>
          </svg>
          <div class="rotary-center-val">
            <span class="rotary-num" id="center-num-${idx}">--</span>
            <span class="rotary-unit">${conf.unit || ""}</span>
          </div>
        </div>
      `;
      const el = container.querySelector(`#rotary-${idx}`);
      el.addEventListener("pointerdown", (e) => this._startRotaryDrag(e, conf, idx, el));
      el.addEventListener("wheel", (e) => this._onWheelAdjust(e, conf), { passive: false });

    } else if (type === "vertical-slider") {
      container.innerHTML = `
        <div class="vslider-container" id="vslider-${idx}">
          <div class="vslider-fill" id="vfill-${idx}"></div>
          <div class="vslider-handle" id="vhandle-${idx}"></div>
        </div>
      `;
      const el = container.querySelector(`#vslider-${idx}`);
      el.addEventListener("pointerdown", (e) => this._startVSliderDrag(e, conf, idx, el));

    } else if (type === "wedge-slider") {
      container.innerHTML = `
        <div class="wedge-container" id="wedge-${idx}">
          <svg class="wedge-svg" viewBox="0 0 200 60" preserveAspectRatio="none">
            <defs>
              <clipPath id="wedge-clip-${idx}">
                <polygon points="0,55 200,5 200,55" />
              </clipPath>
              <linearGradient id="wedge-grad-${idx}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#10b981"/>
                <stop offset="50%" stop-color="#eab308"/>
                <stop offset="100%" stop-color="#ef4444"/>
              </linearGradient>
            </defs>
            <polygon points="0,55 200,5 200,55" fill="var(--ha-card-border-color, rgba(125,125,125,0.2))" />
            <rect id="wedge-rect-${idx}" x="0" y="0" width="0" height="60" fill="url(#wedge-grad-${idx})" clip-path="url(#wedge-clip-${idx})" />
          </svg>
        </div>
      `;
      const el = container.querySelector(`#wedge-${idx}`);
      el.addEventListener("pointerdown", (e) => this._startWedgeDrag(e, conf, idx, el));

    } else if (type === "open-arc") {
      // 270 degree horseshoe arc
      container.innerHTML = `
        <div class="openarc-container" id="openarc-${idx}">
          <svg viewBox="0 0 100 100" style="width:100%;height:100%;">
            <path d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke="var(--ha-card-border-color, rgba(125,125,125,0.2))" stroke-width="9" stroke-linecap="round"/>
            <path id="openarc-path-${idx}" d="M 21.7 78.3 A 40 40 0 1 1 78.3 78.3" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="188.5" stroke-dashoffset="188.5"/>
            <circle id="openarc-handle-${idx}" cx="21.7" cy="78.3" r="7" fill="#ffffff" stroke="var(--primary-color, #0284c7)" stroke-width="2" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25)); pointer-events:none;"/>
          </svg>
          <div class="openarc-center">
            <span class="rotary-num" id="openarc-num-${idx}">--</span>
            <span class="rotary-unit">${conf.unit || ""}</span>
          </div>
        </div>
      `;
      const el = container.querySelector(`#openarc-${idx}`);
      el.addEventListener("pointerdown", (e) => this._startOpenArcDrag(e, conf, idx, el));

    } else if (type === "half-circle") {
      // 180 degree semi-circle
      container.innerHTML = `
        <div class="halfcircle-container" id="halfcircle-${idx}">
          <svg viewBox="0 0 100 55" style="width:100%;height:100%;">
            <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="var(--ha-card-border-color, rgba(125,125,125,0.2))" stroke-width="8" stroke-linecap="round"/>
            <path id="halfcircle-path-${idx}" d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke-width="8" stroke-linecap="round" stroke-dasharray="125.6" stroke-dashoffset="125.6"/>
            <circle id="halfcircle-handle-${idx}" cx="10" cy="50" r="6" fill="#ffffff" stroke="var(--primary-color, #0284c7)" stroke-width="2" style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.25)); pointer-events:none;"/>
          </svg>
        </div>
      `;
      const el = container.querySelector(`#halfcircle-${idx}`);
      el.addEventListener("pointerdown", (e) => this._startHalfCircleDrag(e, conf, idx, el));

    } else if (type === "stepper-presets") {
      const presets = conf.presets || [18, 20, 21.5, 23];
      container.innerHTML = `
        <div class="stepper-row">
          <button class="step-btn" id="step-minus-${idx}">−</button>
          <button class="step-btn" id="step-plus-${idx}">+</button>
        </div>
        <div class="presets-row">
          ${presets.map(p => `<button class="preset-pill" data-val="${p}">${p}${conf.unit || ""}</button>`).join("")}
        </div>
      `;
      container.querySelector(`#step-minus-${idx}`).addEventListener("click", () => this._stepAdjust(conf, -1));
      container.querySelector(`#step-plus-${idx}`).addEventListener("click", () => this._stepAdjust(conf, 1));
      container.querySelectorAll(".preset-pill").forEach(btn => {
        btn.addEventListener("click", () => this._setEntityValue(conf, parseFloat(btn.dataset.val)));
      });

    } else if (type === "segmented-pills") {
      container.innerHTML = `<div class="segmented-container" id="seg-${idx}"></div>`;

    } else if (type === "circular-timer") {
      container.innerHTML = `
        <div class="timer-container">
          <svg viewBox="0 0 100 100" style="width:100%;height:100%;transform:rotate(-90deg);">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--ha-card-border-color, rgba(125,125,125,0.2))" stroke-width="7"/>
            <circle id="timer-arc-${idx}" cx="50" cy="50" r="42" fill="none" stroke="var(--primary-color, #0284c7)" stroke-width="7" stroke-dasharray="263.8" stroke-dashoffset="0"/>
          </svg>
          <div class="timer-center">
            <span class="rotary-num" id="timer-time-${idx}" style="font-size:1.1rem;">--:--</span>
            <div class="timer-btns">
              <button class="timer-micro-btn" id="timer-start-${idx}">Start</button>
              <button class="timer-micro-btn" id="timer-pause-${idx}">Pause</button>
              <button class="timer-micro-btn" id="timer-cancel-${idx}">Reset</button>
            </div>
          </div>
        </div>
      `;
      container.querySelector(`#timer-start-${idx}`).addEventListener("click", () => {
        this._hass?.callService("timer", "start", { entity_id: conf.entity });
      });
      container.querySelector(`#timer-pause-${idx}`).addEventListener("click", () => {
        this._hass?.callService("timer", "pause", { entity_id: conf.entity });
      });
      container.querySelector(`#timer-cancel-${idx}`).addEventListener("click", () => {
        this._hass?.callService("timer", "cancel", { entity_id: conf.entity });
      });

    } else if (type === "rocker-switch") {
      container.innerHTML = `
        <div class="rocker-container" id="rocker-${idx}">
          <div class="rocker-pill"></div>
          <div class="rocker-half half-off">AUS</div>
          <div class="rocker-half half-on">AN</div>
        </div>
      `;
      container.querySelector(`#rocker-${idx}`).addEventListener("click", () => {
        const domain = conf.entity.split(".")[0];
        this._hass?.callService(domain, "toggle", { entity_id: conf.entity });
      });

    } else if (type === "hold-action") {
      container.innerHTML = `
        <div class="hold-btn-container" id="hold-btn-${idx}">
          <svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg);">
            <circle id="hold-ring-${idx}" cx="50" cy="50" r="44" fill="none" stroke="var(--primary-color, #0284c7)" stroke-width="6" stroke-dasharray="276.4" stroke-dashoffset="276.4"/>
          </svg>
          <div class="hold-btn-bg" id="hold-label-${idx}">HALTEN</div>
        </div>
      `;
      const btn = container.querySelector(`#hold-btn-${idx}`);
      const ring = container.querySelector(`#hold-ring-${idx}`);
      let holdTimer = null;
      let startTime = 0;

      btn.addEventListener("pointerdown", () => {
        startTime = Date.now();
        holdTimer = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const prog = Math.min(1, elapsed / 1500);
          ring.style.strokeDashoffset = `${276.4 * (1 - prog)}`;
          if (prog >= 1) {
            clearInterval(holdTimer);
            holdTimer = null;
            ring.style.strokeDashoffset = "276.4";
            const domain = conf.entity.split(".")[0];
            this._hass?.callService(domain, "toggle", { entity_id: conf.entity });
          }
        }, 30);
      });

      const cancelHold = () => {
        if (holdTimer) {
          clearInterval(holdTimer);
          holdTimer = null;
        }
        ring.style.strokeDashoffset = "276.4";
      };
      btn.addEventListener("pointerup", cancelHold);
      btn.addEventListener("pointerleave", cancelHold);
    }
  }

  _updateStates() {
    if (!this._config || !this._hass) return;

    this._config.entities.forEach((conf, idx) => {
      const stateObj = this._getEntityState(conf.entity);
      const valDisplay = this.shadowRoot.getElementById(`val-display-${idx}`);
      const type = conf.control || "rotary-knob";

      if (!stateObj) {
        if (valDisplay) valDisplay.textContent = "Nicht verfügbar";
        return;
      }

      const min = conf.min !== undefined ? conf.min : 0;
      const max = conf.max !== undefined ? conf.max : 100;
      const numVal = this._getNumericValue(stateObj, conf);
      const pct = max > min ? Math.max(0, Math.min(1, (numVal - min) / (max - min))) : 0;
      const color = getColorAtPercent(conf.gradient || "green-yellow-red", pct);

      if (valDisplay) {
        if (type !== "rotary-knob" && type !== "open-arc" && type !== "circular-timer") {
          valDisplay.textContent = `${numVal}${conf.unit || stateObj.attributes.unit_of_measurement || ""}`;
        } else {
          valDisplay.textContent = "";
        }
      }

      if (type === "rotary-knob") {
        const arc = this.shadowRoot.getElementById(`arc-${idx}`);
        const centerNum = this.shadowRoot.getElementById(`center-num-${idx}`);
        if (arc) {
          arc.style.stroke = color;
          arc.style.strokeDashoffset = `${251.2 * (1 - pct)}`;
        }
        if (centerNum) centerNum.textContent = numVal;

      } else if (type === "vertical-slider") {
        const vfill = this.shadowRoot.getElementById(`vfill-${idx}`);
        const vhandle = this.shadowRoot.getElementById(`vhandle-${idx}`);
        if (vfill) {
          vfill.style.height = `${pct * 100}%`;
          vfill.style.background = color;
        }
        if (vhandle) {
          vhandle.style.bottom = `calc(${pct * 100}% - 5px)`;
        }

      } else if (type === "wedge-slider") {
        const rect = this.shadowRoot.getElementById(`wedge-rect-${idx}`);
        if (rect) {
          rect.setAttribute("width", `${pct * 200}`);
        }

      } else if (type === "open-arc") {
        const path = this.shadowRoot.getElementById(`openarc-path-${idx}`);
        const handle = this.shadowRoot.getElementById(`openarc-handle-${idx}`);
        const num = this.shadowRoot.getElementById(`openarc-num-${idx}`);
        if (path) {
          path.style.stroke = color;
          path.style.strokeDashoffset = `${188.5 * (1 - pct)}`;
        }
        if (handle) {
          // Arc angle from 135 deg to 405 deg (270 deg span)
          const angleRad = (135 + pct * 270) * (Math.PI / 180);
          handle.setAttribute("cx", `${50 + 40 * Math.cos(angleRad)}`);
          handle.setAttribute("cy", `${50 + 40 * Math.sin(angleRad)}`);
          handle.style.stroke = color;
        }
        if (num) num.textContent = numVal;

      } else if (type === "half-circle") {
        const path = this.shadowRoot.getElementById(`halfcircle-path-${idx}`);
        const handle = this.shadowRoot.getElementById(`halfcircle-handle-${idx}`);
        if (path) {
          path.style.stroke = color;
          path.style.strokeDashoffset = `${125.6 * (1 - pct)}`;
        }
        if (handle) {
          const angleRad = (180 - pct * 180) * (Math.PI / 180);
          handle.setAttribute("cx", `${50 + 40 * Math.cos(angleRad)}`);
          handle.setAttribute("cy", `${50 - 40 * Math.sin(angleRad)}`);
          handle.style.stroke = color;
        }

      } else if (type === "stepper-presets") {
        const pills = this.shadowRoot.querySelectorAll(`.control-cell[data-index="${idx}"] .preset-pill`);
        pills.forEach(p => {
          if (Math.abs(parseFloat(p.dataset.val) - numVal) < 0.1) {
            p.classList.add("active");
          } else {
            p.classList.remove("active");
          }
        });

      } else if (type === "segmented-pills") {
        const container = this.shadowRoot.getElementById(`seg-${idx}`);
        if (container) {
          const options = stateObj.attributes.options || ["Aus", "Auto", "Ein"];
          container.innerHTML = options.map(opt => `
            <div class="seg-item ${stateObj.state === opt ? "active" : ""}" data-val="${opt}">${opt}</div>
          `).join("");
          container.querySelectorAll(".seg-item").forEach(item => {
            item.addEventListener("click", () => {
              this._hass?.callService("input_select", "select_option", {
                entity_id: conf.entity,
                option: item.dataset.val
              });
            });
          });
        }

      } else if (type === "circular-timer") {
        const arc = this.shadowRoot.getElementById(`timer-arc-${idx}`);
        const timeEl = this.shadowRoot.getElementById(`timer-time-${idx}`);
        if (stateObj.attributes.remaining && timeEl) {
          timeEl.textContent = stateObj.attributes.remaining;
        } else if (timeEl) {
          timeEl.textContent = stateObj.state;
        }

      } else if (type === "rocker-switch") {
        const rocker = this.shadowRoot.getElementById(`rocker-${idx}`);
        if (rocker) {
          const isOn = stateObj.state === "on";
          if (isOn) rocker.classList.add("is-on");
          else rocker.classList.remove("is-on");
        }
      }
    });
  }

  // --- DRAG INTERACTION HANDLERS ---
  _startRotaryDrag(e, conf, idx, el) {
    e.preventDefault();
    this._dragState = { type: "rotary", conf, idx, el, rect: el.getBoundingClientRect() };
  }

  _startVSliderDrag(e, conf, idx, el) {
    e.preventDefault();
    this._dragState = { type: "vslider", conf, idx, el, rect: el.getBoundingClientRect() };
    this._handleVSliderMove(e.clientY);
  }

  _startWedgeDrag(e, conf, idx, el) {
    e.preventDefault();
    this._dragState = { type: "wedge", conf, idx, el, rect: el.getBoundingClientRect() };
    this._handleWedgeMove(e.clientX);
  }

  _startOpenArcDrag(e, conf, idx, el) {
    e.preventDefault();
    this._dragState = { type: "openarc", conf, idx, el, rect: el.getBoundingClientRect() };
  }

  _startHalfCircleDrag(e, conf, idx, el) {
    e.preventDefault();
    this._dragState = { type: "halfcircle", conf, idx, el, rect: el.getBoundingClientRect() };
  }

  _onPointerMove(e) {
    if (!this._dragState) return;
    const { type, conf, rect } = this._dragState;

    if (type === "rotary") {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;
      const pct = angle / 360;
      this._applyPct(conf, pct);

    } else if (type === "vslider") {
      this._handleVSliderMove(e.clientY);

    } else if (type === "wedge") {
      this._handleWedgeMove(e.clientX);

    } else if (type === "openarc") {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      let angle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      // Map 135 deg to 405 deg
      if (angle < 0) angle += 360;
      if (angle >= 45 && angle <= 135) {
        // Deadzone at bottom
        return;
      }
      let normAngle = angle - 135;
      if (normAngle < 0) normAngle += 360;
      const pct = Math.max(0, Math.min(1, normAngle / 270));
      this._applyPct(conf, pct);

    } else if (type === "halfcircle") {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height;
      let angle = Math.atan2(centerY - e.clientY, centerX - e.clientX) * (180 / Math.PI);
      if (angle < 0 || angle > 180) return;
      const pct = Math.max(0, Math.min(1, 1 - angle / 180));
      this._applyPct(conf, pct);
    }
  }

  _handleVSliderMove(clientY) {
    const { conf, rect } = this._dragState;
    const relY = Math.max(0, Math.min(rect.height, rect.bottom - clientY));
    const pct = relY / rect.height;
    this._applyPct(conf, pct);
  }

  _handleWedgeMove(clientX) {
    const { conf, rect } = this._dragState;
    const relX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = relX / rect.width;
    this._applyPct(conf, pct);
  }

  _applyPct(conf, pct) {
    const min = conf.min !== undefined ? conf.min : 0;
    const max = conf.max !== undefined ? conf.max : 100;
    const step = conf.step || 1;
    let rawVal = min + pct * (max - min);
    rawVal = Math.round(rawVal / step) * step;
    this._setEntityValue(conf, rawVal);
  }

  _onPointerUp() {
    this._dragState = null;
  }

  _onWheelAdjust(e, conf) {
    e.preventDefault();
    const step = conf.step || 1;
    const dir = e.deltaY < 0 ? 1 : -1;
    const stateObj = this._getEntityState(conf.entity);
    const curr = this._getNumericValue(stateObj, conf);
    this._setEntityValue(conf, curr + dir * step);
  }

  _stepAdjust(conf, dir) {
    const step = conf.step || 1;
    const stateObj = this._getEntityState(conf.entity);
    const curr = this._getNumericValue(stateObj, conf);
    this._setEntityValue(conf, curr + dir * step);
  }
}

customElements.define("advanced-helper-controls-card", AdvancedHelperControlsCard);

// ==========================================
// VISUAL LOVELACE CARD EDITOR
// ==========================================
class AdvancedHelperControlsCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
  }

  connectedCallback() {
    if (!customElements.get("ha-entity-picker") && window.loadCardHelpers) {
      window.loadCardHelpers();
    }
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (this.shadowRoot) {
      this.shadowRoot.querySelectorAll("ha-entity-picker").forEach(picker => {
        picker.hass = hass;
      });
    }
  }

  _render() {
    if (!this._config) return;

    this.shadowRoot.innerHTML = `
      <style>
        .editor-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 8px 0;
          font-family: var(--paper-font-body1_-_font-family);
        }
        .form-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        ha-entity-picker {
          display: block;
          width: 100%;
        }
        label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--secondary-text-color, #475569);
        }
        input, select {
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid var(--ha-card-border-color, #cbd5e1);
          background: var(--card-background-color, #ffffff);
          color: var(--primary-text-color, #0f172a);
          font-size: 0.9rem;
        }
        .entity-box {
          border: 1px solid var(--ha-card-border-color, #cbd5e1);
          border-radius: 12px;
          padding: 12px;
          background: var(--secondary-background-color, #f8fafc);
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
        }
        .entity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-weight: 700;
        }
        .btn-delete {
          background: #ef4444;
          color: #ffffff;
          border: none;
          border-radius: 6px;
          padding: 4px 8px;
          cursor: pointer;
        }
        .btn-add {
          background: var(--primary-color, #0284c7);
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
      </style>

      <div class="editor-container">
        <div class="form-row">
          <label>Kartentitel</label>
          <input type="text" id="cfg-title" value="${this._config.title || ""}" placeholder="z. B. Raumklima & Beleuchtung"/>
        </div>

        <div class="form-row">
          <label>Spaltenanzahl</label>
          <select id="cfg-columns">
            <option value="1" ${this._config.columns === 1 ? "selected" : ""}>1 Spalte</option>
            <option value="2" ${this._config.columns === 2 ? "selected" : ""}>2 Spalten</option>
            <option value="3" ${this._config.columns === 3 ? "selected" : ""}>3 Spalten</option>
          </select>
        </div>

        <label style="margin-top: 8px;">Konfigurierte Entitäten & Controls</label>
        <div id="entities-container" style="display:flex; flex-direction:column; gap:12px;"></div>

        <button class="btn-add" id="btn-add-entity">+ Entität hinzufügen</button>
      </div>
    `;

    this._renderEntitiesList();
    this._attachEvents();
  }

  _renderEntitiesList() {
    const container = this.shadowRoot.getElementById("entities-container");
    if (!container) return;
    container.innerHTML = "";

    const entities = this._config.entities || [];
    entities.forEach((ent, idx) => {
      const box = document.createElement("div");
      box.className = "entity-box";
      box.innerHTML = `
        <div class="entity-header">
          <span>#${idx + 1} ${ent.name || ent.entity || "Neue Entität"}</span>
          <button class="btn-delete" data-index="${idx}">Entfernen</button>
        </div>
        <div class="form-row">
          <label>Entität</label>
          <ha-entity-picker
            class="field-entity"
            data-index="${idx}"
            label="Entität auswählen"
            allow-custom-entity
          ></ha-entity-picker>
        </div>
        <div class="grid-2">
          <div class="form-row">
            <label>Kontrolltyp</label>
            <select class="field-control" data-index="${idx}">
              <option value="rotary-knob" ${ent.control === "rotary-knob" ? "selected" : ""}>Drehknopf (Rotary Knob)</option>
              <option value="vertical-slider" ${ent.control === "vertical-slider" ? "selected" : ""}>Vertikaler Slider</option>
              <option value="wedge-slider" ${ent.control === "wedge-slider" ? "selected" : ""}>Dreieck-Slider (Volume Wedge)</option>
              <option value="open-arc" ${ent.control === "open-arc" ? "selected" : ""}>Thermostat-Bogen (270° Kreis)</option>
              <option value="half-circle" ${ent.control === "half-circle" ? "selected" : ""}>Halbkreis (180° Bogen)</option>
              <option value="stepper-presets" ${ent.control === "stepper-presets" ? "selected" : ""}>Stepper mit Presets</option>
              <option value="segmented-pills" ${ent.control === "segmented-pills" ? "selected" : ""}>Segmentierte Pills</option>
              <option value="circular-timer" ${ent.control === "circular-timer" ? "selected" : ""}>Runder Timer</option>
              <option value="rocker-switch" ${ent.control === "rocker-switch" ? "selected" : ""}>3D-Wippschalter</option>
              <option value="hold-action" ${ent.control === "hold-action" ? "selected" : ""}>Sicherheits-Halteknopf</option>
            </select>
          </div>
          <div class="form-row">
            <label>Farbverlauf / Gradient</label>
            <select class="field-gradient" data-index="${idx}">
              <option value="green-yellow-red" ${ent.gradient === "green-yellow-red" ? "selected" : ""}>Grün ➔ Gelb ➔ Rot</option>
              <option value="cold-warm" ${ent.gradient === "cold-warm" ? "selected" : ""}>Kalt ➔ Warm (Cyan/Orange/Rot)</option>
              <option value="blue-cyan" ${ent.gradient === "blue-cyan" ? "selected" : ""}>Blau ➔ Cyan</option>
              <option value="purple-pink" ${ent.gradient === "purple-pink" ? "selected" : ""}>Violett ➔ Pink</option>
              <option value="amber-fire" ${ent.gradient === "amber-fire" ? "selected" : ""}>Bernstein ➔ Feuer</option>
              <option value="primary" ${ent.gradient === "primary" ? "selected" : ""}>Home Assistant Theme Farbe</option>
            </select>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-row">
            <label>Name</label>
            <input type="text" class="field-name" data-index="${idx}" value="${ent.name || ""}" placeholder="Standard-Name"/>
          </div>
          <div class="form-row">
            <label>Einheit</label>
            <input type="text" class="field-unit" data-index="${idx}" value="${ent.unit || ""}" placeholder="°C, %, W"/>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-row">
            <label>Min / Max</label>
            <div style="display:flex;gap:4px;">
              <input type="number" class="field-min" data-index="${idx}" value="${ent.min !== undefined ? ent.min : ""}" placeholder="Min"/>
              <input type="number" class="field-max" data-index="${idx}" value="${ent.max !== undefined ? ent.max : ""}" placeholder="Max"/>
            </div>
          </div>
          <div class="form-row">
            <label>Schrittweite (Step)</label>
            <input type="number" step="any" class="field-step" data-index="${idx}" value="${ent.step !== undefined ? ent.step : ""}" placeholder="1 oder 0.5"/>
          </div>
        </div>
      `;
      container.appendChild(box);

      const picker = box.querySelector(".field-entity");
      if (picker) {
        if (this._hass) picker.hass = this._hass;
        picker.value = ent.entity || "";
        const handleEntityChange = (e) => {
          e.stopPropagation();
          const i = parseInt(picker.dataset.index);
          const val = e.detail?.value !== undefined ? e.detail.value : e.target.value;
          const newEntities = [...(this._config.entities || [])];
          if (newEntities[i]?.entity === val) return;
          const updated = { ...newEntities[i], entity: val };
          if (!updated.name && this._hass?.states?.[val]?.attributes?.friendly_name) {
            updated.name = this._hass.states[val].attributes.friendly_name;
          }
          newEntities[i] = updated;
          this._updateConfig({ ...this._config, entities: newEntities });
        };
        picker.addEventListener("value-changed", handleEntityChange);
        picker.addEventListener("change", handleEntityChange);
      }
    });

    container.querySelectorAll(".btn-delete").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const i = parseInt(e.target.dataset.index);
        const newEntities = [...(this._config.entities || [])];
        newEntities.splice(i, 1);
        this._updateConfig({ ...this._config, entities: newEntities });
      });
    });

    const bindField = (selectorClass, key, parseFn = v => v) => {
      container.querySelectorAll(selectorClass).forEach(input => {
        input.addEventListener("change", (e) => {
          const i = parseInt(e.target.dataset.index);
          const newEntities = [...(this._config.entities || [])];
          newEntities[i] = { ...newEntities[i], [key]: parseFn(e.target.value) };
          this._updateConfig({ ...this._config, entities: newEntities });
        });
      });
    };

    bindField(".field-control", "control");
    bindField(".field-gradient", "gradient");
    bindField(".field-name", "name");
    bindField(".field-unit", "unit");
    bindField(".field-min", "min", v => (v === "" ? undefined : parseFloat(v)));
    bindField(".field-max", "max", v => (v === "" ? undefined : parseFloat(v)));
    bindField(".field-step", "step", v => (v === "" ? undefined : parseFloat(v)));
  }

  _attachEvents() {
    this.shadowRoot.getElementById("cfg-title")?.addEventListener("change", (e) => {
      this._updateConfig({ ...this._config, title: e.target.value });
    });
    this.shadowRoot.getElementById("cfg-columns")?.addEventListener("change", (e) => {
      this._updateConfig({ ...this._config, columns: parseInt(e.target.value) });
    });
    this.shadowRoot.getElementById("btn-add-entity")?.addEventListener("click", () => {
      const newEntities = [
        ...(this._config.entities || []),
        { entity: "", control: "rotary-knob", name: "" }
      ];
      this._updateConfig({ ...this._config, entities: newEntities });
    });
  }

  _updateConfig(newConfig) {
    this._config = newConfig;
    const event = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
    this._render();
  }
}

customElements.define("advanced-helper-controls-card-editor", AdvancedHelperControlsCardEditor);

// Register in Home Assistant Lovelace custom cards list
window.customCards = window.customCards || [];
window.customCards.push({
  type: "advanced-helper-controls-card",
  name: "Advanced Helper Controls Card",
  description: "Versatile multi-entity helper card with rotary knobs, vertical faders, wedge sliders, and visual GUI editor.",
  preview: true,
  documentationURL: "https://github.com/adromir/ha-advanced-helper-controls-card",
});

console.info(
  `%c ADVANCED-HELPER-CONTROLS-CARD %c v${CARD_VERSION} `,
  "color: white; background: #0284c7; font-weight: 700; border-radius: 3px 0 0 3px;",
  "color: #0284c7; background: #e0f2fe; font-weight: 700; border-radius: 0 3px 3px 0;"
);


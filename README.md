# 🎛️ Advanced Helper Controls Card for Home Assistant

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=adromir&repository=ha-advanced-helper-controls-card&category=plugin)
[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/default)
[![GitHub Release](https://img.shields.io/github/v/release/adromir/ha-advanced-helper-controls-card?style=for-the-badge&color=blue)](https://github.com/adromir/ha-advanced-helper-controls-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Maintenance](https://img.shields.io/badge/Maintained%3F-yes-green.svg?style=for-the-badge)](https://github.com/adromir/ha-advanced-helper-controls-card)

A versatile, high-performance custom Lovelace card for Home Assistant that combines **multiple entities into one unified card**, allowing you to assign a **unique, specialized tactile control type** to each entity — including controls that don't exist in vanilla Home Assistant!

Features a full visual **GUI Card Editor**, dynamic color gradients (green ➔ yellow ➔ red, cold ➔ warm, and custom palettes), and 100% native Home Assistant design token compliance.

---

## ✨ Available Control Types

| Control Type | Description | Best Suited For |
| :--- | :--- | :--- |
| **`rotary-knob`** | Circular rotary dial with angle dragging, mouse wheel support, center value, and perimeter arc fill | Temperatures, volume, fan speeds, dimmers |
| **`vertical-slider`** | Ergonomic vertical fader with fluid fill level and draggable thumb | Multi-channel mixers, volume faders, vertical height |
| **`wedge-slider`** | Tapered triangular wedge slider that grows taller from left to right | Media player volumes, audio gain |
| **`open-arc`** | 270° horseshoe thermostat arc with perimeter thumb handle and central setpoint | Climate thermostats (`climate.*`), temperature helpers |
| **`half-circle`** | 180° semi-circle gauge arc with angle dragging and baseline display | Illuminance, power meters, gauges |
| **`stepper-presets`** | Fine-tuning `[-]` and `[+]` buttons flanked by one-click quick preset pills | Heating setpoints (`18°`, `20°`, `21.5°`, `23°`) |
| **`segmented-pills`** | Horizontal sliding pill selector with active indicator | `input_select`, operation modes (`Eco`/`Komfort`/`Boost`) |
| **`circular-timer`** | Circular countdown ring with central MM:SS and Start/Pause/Reset micro-buttons | `timer.*` helpers, laundry or cooking timers |
| **`rocker-switch`** | Tactile 3D physical rocker switch with click depression | `input_boolean`, switches, lights |
| **`hold-action`** | 1.5-second safety hold button with radial filling ring (prevents accidental clicks) | Garage doors, gate openers, alarm arming |

---

## 🎨 Color & Gradient System

Customize each control with smooth multi-color gradients that interpolate dynamically based on current value percentage:
- `green-yellow-red`: Green ➔ Yellow ➔ Red (e.g. for load, battery drain, or volume)
- `cold-warm`: Sky Blue ➔ Amber ➔ Red (e.g. for room temperatures)
- `blue-cyan`: Deep Blue ➔ Radiant Cyan
- `purple-pink`: Violet ➔ Fuchsia
- `amber-fire`: Amber ➔ Orange ➔ Red
- `primary`: Matches your active Home Assistant theme accent color

---

## 🛠️ Visual GUI Card Editor

Fully configurable in the Home Assistant Lovelace UI editor without editing YAML:
- Add, edit, or remove entities on the fly.
- Select the control type from an intuitive dropdown.
- Choose color gradients, units, minimum, maximum, and step increments.
- Adjust grid columns (`1`, `2`, or `3`).

---

## 📦 Installation

### Method 1: HACS (Recommended)

1. Click the button below to add this repository directly to HACS:

   [![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=adromir&repository=ha-advanced-helper-controls-card&category=plugin)

2. Or manually in HACS:
   - Go to **HACS** > **Frontend** > **Three dots menu (top right)** > **Custom repositories**.
   - URL: `https://github.com/adromir/ha-advanced-helper-controls-card`
   - Type: `Lovelace` (or `Plugin`)
   - Click **Add**, then find **Advanced Helper Controls Card** and click **Download**.

### Method 2: Manual Installation
1. Download `advanced-helper-controls-card.js` from the latest release.
2. Place it in `<config>/www/community/ha-advanced-helper-controls-card/advanced-helper-controls-card.js`.
3. Add `/local/community/ha-advanced-helper-controls-card/advanced-helper-controls-card.js` as a Lovelace resource (JavaScript Module).

---

## 🚀 YAML Configuration Example

```yaml
type: custom:advanced-helper-controls-card
title: "Klima & Medien Steuerung"
columns: 2
entities:
  # 1. Thermostat mit 270° Bogen & Kalt-Warm Verlauf
  - entity: climate.wohnzimmer
    control: open-arc
    name: "Wohnzimmer Soll"
    min: 16
    max: 28
    step: 0.5
    unit: "°C"
    gradient: cold-warm

  # 2. Dreieck-Lautstärkeregler (Wedge Slider)
  - entity: media_player.avr_receiver
    control: wedge-slider
    name: "Verstärker Lautstärke"
    min: 0
    max: 100
    step: 1
    gradient: green-yellow-red

  # 3. Vertikaler Fader für Licht
  - entity: light.wohnzimmer_decke
    control: vertical-slider
    name: "Deckenlicht"
    min: 0
    max: 100
    step: 5
    gradient: blue-cyan

  # 4. Drehknopf für Lüftung
  - entity: input_number.lueftung_stufe
    control: rotary-knob
    name: "Lüftungsstufe"
    min: 0
    max: 100
    step: 1
    gradient: purple-pink

  # 5. Stepper mit Schnellwahltasten
  - entity: input_number.schlafzimmer_komfort
    control: stepper-presets
    name: "Schlafzimmer Komfort"
    min: 15
    max: 25
    step: 0.5
    unit: "°C"
    presets: [16, 18, 20, 22]

  # 6. Segmentierte Auswahl (Pills)
  - entity: input_select.heizmodus
    control: segmented-pills
    name: "Heizmodus"

  # 7. Runder Timer
  - entity: timer.lueften_countdown
    control: circular-timer
    name: "Lüften Timer"

  # 8. 3D-Wippschalter
  - entity: input_boolean.urlaubsmodus
    control: rocker-switch
    name: "Urlaubsmodus"

  # 9. Sicherheits-Halteknopf (1.5s)
  - entity: switch.hauptschalter_labor
    control: hold-action
    name: "Hauptschalter"
```

---

## 📄 Disclaimer

This is a custom community card and is not officially affiliated with or endorsed by Nabu Casa or Home Assistant.

---

## 📜 License

This project is open-source under the [MIT License](LICENSE).

**Author**: [Adromir](https://github.com/adromir)  
Website: [https://github.com/adromir](https://github.com/adromir)


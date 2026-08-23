# AquaRescue 🌊🛸

> **AI-Driven Off-Grid Multi-Agent Autonomous Water Rescue & Hydrodynamic Drift Localization System**

---

### 📹 Demonstration & Workflow Video

> **Watch Full Workflow Demo:**  
> 🔗 [Click here to watch the AquaRescue System Workflow Video on Google Drive] https://drive.google.com/file/d/1EnKMFvKjBLEcaNMr73cDG5Ua3jTCMC0u/view?usp=sharing

The video demonstrates the end-to-end operational pipeline:
1. Off-grid LoRa sensor puck telemetry broadcasting.
2. AI-driven aerial drone thermal/RGB survivor detection.
3. Live hydrodynamic drift estimation and vector calculation.
4. Autonomous Motorized Hydro-Buoy dispatch via 1-Click Command UI.

---
## 🛠 Hardware Simulation & Firmware Setup

To make testing accessible without physical hardware components, this repository includes a complete **Wokwi / ESP32 Hardware Simulation Bundle** containing microcontrollers, LoRa mesh node configurations, acoustic sensor triggers, and motor driver logic.

---

### 📦 Simulation Package Download

* **File Name:** `AquaRescue_Hardware_Simulation.zip`
* **Contents:**
  * `sketch.ino`: Core ESP32 firmware with HiveMQ MQTT integration & telemetry broadcasting.
  * `diagram.json`: Wokwi hardware wiring diagram (ESP32, INMP441 MEMS Mic, L298N Motor Driver, LoRa SX1278).
  * `wokwi.toml`: IDE environment configuration for offline / VS Code simulation.
  * `README_SIMULATION.md`: Step-by-step pin mapping and setup guide.

👉 **[Download Hardware Simulation Zip File]https://github.com/bbsarada07/AquaRescue/releases/download/v1.0.0/AquaRescue_Simulation_Hardware.zip ** *(or extract `AquaRescue_Hardware_Simulation.zip` from the project root)*

---

### ⚡ How to Run the Simulation Locally

1. **Option 1: Using Wokwi Web Simulator**
   * Go to [Wokwi.com](https://wokwi.com).
   * Upload `sketch.ino` and `diagram.json` from the zip archive.
   * Click **Play** to simulate real-time telemetry streaming directly to `aquarescue/telemetry/#`.

2. **Option 2: Running via VS Code (Wokwi Extension)**
   * Install the **Wokwi Simulator** extension in VS Code / Antigravity IDE.
   * Extract the `.zip` contents into your workspace root.
   * Press `F1` and select **Wokwi: Start Simulator**.
   * Open `http://localhost:5000` to watch the simulated sensor data reflect live on the command dashboard.



## 📌 Executive Summary

During catastrophic flood events, severe cyclones, and maritime accidents, local power grids and cellular infrastructure (4G/5G) typically collapse, leaving victims stranded without reliable means to call for aid. Traditional Search and Rescue (SAR) missions are hindered by fast-moving currents, hazardous floating debris, poor low-light visibility, and high risk to first responders.

**AquaRescue** solves this challenge through a multi-agent hardware-software ecosystem designed for zero-connectivity environments. By combining floating LoRa acoustic sensor pucks, an aerial surveillance drone (UAV), an autonomous motorized hydro-buoy (USV), and a low-overhead dual-mode command interface, AquaRescue reduces search-and-response times from hours to under 3 minutes.

---

## 🎯 Problem Statement Alignment

* **Problem Statement Title:** *A deployable AI-powered autonomous drone that aids search-and-rescue operations by detecting people and hazards, thereby improving responder safety and reducing victim discovery time.*
* **SIH Problem ID:** `SIH26177`
* **Sponsoring Agency / Domain:** Qualcomm Inc / Disaster Management
* **Target Category:** Hardware 

---

## 🚀 Key Innovation Pillars

* **Off-Grid Telemetry Mesh:** Operates completely independent of cellular networks using decentralized LoRa RF frequencies (868 MHz / 915 MHz) to bridge floating sensors, drones, and ground stations.
* **Multi-Modal AI Detection Fusion:** Dual-pipeline survivor recognition running thermal/RGB computer vision alongside edge-processed acoustic signal arrays for distress frequency extraction (98% detection confidence threshold).
* **Kalman-Filtered Hydrodynamic Drift Engine:** A physics-driven real-time tracking model that calculates dynamic water current vector shifts to predict target trajectory downstream.
* **Physical Intervention Payload:** Autonomous motorized surface buoy equipped with obstacle avoidance to reach and stabilize victims prior to ground team arrival.
* **Dual-Mode Command UX:** Purpose-built interface offering **Operator Mode** (1-Click Auto Dispatch with Web Speech AI voice assistance) and **Tactical Mode** (3D geospatial visualizer and real-time sensor graphs).

---

## 🏗 System Architecture & Workflow

```

┌─────────────────────────────────────────────────────────────────────────────────┐
│                           AQUA RESCUE SYSTEM PIPELINE                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────┐
▼                                    ▼                                    ▼
┌───────────────────────┐    ┌───────────────────────┐    ┌───────────────────────┐
│ FLOATING SENSOR PUCKS │    │   UAV DRONE SPOTTER   │    │ MOTORIZED HYDRO-BUOY  │
│  Acoustic Array (MIC) │    │  Thermal / RGB Camera │    │ Propeller Thrusters   │
│  LoRa Mesh Node       │    │  Edge AI Detector     │    │ Dynamic GPS Navigation│
└───────────┬───────────┘    └──────┬────────────────┘    └───────────┬───────────┘
│                                   │                                 │
└───────────────────────────────────┼─────────────────────────────────┘
                                    ▼
┌──────────────────────────────────────┐
│    LOCAL BASE STATION / MQTT EDGE    │
│  ESP32 Gateway + HiveMQ / WebSockets │
└───────────────────┬──────────────────┘
                    │
                    ▼
┌────────────────────────────────────────┐
│    REACT / NEXT.JS COMMAND DASHBOARD   │
├───────────────────┬────────────────────┤
│   OPERATOR MODE   │  TACTICAL MODE     │
│  1-Click Dispatch │ Leaflet 3D Map     │
│  Speech AI Assist │ Kalman Drift Engine│
└───────────────────┴────────────────────┘

```

1. **Deployment Phase:** Waterproof sensor pucks are deployed into active water sectors.
2. **Acoustic & Vision Scan:** Pucks monitor audio frequencies for distress signals, while the UAV conducts thermal/RGB grid scans.
3. **Drift Calculation:** Detection coordinates are fed into the Kalman-filtered drift engine to project victim drift velocity and vector direction.
4. **Autonomous Dispatch:** Rescuers launch the Motorized Hydro-Buoy via a 1-Click trigger or voice command.
5. **Physical Rescue:** The buoy navigates the dynamic water currents, avoids floating obstacles, and delivers emergency floatation to the victim.

---

## 🛠 Tech Stack

### Software & Dashboards
* **Frontend Framework:** Next.js (React 18+, TypeScript)
* **Styling & Icons:** Tailwind CSS, Lucide React
* **Mapping & GIS:** Leaflet.js, React-Leaflet, Three.js / WebGL
* **State & Real-Time Sync:** WebSockets, MQTT.js, Node.js Express server
* **Speech Integration:** Web Speech API (Text-to-Speech & Speech-to-Text)

### Embedded & Firmware
* **Microcontrollers:** ESP32 / ESP8266
* **Wireless Protocol:** LoRa (RadioLib / SPI), Wi-Fi / SoftAP fallback
* **Communication Protocols:** MQTT over WebSockets, Serial UART
* **Firmware Environment:** Arduino C++ / PlatformIO

---

## 🧰 Hardware Specifications

| Component | Hardware Module | Functional Role |
| :--- | :--- | :--- |
| **Edge Gateway Node** | ESP32 Microcontroller | Handles local telemetry routing and MQTT stream parsing. |
| **Mesh Communication** | SX1276 / SX1278 LoRa Transceiver | Long-range, low-power off-grid data link. |
| **Acoustic Sensor Puck** | INMP441 MEMS Microphone Array | Captures audio signals and identifies distress frequencies. |
| **Surface Vessel Buoy** | Brushless Motors + ESC + L298N | Provides motorized propulsion across dynamic water currents. |
| **Power Management** | 3S LiPo Batteries + Buck Converters | Powers microcontrollers, motors, and LoRa radios. |

---

## 📦 Installation & Local Setup

### Prerequisites
* **Node.js:** `v18.x` or higher
* **npm:** `v9.x` or higher
* **Git** installed on your system

### Steps

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/your-username/AquaRescue.git](https://github.com/your-username/AquaRescue.git)
   cd AquaRescue
   ```
   1. Install dependencies:
     ```
     npm install
     ```
   2. Configure Environment Variables:
      Create a .env.local file in the root directory:
      
      NEXT_PUBLIC_MQTT_BROKER_URL=wss://[broker.hivemq.com:8884/mqtt](https://broker.hivemq.com:8884/mqtt)
      NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
      
   3. Run the Development Server: 
      ```
      npm run dev
      ```
   4. Access the Application:
      ```
      Open your browser and navigate to http://localhost:5000 (or http://localhost:3000).
      ```
---
## 👥 Authors & Team : Zenthra

Developed for Smart India Hackathon (SIH).

Project: AquaRescue System

Domain: Disaster Management / Robotics & Drones

import asyncio
import math
import os
import random
import time
from typing import Any, Dict

# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
import socketio

# 1. Initialize Socket.io AsyncServer
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25,
    always_connect=True,
)

# 2. Initialize FastAPI Application
api = FastAPI(
    title="AquaRescue Backend API",
    description="AquaRescue Backend Telemetry & WebSocket Engine",
    version="2.0.0",
)

# CORS Configuration
api.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# HTTP Routes
@api.get("/")
async def root():
    return {
        "status": "AquaRescue Backend Operational",
        "system": "AquaRescue Command Engine v2.0",
        "websocket": "Socket.io enabled on /socket.io",
    }


@api.get("/health")
async def health_check():
    return {
        "status": "ok",
        "timestamp": int(time.time() * 1000),
        "system": "AquaRescue Backend Engine v2.0",
    }


# Simulation State & Target State
active_target: Dict[str, Any] = {
    "puck_id": "PUCK-ALPHA-04",
    "base_lat": 17.385044,
    "base_lng": 78.486671,
    "audio_screech_confidence": 0.96,
    "thermal_delta_c": 5.2,
    "water_velocity_ms": 1.8,
    "drift_heading_deg": 140,
}

simulation_task: asyncio.Task | None = None
simulation_active = False


async def high_frequency_stream():
    global simulation_active
    step = 0
    while simulation_active:
        step += 1
        lat_noise = (math.sin(step * 0.4) * 0.00008) + (
            (random.random() - 0.5) * 0.00006
        )
        lng_noise = (math.cos(step * 0.3) * 0.00008) + (
            (random.random() - 0.5) * 0.00006
        )

        telemetry_payload = {
            "event": "DISTRESS_TRIGGERED",
            "puck_id": active_target["puck_id"],
            "location": {
                "lat": active_target["base_lat"] + lat_noise,
                "lng": active_target["base_lng"] + lng_noise,
            },
            "sensor_data": {
                "audio_screech_confidence": active_target[
                    "audio_screech_confidence"
                ]
                + ((random.random() - 0.5) * 0.02),
                "thermal_delta_c": active_target["thermal_delta_c"]
                + ((random.random() - 0.5) * 0.1),
                "water_velocity_ms": active_target["water_velocity_ms"],
                "drift_heading_deg": active_target["drift_heading_deg"],
            },
            "timestamp": int(time.time() * 1000),
        }

        await sio.emit("DISTRESS_TRIGGERED", telemetry_payload)
        await asyncio.sleep(0.1)  # 100ms interval


def start_simulation():
    global simulation_active, simulation_task
    if simulation_task and not simulation_task.done():
        simulation_task.cancel()
    simulation_active = True
    simulation_task = asyncio.create_task(high_frequency_stream())


def stop_simulation():
    global simulation_active, simulation_task
    simulation_active = False
    if simulation_task and not simulation_task.done():
        simulation_task.cancel()
    simulation_task = None


# Socket.io Event Handlers
@sio.event
async def connect(sid, environ, auth=None):
    print(f"[AquaRescue Socket.io] Client connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f"[AquaRescue Socket.io] Client disconnected: {sid}")


@sio.event
async def DISTRESS_TRIGGERED(sid, data):
    print(f"[ALERT RECEIVED] Puck from {sid}:", data)
    if isinstance(data, dict):
        loc = data.get("location", {})
        if loc.get("lat"):
            active_target["base_lat"] = loc["lat"]
        if loc.get("lng"):
            active_target["base_lng"] = loc["lng"]
    start_simulation()
    await sio.emit("DISTRESS_TRIGGERED", data)


@sio.event
async def EXECUTE_RESCUE(sid, data):
    print(f"[COMMAND DISPATCHED] EXECUTE_RESCUE:", data)
    await sio.emit("COMMAND_RESPONSE", data)
    if isinstance(data, dict):
        if "drone_command" in data:
            await sio.emit("DISPATCH_UAV", data["drone_command"])
        if "buoy_command" in data:
            await sio.emit("NAVIGATE_BUOY", data["buoy_command"])


@sio.event
async def OVERRIDE_DISPATCH(sid, data):
    print(f"[OVERRIDE DISPATCH]:", data)
    await sio.emit("OVERRIDE_DISPATCH_ACK", data)


@sio.event
async def MANUAL_PAYLOAD_DROP(sid, data):
    print(f"[MANUAL PAYLOAD DROP]:", data)
    await sio.emit("MANUAL_PAYLOAD_DROP_ACK", data)


@sio.event
async def RESOLVE_INCIDENT(sid, data):
    print(f"[INCIDENT RESOLVED]:", data)
    stop_simulation()
    await sio.emit("INCIDENT_RESOLVED_ACK", data)


@sio.event
async def SIMULATE_TELEMETRY(sid, data):
    if isinstance(data, dict):
        loc = data.get("location", {})
        if loc.get("lat"):
            active_target["base_lat"] = loc["lat"]
        if loc.get("lng"):
            active_target["base_lng"] = loc["lng"]
    start_simulation()


# 3. Mount Socket.io onto ASGI app (Expose as 'app' for uvicorn main:app)
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=api,
    socketio_path="socket.io",
)

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 5000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)

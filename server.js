/**
 * AquaRescue Laptop 2 Local WebSocket Server Bridge
 * 
 * Express + Socket.io Server (Port 5000)
 * Handles telemetry, commands between Laptop 1 and Laptop 2 Dashboard,
 * and high-frequency (100ms) simulated telemetry ticks with noise for Kalman testing.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

// Default target state
let activeTarget = {
  puck_id: "PUCK-ALPHA-04",
  base_lat: 17.385044,
  base_lng: 78.486671,
  audio_screech_confidence: 0.96,
  thermal_delta_c: 5.2,
  water_velocity_ms: 1.8,
  drift_heading_deg: 140
};

let simulationActive = false;
let simulationInterval = null;

// Telemetry Broadcast Generator (100ms high-frequency stream)
function startHighFrequencyStream() {
  if (simulationInterval) clearInterval(simulationInterval);
  
  let step = 0;
  simulationInterval = setInterval(() => {
    step++;
    // Simulate GPS multipath water reflection noise (+- 3 to 12 meters fluctuation)
    const latNoise = (Math.sin(step * 0.4) * 0.00008) + ((Math.random() - 0.5) * 0.00006);
    const lngNoise = (Math.cos(step * 0.3) * 0.00008) + ((Math.random() - 0.5) * 0.00006);

    const telemetryPayload = {
      event: "DISTRESS_TRIGGERED",
      puck_id: activeTarget.puck_id,
      location: {
        lat: activeTarget.base_lat + latNoise,
        lng: activeTarget.base_lng + lngNoise
      },
      sensor_data: {
        audio_screech_confidence: activeTarget.audio_screech_confidence + ((Math.random() - 0.5) * 0.02),
        thermal_delta_c: activeTarget.thermal_delta_c + ((Math.random() - 0.5) * 0.1),
        water_velocity_ms: activeTarget.water_velocity_ms,
        drift_heading_deg: activeTarget.drift_heading_deg
      },
      timestamp: Date.now()
    };

    io.emit('DISTRESS_TRIGGERED', telemetryPayload);
  }, 100);
}

io.on('connection', (socket) => {
  console.log(`[AquaRescue Mesh Bridge] Client connected: ${socket.id}`);

  // Laptop 1 sends incoming distress trigger
  socket.on('DISTRESS_TRIGGERED', (data) => {
    console.log(`[ALERT RECEIVED from Laptop 1] Puck: ${data.puck_id}`, data.location);
    if (data.location?.lat) activeTarget.base_lat = data.location.lat;
    if (data.location?.lng) activeTarget.base_lng = data.location.lng;
    
    simulationActive = true;
    startHighFrequencyStream();
    io.emit('DISTRESS_TRIGGERED', data);
  });

  // Outgoing Response Command from Laptop 2 Dashboard to Laptop 1
  socket.on('EXECUTE_RESCUE', (commandPayload) => {
    console.log('[COMMAND DISPATCHED -> Laptop 1]', JSON.stringify(commandPayload, null, 2));
    io.emit('COMMAND_RESPONSE', commandPayload);
    io.emit('DISPATCH_UAV', commandPayload.drone_command);
    io.emit('NAVIGATE_BUOY', commandPayload.buoy_command);
  });

  socket.on('OVERRIDE_DISPATCH', (payload) => {
    console.log('[OVERRIDE DISPATCH -> Laptop 1]', payload);
    io.emit('OVERRIDE_DISPATCH_ACK', payload);
  });

  socket.on('MANUAL_PAYLOAD_DROP', (payload) => {
    console.log('[MANUAL PAYLOAD DROP -> Drone Unit]', payload);
    io.emit('MANUAL_PAYLOAD_DROP_ACK', payload);
  });

  socket.on('RESOLVE_INCIDENT', (payload) => {
    console.log('[INCIDENT RESOLVED]', payload);
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    simulationActive = false;
    io.emit('INCIDENT_RESOLVED_ACK', payload);
  });

  socket.on('SIMULATE_TELEMETRY', (payload) => {
    if (payload.location?.lat) activeTarget.base_lat = payload.location.lat;
    if (payload.location?.lng) activeTarget.base_lng = payload.location.lng;
    simulationActive = true;
    startHighFrequencyStream();
  });

  socket.on('disconnect', () => {
    console.log(`[AquaRescue Mesh Bridge] Client disconnected: ${socket.id}`);
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'AquaRescue Command Server v2.0',
    port: PORT,
    activeSimulation: simulationActive
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`[AquaRescue Server] Port ${PORT} is already in use by an active server instance.`);
  } else {
    console.error('[AquaRescue Server Error]', err);
  }
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` AquaRescue Laptop 2 Socket.io Server Running on :${PORT} `);
  console.log(` Ready to bridge Laptop 1 mesh alerts to Command Dashboard `);
  console.log(`=======================================================`);
});

/**
 * AquaRescue Dual-Purpose Express + Next.js Server & HIL MQTT Relay
 * 
 * Features:
 * - Initializes Next.js app (next({ dev })) and attaches Express + HTTP Server
 * - Dynamic port binding (process.env.PORT || 5000)
 * - Socket.io with CORS & 10s pingInterval keep-alive heartbeat for Render idle proxy drops
 * - MQTT Client connecting to mqtt://broker.hivemq.com:1883
 * - Subscribes to aquarescue/telemetry/# and emits hardware_telemetry_update to active Socket.io clients
 * - Standard Next.js route handling for all HTTP traffic
 */

const express = require('express');
const http = require('http');
const next = require('next');
const { Server } = require('socket.io');
const cors = require('cors');
const mqtt = require('mqtt');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 5000;

app.prepare().then(() => {
  const server = express();
  server.use(cors());
  server.use(express.json());

  const httpServer = http.createServer(server);

  // Initialize socket.io with CORS and production heartbeat keep-alive settings
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingInterval: 10000, // Send heartbeat every 10s to prevent Render idle proxy drops
    pingTimeout: 5000,
  });

  // Instantiate MQTT client connecting to public broker
  const mqttClient = mqtt.connect('mqtt://broker.hivemq.com:1883');

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker.hivemq.com:1883');
    mqttClient.subscribe('aquarescue/telemetry/#', (err) => {
      if (err) {
        console.error('[MQTT] Subscription error:', err);
      } else {
        console.log('[MQTT] Subscribed to aquarescue/telemetry/#');
      }
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`[MQTT Telemetry] Topic ${topic}:`, payload);
      io.emit('hardware_telemetry_update', payload);
    } catch (err) {
      console.error('[MQTT Parse Error]', err.message);
    }
  });

  // Default target state & simulation stream
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

  function startHighFrequencyStream() {
    if (simulationInterval) clearInterval(simulationInterval);
    let step = 0;
    simulationInterval = setInterval(() => {
      step++;
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

    socket.on('DISTRESS_TRIGGERED', (data) => {
      console.log(`[ALERT RECEIVED] Puck: ${data.puck_id}`, data.location);
      if (data.location?.lat) activeTarget.base_lat = data.location.lat;
      if (data.location?.lng) activeTarget.base_lng = data.location.lng;
      simulationActive = true;
      startHighFrequencyStream();
      io.emit('DISTRESS_TRIGGERED', data);
    });

    socket.on('EXECUTE_RESCUE', (commandPayload) => {
      console.log('[COMMAND DISPATCHED]', JSON.stringify(commandPayload, null, 2));
      io.emit('COMMAND_RESPONSE', commandPayload);
      io.emit('DISPATCH_UAV', commandPayload.drone_command);
      io.emit('NAVIGATE_BUOY', commandPayload.buoy_command);
    });

    socket.on('OVERRIDE_DISPATCH', (payload) => {
      console.log('[OVERRIDE DISPATCH]', payload);
      io.emit('OVERRIDE_DISPATCH_ACK', payload);
    });

    socket.on('MANUAL_PAYLOAD_DROP', (payload) => {
      console.log('[MANUAL PAYLOAD DROP]', payload);
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

  server.get('/health', (req, res) => {
    res.json({
      status: 'ONLINE',
      system: 'AquaRescue Command Server v2.0',
      port: PORT,
      activeSimulation: simulationActive
    });
  });

  // Route all standard Next.js page HTTP traffic
  server.all('*', (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`=======================================================`);
    console.log(` AquaRescue Dual-Purpose Express + Next.js Server on :${PORT} `);
    console.log(` NODE_ENV=${process.env.NODE_ENV || 'development'} `);
    console.log(`=======================================================`);
  });
}).catch((err) => {
  console.error('Server preparation error:', err);
  process.exit(1);
});

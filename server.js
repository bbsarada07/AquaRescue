/**
 * AquaRescue Production Express + Next.js Server & HIL MQTT Relay
 * 
 * Features:
 * - Initializes Next.js custom server with attached Express + HTTP Server
 * - Socket.io attached directly to httpServer with explicit path '/socket.io/'
 * - Permissive and robust CORS handling for Vercel, localhost, and cross-origin clients
 * - Dynamic port & host binding (process.env.PORT || 5000 on '0.0.0.0') for Render
 * - Health check endpoint GET /health defined before Next.js catch-all routes
 * - MQTT Client connecting to mqtt://broker.hivemq.com:1883
 * - Subscribes to aquarescue/telemetry/# and emits hardware_telemetry_update to active Socket.io clients
 * - Next.js request handler for all standard HTTP page traffic
 */

const { createServer } = require('http');
const express = require('express');
const next = require('next');
const { Server } = require('socket.io');
const cors = require('cors');
const mqtt = require('mqtt');

const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// CORS Origin Validator
const isOriginAllowed = (origin, callback) => {
  // Allow Vercel deployments, localhost, and server-to-server / curl requests
  if (!origin || origin.includes('aquarescue') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
    callback(null, true);
  } else {
    callback(null, true); // Allow all during debugging / deployment
  }
};

const corsOptions = {
  origin: isOriginAllowed,
  methods: ['GET', 'POST'],
  credentials: true,
};

nextApp.prepare().then(() => {
  // 1. Create Express App Instance
  const app = express();

  // Middleware setup
  app.use(cors(corsOptions));
  app.use(express.json());

  // 2. Wrap Express with HTTP Server
  const httpServer = createServer(app);

  // 3. Attach Socket.io directly to httpServer (NOT app) BEFORE catch-all routes
  const io = new Server(httpServer, {
    path: '/socket.io/',
    cors: {
      origin: isOriginAllowed,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Top-level Health Check Endpoint for Render & monitoring services
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: Date.now(),
      system: 'AquaRescue Command Server v2.0',
      port: Number(PORT),
    });
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
    puck_id: 'PUCK-ALPHA-04',
    base_lat: 17.385044,
    base_lng: 78.486671,
    audio_screech_confidence: 0.96,
    thermal_delta_c: 5.2,
    water_velocity_ms: 1.8,
    drift_heading_deg: 140,
  };

  let simulationActive = false;
  let simulationInterval = null;

  function startHighFrequencyStream() {
    if (simulationInterval) clearInterval(simulationInterval);
    let step = 0;
    simulationInterval = setInterval(() => {
      step++;
      const latNoise = Math.sin(step * 0.4) * 0.00008 + (Math.random() - 0.5) * 0.00006;
      const lngNoise = Math.cos(step * 0.3) * 0.00008 + (Math.random() - 0.5) * 0.00006;

      const telemetryPayload = {
        event: 'DISTRESS_TRIGGERED',
        puck_id: activeTarget.puck_id,
        location: {
          lat: activeTarget.base_lat + latNoise,
          lng: activeTarget.base_lng + lngNoise,
        },
        sensor_data: {
          audio_screech_confidence: activeTarget.audio_screech_confidence + (Math.random() - 0.5) * 0.02,
          thermal_delta_c: activeTarget.thermal_delta_c + (Math.random() - 0.5) * 0.1,
          water_velocity_ms: activeTarget.water_velocity_ms,
          drift_heading_deg: activeTarget.drift_heading_deg,
        },
        timestamp: Date.now(),
      };

      io.emit('DISTRESS_TRIGGERED', telemetryPayload);
    }, 100);
  }

  // Socket.io connection and event handling
  io.on('connection', (socket) => {
    console.log(`[AquaRescue Mesh Bridge] Client connected: ${socket.id} (Transport: ${socket.conn.transport.name})`);

    socket.conn.on('upgrade', (transport) => {
      console.log(`[AquaRescue Mesh Bridge] Client ${socket.id} upgraded transport to: ${transport.name}`);
    });

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

    socket.on('disconnect', (reason) => {
      console.log(`[AquaRescue Mesh Bridge] Client disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });

  // Route all standard Next.js page HTTP traffic (AFTER Socket.io & Health routes)
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  // Critical Server Startup: Listen on httpServer (NOT app.listen)
  httpServer.listen(Number(PORT), HOST, () => {
    console.log(`=======================================================`);
    console.log(` AquaRescue server running on port ${PORT}`);
    console.log(` Host: ${HOST} | NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    console.log(` Health check available at: http://${HOST}:${PORT}/health`);
    console.log(` Socket.io path mounted at: /socket.io/`);
    console.log(`=======================================================`);
  });
}).catch((err) => {
  console.error('Server preparation error:', err);
  process.exit(1);
});

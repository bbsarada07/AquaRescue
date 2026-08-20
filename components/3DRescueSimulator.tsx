'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { socket } from '@/lib/socket';
import { Box, Layers, Radio, Cpu, Activity } from 'lucide-react';

const REF_LAT = 17.385044;
const REF_LNG = 78.486671;

export interface HardwareTelemetryPayload {
  vehicleId?: string;
  puck_id?: string;
  lat?: number;
  lng?: number;
  alt?: number;
  location?: { lat: number; lng: number };
  sensor_data?: any;
  timestamp?: number;
}

// 3D Animated Drone Component
function Drone3D({ targetPosition }: { targetPosition: THREE.Vector3 }) {
  const groupRef = useRef<THREE.Group>(null);
  const rotorRefs = useRef<THREE.Mesh[]>([]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // Smooth frame interpolation (lerp) to update 3D drone position without jitter
      groupRef.current.position.lerp(targetPosition, delta * 8);

      // Subtle hovering animation
      groupRef.current.position.y += Math.sin(state.clock.getElapsedTime() * 4) * 0.05;
    }

    // Rotate quadcopter rotors
    rotorRefs.current.forEach((rotor) => {
      if (rotor) {
        rotor.rotation.y += delta * 30;
      }
    });
  });

  return (
    <group ref={groupRef} position={[0, 7.5, 0]}>
      {/* Central Drone Chassis Body */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 0.4, 1.2]} />
        <meshStandardMaterial color="#06B6D4" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Center Top Navigation Light Dome */}
      <mesh position={[0, 0.35, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#00FF88" emissive="#00FF88" emissiveIntensity={0.8} />
      </mesh>

      {/* 4 Rotor Arms */}
      {[
        [-1, 0, -1],
        [1, 0, -1],
        [-1, 0, 1],
        [1, 0, 1],
      ].map(([x, y, z], idx) => (
        <group key={idx} position={[x, y, z]}>
          {/* Connecting Arm Cylinder */}
          <mesh position={[-x * 0.4, 0, -z * 0.4]}>
            <cylinderGeometry args={[0.06, 0.06, 1.2]} />
            <meshStandardMaterial color="#1F293D" metalness={0.9} />
          </mesh>

          {/* Rotor Motor Housing */}
          <mesh position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.2, 0.2, 0.3]} />
            <meshStandardMaterial color="#111827" />
          </mesh>

          {/* Spinning Propeller Rotor */}
          <mesh
            ref={(el) => {
              if (el) rotorRefs.current[idx] = el;
            }}
            position={[0, 0.28, 0]}
          >
            <boxGeometry args={[1.6, 0.02, 0.15]} />
            <meshStandardMaterial color="#67E8F9" opacity={0.85} transparent />
          </mesh>
        </group>
      ))}

      {/* Downward Searchlight Beam */}
      <spotLight
        position={[0, -0.2, 0]}
        target-position={[0, -10, 0]}
        angle={0.6}
        penumbra={0.4}
        intensity={3}
        color="#06B6D4"
      />

      {/* Vehicle ID 3D Floating Label */}
      <Text
        position={[0, 1.2, 0]}
        fontSize={0.5}
        color="#00FF88"
        anchorX="center"
        anchorY="middle"
      >
        UAV-RESCUE-01
      </Text>
    </group>
  );
}

// 3D Target Marker (Victim Puck Origin)
function TargetPuck3D() {
  const pulseRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (pulseRef.current) {
      const s = 1 + Math.sin(state.clock.getElapsedTime() * 5) * 0.2;
      pulseRef.current.scale.set(s, 1, s);
    }
  });

  return (
    <group position={[0, 0.1, 0]}>
      {/* Target Base Cylinder */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.8, 0.8, 0.2, 32]} />
        <meshStandardMaterial color="#EF4444" emissive="#EF4444" emissiveIntensity={0.6} />
      </mesh>

      {/* Pulsing Beacon Ring */}
      <mesh ref={pulseRef} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.9, 1.3, 32]} />
        <meshBasicMaterial color="#EF4444" side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>

      <Text position={[0, 1.5, 0]} fontSize={0.4} color="#EF4444" anchorX="center">
        VICTIM PUCK (REF ORIGIN)
      </Text>
    </group>
  );
}

// Main 3D Digital Twin Canvas Component
export default function RescueSimulator3D() {
  const [telemetry, setTelemetry] = useState<HardwareTelemetryPayload>({
    vehicleId: 'DRONE_UAV_01',
    lat: 17.385044,
    lng: 78.486671,
    alt: 15.0,
    timestamp: Date.now(),
  });
  const [packetCount, setPacketCount] = useState<number>(0);
  const targetPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 7.5, 0));

  useEffect(() => {
    // Subscribe to Socket.io connection for hardware_telemetry_update
    const handleTelemetry = (data: HardwareTelemetryPayload) => {
      setTelemetry(data);
      setPacketCount((prev) => prev + 1);

      const lat = data.lat ?? data.location?.lat ?? REF_LAT;
      const lng = data.lng ?? data.location?.lng ?? REF_LNG;
      const alt = data.alt ?? 15.0;

      // Convert incoming GPS coordinates into WebGL 3D Cartesian space (X, Y, Z) relative to reference origin
      const x = (lng - REF_LNG) * 105930;
      const z = -(lat - REF_LAT) * 111000;
      const y = Math.max(2, alt * 0.5);

      targetPosRef.current.set(x, y, z);
    };

    socket.on('hardware_telemetry_update', handleTelemetry);
    socket.on('DISTRESS_TRIGGERED', handleTelemetry);

    return () => {
      socket.off('hardware_telemetry_update', handleTelemetry);
      socket.off('DISTRESS_TRIGGERED', handleTelemetry);
    };
  }, []);

  const curLat = telemetry.lat ?? telemetry.location?.lat ?? REF_LAT;
  const curLng = telemetry.lng ?? telemetry.location?.lng ?? REF_LNG;
  const curAlt = telemetry.alt ?? 15.0;

  const webglX = (curLng - REF_LNG) * 105930;
  const webglZ = -(curLat - REF_LAT) * 111000;

  return (
    <div className="relative w-full h-[500px] bg-[#050914] rounded-lg overflow-hidden border border-[#1F293D] shadow-2xl font-mono select-none">
      {/* 3D Canvas Context */}
      <Canvas style={{ width: '100%', height: '100%' }}>
        <PerspectiveCamera makeDefault position={[18, 16, 22]} fov={50} />
        <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={5} maxDistance={60} />

        {/* Ambient & Directional Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[20, 30, 10]} intensity={1.5} color="#67E8F9" castShadow />
        <pointLight position={[-10, 10, -10]} intensity={0.8} color="#00FF88" />

        {/* Water Surface Plane / Tactical Mesh Grid */}
        <Grid
          position={[0, 0, 0]}
          args={[100, 100]}
          cellSize={1}
          cellThickness={1}
          cellColor="#06B6D4"
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor="#00FF88"
          fadeDistance={50}
          fadeStrength={1.5}
        />

        {/* Water Surface Simulation Plane */}
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial color="#0A1628" opacity={0.9} transparent roughness={0.1} metalness={0.8} />
        </mesh>

        {/* 3D Target Puck & 3D Quadcopter Drone */}
        <TargetPuck3D />
        <Drone3D targetPosition={targetPosRef.current} />
      </Canvas>

      {/* Overlay HUD Panel: Hardware Telemetry Metrics */}
      <div className="absolute top-3 left-3 bg-[#090D16]/90 border border-[#06B6D4]/50 rounded-lg p-3 w-80 backdrop-blur-md text-xs space-y-2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 text-[#06B6D4] font-extrabold">
          <div className="flex items-center space-x-1.5">
            <Cpu className="w-4 h-4 text-[#00FF88]" />
            <span>HIL 3D DIGITAL TWIN</span>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#00FF88] animate-ping" />
        </div>

        <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
          <span className="text-gray-400">VEHICLE ID</span>
          <span className="text-white font-bold">{telemetry.vehicleId || 'DRONE_UAV_01'}</span>

          <span className="text-gray-400">RAW LAT</span>
          <span className="text-[#06B6D4] font-bold">{curLat.toFixed(6)}</span>

          <span className="text-gray-400">RAW LNG</span>
          <span className="text-[#06B6D4] font-bold">{curLng.toFixed(6)}</span>

          <span className="text-gray-400">ALTITUDE</span>
          <span className="text-[#00FF88] font-bold">{curAlt.toFixed(1)} m</span>

          <span className="text-gray-400">WEBGL (X, Z)</span>
          <span className="text-[#F59E0B] font-bold">{webglX.toFixed(2)}, {webglZ.toFixed(2)}</span>

          <span className="text-gray-400">PACKETS RECV</span>
          <span className="text-white font-bold">{packetCount}</span>
        </div>

        <div className="border-t border-[#1F293D] pt-1.5 flex items-center justify-between text-[10px] text-gray-400">
          <div className="flex items-center space-x-1">
            <Activity className="w-3 h-3 text-[#00FF88]" />
            <span>MQTT → Socket.io Stream</span>
          </div>
          <span className="text-[#00FF88] font-bold">ONLINE</span>
        </div>
      </div>
    </div>
  );
}

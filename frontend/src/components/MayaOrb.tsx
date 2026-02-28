import { useRef, useMemo, Component, ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() { return { crashed: true }; }
  render() {
    if (this.state.crashed) return <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'rgba(137,206,194,0.3)' }} />;
    return this.props.children;
  }
}

type OrbStatus = 'idle' | 'connected' | 'thinking' | 'executing' | 'offline';

interface OrbMeshProps {
  status: OrbStatus;
}

function OrbMesh({ status }: OrbMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const ringRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.Points>(null!);
  const timeRef = useRef(0);

  // Particle positions for orbit ring
  const particlePositions = useMemo(() => {
    const count = 24;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 0.72;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius * 0.3;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return positions;
  }, []);

  const statusColors: Record<OrbStatus, string> = {
    idle: '#8A9EB0',
    connected: '#7DD8B8',
    thinking: '#D4AF6C',
    executing: '#E8C97E',
    offline: '#D47070',
  };

  const color = statusColors[status] ?? statusColors.idle;

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (!meshRef.current) return;

    // Slow base rotation
    meshRef.current.rotation.y += delta * 0.6;
    meshRef.current.rotation.x += delta * 0.2;

    // Breathing scale animation based on status
    const t = timeRef.current;
    if (status === 'idle' || status === 'connected') {
      const breathe = 1 + Math.sin(t * 1.2) * 0.06;
      meshRef.current.scale.setScalar(breathe);
    } else if (status === 'thinking') {
      const pulse = 1 + Math.sin(t * 3.5) * 0.12;
      meshRef.current.scale.setScalar(pulse);
    } else if (status === 'executing') {
      const active = 1 + Math.sin(t * 6) * 0.18;
      meshRef.current.scale.setScalar(active);
    }

    // Orbit ring rotation for thinking/executing
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (status === 'executing' ? 4 : status === 'thinking' ? 2 : 0.5);
      ringRef.current.visible = status === 'thinking' || status === 'executing';
    }

    // Particles for executing state
    if (particlesRef.current) {
      particlesRef.current.rotation.y += delta * 3;
      particlesRef.current.visible = status === 'executing';
    }
  });

  return (
    <>
      {/* Core sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.48, 24, 24]} />
        <meshStandardMaterial
          color={color}
          metalness={0.85}
          roughness={0.08}
          emissive={color}
          emissiveIntensity={status === 'executing' ? 0.8 : status === 'thinking' ? 0.5 : 0.3}
        />
      </mesh>

      {/* Orbit ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2.5, 0, 0]} visible={false}>
        <torusGeometry args={[0.72, 0.025, 6, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>

      {/* Particle cloud for executing state */}
      <points ref={particlesRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[particlePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial color={color} size={0.06} transparent opacity={0.9} />
      </points>

      {/* Ambient + point lights */}
      <ambientLight intensity={0.3} />
      <pointLight position={[2, 2, 2]} intensity={1.2} color={color} />
      <pointLight position={[-1, -1, 1]} intensity={0.4} color="#ffffff" />
    </>
  );
}

interface MayaOrbProps {
  status: OrbStatus;
  size?: number;
}

export function MayaOrb({ status, size = 32 }: MayaOrbProps) {
  return (
    <div style={{ width: size, height: size, flexShrink: 0 }}>
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 2.2], fov: 45 }}
          style={{ background: 'transparent' }}
          dpr={1}
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        >
          <OrbMesh status={status} />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}

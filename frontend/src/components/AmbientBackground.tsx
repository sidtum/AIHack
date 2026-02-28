import { useRef, useEffect, useState, Component, ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Error boundary so a WebGL crash doesn't freeze the app
class CanvasErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError(e: unknown) { console.error('[AmbientBackground] WebGL crashed:', e); return { crashed: true }; }
  render() { return this.state.crashed ? null : this.props.children; }
}

interface WireframeShapeProps {
  mousePos: { x: number; y: number };
}

function WireframeShape({ mousePos }: WireframeShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const targetRotation = useRef({ x: 0, y: 0 });
  const currentRotation = useRef({ x: 0, y: 0 });

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // Slow base rotation
    meshRef.current.rotation.x += delta * 0.08;
    meshRef.current.rotation.y += delta * 0.13;
    meshRef.current.rotation.z += delta * 0.05;

    // Mouse parallax: gently shift toward mouse position
    targetRotation.current.x = mousePos.y * 0.3;
    targetRotation.current.y = mousePos.x * 0.3;

    currentRotation.current.x += (targetRotation.current.x - currentRotation.current.x) * delta * 0.8;
    currentRotation.current.y += (targetRotation.current.y - currentRotation.current.y) * delta * 0.8;

    meshRef.current.rotation.x += currentRotation.current.x * 0.01;
    meshRef.current.rotation.y += currentRotation.current.y * 0.01;
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <icosahedronGeometry args={[2.2, 1]} />
      <meshBasicMaterial
        color="#D4AF6C"
        wireframe
        transparent
        opacity={0.18}
      />
    </mesh>
  );
}

function SecondaryShape({ mousePos: _mousePos }: WireframeShapeProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x -= delta * 0.05;
    meshRef.current.rotation.y -= delta * 0.09;
    meshRef.current.rotation.z += delta * 0.07;
  });

  return (
    <mesh ref={meshRef} position={[3.5, -1.5, -2]}>
      <octahedronGeometry args={[1.1, 0]} />
      <meshBasicMaterial
        color="#89CEC2"
        wireframe
        transparent
        opacity={0.12}
      />
    </mesh>
  );
}

function TorusShape() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.x += delta * 0.04;
    meshRef.current.rotation.z += delta * 0.06;
  });

  return (
    <mesh ref={meshRef} position={[-3.8, 2, -1.5]}>
      <torusGeometry args={[1.0, 0.35, 8, 20]} />
      <meshBasicMaterial
        color="#D4AF6C"
        wireframe
        transparent
        opacity={0.10}
      />
    </mesh>
  );
}

interface AmbientBackgroundProps {
  /** Fades the 3D canvas to near-invisible when browser is active */
  dim?: boolean;
}

export function AmbientBackground({ dim = false }: AmbientBackgroundProps) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1,
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: dim ? 0.15 : 1,
        transition: 'opacity 1.2s ease',
        filter: 'blur(0.5px)',
      }}
    >
      <CanvasErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 6], fov: 55 }}
          style={{ background: 'transparent' }}
          dpr={[1, 1.5]}
          performance={{ min: 0.4 }}
          gl={{ alpha: true, antialias: false, powerPreference: 'low-power' }}
        >
          <WireframeShape mousePos={mousePos} />
          <SecondaryShape mousePos={mousePos} />
          <TorusShape />
        </Canvas>
      </CanvasErrorBoundary>
    </div>
  );
}

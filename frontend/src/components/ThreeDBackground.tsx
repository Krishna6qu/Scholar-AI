import { useEffect, useRef } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  color: string;
  vx: number;
  vy: number;
  vz: number;
  pulsePhase: number;
}

interface Star3D {
  x: number;
  y: number;
  z: number;
  size: number;
  alpha: number;
  twinkleSpeed: number;
}

export default function ThreeDBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = 0;
    let height = 0;

    function resize() {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx?.scale(dpr, dpr);
    }

    resize();
    window.addEventListener("resize", resize);

    // Color palette matching ScholarAI's neon aesthetic
    const colors = [
      "rgba(168, 85, 247, ", // neon-violet
      "rgba(34, 211, 238, ",  // neon-cyan
      "rgba(244, 114, 182, ", // neon-pink
      "rgba(163, 230, 53, ",  // neon-lime
    ];

    // Initialize 3D Constellation Nodes
    const NODE_COUNT = 75;
    const BOX_X = 700;
    const BOX_Y = 450;
    const BOX_Z = 500;

    const nodes: Point3D[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: (Math.random() - 0.5) * BOX_X * 2,
        y: (Math.random() - 0.5) * BOX_Y * 2,
        z: (Math.random() - 0.5) * BOX_Z * 2,
        baseRadius: Math.random() * 1.8 + 1.2,
        color: colors[i % colors.length],
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        vz: (Math.random() - 0.5) * 0.45,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Initialize Deep 3D Star Dust
    const STAR_COUNT = 90;
    const stars: Star3D[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 1400,
        y: (Math.random() - 0.5) * 1000,
        z: Math.random() * 800 - 200,
        size: Math.random() * 1.2 + 0.5,
        alpha: Math.random() * 0.6 + 0.2,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
      });
    }

    // Mouse tracking for 3D Camera Tilt
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;
    let mouseX = width / 2;
    let mouseY = height / 2;

    function onPointerMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const normX = (mouseX / width - 0.5) * 2;
      const normY = (mouseY / height - 0.5) * 2;
      targetRotY = normX * 0.25;
      targetRotX = -normY * 0.2;
    }

    window.addEventListener("pointermove", onPointerMove);

    // Visibility change handler to pause when tab is inactive
    let isTabVisible = !document.hidden;
    function onVisibilityChange() {
      isTabVisible = !document.hidden;
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const FOV = 420;
    let time = 0;

    function render() {
      if (!isTabVisible || !ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      time += 0.016;

      // Smooth camera interpolation
      currentRotY += (targetRotY - currentRotY) * 0.04;
      currentRotX += (targetRotX - currentRotX) * 0.04;

      // Continuous subtle natural orbital drift
      const autoY = time * 0.06;
      const totalRotY = currentRotY + autoY;
      const totalRotX = currentRotX;

      const cosY = Math.cos(totalRotY);
      const sinY = Math.sin(totalRotY);
      const cosX = Math.cos(totalRotX);
      const sinX = Math.sin(totalRotX);

      ctx.clearRect(0, 0, width, height);

      const halfW = width / 2;
      const halfH = height / 2;

      // 1. Render Deep Star Dust
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        // Move stars slowly forward
        s.z -= 0.15;
        if (s.z < -200) s.z += 800;

        // Apply rotation
        const x1 = s.x * cosY - s.z * sinY;
        const z1 = s.x * sinY + s.z * cosY;
        const y1 = s.y * cosX - z1 * sinX;
        const z2 = s.y * sinX + z1 * cosX;

        const depth = z2 + 350;
        if (depth > 20) {
          const scale = FOV / depth;
          const sx = halfW + x1 * scale;
          const sy = halfH + y1 * scale;

          if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
            const twinkle = (Math.sin(time * 2 + i) + 1) * 0.5;
            const starAlpha = Math.min(Math.max(s.alpha * twinkle * (scale * 0.8), 0.05), 0.7);
            ctx.fillStyle = `rgba(212, 212, 220, ${starAlpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(s.size * scale, 0.6), 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 2. Project Nodes to Screen Space
      interface ProjectedNode {
        sx: number;
        sy: number;
        z: number;
        scale: number;
        radius: number;
        color: string;
        alpha: number;
        pulse: number;
      }

      const projected: (ProjectedNode | null)[] = [];

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        // Animate node velocity
        n.x += n.vx;
        n.y += n.vy;
        n.z += n.vz;

        // Bounds bounce in 3D box
        if (n.x < -BOX_X || n.x > BOX_X) n.vx *= -1;
        if (n.y < -BOX_Y || n.y > BOX_Y) n.vy *= -1;
        if (n.z < -BOX_Z || n.z > BOX_Z) n.vz *= -1;

        // 3D rotation
        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.x * sinY + n.z * cosY;
        const y1 = n.y * cosX - z1 * sinX;
        const z2 = n.y * sinX + z1 * cosX;

        const depth = z2 + 400;

        if (depth > 20) {
          const scale = FOV / depth;
          const sx = halfW + x1 * scale;
          const sy = halfH + y1 * scale;

          const pulse = Math.sin(time * 2 + n.pulsePhase) * 0.3 + 0.7;
          const alpha = Math.min(Math.max((scale * 0.9) * pulse, 0.15), 0.95);
          const radius = Math.max(n.baseRadius * scale * (0.85 + pulse * 0.3), 0.8);

          projected.push({
            sx,
            sy,
            z: z2,
            scale,
            radius,
            color: n.color,
            alpha,
            pulse,
          });
        } else {
          projected.push(null);
        }
      }

      // 3. Draw 3D Connecting Lines
      const MAX_DIST_SQ = 135 * 135;
      ctx.lineWidth = 1;

      for (let i = 0; i < nodes.length; i++) {
        const p1 = projected[i];
        if (!p1) continue;

        for (let j = i + 1; j < nodes.length; j++) {
          const p2 = projected[j];
          if (!p2) continue;

          // 3D Euclidean distance check
          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dz = n1.z - n2.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < MAX_DIST_SQ) {
            const distRatio = 1 - Math.sqrt(distSq) / 135;
            const lineAlpha = distRatio * Math.min(p1.alpha, p2.alpha) * 0.38;

            if (lineAlpha > 0.02) {
              const grad = ctx.createLinearGradient(p1.sx, p1.sy, p2.sx, p2.sy);
              grad.addColorStop(0, `${p1.color}${lineAlpha})`);
              grad.addColorStop(1, `${p2.color}${lineAlpha})`);

              ctx.strokeStyle = grad;
              ctx.beginPath();
              ctx.moveTo(p1.sx, p1.sy);
              ctx.lineTo(p2.sx, p2.sy);
              ctx.stroke();
            }
          }
        }
      }

      // 4. Draw Glowing Nodes
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        if (!p) continue;

        // Outer ambient glow
        const glowGrad = ctx.createRadialGradient(
          p.sx,
          p.sy,
          0,
          p.sx,
          p.sy,
          p.radius * 3.8
        );
        glowGrad.addColorStop(0, `${p.color}${p.alpha * 0.65})`);
        glowGrad.addColorStop(0.5, `${p.color}${p.alpha * 0.2})`);
        glowGrad.addColorStop(1, `${p.color}0)`);

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.radius * 3.8, 0, Math.PI * 2);
        ctx.fill();

        // Inner solid core
        ctx.fillStyle = `${p.color}${Math.min(p.alpha * 1.2, 1)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ opacity: 0.82 }}
      aria-hidden="true"
    />
  );
}

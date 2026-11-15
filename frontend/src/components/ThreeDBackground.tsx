import { useEffect, useRef } from "react";

interface Point3D {
  x: number;
  y: number;
  z: number;
  baseRadius: number;
  color: string;
  glowColor: string;
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
  isBright: boolean;
}

interface ThreeDBackgroundProps {
  variant?: "default" | "dashboard";
}

export default function ThreeDBackground({ variant = "default" }: ThreeDBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const isDashboard = variant === "dashboard";
    let isReducedMotion = localStorage.getItem("scholarai_reduced_motion") === "true";

    function onReducedMotionChange() {
      isReducedMotion = localStorage.getItem("scholarai_reduced_motion") === "true";
    }
    window.addEventListener("scholarai_reduced_motion_changed", onReducedMotionChange);
    window.addEventListener("storage", onReducedMotionChange);

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

    // High-vibrancy neon palette
    const colors = [
      { base: "rgba(168, 85, 247, ", glow: "#A855F7" }, // neon-violet
      { base: "rgba(34, 211, 238, ", glow: "#22D3EE" },  // neon-cyan
      { base: "rgba(244, 114, 182, ", glow: "#F472B6" }, // neon-pink
      { base: "rgba(163, 230, 53, ", glow: "#A3E635" },  // neon-lime
    ];

    // 3D Constellation Nodes
    const NODE_COUNT = isDashboard ? 38 : 62;
    const BOX_X = 750;
    const BOX_Y = 480;
    const BOX_Z = 520;
    const speedMult = isReducedMotion ? 0 : isDashboard ? 0.35 : 0.7;

    const nodes: Point3D[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      const col = colors[i % colors.length];
      nodes.push({
        x: (Math.random() - 0.5) * BOX_X * 2,
        y: (Math.random() - 0.5) * BOX_Y * 2,
        z: (Math.random() - 0.5) * BOX_Z * 2,
        baseRadius: Math.random() * 1.8 + 1.2,
        color: col.base,
        glowColor: col.glow,
        vx: (Math.random() - 0.5) * 0.4 * speedMult,
        vy: (Math.random() - 0.5) * 0.4 * speedMult,
        vz: (Math.random() - 0.5) * 0.4 * speedMult,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }

    // Deep 3D Star Dust & Sparkling Cosmic Stars
    const STAR_COUNT = isDashboard ? 70 : 105;
    const stars: Star3D[] = [];
    for (let i = 0; i < STAR_COUNT; i++) {
      stars.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1100,
        z: Math.random() * 900 - 250,
        size: Math.random() * 1.4 + 0.5,
        alpha: Math.random() * 0.5 + 0.2,
        twinkleSpeed: Math.random() * 0.03 + 0.01,
        isBright: Math.random() < 0.18,
      });
    }

    // Mouse tracking
    let targetRotY = 0;
    let targetRotX = 0;
    let currentRotY = 0;
    let currentRotX = 0;
    let mouseX = width / 2;
    let mouseY = height / 2;
    let smoothMouseX = width / 2;
    let smoothMouseY = height / 2;

    function onPointerMove(e: MouseEvent) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const normX = (mouseX / width - 0.5) * 2;
      const normY = (mouseY / height - 0.5) * 2;
      targetRotY = normX * 0.25;
      targetRotX = -normY * 0.2;
    }

    window.addEventListener("pointermove", onPointerMove);

    let isTabVisible = !document.hidden;
    function onVisibilityChange() {
      isTabVisible = !document.hidden;
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const FOV = 440;
    let time = 0;

    function render() {
      if (!isTabVisible || !ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const motionSpeed = isReducedMotion ? 0.05 : 1;
      time += (isDashboard ? 0.008 : 0.016) * motionSpeed;

      // Smooth camera & mouse interpolation
      currentRotY += (targetRotY - currentRotY) * (isReducedMotion ? 0.01 : 0.04);
      currentRotX += (targetRotX - currentRotX) * (isReducedMotion ? 0.01 : 0.04);
      smoothMouseX += (mouseX - smoothMouseX) * 0.05;
      smoothMouseY += (mouseY - smoothMouseY) * 0.05;

      const autoY = isReducedMotion ? 0 : isDashboard ? time * 0.015 : time * 0.032;
      const totalRotY = currentRotY + autoY;
      const totalRotX = currentRotX;

      const cosY = Math.cos(totalRotY);
      const sinY = Math.sin(totalRotY);
      const cosX = Math.cos(totalRotX);
      const sinX = Math.sin(totalRotX);

      // Deep dark space background
      ctx.fillStyle = "#050508";
      ctx.fillRect(0, 0, width, height);

      // 1. Subtle Deep Space Ambient Nebulae (Atmospheric without washing out text)
      const halfW = width / 2;
      const halfH = height / 2;
      const nebAlphaMult = isDashboard ? 0.4 : 0.75;

      // Violet Nebula (Upper Left, drifting)
      const vX = width * 0.22 + Math.sin(time * 0.3) * 50;
      const vY = height * 0.28 + Math.cos(time * 0.25) * 40;
      const vGrad = ctx.createRadialGradient(vX, vY, 10, vX, vY, 450);
      vGrad.addColorStop(0, `rgba(168, 85, 247, ${0.09 * nebAlphaMult})`);
      vGrad.addColorStop(0.5, `rgba(126, 34, 206, ${0.04 * nebAlphaMult})`);
      vGrad.addColorStop(1, "rgba(5, 5, 8, 0)");
      ctx.fillStyle = vGrad;
      ctx.fillRect(0, 0, width, height);

      // Cyan Nebula (Upper Right, drifting)
      const cX = width * 0.78 - Math.cos(time * 0.28) * 50;
      const cY = height * 0.32 + Math.sin(time * 0.3) * 35;
      const cGrad = ctx.createRadialGradient(cX, cY, 10, cX, cY, 480);
      cGrad.addColorStop(0, `rgba(34, 211, 238, ${0.08 * nebAlphaMult})`);
      cGrad.addColorStop(0.5, `rgba(14, 116, 144, ${0.03 * nebAlphaMult})`);
      cGrad.addColorStop(1, "rgba(5, 5, 8, 0)");
      ctx.fillStyle = cGrad;
      ctx.fillRect(0, 0, width, height);

      // Magenta / Pink Nebula (Bottom Center)
      const pX = halfW + Math.sin(time * 0.35) * 70;
      const pY = height * 0.82 + Math.cos(time * 0.3) * 30;
      const pGrad = ctx.createRadialGradient(pX, pY, 10, pX, pY, 520);
      pGrad.addColorStop(0, `rgba(244, 114, 182, ${0.06 * nebAlphaMult})`);
      pGrad.addColorStop(0.5, `rgba(190, 24, 93, ${0.02 * nebAlphaMult})`);
      pGrad.addColorStop(1, "rgba(5, 5, 8, 0)");
      ctx.fillStyle = pGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle Interactive Cursor Ambient Spotlight
      const mGrad = ctx.createRadialGradient(smoothMouseX, smoothMouseY, 0, smoothMouseX, smoothMouseY, 260);
      mGrad.addColorStop(0, `rgba(34, 211, 238, ${0.05 * nebAlphaMult})`);
      mGrad.addColorStop(0.5, `rgba(168, 85, 247, ${0.02 * nebAlphaMult})`);
      mGrad.addColorStop(1, "rgba(5, 5, 8, 0)");
      ctx.fillStyle = mGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Render 3D Stars & Sparkling Flares
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.z -= 0.18 * motionSpeed;
        if (s.z < -250) s.z += 900;

        const x1 = s.x * cosY - s.z * sinY;
        const z1 = s.x * sinY + s.z * cosY;
        const y1 = s.y * cosX - z1 * sinX;
        const z2 = s.y * sinX + z1 * cosX;

        const depth = z2 + 380;
        if (depth > 20) {
          const scale = FOV / depth;
          const sx = halfW + x1 * scale;
          const sy = halfH + y1 * scale;

          if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
            const twinkle = (Math.sin(time * 2.5 + i * 1.3) + 1) * 0.5;
            const starAlpha = Math.min(Math.max(s.alpha * twinkle * (scale * 0.9), 0.08), 0.95);
            const r = Math.max(s.size * scale, 0.7);

            ctx.fillStyle = `rgba(255, 255, 255, ${starAlpha})`;
            ctx.beginPath();
            ctx.arc(sx, sy, r, 0, Math.PI * 2);
            ctx.fill();

            // Diamond starburst flare for brighter stars
            if (s.isBright && starAlpha > 0.45) {
              const flareLen = r * 4.5;
              ctx.strokeStyle = `rgba(220, 240, 255, ${starAlpha * 0.55})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(sx - flareLen, sy);
              ctx.lineTo(sx + flareLen, sy);
              ctx.moveTo(sx, sy - flareLen);
              ctx.lineTo(sx, sy + flareLen);
              ctx.stroke();
            }
          }
        }
      }

      // 3. Project 3D Constellation Nodes
      interface ProjectedNode {
        sx: number;
        sy: number;
        z: number;
        scale: number;
        radius: number;
        color: string;
        glowColor: string;
        alpha: number;
        pulse: number;
      }

      const projected: (ProjectedNode | null)[] = [];

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx * motionSpeed;
        n.y += n.vy * motionSpeed;
        n.z += n.vz * motionSpeed;

        if (n.x < -BOX_X || n.x > BOX_X) n.vx *= -1;
        if (n.y < -BOX_Y || n.y > BOX_Y) n.vy *= -1;
        if (n.z < -BOX_Z || n.z > BOX_Z) n.vz *= -1;

        const x1 = n.x * cosY - n.z * sinY;
        const z1 = n.x * sinY + n.z * cosY;
        const y1 = n.y * cosX - z1 * sinX;
        const z2 = n.y * sinX + z1 * cosX;

        const depth = z2 + 420;

        if (depth > 20) {
          const scale = FOV / depth;
          const sx = halfW + x1 * scale;
          const sy = halfH + y1 * scale;

          const pulse = Math.sin(time * 2.2 + n.pulsePhase) * 0.35 + 0.65;
          const alpha = Math.min(Math.max((scale * 1.1) * pulse, 0.25), 1);
          const radius = Math.max(n.baseRadius * scale * (0.9 + pulse * 0.35), 1.2);

          projected.push({
            sx,
            sy,
            z: z2,
            scale,
            radius,
            color: n.color,
            glowColor: n.glowColor,
            alpha,
            pulse,
          });
        } else {
          projected.push(null);
        }
      }

      // 4. Draw Glowing 3D Connecting Laser Edges
      const MAX_DIST_SQ = 145 * 145;
      ctx.lineWidth = 1.2;

      for (let i = 0; i < nodes.length; i++) {
        const p1 = projected[i];
        if (!p1) continue;

        for (let j = i + 1; j < nodes.length; j++) {
          const p2 = projected[j];
          if (!p2) continue;

          const n1 = nodes[i];
          const n2 = nodes[j];
          const dx = n1.x - n2.x;
          const dy = n1.y - n2.y;
          const dz = n1.z - n2.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq < MAX_DIST_SQ) {
            const distRatio = 1 - Math.sqrt(distSq) / 145;
            const lineAlpha = distRatio * Math.min(p1.alpha, p2.alpha) * (isDashboard ? 0.14 : 0.22);

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

      // 5. Draw Glowing Constellation Orbs (Vibrant & Radiant)
      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        if (!p) continue;

        // Outer radiant bloom
        const glowGrad = ctx.createRadialGradient(
          p.sx,
          p.sy,
          0,
          p.sx,
          p.sy,
          p.radius * 3.5
        );
        glowGrad.addColorStop(0, `${p.color}${p.alpha * (isDashboard ? 0.4 : 0.65)})`);
        glowGrad.addColorStop(0.4, `${p.color}${p.alpha * 0.2})`);
        glowGrad.addColorStop(1, `${p.color}0)`);

        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.radius * 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Inner glowing core
        ctx.fillStyle = `${p.color}${Math.min(p.alpha * (isDashboard ? 0.8 : 1.1), 1)})`;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.radius * 0.95, 0, Math.PI * 2);
        ctx.fill();

        // Brilliant white spark at center
        if (p.alpha > 0.6 && !isDashboard) {
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, p.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    }

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("scholarai_reduced_motion_changed", onReducedMotionChange);
      window.removeEventListener("storage", onReducedMotionChange);
    };
  }, [variant]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ opacity: variant === "dashboard" ? 0.22 : 0.38 }}
      aria-hidden="true"
    />
  );
}

import React, { useRef, useState, useEffect, useCallback } from "react";

interface TiltCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxTilt?: number;
  glowColor?: "violet" | "cyan" | "pink" | "lime" | "amber" | "white";
  className?: string;
  enableTilt?: boolean;
}

const GLOW_COLORS = {
  violet: "rgba(168, 85, 247, 0.15)",
  cyan: "rgba(34, 211, 238, 0.15)",
  pink: "rgba(244, 114, 182, 0.15)",
  lime: "rgba(163, 230, 53, 0.15)",
  amber: "rgba(245, 158, 11, 0.16)",
  white: "rgba(255, 255, 255, 0.08)",
};

export const TiltCard: React.FC<TiltCardProps> = ({
  children,
  maxTilt = 4,
  glowColor = "cyan",
  className = "",
  enableTilt = true,
  ...props
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const [mousePos, setMousePos] = useState({ x: 50, y: 50, active: false });
  const [transformStyle, setTransformStyle] = useState<string>("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(motionMedia.matches);

    // Detect touch-only / coarse pointer devices (smartphones, tablets)
    const touchMedia = window.matchMedia("(pointer: coarse), (hover: none)");
    setIsTouchDevice(touchMedia.matches);

    const motionListener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    const touchListener = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches);

    motionMedia.addEventListener("change", motionListener);
    touchMedia.addEventListener("change", touchListener);

    return () => {
      motionMedia.removeEventListener("change", motionListener);
      touchMedia.removeEventListener("change", touchListener);
    };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Never compute tilt on touch screens or if reduced motion is requested
      if (prefersReducedMotion || isTouchDevice || !enableTilt || !cardRef.current) return;

      const rect = cardRef.current.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const xPercent = (clientX / rect.width) * 100;
      const yPercent = (clientY / rect.height) * 100;

      // Calculate tilt angles (subtle and physics-calibrated)
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((clientY - centerY) / centerY) * -maxTilt;
      const rotateY = ((clientX - centerX) / centerX) * maxTilt;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        setMousePos({ x: xPercent, y: yPercent, active: true });
        setTransformStyle(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`);
      });
    },
    [maxTilt, enableTilt, prefersReducedMotion, isTouchDevice]
  );

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setMousePos((prev) => ({ ...prev, active: false }));
    setTransformStyle("perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const glowStyle = mousePos.active && !prefersReducedMotion
    ? {
        background: `radial-gradient(400px circle at ${mousePos.x}% ${mousePos.y}%, ${GLOW_COLORS[glowColor]}, transparent 70%)`,
      }
    : { opacity: 0 };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: prefersReducedMotion ? undefined : transformStyle,
        transition: mousePos.active ? "transform 0.08s ease-out" : "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)",
        willChange: mousePos.active ? "transform" : "auto",
      }}
      className={`relative overflow-hidden rounded-2xl glass-modern border border-white/[0.08] shadow-lg shadow-black/40 ${className}`}
      {...props}
    >
      {/* Dynamic Cursor Spotlight Layer */}
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300 ease-out"
        style={glowStyle}
      />

      {/* Content Layer */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};

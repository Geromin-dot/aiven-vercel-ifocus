"use client";

import { useEffect, useRef } from "react";

export default function BackgroundBlobs() {
  const canvasRef = useRef(null);
  const cursorBlobRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouse = { x: -1000, y: -1000, lastX: -1000, lastY: -1000, speed: 0 };
    let cursorGlow = { x: width / 2, y: height / 2 };
    let animationFrameId;

    // Palette: Pure, lush watercolor & botanical ambient pigment tones
    const colorPigments = [
      { r: 65, g: 145, b: 85, alpha: 0.55 },   // Lush Emerald Sage
      { r: 228, g: 162, b: 52, alpha: 0.50 },  // Warm Amber Glow
      { r: 38, g: 168, b: 142, alpha: 0.48 },  // Coastal Teal
      { r: 92, g: 155, b: 96, alpha: 0.45 },   // Botanical Forest
      { r: 232, g: 125, b: 82, alpha: 0.42 },  // Apricot Coral
      { r: 48, g: 135, b: 105, alpha: 0.52 },  // Deep Pine Jade
      { r: 215, g: 180, b: 80, alpha: 0.44 },  // Golden Ochre
    ];

    // Responsive Color Cloud Pools (No hard shapes, pure ambient liquid colors)
    const poolCount = Math.max(12, Math.floor((width * height) / 60000));
    const colorPools = [];

    for (let i = 0; i < poolCount; i++) {
      const homeX = (Math.random() * 0.9 + 0.05) * width;
      const homeY = (Math.random() * 0.9 + 0.05) * height;
      const radius = 130 + Math.random() * 160; // Large soft color radius
      const pigment = colorPigments[i % colorPigments.length];

      colorPools.push({
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        radius,
        baseRadius: radius,
        pigment,
        seed: Math.random() * 200,
        mass: 1.0 + (radius / 150) * 0.8,
        driftSpeed: 0.3 + Math.random() * 0.5
      });
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      colorPools.forEach((p) => {
        p.homeX = (Math.random() * 0.9 + 0.05) * width;
        p.homeY = (Math.random() * 0.9 + 0.05) * height;
      });
    };

    const handleMouseMove = (e) => {
      const dx = e.clientX - mouse.x;
      const dy = e.clientY - mouse.y;
      mouse.speed = Math.hypot(dx, dy);
      mouse.lastX = mouse.x;
      mouse.lastY = mouse.y;
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    let time = 0;

    const render = () => {
      time += 0.012;
      ctx.clearRect(0, 0, width, height);

      // Smooth Cursor Glow Interpolation
      if (mouse.x > 0 && mouse.y > 0) {
        cursorGlow.x += (mouse.x - cursorGlow.x) * 0.09;
        cursorGlow.y += (mouse.y - cursorGlow.y) * 0.09;
      }

      if (cursorBlobRef.current) {
        cursorBlobRef.current.style.transform = `translate3d(${cursorGlow.x}px, ${cursorGlow.y}px, 0) translate(-50%, -50%)`;
      }

      // Physics: Fluid Color Push-Off & Elastic Relaxation
      const repelRadius = 260;

      colorPools.forEach((pool) => {
        // Distance from cursor to color pool center
        const dx = pool.x - mouse.x;
        const dy = pool.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        // Fluid Push-Off Force: pushes color clouds away dynamically
        if (dist < repelRadius && dist > 1) {
          const proximity = Math.pow(1 - dist / repelRadius, 1.4);
          const pushForce = proximity * (18 + Math.min(mouse.speed * 0.45, 24)) / pool.mass;
          const angle = Math.atan2(dy, dx);

          pool.vx += Math.cos(angle) * pushForce;
          pool.vy += Math.sin(angle) * pushForce;
        }

        // Hooke's Elastic Spring Law returning color gently back to home
        const springDx = pool.homeX - pool.x;
        const springDy = pool.homeY - pool.y;
        pool.vx += springDx * 0.018;
        pool.vy += springDy * 0.018;

        // Ambient Organic Floating Drift
        pool.vx += Math.sin(time * pool.driftSpeed + pool.seed) * 0.15;
        pool.vy += Math.cos(time * pool.driftSpeed * 0.8 + pool.seed) * 0.15;

        // Fluid Viscous Damping
        pool.vx *= 0.91;
        pool.vy *= 0.91;

        pool.x += pool.vx;
        pool.y += pool.vy;

        // Fluid deformation stretch based on push velocity
        const speed = Math.hypot(pool.vx, pool.vy);
        const stretchAngle = Math.atan2(pool.vy, pool.vx);
        const stretchFactor = 1 + Math.min(speed * 0.025, 0.4);

        // Render Pure Ambient Color Pool via Multi-Stop Radial Gradient
        ctx.save();
        ctx.translate(pool.x, pool.y);
        ctx.rotate(stretchAngle);
        ctx.scale(stretchFactor, 1 / stretchFactor);

        const rad = pool.radius;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, rad);
        const { r, g, b, alpha } = pool.pigment;

        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        grad.addColorStop(0.35, `rgba(${r}, ${g}, ${b}, ${alpha * 0.7})`);
        grad.addColorStop(0.70, `rgba(${r}, ${g}, ${b}, ${alpha * 0.25})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, rad, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("mouseleave", handleMouseLeave);

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="background-blobs">
      {/* Interactive Liquid Color Canvas with Soft Fluid Blur */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 0,
          filter: "blur(42px)",
          WebkitFilter: "blur(42px)",
          mixBlendMode: "multiply"
        }}
      />
      {/* Richer Luminous Interactive Cursor Spotlight Glow */}
      <div className="blob blob-cursor" ref={cursorBlobRef}></div>
    </div>
  );
}

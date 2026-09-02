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

    // Palette: Richer, more vibrant botanical and watercolor paint colors
    const colorPalette = [
      { fill: "rgba(78, 145, 90, 0.42)", stroke: "rgba(78, 145, 90, 0.65)" },   // Sage emerald
      { fill: "rgba(45, 175, 145, 0.38)", stroke: "rgba(45, 175, 145, 0.60)" }, // Mint teal
      { fill: "rgba(225, 165, 65, 0.38)", stroke: "rgba(225, 165, 65, 0.60)" }, // Amber gold
      { fill: "rgba(95, 145, 95, 0.35)", stroke: "rgba(95, 145, 95, 0.55)" },   // Forest green
      { fill: "rgba(230, 130, 90, 0.32)", stroke: "rgba(230, 130, 90, 0.52)" }, // Coral bloom
      { fill: "rgba(90, 110, 140, 0.30)", stroke: "rgba(90, 110, 140, 0.50)" }, // Slate indigo
      { fill: "rgba(30, 180, 120, 0.36)", stroke: "rgba(30, 180, 120, 0.58)" }, // Lush mint
    ];

    const shapeTypes = ["circle", "squircle", "pill", "ring", "blob", "triangle"];

    // Generate responsive interactive shapes
    const shapeCount = Math.max(20, Math.floor((width * height) / 42000));
    const shapes = [];

    for (let i = 0; i < shapeCount; i++) {
      const homeX = Math.random() * width;
      const homeY = Math.random() * height;
      const size = 38 + Math.random() * 65;
      const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
      const type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];

      shapes.push({
        homeX,
        homeY,
        x: homeX,
        y: homeY,
        vx: 0,
        vy: 0,
        size,
        baseSize: size,
        color,
        type,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.012,
        seed: Math.random() * 100,
        mass: 0.9 + (size / 55) * 0.7
      });
    }

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      shapes.forEach((s) => {
        s.homeX = Math.random() * width;
        s.homeY = Math.random() * height;
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
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      // Smooth Cursor Glow Interpolation
      if (mouse.x > 0 && mouse.y > 0) {
        cursorGlow.x += (mouse.x - cursorGlow.x) * 0.09;
        cursorGlow.y += (mouse.y - cursorGlow.y) * 0.09;
      }

      if (cursorBlobRef.current) {
        cursorBlobRef.current.style.transform = `translate3d(${cursorGlow.x}px, ${cursorGlow.y}px, 0) translate(-50%, -50%)`;
      }

      // Physics: Mouse Push & Elastic Spring Return to Home
      const repelRadius = 210;

      shapes.forEach((s) => {
        // Distance to cursor
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        // Repulsive force when mouse pushes against paint shape
        if (dist < repelRadius && dist > 1) {
          const proximityFactor = Math.pow(1 - dist / repelRadius, 1.5);
          const pushForce = proximityFactor * (16 + Math.min(mouse.speed * 0.4, 20)) / s.mass;
          const angle = Math.atan2(dy, dx);

          s.vx += Math.cos(angle) * pushForce;
          s.vy += Math.sin(angle) * pushForce;
          s.rotation += (Math.cos(angle) * 0.04) / s.mass;
        }

        // Spring Law smoothly returning shape back to its original home position
        const springDx = s.homeX - s.x;
        const springDy = s.homeY - s.y;
        s.vx += springDx * 0.024;
        s.vy += springDy * 0.024;

        // Subtle ambient organic breathing float
        s.vx += Math.sin(time + s.seed) * 0.1;
        s.vy += Math.cos(time + s.seed * 0.8) * 0.1;

        // Velocity friction damping for smooth settlement
        s.vx *= 0.90;
        s.vy *= 0.90;

        s.x += s.vx;
        s.y += s.vy;
        s.rotation += s.vRot;

        // Draw Shape on Canvas
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation);

        // Fluid squash & stretch
        const speed = Math.hypot(s.vx, s.vy);
        const stretch = 1 + Math.min(speed * 0.02, 0.35);
        const squash = 1 / stretch;
        ctx.scale(stretch, squash);

        ctx.fillStyle = s.color.fill;
        ctx.strokeStyle = s.color.stroke;
        ctx.lineWidth = 2.5;

        const r = s.size / 2;

        if (s.type === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (s.type === "ring") {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
          ctx.lineWidth = 5;
          ctx.strokeStyle = s.color.stroke;
          ctx.stroke();
        } else if (s.type === "pill") {
          ctx.beginPath();
          const pW = s.size * 1.35;
          const pH = s.size * 0.6;
          ctx.roundRect(-pW / 2, -pH / 2, pW, pH, pH / 2);
          ctx.fill();
          ctx.stroke();
        } else if (s.type === "squircle") {
          ctx.beginPath();
          const sqSize = s.size * 0.9;
          ctx.roundRect(-sqSize / 2, -sqSize / 2, sqSize, sqSize, 18);
          ctx.fill();
          ctx.stroke();
        } else if (s.type === "triangle") {
          ctx.beginPath();
          const tr = s.size * 0.65;
          ctx.moveTo(0, -tr);
          ctx.lineTo(tr * 0.866, tr * 0.5);
          ctx.lineTo(-tr * 0.866, tr * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Organic 5-point morphing blob
          ctx.beginPath();
          const points = 5;
          for (let p = 0; p < points; p++) {
            const a = (p / points) * Math.PI * 2;
            const variance = Math.sin(time * 2 + s.seed + p) * 5;
            const rad = r + variance;
            const px = Math.cos(a) * rad;
            const py = Math.sin(a) * rad;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

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
      {/* Interactive Physics Canvas with Dreamy Frosted Blur Filter */}
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
          filter: "blur(14px)", // Dreamy blur while preserving clear shape silhouettes
          WebkitFilter: "blur(14px)"
        }}
      />
      {/* Richer Luminous Interactive Cursor Spotlight Glow */}
      <div className="blob blob-cursor" ref={cursorBlobRef}></div>
    </div>
  );
}

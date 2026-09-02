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

    // Palette: Clean, elegant botanical & ambient paint colors
    const colorPalette = [
      { fill: "rgba(78, 130, 83, 0.28)", stroke: "rgba(78, 130, 83, 0.45)" }, // Sage green
      { fill: "rgba(56, 178, 147, 0.25)", stroke: "rgba(56, 178, 147, 0.40)" }, // Mint teal
      { fill: "rgba(230, 175, 80, 0.25)", stroke: "rgba(230, 175, 80, 0.40)" }, // Warm amber
      { fill: "rgba(95, 143, 94, 0.22)", stroke: "rgba(95, 143, 94, 0.38)" },  // Forest pastel
      { fill: "rgba(235, 140, 100, 0.20)", stroke: "rgba(235, 140, 100, 0.35)" }, // Soft coral
      { fill: "rgba(100, 116, 139, 0.18)", stroke: "rgba(100, 116, 139, 0.30)" }, // Slate blue
      { fill: "rgba(16, 185, 129, 0.22)", stroke: "rgba(16, 185, 129, 0.38)" }, // Emerald
    ];

    const shapeTypes = ["circle", "squircle", "pill", "ring", "blob", "triangle"];

    // Generate responsive interactive shapes
    const shapeCount = Math.max(18, Math.floor((width * height) / 45000));
    const shapes = [];

    for (let i = 0; i < shapeCount; i++) {
      const homeX = Math.random() * width;
      const homeY = Math.random() * height;
      const size = 28 + Math.random() * 55;
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
        vRot: (Math.random() - 0.5) * 0.015,
        seed: Math.random() * 100,
        mass: 0.8 + (size / 50) * 0.8
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
        cursorGlow.x += (mouse.x - cursorGlow.x) * 0.085;
        cursorGlow.y += (mouse.y - cursorGlow.y) * 0.085;
      }

      if (cursorBlobRef.current) {
        cursorBlobRef.current.style.transform = `translate3d(${cursorGlow.x}px, ${cursorGlow.y}px, 0) translate(-50%, -50%)`;
      }

      // Physics: Mouse Push & Spring Return
      const repelRadius = 190;

      shapes.forEach((s) => {
        // Distance to cursor
        const dx = s.x - mouse.x;
        const dy = s.y - mouse.y;
        const dist = Math.hypot(dx, dy);

        // Repulsive force when mouse pushes against paint shape
        if (dist < repelRadius && dist > 1) {
          const proximityFactor = Math.pow(1 - dist / repelRadius, 1.6);
          const pushForce = proximityFactor * (14 + Math.min(mouse.speed * 0.35, 18)) / s.mass;
          const angle = Math.atan2(dy, dx);

          s.vx += Math.cos(angle) * pushForce;
          s.vy += Math.sin(angle) * pushForce;
          s.rotation += (Math.cos(angle) * 0.04) / s.mass;
        }

        // Hooke's Spring Law back to Home Position
        const springDx = s.homeX - s.x;
        const springDy = s.homeY - s.y;
        s.vx += springDx * 0.028;
        s.vy += springDy * 0.028;

        // Ambient Organic Floating Drift
        s.vx += Math.sin(time + s.seed) * 0.12;
        s.vy += Math.cos(time + s.seed * 0.8) * 0.12;

        // Friction Damping
        s.vx *= 0.89;
        s.vy *= 0.89;

        s.x += s.vx;
        s.y += s.vy;
        s.rotation += s.vRot;

        // Draw Shape on Canvas
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rotation);

        // Dynamic fluid squash & stretch according to velocity
        const speed = Math.hypot(s.vx, s.vy);
        const stretch = 1 + Math.min(speed * 0.02, 0.35);
        const squash = 1 / stretch;
        ctx.scale(stretch, squash);

        ctx.fillStyle = s.color.fill;
        ctx.strokeStyle = s.color.stroke;
        ctx.lineWidth = 1.5;

        const r = s.size / 2;

        if (s.type === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else if (s.type === "ring") {
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
          ctx.lineWidth = 3;
          ctx.strokeStyle = s.color.stroke;
          ctx.stroke();
        } else if (s.type === "pill") {
          ctx.beginPath();
          const pW = s.size * 1.3;
          const pH = s.size * 0.55;
          ctx.roundRect(-pW / 2, -pH / 2, pW, pH, pH / 2);
          ctx.fill();
          ctx.stroke();
        } else if (s.type === "squircle") {
          ctx.beginPath();
          const sqSize = s.size * 0.85;
          ctx.roundRect(-sqSize / 2, -sqSize / 2, sqSize, sqSize, 14);
          ctx.fill();
          ctx.stroke();
        } else if (s.type === "triangle") {
          ctx.beginPath();
          const tr = s.size * 0.6;
          ctx.moveTo(0, -tr);
          ctx.lineTo(tr * 0.866, tr * 0.5);
          ctx.lineTo(-tr * 0.866, tr * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          // Organic paint blob with 5 bezier control points
          ctx.beginPath();
          const points = 5;
          for (let p = 0; p < points; p++) {
            const a = (p / points) * Math.PI * 2;
            const variance = Math.sin(time * 2 + s.seed + p) * 4;
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
      {/* Interactive Physics Canvas for Pushable Paint Shapes */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          pointerEvents: "none",
          zIndex: 0
        }}
      />
      {/* Luminous Interactive Cursor Spotlight Glow */}
      <div className="blob blob-cursor" ref={cursorBlobRef}></div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

export default function BackgroundBlobs() {
  const cursorBlobRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    let mouseX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
    let mouseY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0;
    let currentX = mouseX;
    let currentY = mouseY;
    let animationFrameId;

    const handleMouseMove = (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      if (containerRef.current) {
        const normX = (e.clientX / window.innerWidth - 0.5) * 2;
        const normY = (e.clientY / window.innerHeight - 0.5) * 2;
        containerRef.current.style.setProperty("--cursor-px", `${normX}`);
        containerRef.current.style.setProperty("--cursor-py", `${normY}`);
      }
    };

    const animate = () => {
      currentX += (mouseX - currentX) * 0.075;
      currentY += (mouseY - currentY) * 0.075;

      if (cursorBlobRef.current) {
        cursorBlobRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    animate();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="background-blobs" ref={containerRef}>
      <div className="blob blob-1"></div>
      <div className="blob blob-2"></div>
      <div className="blob blob-3"></div>
      <div className="blob blob-4"></div>
      <div className="blob blob-5"></div>
      {/* Interactive Cursor Spotlight Glow */}
      <div className="blob blob-cursor" ref={cursorBlobRef}></div>
    </div>
  );
}

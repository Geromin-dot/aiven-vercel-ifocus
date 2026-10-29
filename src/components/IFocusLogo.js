"use client";

import React from "react";

/**
 * iFocus Official Logo Component
 * Uses the official crisp vector SVG (/logo.svg).
 * Avoids browser SVE defs/gradient collision issues across multiple instances.
 */
export default function IFocusLogo({ 
  size = 34, 
  className = '', 
  style = {},
  variant = 'svg'
}) {
  const isBadge = variant === 'badge' || variant === 'app';

  if (isBadge) {
    return (
      <div
        className={className}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: `${Math.round(size * 0.24)}px`,
          background: 'linear-gradient(145deg, #1f4525 0%, #132f17 100%)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px -4px rgba(31, 69, 37, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
          border: '1px solid rgba(74, 222, 128, 0.2)',
          flexShrink: 0,
          ...style
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt="iFocus Logo"
          width={Math.round(size * 0.72)}
          height={Math.round(size * 0.72)}
          style={{ display: 'block', objectFit: 'contain' }}
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img 
      src="/logo.svg" 
      alt="iFocus Logo" 
      width={size} 
      height={size} 
      className={className}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        objectFit: 'contain',
        ...style
      }}
    />
  );
}

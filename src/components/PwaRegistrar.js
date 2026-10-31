"use client";

import { useEffect, useState } from "react";
import IFocusLogo from "./IFocusLogo";

export default function PwaRegistrar() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker quietly in background
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const register = () => {
        navigator.serviceWorker
          .register("/sw.js", { updateViaCache: 'none' })
          .then((reg) => {
            console.log("PWA Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration failed:", err);
          });
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    if (typeof window === "undefined") return;

    // 2. Check if already running in standalone mode (installed app)
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalone(isInStandaloneMode);
    if (isInStandaloneMode) return;

    // 3. Strictly verify if client is a MOBILE device (phone/tablet)
    // Desktop computers & laptops must NEVER see this install banner
    const ua = (window.navigator.userAgent || "").toLowerCase();
    const isTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
    const isMobileUa = /android|iphone|ipad|ipod|mobile/i.test(ua);
    const isSmallScreen = window.innerWidth <= 768;
    const isMobileDevice = isMobileUa || (isSmallScreen && isTouch);

    setIsMobile(isMobileDevice);

    // If it's a computer/desktop, completely halt banner logic
    if (!isMobileDevice) {
      return;
    }

    // Check if user previously dismissed banner
    try {
      const dismissedAt = localStorage.getItem("ifocus_pwa_dismissed");
      if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    } catch (e) {}

    // 4. Detect iOS device
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 5. Capture Android/Chromium beforeinstallprompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem("ifocus_pwa_dismissed", Date.now().toString());
    } catch (e) {}
  };

  if (!showInstallBanner || isStandalone || !isMobile) return null;

  return (
    <div
      className="pwa-mobile-only-banner"
      style={{
        position: "fixed",
        bottom: "calc(78px + env(safe-area-inset-bottom))",
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "420px",
        background: "rgba(255, 255, 255, 0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(0, 0, 0, 0.08)",
        borderRadius: "20px",
        padding: "14px 16px",
        boxShadow: "0 14px 36px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04)",
        zIndex: 99990,
        color: "#1e293b",
        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        {/* App Icon */}
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(39, 82, 45, 0.25)"
          }}
        >
          <IFocusLogo size={42} variant="app" />
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h4 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: "#1e293b" }}>
              Install iFocus
            </h4>
            <button
              onClick={handleDismiss}
              style={{
                background: "rgba(0, 0, 0, 0.05)",
                border: "none",
                borderRadius: "50%",
                width: "24px",
                height: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#64748b",
                cursor: "pointer",
                padding: 0,
                fontSize: "0.85rem",
                lineHeight: 1
              }}
              title="Close"
            >
              x
            </button>
          </div>

          <p style={{ margin: "4px 0 8px", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.4 }}>
            {isIos ? (
              <>
                Add to your iPhone Home Screen: Tap <span style={{ color: "#27522d", fontWeight: 600 }}>Share</span> below, then select <span style={{ color: "#27522d", fontWeight: 600 }}>&ldquo;Add to Home Screen&rdquo;</span>.
              </>
            ) : (
              "Install as an app on your phone for quick full-screen access without opening a browser."
            )}
          </p>

          {!isIos && deferredPrompt && (
            <button
              onClick={handleInstallClick}
              style={{
                width: "100%",
                padding: "8px 16px",
                background: "#27522d",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
            >
              Install on Device
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

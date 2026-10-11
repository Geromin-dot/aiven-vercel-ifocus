"use client";

import { useEffect, useState } from "react";

export default function PwaRegistrar() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA Service Worker registered with scope:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA Service Worker registration failed:", err);
          });
      });
    }

    // 2. Check if already running in standalone mode (installed)
    const isInStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    setIsStandalone(isInStandaloneMode);

    if (isInStandaloneMode) {
      return; // Already running as PWA installed app!
    }

    // Check if user previously dismissed banner
    const dismissedAt = localStorage.getItem("ifocus_pwa_dismissed");
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    // 3. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    if (isIosDevice) {
      // Delay prompt slightly for better user onboarding
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // 4. Capture Android/Chromium beforeinstallprompt
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

  if (!showInstallBanner || isStandalone) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "80px", // Just above mobile bottom nav or bottom of screen
        left: "50%",
        transform: "translateX(-50%)",
        width: "calc(100% - 32px)",
        maxWidth: "420px",
        background: "rgba(24, 35, 26, 0.96)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(95, 143, 94, 0.35)",
        borderRadius: "20px",
        padding: "16px 18px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        zIndex: 99990,
        color: "#ffffff",
        animation: "slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
        {/* App Icon */}
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #72b270, #5f8f5e)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 4px 12px rgba(95, 143, 94, 0.3)"
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" fill="#ffffff" />
          </svg>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#ffffff" }}>
              Install iFocus
            </h4>
            <button
              onClick={handleDismiss}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255, 255, 255, 0.5)",
                cursor: "pointer",
                padding: "2px",
                fontSize: "1.1rem",
                lineHeight: 1
              }}
              title="Close"
            >
              x
            </button>
          </div>

          <p style={{ margin: "4px 0 10px", fontSize: "0.8rem", color: "rgba(255, 255, 255, 0.75)", lineHeight: 1.4 }}>
            {isIos ? (
              <>
                Add to your iPhone Home Screen: Tap <span style={{ color: "#72b270", fontWeight: 600 }}>Share</span> below, then select <span style={{ color: "#72b270", fontWeight: 600 }}>&ldquo;Add to Home Screen&rdquo;</span>.
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
                background: "var(--primary-accent, #5f8f5e)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                fontSize: "0.85rem",
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

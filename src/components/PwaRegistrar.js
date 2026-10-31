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
    const register = () => navigator.serviceWorker?.register('/sw.js', { updateViaCache: 'none' }).catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const standalone = () => displayMode.matches || navigator.standalone === true;
    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const mobile = ios || /android|mobile/.test(ua);
    const initialFrame = requestAnimationFrame(() => { setIsMobile(mobile); setIsIos(ios); setIsStandalone(standalone()); });
    const dismissed = () => { try { return Date.now() - Number(localStorage.getItem('ifocus_pwa_dismissed')) < 7 * 86400000; } catch { return false; } };
    const updateMode = () => { setIsStandalone(standalone()); if (standalone()) { setShowInstallBanner(false); setDeferredPrompt(null); } };
    const beforeInstall = event => {
      if (!mobile) return;
      event.preventDefault();
      if (standalone()) return;
      setDeferredPrompt(event);
      if (!dismissed()) setShowInstallBanner(true);
    };
    const installed = () => {
      setShowInstallBanner(false); setDeferredPrompt(null);
      try { localStorage.removeItem('ifocus_pwa_dismissed'); } catch {}
    };
    const requestHelp = () => {
      if (!mobile || standalone()) return;
      try { localStorage.removeItem('ifocus_pwa_dismissed'); } catch {}
      setShowInstallBanner(true);
    };
    const timer = ios && !standalone() && !dismissed() ? setTimeout(() => setShowInstallBanner(true), 3000) : null;
    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    window.addEventListener('ifocus_request_install', requestHelp);
    window.addEventListener('pageshow', updateMode);
    displayMode.addEventListener('change', updateMode);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(initialFrame);
      window.removeEventListener('load', register);
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      window.removeEventListener('ifocus_request_install', requestHelp);
      window.removeEventListener('pageshow', updateMode);
      displayMode.removeEventListener('change', updateMode);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
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
              deferredPrompt ? "Install iFocus for quick access from your Home Screen." : "In Chrome, open the browser menu and choose Install app or Add to Home screen. If you opened this link in Messenger, open it in Chrome first."
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

export function PwaInstallControl() {
  const [mode, setMode] = useState(null);
  useEffect(() => {
    const media = matchMedia('(display-mode: standalone)');
    const update = () => setMode(media.matches || navigator.standalone === true ? 'installed' : /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent) ? 'browser' : null);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  if (!mode) return null;
  return <button type="button" className="btn-secondary" disabled={mode === 'installed'} onClick={() => dispatchEvent(new CustomEvent('ifocus_request_install'))}>{mode === 'installed' ? 'Opened as installed app' : 'Install iFocus / Installation help'}</button>;
}

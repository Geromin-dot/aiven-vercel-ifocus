"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import IFocusLogo from "@/components/IFocusLogo";

export default function ConcurrentSessionGuard() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictReason, setConflictReason] = useState("");
  const isCheckingRef = useRef(false);

  // Exempt public pages where authentication guard is not needed
  const isExemptRoute = pathname === "/" || pathname === "/login" || pathname === "/manifest.json";

  const triggerLogoutModal = useCallback((reason = "CONCURRENT_LOGIN") => {
    setHasConflict(true);
    setConflictReason(reason);

    // Stop all audio, timers, and active study processes on this device
    try {
      window.dispatchEvent(new CustomEvent("ifocus_emergency_stop"));
      const currentTimer = localStorage.getItem("ifocus_timer_state");
      if (currentTimer) {
        const parsed = JSON.parse(currentTimer);
        localStorage.setItem("ifocus_timer_state", JSON.stringify({ ...parsed, isRunning: false }));
      }
    } catch (e) {}
  }, []);

  const verifyActiveSession = useCallback(async () => {
    if (isExemptRoute || status !== "authenticated" || isCheckingRef.current || hasConflict) {
      return;
    }

    if (session?.error === "CONCURRENT_LOGIN") {
      triggerLogoutModal("CONCURRENT_LOGIN");
      return;
    }

    isCheckingRef.current = true;
    try {
      const res = await fetch("/api/auth/active-session", {
        method: "GET",
        headers: { "Cache-Control": "no-cache, no-store" },
      });

      if (res.status === 401) {
        const data = await res.json().catch(() => ({}));
        if (data?.conflict) {
          triggerLogoutModal("CONCURRENT_LOGIN");
        }
      } else if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data?.onHold) {
          triggerLogoutModal("ACCOUNT_ON_HOLD");
        }
      }
    } catch (e) {
      // Ignore network errors so transient offline blips don't disconnect user
    } finally {
      isCheckingRef.current = false;
    }
  }, [isExemptRoute, status, session?.error, hasConflict, triggerLogoutModal]);

  // Periodic background check every 12 seconds + instant check on window focus / tab switch
  useEffect(() => {
    if (isExemptRoute || status !== "authenticated") return;

    verifyActiveSession();
    const interval = setInterval(verifyActiveSession, 12000);

    const onFocus = () => verifyActiveSession();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") verifyActiveSession();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [isExemptRoute, status, verifyActiveSession]);

  const handleSignOutAndRelogin = async () => {
    try {
      await signOut({
        redirect: true,
        callbackUrl: conflictReason === "ACCOUNT_ON_HOLD" 
          ? "/login?error=ACCOUNT_ON_HOLD" 
          : "/login?error=CONCURRENT_SESSION",
      });
    } catch (e) {
      window.location.href = "/login?error=CONCURRENT_SESSION";
    }
  };

  if (!hasConflict) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 999999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.25rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          padding: "2rem",
          textAlign: "center",
          boxSizing: "border-box",
          animation: "scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            backgroundColor: "#fef2f2",
            color: "#dc2626",
            marginBottom: "1.25rem",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
            <path d="M12 18h.01" />
          </svg>
        </div>

        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 800,
            color: "#0f172a",
            margin: "0 0 0.5rem 0",
            letterSpacing: "-0.02em",
          }}
        >
          {conflictReason === "ACCOUNT_ON_HOLD"
            ? "Account Placed On Hold"
            : "Session Expired: Active on Another Device"}
        </h3>

        <p
          style={{
            fontSize: "0.88rem",
            color: "#64748b",
            margin: "0 0 1.25rem 0",
            lineHeight: 1.5,
          }}
        >
          {conflictReason === "ACCOUNT_ON_HOLD"
            ? "Your account has been placed on hold by the Academic Dean. Please consult the College of Nursing Dean's Office for clearance."
            : "You have signed in to this iFocus account on another device (such as your phone). To maintain academic integrity and session synchronization, only one active device is allowed at a time."}
        </p>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            padding: "0.75rem 1rem",
            marginBottom: "1.5rem",
            fontSize: "0.82rem",
            color: "#334155",
            fontWeight: 600,
          }}
        >
          Your active session on this device has ended.
        </div>

        <button
          onClick={handleSignOutAndRelogin}
          type="button"
          style={{
            width: "100%",
            padding: "0.85rem 1.25rem",
            borderRadius: "12px",
            backgroundColor: "#27522d",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(39, 82, 45, 0.3)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#1b381f";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#27522d";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          Log Out
        </button>
      </div>
    </div>
  );
}


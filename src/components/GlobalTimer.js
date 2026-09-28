"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

// Web Audio Chime for Active Presence Check (Zero external audio asset dependency)
const playPresenceChime = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    // Note 1: D5 (587.33 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Note 2: A5 (880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.15);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.25, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.65);
  } catch (e) {
    console.warn("Presence chime audio blocked:", e);
  }
};

const playCompletionAlarm = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;

    // Triple gentle ping
    [0, 0.2, 0.4].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(783.99 + idx * 100, now + delay); // G5+
      gain.gain.setValueAtTime(0.18, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.28);
    });
  } catch (e) {
    console.warn("Completion alarm audio blocked:", e);
  }
};

export default function GlobalTimer() {
  const pathname = usePathname();
  const router = useRouter();

  // Timer state synced with localStorage
  const [timerState, setTimerState] = useState({
    isRunning: false,
    isFocus: true,
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    targetEndTime: null,
    timerPreset: "25/5",
    presencePaused: false,
    lastPresenceElapsed: 0,
    sessionCount: 1,
  });

  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const stateRef = useRef(timerState);
  stateRef.current = timerState;

  // Read latest timer state from localStorage
  const readStorageState = useCallback(() => {
    try {
      const raw = localStorage.getItem("ifocus_timer_state");
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed;
      }
    } catch (e) {
      console.warn("Failed reading ifocus_timer_state:", e);
    }
    return null;
  }, []);

  // Write updated timer state to localStorage and broadcast sync event
  const commitStorageState = useCallback((nextState, dispatchSync = true) => {
    try {
      localStorage.setItem("ifocus_timer_state", JSON.stringify(nextState));
      setTimerState(nextState);
      if (dispatchSync) {
        window.dispatchEvent(new CustomEvent("ifocus_timer_sync", { detail: nextState }));
      }
    } catch (e) {
      console.warn("Failed writing ifocus_timer_state:", e);
    }
  }, []);

  // Initialize and listen to sync events across tabs / components
  useEffect(() => {
    const handleSync = (e) => {
      if (e?.detail) {
        setTimerState(e.detail);
        if (e.detail.presencePaused) {
          setShowPresenceModal(true);
        } else if (!e.detail.presencePaused && showPresenceModal) {
          setShowPresenceModal(false);
        }
      } else {
        const saved = readStorageState();
        if (saved) {
          setTimerState(saved);
          if (saved.presencePaused) setShowPresenceModal(true);
        }
      }
    };

    // Initial load from storage
    const initial = readStorageState();
    if (initial) {
      // Calculate accurate current timeLeft if running
      if (initial.isRunning && initial.targetEndTime) {
        const remaining = Math.max(0, Math.round((initial.targetEndTime - Date.now()) / 1000));
        initial.timeLeft = remaining;
      }
      setTimerState(initial);
      if (initial.presencePaused) setShowPresenceModal(true);
    }

    window.addEventListener("ifocus_timer_sync", handleSync);
    window.addEventListener("storage", (e) => {
      if (e.key === "ifocus_timer_state") {
        handleSync();
      }
    });

    return () => {
      window.removeEventListener("ifocus_timer_sync", handleSync);
    };
  }, [readStorageState]);

  // Main Global Timer Loop (Runs continuously across all routes in background)
  useEffect(() => {
    const interval = setInterval(() => {
      const current = readStorageState() || stateRef.current;
      if (!current.isRunning || !current.targetEndTime) {
        return;
      }

      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.round((current.targetEndTime - now) / 1000));
      const totalTime = current.totalTime || 25 * 60;
      const elapsedSeconds = Math.max(0, totalTime - remainingSeconds);

      // 1. Check Active Presence interval condition (during Focus mode)
      if (current.isFocus && remainingSeconds > 0) {
        let activePresenceEnabled = true;
        let activePresenceInterval = 5; // default 5 minutes
        try {
          const rawPrefs = localStorage.getItem("ifocus_timer_preferences");
          if (rawPrefs) {
            const prefs = JSON.parse(rawPrefs);
            if (prefs.activePresenceEnabled !== undefined) {
              activePresenceEnabled = prefs.activePresenceEnabled;
            }
            if (prefs.activePresenceInterval) {
              activePresenceInterval = Number(prefs.activePresenceInterval);
            }
          }
        } catch (e) {}

        const intervalSeconds = activePresenceInterval * 60;

        // Check if elapsed focus time crossed the next interval threshold
        const currentIntervalBucket = Math.floor(elapsedSeconds / intervalSeconds);
        const lastIntervalBucket = Math.floor((current.lastPresenceElapsed || 0) / intervalSeconds);

        if (
          activePresenceEnabled &&
          currentIntervalBucket > 0 &&
          currentIntervalBucket > lastIntervalBucket
        ) {
          // Immediately pause timer! It CANNOT continue until user clicks confirm!
          const pausedState = {
            ...current,
            isRunning: false,
            targetEndTime: null,
            timeLeft: remainingSeconds,
            presencePaused: true,
            lastPresenceElapsed: currentIntervalBucket * intervalSeconds,
          };
          commitStorageState(pausedState, true);
          setShowPresenceModal(true);
          playPresenceChime();
          return;
        }
      }

      // 2. Timer finished condition (remainingSeconds === 0)
      if (remainingSeconds <= 0) {
        playCompletionAlarm();

        if (current.isFocus) {
          // Record completed focus session in history & stats
          const focusMins = Math.max(1, Math.round(totalTime / 60));
          try {
            const history = JSON.parse(localStorage.getItem("ifocus_session_history") || "[]");
            history.push({
              date: new Date().toISOString(),
              duration: focusMins,
              type: "pomodoro",
            });
            if (history.length > 200) history.splice(0, history.length - 200);
            localStorage.setItem("ifocus_session_history", JSON.stringify(history));

            const today = new Date().toDateString();
            const stats = JSON.parse(localStorage.getItem("ifocus_focus_stats") || "{}");
            const currentSessions = (stats.sessions || 0) + 1;
            const currentMinutes = (stats.minutes || 0) + focusMins;
            const uniqueDates = new Set(history.map((s) => new Date(s.date).toISOString().slice(0, 10)));
            let streakCount = 0;
            let checkDate = new Date();
            while (true) {
              const dateStr = checkDate.toISOString().slice(0, 10);
              if (uniqueDates.has(dateStr)) {
                streakCount++;
                checkDate.setDate(checkDate.getDate() - 1);
              } else {
                break;
              }
            }
            localStorage.setItem(
              "ifocus_focus_stats",
              JSON.stringify({
                date: today,
                sessions: currentSessions,
                minutes: currentMinutes,
                streak: Math.max(1, streakCount),
              })
            );
          } catch (e) {
            console.warn("Could not save session stats:", e);
          }

          // Calculate break duration
          const breakDuration =
            current.timerPreset === "50/10"
              ? 10 * 60
              : current.timerPreset === "15/3"
              ? 3 * 60
              : current.timerPreset === "90/20"
              ? 20 * 60
              : 5 * 60;

          // Transition to Break Mode
          const nextBreakState = {
            ...current,
            isFocus: false,
            isRunning: true,
            totalTime: breakDuration,
            timeLeft: breakDuration,
            targetEndTime: Date.now() + breakDuration * 1000,
            lastPresenceElapsed: 0,
            presencePaused: false,
          };
          commitStorageState(nextBreakState, true);
          return;
        } else {
          // Break is finished -> Switch back to focus session
          const focusDuration =
            current.timerPreset === "50/10"
              ? 50 * 60
              : current.timerPreset === "15/3"
              ? 15 * 60
              : current.timerPreset === "90/20"
              ? 90 * 60
              : 25 * 60;

          const nextFocusState = {
            ...current,
            isFocus: true,
            isRunning: false, // Wait for user to start next focus or start if configured
            totalTime: focusDuration,
            timeLeft: focusDuration,
            targetEndTime: null,
            lastPresenceElapsed: 0,
            presencePaused: false,
            sessionCount: (current.sessionCount || 1) + 1,
          };
          commitStorageState(nextFocusState, true);
          return;
        }
      }

      // 3. Normal 1-second Tick
      const updatedState = {
        ...current,
        timeLeft: remainingSeconds,
      };
      setTimerState(updatedState);
      // Dispatch tick for smooth UI updates
      window.dispatchEvent(
        new CustomEvent("ifocus_timer_tick", {
          detail: {
            timeLeft: remainingSeconds,
            isRunning: true,
            isFocus: current.isFocus,
            totalTime: current.totalTime,
          },
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [readStorageState, commitStorageState]);

  // Handle Active Presence Confirmation
  const handleConfirmPresence = () => {
    setShowPresenceModal(false);
    const current = readStorageState() || timerState;
    // Resume timer and extend targetEndTime by current timeLeft
    const resumedState = {
      ...current,
      isRunning: true,
      presencePaused: false,
      targetEndTime: Date.now() + current.timeLeft * 1000,
    };
    commitStorageState(resumedState, true);
  };

  const handleKeepPaused = () => {
    setShowPresenceModal(false);
    const current = readStorageState() || timerState;
    const pausedState = {
      ...current,
      isRunning: false,
      presencePaused: false,
      targetEndTime: null,
    };
    commitStorageState(pausedState, true);
  };

  const toggleMiniTimerPlay = (e) => {
    e.stopPropagation();
    const current = readStorageState() || timerState;
    if (current.isRunning) {
      // Pause
      const paused = {
        ...current,
        isRunning: false,
        targetEndTime: null,
      };
      commitStorageState(paused, true);
    } else {
      // Resume
      const resumed = {
        ...current,
        isRunning: true,
        presencePaused: false,
        targetEndTime: Date.now() + (current.timeLeft || 25 * 60) * 1000,
      };
      commitStorageState(resumed, true);
    }
  };

  // Format MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Check if we should display the floating mini-timer:
  // Show when NOT on /dashboard AND (timer is running OR paused by active presence)
  const isDashboard = pathname === "/dashboard";
  const showFloatingMiniTimer = !isDashboard && (timerState.isRunning || timerState.presencePaused);

  return (
    <>
      {/* Floating Mini-Timer Pill (Visible on /flashcards, /analytics, /coach, /settings, etc.) */}
      {showFloatingMiniTimer && (
        <div
          id="globalMiniTimerPill"
          onClick={() => router.push("/dashboard")}
          style={{
            position: "fixed",
            bottom: "24px",
            right: "28px",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            gap: "0.85rem",
            padding: "0.65rem 1.15rem",
            background: "rgba(15, 23, 42, 0.92)",
            color: "#ffffff",
            borderRadius: "9999px",
            boxShadow: "0 12px 30px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.12)",
            backdropFilter: "blur(12px)",
            cursor: "pointer",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-3px) scale(1.02)";
            e.currentTarget.style.boxShadow =
              "0 18px 36px -8px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.2)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow =
              "0 12px 30px -8px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.12)";
          }}
          title="Click to open Command Center"
        >
          {/* Status Indicator Dot */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: timerState.presencePaused
                  ? "#f59e0b"
                  : timerState.isFocus
                  ? "#10b981"
                  : "#38bdf8",
              }}
            />
            {timerState.isRunning && (
              <span
                style={{
                  position: "absolute",
                  width: "17px",
                  height: "17px",
                  borderRadius: "50%",
                  background: timerState.isFocus ? "rgba(16, 185, 129, 0.35)" : "rgba(56, 189, 248, 0.35)",
                  animation: "ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                }}
              />
            )}
          </div>

          {/* Time & Session Label */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.75px",
                  color: timerState.presencePaused
                    ? "#fbbf24"
                    : timerState.isFocus
                    ? "#34d399"
                    : "#7dd3fc",
                }}
              >
                {timerState.presencePaused
                  ? "Presence Paused"
                  : timerState.isFocus
                  ? "Focus Session"
                  : "Break Time"}
              </span>
            </div>
            <span
              style={{
                fontSize: "1.15rem",
                fontWeight: 700,
                letterSpacing: "0.5px",
                fontFamily: "monospace",
                lineHeight: 1.1,
              }}
            >
              {formatTime(timerState.timeLeft || 0)}
            </span>
          </div>

          {/* Play / Pause Toggle Button */}
          <button
            type="button"
            onClick={toggleMiniTimerPlay}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              border: "none",
              background: "rgba(255, 255, 255, 0.12)",
              color: "#ffffff",
              cursor: "pointer",
              transition: "background 0.2s",
              marginLeft: "4px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.24)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")}
            title={timerState.isRunning ? "Pause Session" : "Resume Session"}
          >
            {timerState.isRunning ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          {/* Quick jump arrow */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="rgba(255, 255, 255, 0.6)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
      )}

      {/* Global Active Presence Check Modal (100% Emoji-Free, Blocks session continuation until confirmed) */}
      {showPresenceModal && (
        <div
          id="globalActivePresenceModal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.72)",
            backdropFilter: "blur(10px)",
            zIndex: 99999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
            animation: "fadeIn 0.25s ease-out forwards",
          }}
        >
          <div
            style={{
              background: "var(--card-bg, #ffffff)",
              border: "1px solid var(--border-color, rgba(226, 232, 240, 0.8))",
              borderRadius: "20px",
              padding: "2rem 2.2rem",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.2rem",
            }}
          >
            {/* Visual Icon Header (Zero Emojis, Clean SVG) */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#d97706",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "0.3rem 0.8rem",
                borderRadius: "9999px",
                background: "rgba(245, 158, 11, 0.12)",
                color: "#b45309",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }} />
              Active Presence Check
            </div>

            {/* Title & Body */}
            <div>
              <h3
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "var(--text-primary, #0f172a)",
                  margin: "0 0 0.5rem 0",
                  letterSpacing: "-0.3px",
                }}
              >
                Are you still there?
              </h3>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary, #64748b)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                The timer has paused to verify you are actively studying. Your session will remain on hold until
                you confirm your presence.
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.8rem", width: "100%", marginTop: "0.4rem" }}>
              <button
                type="button"
                onClick={handleConfirmPresence}
                style={{
                  flex: 2,
                  padding: "0.85rem 1.4rem",
                  background: "var(--primary-accent, #3b82f6)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "12px",
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.25)",
                  transition: "opacity 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Continue Session
              </button>

              <button
                type="button"
                onClick={handleKeepPaused}
                style={{
                  flex: 1,
                  padding: "0.85rem 1rem",
                  background: "var(--bg-secondary, #f1f5f9)",
                  color: "var(--text-secondary, #64748b)",
                  border: "1px solid var(--border-color, rgba(226, 232, 240, 0.8))",
                  borderRadius: "12px",
                  fontSize: "0.92rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border-color, #e2e8f0)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-secondary, #f1f5f9)")}
              >
                Keep Paused
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

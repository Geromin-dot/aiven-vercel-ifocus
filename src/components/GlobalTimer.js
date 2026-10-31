"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import BreakGateModal from "./BreakGateModal";
import FeatureGuideModal from "./FeatureGuideModal";
import { reconcileCloudTelemetry } from "../lib/telemetrySync";

// Helper: Retrieve user-configured audio volume factor from settings (0.0 to 1.0)
const getUserAudioVolumeFactor = () => {
  try {
    const soundPrefs = JSON.parse(localStorage.getItem('ifocus_sound_preferences') || '{}');
    if (soundPrefs.ambientVolume !== undefined) {
      return Math.max(0.4, Math.min(100, Number(soundPrefs.ambientVolume))) / 100;
    }
  } catch (e) {}
  return 0.85; // default 85% for loud, crystal-clear alerts
};

// Helper: Determine if a route is public, administrative, or exempt from AFK/idle/presence checks
const isExemptPath = (path) => {
  if (!path) return true;
  const cleanPath = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  return (
    cleanPath === "/" ||
    cleanPath === "/login" ||
    cleanPath === "/signup" ||
    cleanPath.startsWith("/admin") ||
    cleanPath.startsWith("/showcase-preview") ||
    cleanPath.startsWith("/api")
  );
};

// High-Reliability Shared Web Audio Context & Mobile iOS Unlocker
const getSharedAudioContext = () => {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!window.__ifocusSharedAudioCtx || window.__ifocusSharedAudioCtx.state === "closed") {
    window.__ifocusSharedAudioCtx = new AudioCtx();
  }
  return window.__ifocusSharedAudioCtx;
};

// Automatic One-Time Audio Unlocker for iOS Safari WebKit (requires user gesture)
if (typeof window !== "undefined") {
  const unlockEvents = ["touchstart", "touchend", "pointerdown", "mousedown", "click"];
  const handleUnlockAudio = () => {
    try {
      const ctx = getSharedAudioContext();
      if (ctx) {
        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        // Play silent 1-sample buffer to warm up iOS hardware output
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    } catch (e) {}
    unlockEvents.forEach((evt) => window.removeEventListener(evt, handleUnlockAudio));
  };
  unlockEvents.forEach((evt) => window.addEventListener(evt, handleUnlockAudio, { passive: true, once: true }));
}

// Vibration Support (for mobile browsers that support navigator.vibrate)
const triggerVibration = (pattern = [200, 100, 200]) => {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
};

const formatNotificationTime = (seconds) => {
  const safe = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
};

const PRESENCE_NOTIFICATION_ACTIONS = [
  { action: "resume", title: "I am still here" },
  { action: "pause", title: "Stay Paused" }
];

// Cross-Platform Native System Notification Helper (iOS 16.4+ PWA ServiceWorker, Android, Desktop)
const sendSystemNotification = async (title, body, tag = "ifocus-presence", actions = []) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  try {
    if (Notification.permission === "default") {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
      } catch (err) {
        return;
      }
    } else if (Notification.permission !== "granted") {
      return;
    }

    const options = {
      body,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      tag,
      renotify: true,
      silent: false,
      requireInteraction: true,
      data: { url: "/dashboard", tag },
    };

    if (Array.isArray(actions) && actions.length > 0) {
      options.actions = actions;
    }

    // 1. Primary path for iOS PWA and modern Service Workers:
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && typeof registration.showNotification === "function") {
          await registration.showNotification(title, options);
          return;
        }
      } catch (swErr) {}
    }

    // 2. Desktop browser fallback:
    new Notification(title, options);
  } catch (e) {
    console.warn("sendSystemNotification error:", e);
  }
};

// Crystal-clear Web Audio Chimes (100% Client-side synthetic audio - loud, punchy, high-harmonic for iPhone & mobile)
const playPresenceChime = () => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const volFactor = getUserAudioVolumeFactor();
    if (volFactor <= 0) return;
    const masterVol = Math.max(0.65, volFactor); // Guaranteed audible floor for mobile speakers

    // Note 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.75 * masterVol, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.45);

    // Note 2: B5 (987.77 Hz) - bright harmonic sparkle
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.setValueAtTime(0.85 * masterVol, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);

    // Note 3: E6 (1318.51 Hz) - high crystal chime for mobile piercing power
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1318.51, now + 0.22);
    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0.65 * masterVol, now + 0.22);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.22);
    osc3.stop(now + 0.85);
  } catch (e) {
    console.warn("Presence chime audio prevented:", e);
  }
};

const playCompletionAlarm = () => {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    const volFactor = getUserAudioVolumeFactor();
    if (volFactor <= 0) return;
    [0, 0.18, 0.36].forEach((delay, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(783.99 + idx * 80, now + delay);
      gain.gain.setValueAtTime(0.2 * volFactor, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });
  } catch (e) {
    console.warn("Completion alarm audio prevented:", e);
  }
};


// Web Audio API Synthesis for High-End Navigation Slide Chime
const playNavigationSlideSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!window.__ifocusAudioCtx || window.__ifocusAudioCtx.state === "closed") {
      window.__ifocusAudioCtx = new AudioCtx();
    }
    const ctx = window.__ifocusAudioCtx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Subtle high-speed whoosh / air sweep
    const sweepOsc = ctx.createOscillator();
    const sweepGain = ctx.createGain();
    sweepOsc.type = "sine";
    sweepOsc.frequency.setValueAtTime(380, now);
    sweepOsc.frequency.exponentialRampToValueAtTime(980, now + 0.12);
    sweepGain.gain.setValueAtTime(0.0001, now);
    sweepGain.gain.linearRampToValueAtTime(0.04, now + 0.03);
    sweepGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    sweepOsc.connect(sweepGain);
    sweepGain.connect(ctx.destination);
    sweepOsc.start(now);
    sweepOsc.stop(now + 0.18);

    // 2. Crystal clear high bell chime (D6 / A6 harmonic)
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = "sine";
    bellOsc.frequency.setValueAtTime(1174.66, now + 0.05); // D6
    bellOsc.frequency.exponentialRampToValueAtTime(1760, now + 0.22); // A6
    bellGain.gain.setValueAtTime(0.0001, now + 0.05);
    bellGain.gain.linearRampToValueAtTime(0.065, now + 0.08);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now + 0.05);
    bellOsc.stop(now + 0.38);

    // 3. Warm pleasant undertone (D5)
    const warmOsc = ctx.createOscillator();
    const warmGain = ctx.createGain();
    warmOsc.type = "triangle";
    warmOsc.frequency.setValueAtTime(587.33, now + 0.05); // D5
    warmGain.gain.setValueAtTime(0.0001, now + 0.05);
    warmGain.gain.linearRampToValueAtTime(0.035, now + 0.08);
    warmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.30);
    warmOsc.connect(warmGain);
    warmGain.connect(ctx.destination);
    warmOsc.start(now + 0.05);
    warmOsc.stop(now + 0.32);
  } catch (e) {
    console.warn("Navigation slide sound error:", e);
  }
};

export default function GlobalTimer() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN" || session?.user?.username === "adminUAnursing";
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const getEffectivePath = useCallback(() => {
    if (typeof window !== "undefined" && window.location?.pathname) {
      return window.location.pathname;
    }
    return pathnameRef.current || pathname || "/";
  }, [pathname]);

  // Master Timer State
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
    breakGatePending: false,
  });

  const [showPresenceModal, setShowPresenceModal] = useState(false);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [showCycleCompleteModal, setShowCycleCompleteModal] = useState(false);
  const [completedCycleDetails, setCompletedCycleDetails] = useState({
    sessionsCompleted: 1,
    wasCustom: false,
    timerPreset: '25/5'
  });
  const [isTestReflectionModal, setIsTestReflectionModal] = useState(false);
  const [isTestPresenceModal, setIsTestPresenceModal] = useState(false);
  const [showIdleCoachModal, setShowIdleCoachModal] = useState(false);
  const [isTestIdleCoachModal, setIsTestIdleCoachModal] = useState(false);
  const [idleModalMinutes, setIdleModalMinutes] = useState(1);
  const [showBurnoutModal, setShowBurnoutModal] = useState(false);
  const [isTestBurnoutModal, setIsTestBurnoutModal] = useState(false);
  const [burnoutModalMinutes, setBurnoutModalMinutes] = useState(20);
  const tasksCompletedInSessionRef = useRef(0);
  const burnoutCheckedThisSessionRef = useRef(false);
  const [showBreakGateModal, setShowBreakGateModal] = useState(false);
  const [activeBreakGateDeck, setActiveBreakGateDeck] = useState(null);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideTopic, setGuideTopic] = useState("pomodoro");

  // Global Music & Soundscapes State (Synced with Dashboard)
  const [musicState, setMusicState] = useState({ isPlaying: false, currentTrack: 'Chill Lofi', volume: 70 });
  const globalAudioRef = useRef(null);

  // Navigation Slide-In Animation & Audio State
  const [isNavSliding, setIsNavSliding] = useState(false);
  const prevPathRef = useRef(pathname);
  const isInitialMount = useRef(true);

  // Track Source Map - Full Curated Soundscapes Library
  const getTrackSrc = (name) => {
    switch (name) {
      case 'Chill Lofi':
        return '/music/Lofi Chill.mp3';
      case 'Study Music':
        return '/music/Study Music.mp3';
      case 'Rain Ambient':
        return '/music/rain.mp3';
      case 'Ocean Waves':
        return '/music/ocean.wav';
      case 'Binaural Alpha (432Hz)':
        return '/music/binaural_alpha.wav';
      case 'Warm Campfire':
        return '/music/campfire.wav';
      case 'Pink Noise':
        return '/music/pink_noise.wav';
      case 'Cosmic Deep Space':
        return '/music/cosmic_drone.wav';
      default:
        return '/music/Lofi Chill.mp3';
    }
  };

  // Sync Ambient Music across all pages
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ifocus_music_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed.isPlaying === 'boolean') {
          setMusicState(parsed);
        }
      }
    } catch (e) {}

    const handleMusicSync = (e) => {
      if (e?.detail) {
        const detail = e.detail;
        setMusicState((prev) => ({ ...prev, ...detail }));
        if (globalAudioRef.current) {
          if (detail.volume !== undefined) {
            globalAudioRef.current.volume = Math.max(0, Math.min(1, detail.volume / 100));
          }
          if (typeof detail.isPlaying === 'boolean') {
            if (detail.isPlaying && detail.currentTrack !== 'None') {
              const targetSrc = getTrackSrc(detail.currentTrack || musicState.currentTrack || 'Chill Lofi');
              if (!globalAudioRef.current.src.endsWith(targetSrc)) {
                globalAudioRef.current.src = targetSrc;
                globalAudioRef.current.load();
              }
              globalAudioRef.current.play().catch((err) => console.warn("Global audio play prevented:", err));
            } else {
              globalAudioRef.current.pause();
            }
          }
        }
      }
    };
    window.addEventListener('ifocus_music_sync', handleMusicSync);

    const handleGuideOpen = (e) => {
      setGuideTopic(e?.detail?.topic || 'pomodoro');
      setGuideModalOpen(true);
    };
    window.addEventListener('ifocus_open_guide', handleGuideOpen);

    const handleEmergencyStop = () => {
      setTimerState((prev) => ({ ...prev, isRunning: false, targetEndTime: null }));
      if (globalAudioRef.current) {
        globalAudioRef.current.pause();
      }
      setMusicState((prev) => ({ ...prev, isPlaying: false }));
    };
    window.addEventListener('ifocus_emergency_stop', handleEmergencyStop);

    return () => {
      window.removeEventListener('ifocus_music_sync', handleMusicSync);
      window.removeEventListener('ifocus_open_guide', handleGuideOpen);
      window.removeEventListener('ifocus_emergency_stop', handleEmergencyStop);
    };
  }, []);

  // Global Audio Playback Controller
  useEffect(() => {
    if (globalAudioRef.current) {
      const vol = Math.max(0, Math.min(1, (musicState.volume !== undefined ? musicState.volume : 70) / 100));
      globalAudioRef.current.volume = vol;
      if (musicState.isPlaying && musicState.currentTrack !== 'None' && vol > 0) {
        const targetSrc = getTrackSrc(musicState.currentTrack || 'Chill Lofi');
        if (!globalAudioRef.current.src.endsWith(targetSrc)) {
          globalAudioRef.current.src = targetSrc;
          globalAudioRef.current.load();
        }
        globalAudioRef.current.play().catch((e) => console.warn("Global audio play prevented:", e));
      } else {
        globalAudioRef.current.pause();
      }
    }
  }, [musicState.isPlaying, musicState.currentTrack, musicState.volume]);

  // Navigation Route Change Trigger: Slide In from Right + Elegant Chime
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevPathRef.current = pathname;
      return;
    }

    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;

      const isTimerActive = timerState.isRunning || timerState.presencePaused || timerState.breakGatePending;
      if (isTimerActive && !isExemptPath(pathname)) {
        setIsNavSliding(true);
        playNavigationSlideSound();
        const t = setTimeout(() => {
          setIsNavSliding(false);
        }, 550);
        return () => clearTimeout(t);
      }
    }
  }, [pathname, timerState.isRunning, timerState.presencePaused, timerState.breakGatePending]);

  // When user is on landing page or exempt route, immediately dismiss all modals and refresh activity
  useEffect(() => {
    const livePath = getEffectivePath();
    if (isExemptPath(livePath)) {
      setShowPresenceModal(false);
      setShowIdleCoachModal(false);
      setShowBreakGateModal(false);
      setShowBurnoutModal(false);
      setShowCycleCompleteModal(false);
      lastActivityRef.current = Date.now();
    }
  }, [pathname, getEffectivePath]);

  // Draggable Floating Mini-Timer State & Drag Gestures
  const [miniTimerPos, setMiniTimerPos] = useState({ x: null, y: null });
  const [isDraggingMiniTimer, setIsDraggingMiniTimer] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const miniTimerRef = useRef(null);
  const dragInfoRef = useRef({ isDragging: false, startX: 0, startY: 0, initialLeft: 0, initialTop: 0, moved: false });

  // Detect mobile screen width (< 768px)
  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== "undefined") {
        setIsMobileScreen(window.innerWidth <= 768);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load saved mini-timer position from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ifocus_mini_timer_pos");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const maxX = Math.max(10, (typeof window !== "undefined" ? window.innerWidth : 1200) - 240);
          const maxY = Math.max(10, (typeof window !== "undefined" ? window.innerHeight : 800) - 70);
          setMiniTimerPos({
            x: Math.min(Math.max(12, parsed.x), maxX),
            y: Math.min(Math.max(12, parsed.y), maxY),
          });
        }
      }
    } catch (e) {}
  }, []);

  const handleMiniTimerMouseDown = (e) => {
    if (e.button !== 0) return;
    const el = miniTimerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragInfoRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      moved: false,
    };
    setIsDraggingMiniTimer(true);

    const onMouseMove = (moveEvent) => {
      if (!dragInfoRef.current.isDragging) return;
      const dx = moveEvent.clientX - dragInfoRef.current.startX;
      const dy = moveEvent.clientY - dragInfoRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragInfoRef.current.moved = true;
      }
      const elWidth = el.offsetWidth || 230;
      const elHeight = el.offsetHeight || 56;
      const newX = Math.min(Math.max(12, dragInfoRef.current.initialLeft + dx), window.innerWidth - elWidth - 12);
      const newY = Math.min(Math.max(12, dragInfoRef.current.initialTop + dy), window.innerHeight - elHeight - 12);

      setMiniTimerPos({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      dragInfoRef.current.isDragging = false;
      setIsDraggingMiniTimer(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      if (miniTimerRef.current) {
        const r = miniTimerRef.current.getBoundingClientRect();
        try {
          localStorage.setItem("ifocus_mini_timer_pos", JSON.stringify({ x: r.left, y: r.top }));
        } catch (err) {}
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleMiniTimerTouchStart = (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const el = miniTimerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    dragInfoRef.current = {
      isDragging: true,
      startX: touch.clientX,
      startY: touch.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
      moved: false,
    };
    setIsDraggingMiniTimer(true);

    const onTouchMove = (moveEvent) => {
      if (!dragInfoRef.current.isDragging || !moveEvent.touches || moveEvent.touches.length !== 1) return;
      const t = moveEvent.touches[0];
      const dx = t.clientX - dragInfoRef.current.startX;
      const dy = t.clientY - dragInfoRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragInfoRef.current.moved = true;
      }
      const elWidth = el.offsetWidth || 230;
      const elHeight = el.offsetHeight || 56;
      const newX = Math.min(Math.max(12, dragInfoRef.current.initialLeft + dx), window.innerWidth - elWidth - 12);
      const newY = Math.min(Math.max(12, dragInfoRef.current.initialTop + dy), window.innerHeight - elHeight - 12);

      setMiniTimerPos({ x: newX, y: newY });
    };

    const onTouchEnd = () => {
      dragInfoRef.current.isDragging = false;
      setIsDraggingMiniTimer(false);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);

      if (miniTimerRef.current) {
        const r = miniTimerRef.current.getBoundingClientRect();
        try {
          localStorage.setItem("ifocus_mini_timer_pos", JSON.stringify({ x: r.left, y: r.top }));
        } catch (err) {}
      }
    };

    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
  };

  const handleMiniTimerClick = () => {
    if (dragInfoRef.current.moved) {
      dragInfoRef.current.moved = false;
      return;
    }
    if (timerState.breakGatePending) {
      setShowBreakGateModal(true);
    } else {
      router.push("/dashboard");
    }
  };

  const stateRef = useRef(timerState);
  stateRef.current = timerState;

  // Track User Activity across the entire screen for AFK Detection (Persisted across route navigation)
  const lastActivityRef = useRef(
    (typeof window !== "undefined" && Number(localStorage.getItem("ifocus_last_user_activity"))) || Date.now()
  );

  // Read latest timer state from localStorage
  const readStorageState = useCallback(() => {
    try {
      const raw = localStorage.getItem("ifocus_timer_state");
      if (raw) {
        return JSON.parse(raw);
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

  // Cycle Completion & Rhythm Reset Handlers
  const handleReturnToDefaultPreset = useCallback(() => {
    setShowCycleCompleteModal(false);
    const defaultState = {
      ...stateRef.current,
      isRunning: false,
      isFocus: true,
      timeLeft: 25 * 60,
      totalTime: 25 * 60,
      targetEndTime: null,
      timerPreset: '25/5',
      sessionCount: 1,
      presencePaused: false,
      lastPresenceElapsed: 0,
      breakGatePending: false,
    };
    try {
      localStorage.removeItem('ifocus_ai_adjusted_active');
      localStorage.removeItem('ifocus_ai_adjusted_details');
    } catch (e) {}
    commitStorageState(defaultState, true);
  }, [commitStorageState]);

  const handleKeepCurrentRhythm = useCallback(() => {
    setShowCycleCompleteModal(false);
  }, []);

  // Trigger Active Presence Pause
  const triggerPresencePause = useCallback(() => {
    const livePath = getEffectivePath();
    if (isExemptPath(livePath) || isAdmin) {
      lastActivityRef.current = Date.now();
      return;
    }
    const current = readStorageState() || stateRef.current;
    const remainingSeconds = current.targetEndTime
      ? Math.max(0, Math.round((current.targetEndTime - Date.now()) / 1000))
      : (current.timeLeft !== undefined ? current.timeLeft : 25 * 60);
    const totalTime = current.totalTime || 25 * 60;
    const elapsedSeconds = Math.max(0, totalTime - remainingSeconds);

    const pausedState = {
      ...current,
      isRunning: false,
      targetEndTime: null,
      timeLeft: remainingSeconds,
      presencePaused: true,
      lastPresenceCheckElapsed: elapsedSeconds,
      lastPresenceRemaining: remainingSeconds,
      lastPresenceElapsed: elapsedSeconds,
    };

    commitStorageState(pausedState, true);
    setShowPresenceModal(true);
    playPresenceChime();
    triggerVibration([250, 100, 250]);
    const timerFormatted = formatNotificationTime(remainingSeconds);
    sendSystemNotification(
      "iFocus Active Presence Check",
      `Timer: ${timerFormatted} remaining. Are you still studying? Tap to continue or pause.`,
      "ifocus-presence",
      PRESENCE_NOTIFICATION_ACTIONS
    );
  }, [commitStorageState, readStorageState, getEffectivePath, isAdmin]);

  // Proactive Idle Coach Intervention Trigger
  const triggerIdleCoachIntervention = useCallback((isTest = false, explicitMinutes = null) => {
    const livePath = getEffectivePath();
    // Strictly prevent firing if user is on public landing page, login, signup, or admin
    if (!isTest && (isExemptPath(livePath) || isAdmin)) {
      lastActivityRef.current = Date.now();
      return;
    }

    let afkMinutes = 1;
    try {
      const raw = localStorage.getItem("ifocus_timer_preferences");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.afkCoachMinutes !== undefined) {
          afkMinutes = Number(parsed.afkCoachMinutes) || 1;
        }
      }
    } catch (e) {}

    const effectiveMinutes = explicitMinutes !== null ? explicitMinutes : afkMinutes;
    setIdleModalMinutes(effectiveMinutes);
    setIsTestIdleCoachModal(isTest);
    setShowIdleCoachModal(true);
    lastActivityRef.current = Date.now();
    try {
      localStorage.setItem("ifocus_last_user_activity", String(Date.now()));
    } catch (e) {}

    playPresenceChime();

    const userName = session?.user?.name || session?.user?.username || (typeof window !== 'undefined' ? localStorage.getItem('ifocus_user_name') : '') || 'Student';
    const minText = `${effectiveMinutes} ${effectiveMinutes === 1 ? 'minute' : 'minutes'}`;

    const insightData = {
      type: 'idle',
      state: 'idle',
      sentiment: 'Inactivity & Task Friction',
      idleMinutes: effectiveMinutes,
      timestamp: new Date().toISOString(),
      reason: `Inactivity detected: You have been idle for ${minText} with no active timer. Student appears stuck, hesitant, or experiencing task friction.`,
      actionPlan: `You have been idle for ${minText} without starting a focus session. Feeling stuck on where to begin? Break your upcoming task into just one simple step, or start a gentle 15m focus session to build momentum.`,
      metrics: {
        dwellTime: 0,
        flightTime: 0,
        errorRate: 0,
      }
    };

    try {
      localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(insightData));
      localStorage.setItem("ifocus_telemetry_insight_anonymous", JSON.stringify(insightData));
      localStorage.setItem("ifocus_latest_telemetry", JSON.stringify(insightData));
      localStorage.setItem("ifocus_active_idle_alert", JSON.stringify(insightData));
      window.dispatchEvent(new CustomEvent("ifocus_telemetry_updated", { detail: insightData }));

      // Sync proactive idle alert to database for multi-device parity
      fetch("/api/user/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telemetryState: {
            latestTelemetry: insightData,
            activeIdleAlert: insightData,
            updatedAt: new Date().toISOString()
          }
        })
      }).catch(() => {});
    } catch (e) {}
  }, [session?.user, pathname, isAdmin]);

  // Proactive Task Stagnation & Burnout Check Trigger (While Focus Timer is Running)
  const triggerBurnoutCheck = useCallback((isTest = false, minutes = 20) => {
    setIsTestBurnoutModal(isTest);
    setBurnoutModalMinutes(minutes);
    setShowBurnoutModal(true);
    playPresenceChime();

    if (isTest) return;

    const userName = session?.user?.name || session?.user?.username || (typeof window !== 'undefined' ? localStorage.getItem('ifocus_user_name') : '') || 'Student';
    const insightData = {
      timestamp: new Date().toISOString(),
      reason: `Task stagnation alert: Active focus for ${minutes} minutes without completing any task.`,
      actionPlan: `You have been focusing for ${minutes} minutes without completing a task. If feeling stuck or experiencing task friction, switch to an easier task from your list or take a brief mental pause.`,
      metrics: {
        dwellTime: 0,
        flightTime: 0,
        errorRate: 0,
      }
    };

    try {
      localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(insightData));
      localStorage.setItem("ifocus_latest_telemetry", JSON.stringify(insightData));
      window.dispatchEvent(new CustomEvent("ifocus_telemetry_updated", { detail: insightData }));

      // Sync proactive idle alert to database for multi-device parity
      fetch("/api/user/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telemetryState: {
            latestTelemetry: insightData,
            activeIdleAlert: insightData,
            updatedAt: new Date().toISOString()
          }
        })
      }).catch(() => {});
    } catch (e) {}
  }, [session?.user, pathname, isAdmin]);

  // Global Inactivity (AFK) Listeners across all user input methods
  useEffect(() => {
    const livePath = getEffectivePath();
    if (isAdmin || isExemptPath(livePath)) {
      lastActivityRef.current = Date.now();
      return;
    }

    const handleUserActivity = () => {
      // Do not run idle checks on public routes or exempt paths
      const activePath = getEffectivePath();
      if (isAdmin || isExemptPath(activePath)) {
        lastActivityRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const last = lastActivityRef.current || now;
      const idleMs = now - last;

      // Update in-memory & persistent activity timestamp
      lastActivityRef.current = now;
      try {
        localStorage.setItem("ifocus_last_user_activity", String(now));
      } catch (e) {}

      // If user returns after being AFK for longer than timeout and NO timer is running:
      const current = readStorageState() || stateRef.current;
      const isTimerRunning = Boolean(current?.isRunning);

      if (!isTimerRunning && !showIdleCoachModal && !showPresenceModal && !showBreakGateModal && !showReflectionModal && !showCycleCompleteModal && !showBurnoutModal) {
        let afkEnabled = true;
        let afkMinutes = 1;
        try {
          const raw = localStorage.getItem("ifocus_timer_preferences");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.afkCoachEnabled !== undefined) afkEnabled = Boolean(parsed.afkCoachEnabled);
            if (parsed.afkCoachMinutes !== undefined) afkMinutes = Number(parsed.afkCoachMinutes) || 1;
          }
        } catch (e) {}

        const thresholdMs = Math.max(30000, afkMinutes * 60 * 1000);
        if (afkEnabled && idleMs >= thresholdMs) {
          triggerIdleCoachIntervention(false, afkMinutes);
        }
      }
    };

    const handleVisibilityOrFocus = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: "CANCEL_BACKGROUND_PRESENCE_CHECK"
          });
        }
        const livePath = getEffectivePath();
        if (isAdmin || isExemptPath(livePath)) {
          lastActivityRef.current = Date.now();
          setShowPresenceModal(false);
          setShowIdleCoachModal(false);
          return;
        }
        handleUserActivity();
        const current = readStorageState() || stateRef.current;
        // If presence paused while away or screen locked on mobile, re-prompt and re-chime
        if (current?.presencePaused) {
          setShowPresenceModal(true);
          playPresenceChime();
          return;
        }

        // Active Presence Catch-Up on Mobile Screen Unlock or Tab Switch:
        if (current?.isRunning && current?.isFocus && current?.targetEndTime) {
          let activePresenceEnabled = true;
          let activePresenceInterval = 5;
          try {
            const rawPrefs = localStorage.getItem("ifocus_timer_preferences");
            if (rawPrefs) {
              const prefs = JSON.parse(rawPrefs);
              if (prefs.activePresenceEnabled !== undefined) activePresenceEnabled = Boolean(prefs.activePresenceEnabled);
              if (prefs.activePresenceInterval) activePresenceInterval = Number(prefs.activePresenceInterval);
            }
          } catch (e) {}

          const intervalSeconds = Math.max(60, Number(activePresenceInterval || 5) * 60);
          const totalTime = current.totalTime || 25 * 60;
          const remainingSeconds = Math.max(0, Math.round((current.targetEndTime - Date.now()) / 1000));
          const elapsedSeconds = Math.max(0, totalTime - remainingSeconds);
          const lastCheckElapsed = typeof current.lastPresenceCheckElapsed === "number" ? current.lastPresenceCheckElapsed : 0;
          const validLastCheck = lastCheckElapsed > elapsedSeconds ? 0 : lastCheckElapsed;
          const focusSecondsSinceLastCheck = Math.max(0, elapsedSeconds - validLastCheck);

          if (activePresenceEnabled && focusSecondsSinceLastCheck >= intervalSeconds) {
            const pausedState = {
              ...current,
              isRunning: false,
              targetEndTime: null,
              timeLeft: remainingSeconds,
              presencePaused: true,
              lastPresenceCheckElapsed: elapsedSeconds,
              lastPresenceRemaining: remainingSeconds,
              lastPresenceElapsed: elapsedSeconds,
            };
            commitStorageState(pausedState, true);
            setShowPresenceModal(true);
            playPresenceChime();
            triggerVibration([250, 100, 250]);
            sendSystemNotification(
              "iFocus Active Presence Check",
              `Timer: ${formatNotificationTime(remainingSeconds)} remaining. Are you still studying? Tap to continue or pause.`,
              "ifocus-presence",
              PRESENCE_NOTIFICATION_ACTIONS
            );
          }
        }
      } else if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        const current = readStorageState() || stateRef.current;
        if (current?.isRunning && current?.isFocus && current?.targetEndTime) {
          let activePresenceEnabled = true;
          let activePresenceInterval = 5;
          try {
            const rawPrefs = localStorage.getItem("ifocus_timer_preferences");
            if (rawPrefs) {
              const prefs = JSON.parse(rawPrefs);
              if (prefs.activePresenceEnabled !== undefined) activePresenceEnabled = Boolean(prefs.activePresenceEnabled);
              if (prefs.activePresenceInterval) activePresenceInterval = Number(prefs.activePresenceInterval);
            }
          } catch (e) {}

          if (activePresenceEnabled) {
            const intervalSeconds = Math.max(60, Number(activePresenceInterval || 5) * 60);
            const totalTime = current.totalTime || 25 * 60;
            const remainingSeconds = Math.max(0, Math.round((current.targetEndTime - Date.now()) / 1000));
            const elapsedSeconds = Math.max(0, totalTime - remainingSeconds);
            const lastCheckElapsed = typeof current.lastPresenceCheckElapsed === "number" ? current.lastPresenceCheckElapsed : 0;
            const validLastCheck = lastCheckElapsed > elapsedSeconds ? 0 : lastCheckElapsed;
            const focusSecondsSinceLastCheck = Math.max(0, elapsedSeconds - validLastCheck);
            const secondsUntilCheck = Math.max(5, intervalSeconds - focusSecondsSinceLastCheck);

            if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: "SCHEDULE_BACKGROUND_PRESENCE_CHECK",
                delayMs: secondsUntilCheck * 1000,
                remainingSeconds: Math.max(0, remainingSeconds - secondsUntilCheck)
              });
            }
          }
        }
      }
    };

    const events = ["mousemove", "keydown", "mousedown", "touchstart", "touchmove", "scroll", "wheel", "pointerdown", "click"];
    events.forEach(evt => window.addEventListener(evt, handleUserActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserActivity));
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [isAdmin, pathname, readStorageState, showIdleCoachModal, showPresenceModal, showBreakGateModal, showReflectionModal, showCycleCompleteModal, showBurnoutModal, triggerIdleCoachIntervention]);

  // Test Listeners for Idle Coach & Burnout Check
  useEffect(() => {
    const handleTestTrigger = (e) => {
      let mins = e?.detail?.minutes;
      if (!mins) {
        try {
          const raw = localStorage.getItem("ifocus_timer_preferences");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.afkCoachMinutes !== undefined) mins = Number(parsed.afkCoachMinutes);
          }
        } catch (err) {}
      }
      triggerIdleCoachIntervention(true, mins || 1);
    };
    const handleBurnoutTest = (e) => {
      let mins = e?.detail?.minutes;
      if (!mins) {
        try {
          const raw = localStorage.getItem("ifocus_timer_preferences");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.burnoutCheckMinutes !== undefined) mins = Number(parsed.burnoutCheckMinutes);
          }
        } catch (err) {}
      }
      triggerBurnoutCheck(true, mins || 20);
    };
    const handleTaskCompleted = () => {
      tasksCompletedInSessionRef.current += 1;
    };

    window.addEventListener("ifocus_trigger_afk_coach_test", handleTestTrigger);
    window.addEventListener("ifocus_trigger_burnout_check_test", handleBurnoutTest);
    window.addEventListener("ifocus_task_completed", handleTaskCompleted);

    return () => {
      window.removeEventListener("ifocus_trigger_afk_coach_test", handleTestTrigger);
      window.removeEventListener("ifocus_trigger_burnout_check_test", handleBurnoutTest);
      window.removeEventListener("ifocus_task_completed", handleTaskCompleted);
    };
  }, [triggerIdleCoachIntervention, triggerBurnoutCheck]);

  // Idle AFK Coach Inactivity Watcher (When NO timer is running)
  useEffect(() => {
    const livePath = getEffectivePath();
    if (isAdmin || isExemptPath(livePath)) {
      lastActivityRef.current = Date.now();
      return;
    }

    const checkAfkInactivity = () => {
      const activePath = getEffectivePath();
      if (isAdmin || isExemptPath(activePath)) {
        lastActivityRef.current = Date.now();
        return;
      }

      // 1. MUST NOT have an actively ticking timer
      const current = readStorageState() || stateRef.current;
      const isTimerRunning = Boolean(current?.isRunning);

      if (isTimerRunning) {
        lastActivityRef.current = Date.now();
        try {
          localStorage.setItem("ifocus_last_user_activity", String(Date.now()));
        } catch (e) {}
        return;
      }

      // 2. Do not trigger if any modal is currently visible
      if (showIdleCoachModal || showPresenceModal || showBreakGateModal || showReflectionModal || showCycleCompleteModal || showBurnoutModal) {
        return;
      }

      // 3. Read AFK preferences
      let afkEnabled = true;
      let afkMinutes = 1;
      try {
        const raw = localStorage.getItem("ifocus_timer_preferences");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.afkCoachEnabled !== undefined) afkEnabled = Boolean(parsed.afkCoachEnabled);
          if (parsed.afkCoachMinutes !== undefined) afkMinutes = Number(parsed.afkCoachMinutes) || 1;
        }
      } catch (e) {}

      if (!afkEnabled) return;

      const idleDurationMs = Date.now() - (lastActivityRef.current || Date.now());
      const thresholdMs = Math.max(30000, afkMinutes * 60 * 1000); // e.g. 5m = 300,000ms

      if (idleDurationMs >= thresholdMs) {
        // Inactivity threshold exceeded! Trigger AFK Coach Intervention!
        triggerIdleCoachIntervention(false, afkMinutes);
      }
    };

    const intervalId = setInterval(checkAfkInactivity, 1000);
    return () => clearInterval(intervalId);
  }, [pathname, showIdleCoachModal, showPresenceModal, showBreakGateModal, showReflectionModal, showCycleCompleteModal, showBurnoutModal, readStorageState, isAdmin, triggerIdleCoachIntervention]);

  // Automatic Offline Re-sync Handler (ISO/IEC 25010 Item 8)
  useEffect(() => {
    const syncPendingOfflineSessions = async () => {
      try {
        const raw = localStorage.getItem('ifocus_pending_study_sessions');
        if (!raw) return;
        const pending = JSON.parse(raw);
        if (!Array.isArray(pending) || pending.length === 0) return;

        const remaining = [];
        for (const sessionItem of pending) {
          try {
            const res = await fetch('/api/study-sessions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(sessionItem)
            });
            if (!res.ok) remaining.push(sessionItem);
          } catch (e) {
            remaining.push(sessionItem);
          }
        }

        if (remaining.length === 0) {
          localStorage.removeItem('ifocus_pending_study_sessions');
        } else {
          localStorage.setItem('ifocus_pending_study_sessions', JSON.stringify(remaining));
        }
      } catch (err) {}
    };

    window.addEventListener('online', syncPendingOfflineSessions);
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncPendingOfflineSessions();
    }

    return () => {
      window.removeEventListener('online', syncPendingOfflineSessions);
    };
  }, []);

  // Initialize and listen to sync and test events
  useEffect(() => {
    const handleSync = (e) => {
      if (e?.detail) {
        setTimerState(e.detail);
        if (e.detail.isRunning) {
          lastActivityRef.current = Date.now();
        }
        if (e.detail.presencePaused) {
          const currentLive = getEffectivePath();
          if (!isExemptPath(currentLive) && !isAdmin) {
            setShowPresenceModal(true);
          }
        } else if (!e.detail.presencePaused) {
          setShowPresenceModal(false);
        }
        if (e.detail.breakGatePending) {
          // Check for active deck
          try {
            const rawDeck = localStorage.getItem("ifocus_active_breakgate_deck");
            if (rawDeck) {
              const parsed = JSON.parse(rawDeck);
              if (session?.user?.id && parsed?.userId && parsed.userId !== session.user.id) {
                localStorage.removeItem("ifocus_active_breakgate_deck");
                setActiveBreakGateDeck(null);
              } else {
                setActiveBreakGateDeck(parsed);
                setShowBreakGateModal(true);
              }
            }
          } catch(err) {}
        }
      } else {
        const saved = readStorageState();
        if (saved) {
          setTimerState(saved);
          if (saved.presencePaused) {
            const currentLive = getEffectivePath();
            if (!isExemptPath(currentLive) && !isAdmin) {
              setShowPresenceModal(true);
            }
          }
          if (saved.breakGatePending) {
            try {
              const rawDeck = localStorage.getItem("ifocus_active_breakgate_deck");
              if (rawDeck) {
                const parsed = JSON.parse(rawDeck);
                setActiveBreakGateDeck(parsed);
                setShowBreakGateModal(true);
              }
            } catch (err) {}
          }
        }
      }
    };

    const handleTestPresence = () => {
      setIsTestPresenceModal(true);
      setShowPresenceModal(true);
      playPresenceChime();
    };

    // Initial load from storage
    const initial = readStorageState();
    if (initial) {
      let maxS = 4;
      if (initial.timerPreset === "Custom") {
        if (initial.customSessions) maxS = Number(initial.customSessions) || 1;
        else {
          try {
            const customStored = localStorage.getItem("ifocus_custom_timer");
            if (customStored) {
              const parsed = JSON.parse(customStored);
              if (parsed.customSessions) maxS = Number(parsed.customSessions) || 1;
            }
          } catch (e) {}
        }
      }
      if (initial.sessionCount && initial.sessionCount > maxS) {
        initial.sessionCount = 1;
        if (!initial.isRunning) {
          commitStorageState(initial, false);
        }
      }
      if (initial.isRunning && initial.targetEndTime) {
        const remaining = Math.max(0, Math.round((initial.targetEndTime - Date.now()) / 1000));
        initial.timeLeft = remaining;
      }
      setTimerState(initial);
      if (initial.presencePaused) {
        const currentLive = getEffectivePath();
        if (!isExemptPath(currentLive) && !isAdmin) {
          setShowPresenceModal(true);
        }
      }
      if (initial.breakGatePending) {
        try {
          const rawDeck = localStorage.getItem("ifocus_active_breakgate_deck");
          if (rawDeck) {
            const parsed = JSON.parse(rawDeck);
            setActiveBreakGateDeck(parsed);
            setShowBreakGateModal(true);
          }
        } catch (err) {}
      }
    }

    const handleTestReflection = () => {
      setIsTestReflectionModal(true);
      setShowReflectionModal(true);
    };

    const handleTestCycleComplete = () => {
      setCompletedCycleDetails({
        sessionsCompleted: 1,
        wasCustom: true,
        timerPreset: 'Custom'
      });
      setShowCycleCompleteModal(true);
      playCompletionAlarm();
    };

    const handleSkipBreakEvent = () => {
      const current = readStorageState() || stateRef.current;
      let maxSessions = 4;
      if (current.timerPreset === "Custom") {
        if (current.customSessions) maxSessions = Number(current.customSessions) || 1;
        else {
          try {
            const customStored = localStorage.getItem("ifocus_custom_timer");
            if (customStored) {
              const parsed = JSON.parse(customStored);
              if (parsed.customSessions) maxSessions = Number(parsed.customSessions) || 1;
            }
          } catch(e) {}
        }
      }
      const currentCount = current.sessionCount || 1;
      const isPreSessionRest = Boolean(current.isAiRestRecovery);
      const nextCount = isPreSessionRest ? currentCount : currentCount + 1;

      let focusDuration = 25 * 60;
      if (current.timerPreset === "50/10") focusDuration = 50 * 60;
      else if (current.timerPreset === "15/3") focusDuration = 15 * 60;
      else if (current.timerPreset === "90/20") focusDuration = 90 * 60;
      else if (current.timerPreset === "Custom") {
        if (current.customWorkDuration) focusDuration = current.customWorkDuration;
        else {
          try {
            const customStored = localStorage.getItem("ifocus_custom_timer");
            if (customStored) {
              const parsed = JSON.parse(customStored);
              if (parsed.customWorkDuration) focusDuration = parsed.customWorkDuration;
            }
          } catch(e) {}
        }
      }

      let breakDuration = 5 * 60;
      if (current.timerPreset === "50/10") breakDuration = 10 * 60;
      else if (current.timerPreset === "15/3") breakDuration = 3 * 60;
      else if (current.timerPreset === "90/20") breakDuration = 20 * 60;
      else if (current.timerPreset === "Custom" && current.customBreakDuration) breakDuration = current.customBreakDuration;

      if (nextCount > maxSessions) {
        playCompletionAlarm();
        const completedCycleState = {
          ...current,
          isFocus: true,
          isRunning: false,
          totalTime: focusDuration,
          timeLeft: focusDuration,
          targetEndTime: null,
          lastPresenceElapsed: 0,
          presencePaused: false,
          breakGatePending: false,
          sessionCount: 1,
          customSessions: maxSessions,
          customWorkDuration: focusDuration,
          customBreakDuration: breakDuration,
        };
        commitStorageState(completedCycleState, true);
        setCompletedCycleDetails({
          sessionsCompleted: maxSessions,
          timerPreset: current.timerPreset,
          wasCustom: current.timerPreset === "Custom"
        });
        setShowCycleCompleteModal(true);
        window.dispatchEvent(new CustomEvent("ifocus_cycle_completed", { detail: { sessionsCompleted: maxSessions } }));
        return;
      }

      try {
        localStorage.removeItem("ifocus_ai_rest_recovery");
        localStorage.removeItem("ifocus_recovery_completed");
        localStorage.removeItem("ifocus_cognitive_reset");
      } catch (e) {}
      window.dispatchEvent(new CustomEvent("ifocus_telemetry_updated"));

      const nextFocusState = {
        ...current,
        isFocus: true,
        isRunning: true,
        totalTime: focusDuration,
        timeLeft: focusDuration,
        targetEndTime: Date.now() + focusDuration * 1000,
        lastPresenceElapsed: 0,
        presencePaused: false,
        breakGatePending: false,
        sessionCount: nextCount,
        customSessions: maxSessions,
        customWorkDuration: focusDuration,
        customBreakDuration: breakDuration,
      };
      commitStorageState(nextFocusState, true);
    };

    const handleBreakGateDeckChanged = (e) => {
      if (e?.detail?.active && e?.detail?.deck) {
        if (session?.user?.id && e.detail.deck.userId && e.detail.deck.userId !== session.user.id) {
          setActiveBreakGateDeck(null);
        } else {
          setActiveBreakGateDeck(e.detail.deck);
        }
      } else {
        setActiveBreakGateDeck(null);
      }
    };

    window.addEventListener("ifocus_timer_sync", handleSync);
    window.addEventListener("ifocus_breakgate_deck_changed", handleBreakGateDeckChanged);
    window.addEventListener("ifocus_skip_break", handleSkipBreakEvent);
    window.addEventListener("ifocus_test_presence", handleTestPresence);
    window.addEventListener("ifocus_test_reflection_prompt", handleTestReflection);
    window.addEventListener("ifocus_test_cycle_complete", handleTestCycleComplete);
    window.addEventListener("storage", (e) => {
      if (e.key === "ifocus_timer_state") handleSync();
    });

    return () => {
      window.removeEventListener("ifocus_timer_sync", handleSync);
      window.removeEventListener("ifocus_breakgate_deck_changed", handleBreakGateDeckChanged);
      window.removeEventListener("ifocus_skip_break", handleSkipBreakEvent);
      window.removeEventListener("ifocus_test_presence", handleTestPresence);
      window.removeEventListener("ifocus_test_reflection_prompt", handleTestReflection);
      window.removeEventListener("ifocus_test_cycle_complete", handleTestCycleComplete);
    };
  }, [readStorageState, triggerPresencePause]);

  // Bi-Directional Cloud Telemetry & Preference Reconciliation on mount (PC to iPhone PWA parity)
  useEffect(() => {
    if (!session?.user?.id) return;
    reconcileCloudTelemetry().catch(() => {});
  }, [session?.user?.id]);

  // Main Global Timer Loop (Runs continuously across all routes in background)
  useEffect(() => {
    if (isAdmin || pathname.startsWith("/admin")) return;
    const interval = setInterval(() => {
      const current = readStorageState() || stateRef.current;
      if (!current.isRunning || !current.targetEndTime) {
        return;
      }

      const now = Date.now();
      const remainingSeconds = Math.max(0, Math.round((current.targetEndTime - now) / 1000));
      const totalTime = current.totalTime || 25 * 60;
      const elapsedSeconds = Math.max(0, totalTime - remainingSeconds);

      // --- 1. ACTIVE PRESENCE CHECK ---
      if (current.isFocus) {
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

        // Minimum active presence check interval is 60 seconds (1 minute)
        const intervalSeconds = Math.max(60, Number(activePresenceInterval || 5) * 60);

        // Track focus seconds elapsed since the last confirmed presence check
        const lastCheckElapsed = typeof current.lastPresenceCheckElapsed === "number"
          ? current.lastPresenceCheckElapsed
          : 0;

        // Reset baseline if lastCheckElapsed is ahead of elapsedSeconds (e.g. new session started or reset)
        const validLastCheck = lastCheckElapsed > elapsedSeconds ? 0 : lastCheckElapsed;
        const focusSecondsSinceLastCheck = Math.max(0, elapsedSeconds - validLastCheck);

        // Periodic Elapsed Focus Time Check: triggers strictly when the interval has elapsed (e.g. 60s for 1m test, 300s for 5m)
        const isIntervalReached = focusSecondsSinceLastCheck >= intervalSeconds;

        if (activePresenceEnabled && isIntervalReached) {
          const livePath = getEffectivePath();
          if (isExemptPath(livePath) || isAdmin) {
            // Do not pause on exempt routes; advance check baseline so countdown never hangs
            current.lastPresenceCheckElapsed = elapsedSeconds;
            current.lastPresenceRemaining = remainingSeconds;
            lastActivityRef.current = Date.now();
          } else {
            // Immediately pause timer! It CANNOT continue until user clicks confirm!
            const pausedState = {
              ...current,
              isRunning: false,
              targetEndTime: null,
              timeLeft: remainingSeconds,
              presencePaused: true,
              lastPresenceCheckElapsed: elapsedSeconds,
              lastPresenceRemaining: remainingSeconds,
              lastPresenceElapsed: elapsedSeconds,
            };
            commitStorageState(pausedState, true);
            setShowPresenceModal(true);
            playPresenceChime();
            triggerVibration([300, 150, 300, 150, 400]);
            sendSystemNotification(
              "iFocus Active Presence Check",
              `Timer: ${formatNotificationTime(remainingSeconds)} remaining. Are you still studying? Tap to continue or pause.`,
              "ifocus-presence",
              PRESENCE_NOTIFICATION_ACTIONS
            );
            lastActivityRef.current = Date.now();
            return;
          }
        }

        // --- 1.1 TASK STAGNATION & BURNOUT CHECK (Focus without completed task) ---
        if (!burnoutCheckedThisSessionRef.current) {
          const livePath = getEffectivePath();
          if (!isExemptPath(livePath) && !isAdmin) {
            let burnoutCheckEnabled = true;
            let burnoutCheckMinutes = 20;
            try {
              const rawPrefs = localStorage.getItem("ifocus_timer_preferences");
              if (rawPrefs) {
                const prefs = JSON.parse(rawPrefs);
                if (prefs.burnoutCheckEnabled !== undefined) {
                  burnoutCheckEnabled = Boolean(prefs.burnoutCheckEnabled);
                }
                if (prefs.burnoutCheckMinutes) {
                  burnoutCheckMinutes = Number(prefs.burnoutCheckMinutes);
                }
              }
            } catch (e) {}

            const focusElapsedSecs = Math.max(0, totalTime - remainingSeconds);
            const focusElapsedMins = Math.floor(focusElapsedSecs / 60);

            if (burnoutCheckEnabled && focusElapsedMins >= burnoutCheckMinutes && tasksCompletedInSessionRef.current === 0) {
              burnoutCheckedThisSessionRef.current = true;
              triggerBurnoutCheck(false, burnoutCheckMinutes);
            }
          }
        }
      }

      // --- 2. TIMER FINISHED (remainingSeconds === 0) ---
      if (remainingSeconds <= 0) {
        tasksCompletedInSessionRef.current = 0;
        burnoutCheckedThisSessionRef.current = false;
        playCompletionAlarm();

        // Check if an active deck is set for BreakGate
        let breakGateDeck = null;
        try {
          const stored = localStorage.getItem("ifocus_active_breakgate_deck");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (session?.user?.id && parsed?.userId && parsed.userId !== session.user.id) {
              localStorage.removeItem("ifocus_active_breakgate_deck");
            } else if (parsed && parsed.cards && parsed.cards.length > 0) {
              breakGateDeck = parsed;
            }
          }
        } catch (e) {}

        // Calculate focus duration with Custom timer support
        let focusDuration = 25 * 60;
        if (current.timerPreset === "50/10") focusDuration = 50 * 60;
        else if (current.timerPreset === "15/3") focusDuration = 15 * 60;
        else if (current.timerPreset === "90/20") focusDuration = 90 * 60;
        else if (current.timerPreset === "Custom") {
          if (current.customWorkDuration) focusDuration = current.customWorkDuration;
          else {
            try {
              const customStored = localStorage.getItem("ifocus_custom_timer");
              if (customStored) {
                const parsed = JSON.parse(customStored);
                if (parsed.customWorkDuration) focusDuration = parsed.customWorkDuration;
              }
            } catch(e) {}
          }
        }

        // Calculate break duration with Custom timer support
        let breakDuration = 5 * 60;
        if (current.timerPreset === "50/10") {
          breakDuration = 10 * 60;
        } else if (current.timerPreset === "15/3") {
          breakDuration = 3 * 60;
        } else if (current.timerPreset === "90/20") {
          breakDuration = 20 * 60;
        } else if (current.timerPreset === "Custom") {
          if (current.customBreakDuration) {
            breakDuration = current.customBreakDuration;
          } else {
            try {
              const customStored = localStorage.getItem("ifocus_custom_timer");
              if (customStored) {
                const parsed = JSON.parse(customStored);
                if (parsed.customBreakDuration) breakDuration = parsed.customBreakDuration;
              }
            } catch(e) {}
          }
        }

        // Check if user completed their planned cycle target
        let maxSessions = 4;
        if (current.timerPreset === "Custom") {
          if (current.customSessions) {
            maxSessions = Number(current.customSessions) || 1;
          } else {
            try {
              const customStored = localStorage.getItem("ifocus_custom_timer");
              if (customStored) {
                const parsed = JSON.parse(customStored);
                if (parsed.customSessions) maxSessions = Number(parsed.customSessions) || 1;
              }
            } catch (e) {}
          }
        }
        const currentCount = current.sessionCount || 1;
        const isCycleFinished = currentCount >= maxSessions;

        if (current.isFocus) {
          // Record completed focus session in history & stats
          const focusMins = Math.max(1, Math.round(totalTime / 60));
          try {
            const history = JSON.parse(localStorage.getItem("ifocus_session_history") || "[]");
            history.push({
              date: new Date().toISOString(),
              duration: focusMins,
              type: "pomodoro",
              synced: true,
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
            window.dispatchEvent(new CustomEvent("ifocus_stats_updated"));

            // Cloud Sync to PostgreSQL Database with Offline Queue Resilience (ISO/IEC 25010 Item 8)
            const sessionPayload = {
              duration: focusMins * 60,
              score: 100,
              deckId: breakGateDeck?.id || null,
              createdAt: new Date().toISOString()
            };

            const recordPendingOffline = (payload) => {
              try {
                const pending = JSON.parse(localStorage.getItem('ifocus_pending_study_sessions') || '[]');
                pending.push(payload);
                localStorage.setItem('ifocus_pending_study_sessions', JSON.stringify(pending));
              } catch (e) {}
            };

            if (typeof navigator !== 'undefined' && !navigator.onLine) {
              recordPendingOffline(sessionPayload);
            } else {
              fetch('/api/study-sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionPayload)
              }).catch(() => {
                recordPendingOffline(sessionPayload);
              });
            }
          } catch (e) {
            console.warn("Could not save session stats:", e);
          }

          // If BreakGate is NOT active and this was the final planned session, complete cycle immediately!
          if (!breakGateDeck && isCycleFinished) {
            playCompletionAlarm();
            const completedCycleState = {
              ...current,
              isFocus: true,
              isRunning: false,
              totalTime: focusDuration,
              timeLeft: focusDuration,
              targetEndTime: null,
              lastPresenceElapsed: 0,
              presencePaused: false,
              breakGatePending: false,
              sessionCount: 1,
              customSessions: maxSessions,
              customWorkDuration: focusDuration,
              customBreakDuration: breakDuration,
            };
            commitStorageState(completedCycleState, true);
            setCompletedCycleDetails({
              sessionsCompleted: currentCount,
              timerPreset: current.timerPreset,
              wasCustom: current.timerPreset === "Custom"
            });
            setShowCycleCompleteModal(true);
            window.dispatchEvent(new CustomEvent("ifocus_cycle_completed", { detail: { sessionsCompleted: currentCount } }));
            return;
          }

          if (breakGateDeck) {
            // Intercept break with retrieval challenge modal!
            const breakGateState = {
              ...current,
              isFocus: false,
              isRunning: false,
              totalTime: breakDuration,
              timeLeft: breakDuration,
              targetEndTime: null,
              lastPresenceElapsed: 0,
              presencePaused: false,
              breakGatePending: true,
              sessionCount: currentCount,
              customSessions: maxSessions,
              customWorkDuration: focusDuration,
              customBreakDuration: breakDuration,
            };
            commitStorageState(breakGateState, true);
            setActiveBreakGateDeck(breakGateDeck);
            setShowBreakGateModal(true);
            window.dispatchEvent(new CustomEvent("ifocus_breakgate_trigger", { detail: breakGateDeck }));
            return;
          }

          // Check if Post-Session Reflection Prompts enabled
          let reflectionPromptEnabled = true;
          try {
            const rawSound = localStorage.getItem("ifocus_sound_preferences");
            if (rawSound) {
              const parsed = JSON.parse(rawSound);
              if (parsed.dailyReminder !== undefined) {
                reflectionPromptEnabled = parsed.dailyReminder;
              }
            }
          } catch (e) {}

          if (reflectionPromptEnabled) {
            setIsTestReflectionModal(false);
            setShowReflectionModal(true);
          }

          // Check Auto-Start Break preference
          let autoStartBreaksPref = true;
          try {
            const rawTimerPrefs = localStorage.getItem("ifocus_timer_preferences");
            if (rawTimerPrefs) {
              const tPrefs = JSON.parse(rawTimerPrefs);
              if (tPrefs.autoStartBreaks !== undefined) autoStartBreaksPref = tPrefs.autoStartBreaks;
            }
          } catch (e) {}

          // Transition to Break mode
          playCompletionAlarm();
          triggerVibration([250, 100, 250]);
          sendSystemNotification("Focus Session Complete", "Great job! Time for your scheduled break.");
          const nextBreakState = {
            ...current,
            isFocus: false,
            isRunning: autoStartBreaksPref,
            totalTime: breakDuration,
            timeLeft: breakDuration,
            targetEndTime: autoStartBreaksPref ? Date.now() + breakDuration * 1000 : null,
            lastPresenceElapsed: 0,
            presencePaused: false,
            breakGatePending: false,
            sessionCount: currentCount,
            customSessions: maxSessions,
            customWorkDuration: focusDuration,
            customBreakDuration: breakDuration,
          };
          commitStorageState(nextBreakState, true);
          return;
        } else {
          // Break finished -> Switch to next focus session with Custom timer support
          const isPreSessionRest = Boolean(current.isAiRestRecovery);
          const nextCount = isPreSessionRest ? currentCount : currentCount + 1;
          const isBreakCycleFinished = nextCount > maxSessions;

          if (isPreSessionRest) {
            try {
              localStorage.setItem("ifocus_recovery_completed", String(Date.now()));
              localStorage.setItem("ifocus_cognitive_reset", String(Date.now()));
              localStorage.removeItem("ifocus_ai_rest_recovery");
              localStorage.removeItem("ifocus_latest_telemetry");
              localStorage.removeItem("ifocus_active_idle_alert");
              const uName = session?.user?.name || session?.user?.username || (typeof window !== 'undefined' ? localStorage.getItem('ifocus_user_name') : '') || 'Student';
              localStorage.removeItem(`ifocus_telemetry_insight_${uName}`);
              localStorage.removeItem('ifocus_telemetry_insight_anonymous');

              // Sync completed restorative break to cloud database
              fetch("/api/user/telemetry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  telemetryState: {
                    latestTelemetry: null,
                    activeIdleAlert: null,
                    recoveryCompleted: Date.now(),
                    cognitiveReset: Date.now(),
                    updatedAt: new Date().toISOString()
                  }
                })
              }).catch(() => {});
            } catch (e) {}
            window.dispatchEvent(new CustomEvent("ifocus_telemetry_updated"));
          }

          if (isBreakCycleFinished) {
            playCompletionAlarm();
            // Entire cycle completed! Reset back to Session 1 and pause timer (no continuous run)
            const completedCycleState = {
              ...current,
              isFocus: true,
              isRunning: false,
              totalTime: focusDuration,
              timeLeft: focusDuration,
              targetEndTime: null,
              lastPresenceElapsed: 0,
              presencePaused: false,
              breakGatePending: false,
              sessionCount: 1,
              customSessions: maxSessions,
              customWorkDuration: focusDuration,
              customBreakDuration: breakDuration,
            };
            commitStorageState(completedCycleState, true);
            setCompletedCycleDetails({
              sessionsCompleted: maxSessions,
              timerPreset: current.timerPreset,
              wasCustom: current.timerPreset === "Custom"
            });
            setShowCycleCompleteModal(true);
            window.dispatchEvent(new CustomEvent("ifocus_cycle_completed", { detail: { sessionsCompleted: maxSessions } }));
            return;
          }

          let autoStartFocusPref = false;
          try {
            const rawTimerPrefs = localStorage.getItem("ifocus_timer_preferences");
            if (rawTimerPrefs) {
              const tPrefs = JSON.parse(rawTimerPrefs);
              if (tPrefs.autoStartFocus !== undefined) autoStartFocusPref = tPrefs.autoStartFocus;
            }
          } catch (e) {}

          try {
            localStorage.removeItem("ifocus_ai_rest_recovery");
          } catch (e) {}

          playCompletionAlarm();
          triggerVibration([300, 150, 300]);
          sendSystemNotification("Break Complete", `Your break has ended. Ready to continue Session ${nextCount}?`);
          try {
            localStorage.setItem("ifocus_applied_toast", JSON.stringify({
              title: `Break Finished • Next: Session ${nextCount}`,
              message: `Your break is complete. Tap Start to continue Session ${nextCount}.`
            }));
          } catch (e) {}

          const nextFocusState = {
            ...current,
            isFocus: true,
            isRunning: autoStartFocusPref,
            totalTime: focusDuration,
            timeLeft: focusDuration,
            targetEndTime: autoStartFocusPref ? Date.now() + focusDuration * 1000 : null,
            lastPresenceElapsed: 0,
            presencePaused: false,
            breakGatePending: false,
            sessionCount: nextCount,
            customSessions: maxSessions,
            customWorkDuration: focusDuration,
            customBreakDuration: breakDuration,
          };
          commitStorageState(nextFocusState, true);
          return;
        }
      }

      // --- 3. NORMAL 1-SECOND TICK ---
      const updatedState = {
        ...current,
        timeLeft: remainingSeconds,
        lastPresenceCheckElapsed: typeof current.lastPresenceCheckElapsed === "number" ? current.lastPresenceCheckElapsed : 0,
        lastPresenceRemaining: remainingSeconds,
      };
      
      // Update both React state and localStorage on tick for 100% continuous persistence
      setTimerState(updatedState);
      try {
        localStorage.setItem("ifocus_timer_state", JSON.stringify(updatedState));
      } catch (e) {}

      window.dispatchEvent(
        new CustomEvent("ifocus_timer_tick", {
          detail: {
            timeLeft: remainingSeconds,
            isRunning: true,
            isFocus: current.isFocus,
            totalTime: current.totalTime,
            isAiRestRecovery: Boolean(current.isAiRestRecovery),
          },
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [readStorageState, commitStorageState, getEffectivePath, isAdmin]);

  // Handle Active Presence Confirmation
  const handleConfirmPresence = () => {
    setShowPresenceModal(false);
    if (isTestPresenceModal) {
      setIsTestPresenceModal(false);
      return; // Do NOT touch or resume timer if this was just a preview test!
    }
    lastActivityRef.current = Date.now();
    const current = readStorageState() || timerState;
    const remaining = current.timeLeft !== undefined ? current.timeLeft : 25 * 60;
    const total = current.totalTime || 25 * 60;
    const currentElapsed = Math.max(0, total - remaining);

    const resumedState = {
      ...current,
      isRunning: true,
      presencePaused: false,
      timeLeft: remaining,
      targetEndTime: Date.now() + remaining * 1000,
      lastPresenceRemaining: remaining,
      lastPresenceCheckElapsed: currentElapsed,
      lastPresenceElapsed: currentElapsed,
    };
    commitStorageState(resumedState, true);
  };

  const handleKeepPaused = () => {
    setShowPresenceModal(false);
    if (isTestPresenceModal) {
      setIsTestPresenceModal(false);
      return; // Do NOT pause the real timer if this was just a preview test!
    }
    const current = readStorageState() || timerState;
    const remaining = current.timeLeft !== undefined ? current.timeLeft : 25 * 60;
    const total = current.totalTime || 25 * 60;
    const currentElapsed = Math.max(0, total - remaining);
    const pausedState = {
      ...current,
      isRunning: false,
      presencePaused: false,
      targetEndTime: null,
      timeLeft: remaining,
      lastPresenceCheckElapsed: currentElapsed,
      lastPresenceRemaining: remaining,
      lastPresenceElapsed: currentElapsed,
    };
    commitStorageState(pausedState, true);
  };

  // Handle Service Worker Notification Action Messages (e.g., "I am still here")
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const handleSwMessage = (e) => {
      if (e.data?.type === "IFOCUS_RESUME_PRESENCE") {
        handleConfirmPresence();
      } else if (e.data?.type === "IFOCUS_PAUSE_PRESENCE") {
        handleKeepPaused();
      }
    };
    navigator.serviceWorker.addEventListener("message", handleSwMessage);

    // Check query params if opened from notification click
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("resumePresence") === "1") {
        handleConfirmPresence();
        url.searchParams.delete("resumePresence");
        window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      }
    } catch (e) {}

    return () => {
      navigator.serviceWorker.removeEventListener("message", handleSwMessage);
    };
  }, []);

  // Handle BreakGate Completion
  const handleBreakGateComplete = () => {
    setShowBreakGateModal(false);
    const current = readStorageState() || timerState;

    let maxSessions = 4;
    let focusDuration = 25 * 60;
    let breakDuration = 5 * 60;

    if (current.timerPreset === "50/10") {
      focusDuration = 50 * 60;
      breakDuration = 10 * 60;
    } else if (current.timerPreset === "15/3") {
      focusDuration = 15 * 60;
      breakDuration = 3 * 60;
    } else if (current.timerPreset === "90/20") {
      focusDuration = 90 * 60;
      breakDuration = 20 * 60;
    } else if (current.timerPreset === "Custom") {
      if (current.customSessions) maxSessions = Number(current.customSessions) || 1;
      if (current.customWorkDuration) focusDuration = current.customWorkDuration;
      if (current.customBreakDuration) breakDuration = current.customBreakDuration;

      try {
        const customStored = localStorage.getItem("ifocus_custom_timer");
        if (customStored) {
          const parsed = JSON.parse(customStored);
          if (parsed.customSessions && !current.customSessions) maxSessions = Number(parsed.customSessions) || 1;
          if (parsed.customWorkDuration && !current.customWorkDuration) focusDuration = parsed.customWorkDuration;
          if (parsed.customBreakDuration && !current.customBreakDuration) breakDuration = parsed.customBreakDuration;
        }
      } catch (e) {}
    }
    if (!breakDuration) breakDuration = 5 * 60;

    const currentCount = current.sessionCount || 1;
    if (currentCount >= maxSessions) {
      playCompletionAlarm();
      const completedCycleState = {
        ...current,
        isFocus: true,
        isRunning: false,
        totalTime: focusDuration,
        timeLeft: focusDuration,
        targetEndTime: null,
        lastPresenceElapsed: 0,
        presencePaused: false,
        breakGatePending: false,
        sessionCount: 1,
        customSessions: maxSessions,
        customWorkDuration: focusDuration,
        customBreakDuration: breakDuration,
      };
      commitStorageState(completedCycleState, true);
      setCompletedCycleDetails({
        sessionsCompleted: currentCount,
        timerPreset: current.timerPreset,
        wasCustom: current.timerPreset === "Custom"
      });
      setShowCycleCompleteModal(true);
      window.dispatchEvent(new CustomEvent("ifocus_cycle_completed", { detail: { sessionsCompleted: currentCount } }));
      return;
    }

    let reflectionPromptEnabled = true;
    try {
      const rawSound = localStorage.getItem("ifocus_sound_preferences");
      if (rawSound) {
        const parsed = JSON.parse(rawSound);
        if (parsed.dailyReminder !== undefined) {
          reflectionPromptEnabled = parsed.dailyReminder;
        }
      }
    } catch (e) {}

    if (reflectionPromptEnabled) {
      setIsTestReflectionModal(false);
      setShowReflectionModal(true);
    }

    let autoStartBreaksPref = true;
    try {
      const rawTimerPrefs = localStorage.getItem("ifocus_timer_preferences");
      if (rawTimerPrefs) {
        const tPrefs = JSON.parse(rawTimerPrefs);
        if (tPrefs.autoStartBreaks !== undefined) autoStartBreaksPref = tPrefs.autoStartBreaks;
      }
    } catch (e) {}

    const breakState = {
      ...current,
      isFocus: false,
      isRunning: autoStartBreaksPref,
      timeLeft: breakDuration,
      totalTime: breakDuration,
      targetEndTime: autoStartBreaksPref ? Date.now() + breakDuration * 1000 : null,
      breakGatePending: false,
      presencePaused: false,
      lastPresenceElapsed: 0,
      sessionCount: currentCount,
      customSessions: maxSessions,
      customWorkDuration: focusDuration,
      customBreakDuration: breakDuration,
    };
    commitStorageState(breakState, true);
  };

  const handleBreakGateSkip = () => {
    handleBreakGateComplete();
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
      const remaining = current.timeLeft !== undefined ? current.timeLeft : 25 * 60;
      const resumed = {
        ...current,
        isRunning: true,
        presencePaused: false,
        timeLeft: remaining,
        targetEndTime: Date.now() + remaining * 1000,
      };
      commitStorageState(resumed, true);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const isDashboard = pathname === "/dashboard" || pathname?.startsWith("/dashboard");

  // Floating mini-timer strictly appears ONLY on desktop/tablet viewports (> 768px)
  // when navigating away from the dashboard. On mobile screens (<= 768px), navigation
  // to the timer is cleanly provided by the elevated center Timer button on the bottom nav bar.
  const showFloatingMiniTimer =
    !isMobileScreen &&
    !isDashboard &&
    (timerState.isRunning || timerState.presencePaused || timerState.breakGatePending);

  const isWarning = timerState.breakGatePending || timerState.presencePaused;
  const statusColor = isWarning
    ? "#d97706"
    : timerState.isFocus
    ? "#16a34a"
    : "#0284c7";
  const statusGlow = isWarning
    ? "rgba(217, 119, 6, 0.45)"
    : timerState.isFocus
    ? "rgba(22, 163, 74, 0.42)"
    : "rgba(2, 132, 199, 0.42)";

  const statusLabel = timerState.breakGatePending
    ? "BreakGate Ready"
    : timerState.presencePaused
    ? "Presence Paused"
    : timerState.isFocus
    ? "Focus Session"
    : "Break Time";

  const pillAnimation = isDraggingMiniTimer
    ? "none"
    : timerState.isRunning
    ? timerState.isFocus
      ? "ifocusPillPulseRunning 2.4s ease-in-out infinite"
      : "ifocusPillPulseBreak 2.4s ease-in-out infinite"
    : isWarning
    ? "ifocusPillPulseWarning 2s ease-in-out infinite"
    : "none";

  const liveRenderPath = getEffectivePath();
  if (isExemptPath(liveRenderPath) || isAdmin) {
    return null;
  }

  return (
    <>
      {/* Floating Mini-Timer Pill (Movable, Frosted White & Glowing Live Forest Green Design) */}
      <style>{`
        
        @keyframes ifocusSlideInFromRight {
          0% {
            transform: translate3d(160px, 0, 0);
            opacity: 0;
          }
          55% {
            opacity: 1;
          }
          80% {
            transform: translate3d(-10px, 0, 0);
          }
          100% {
            transform: translate3d(0, 0, 0);
            opacity: 1;
          }
        }

        @keyframes ifocusPillPulseRunning {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45), 0 10px 28px -4px rgba(22, 101, 52, 0.24);
            border-color: rgba(34, 197, 94, 0.45);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(34, 197, 94, 0.18), 0 14px 34px -4px rgba(22, 101, 52, 0.38), 0 0 20px rgba(34, 197, 94, 0.3);
            border-color: rgba(34, 197, 94, 0.9);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.45), 0 10px 28px -4px rgba(22, 101, 52, 0.24);
            border-color: rgba(34, 197, 94, 0.45);
          }
        }

        @keyframes ifocusPillPulseBreak {
          0% {
            box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.45), 0 10px 28px -4px rgba(2, 132, 199, 0.24);
            border-color: rgba(2, 132, 199, 0.45);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(2, 132, 199, 0.18), 0 14px 34px -4px rgba(2, 132, 199, 0.38), 0 0 20px rgba(2, 132, 199, 0.3);
            border-color: rgba(2, 132, 199, 0.9);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.45), 0 10px 28px -4px rgba(2, 132, 199, 0.24);
            border-color: rgba(2, 132, 199, 0.45);
          }
        }

        @keyframes ifocusPillPulseWarning {
          0% {
            box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.45), 0 10px 28px -4px rgba(217, 119, 6, 0.24);
            border-color: rgba(217, 119, 6, 0.45);
          }
          50% {
            box-shadow: 0 0 0 6px rgba(217, 119, 6, 0.2), 0 14px 34px -4px rgba(217, 119, 6, 0.4), 0 0 18px rgba(217, 119, 6, 0.32);
            border-color: rgba(217, 119, 6, 0.9);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(217, 119, 6, 0.45), 0 10px 28px -4px rgba(217, 119, 6, 0.24);
            border-color: rgba(217, 119, 6, 0.45);
          }
        }

        @keyframes ifocusRadarWave {
          0% {
            transform: scale(0.9);
            opacity: 0.95;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }

        @keyframes ifocusColonBlink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.15;
          }
        }

        @keyframes ifocusWaveBar1 {
          0%, 100% { height: 4px; }
          50% { height: 13px; }
        }

        @keyframes ifocusWaveBar2 {
          0%, 100% { height: 12px; }
          50% { height: 4px; }
        }

        @keyframes ifocusWaveBar3 {
          0%, 100% { height: 7px; }
          50% { height: 14px; }
        }
      `}</style>

      {/* Persistent Ambient Soundscape Audio Engine - Always mounted across all routes */}
      <audio
        ref={globalAudioRef}
        loop
        preload="auto"
        src={getTrackSrc(musicState.currentTrack || 'Chill Lofi')}
      />

      {showFloatingMiniTimer && (
        <div
          ref={miniTimerRef}
          id="globalMiniTimerPill"
          onMouseDown={handleMiniTimerMouseDown}
          onTouchStart={handleMiniTimerTouchStart}
          onClick={handleMiniTimerClick}
          style={{
            position: "fixed",
            left: miniTimerPos.x !== null ? `${miniTimerPos.x}px` : "auto",
            top: miniTimerPos.y !== null ? `${miniTimerPos.y}px` : "auto",
            bottom: miniTimerPos.y === null ? "calc(75px + env(safe-area-inset-bottom, 24px))" : "auto",
            right: miniTimerPos.x === null ? "16px" : "auto",
            zIndex: 9998,
            display: "flex",
            alignItems: "center",
            gap: "0.65rem",
            padding: "0 0.95rem 0 0.75rem",
            height: "46px",
            maxHeight: "46px",
            maxWidth: "250px",
            width: "fit-content",
            boxSizing: "border-box",
            overflow: "hidden",
            whiteSpace: "nowrap",
            background: "rgba(255, 255, 255, 0.96)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: `1.5px solid ${timerState.isRunning ? statusColor : "rgba(46, 125, 50, 0.22)"}`,
            borderRadius: "9999px",
            boxShadow: isDraggingMiniTimer
              ? "0 22px 42px -6px rgba(27, 67, 50, 0.32), 0 0 0 2px rgba(46, 125, 50, 0.4)"
              : timerState.isRunning
              ? `0 10px 30px -4px ${statusGlow}, 0 4px 12px rgba(0, 0, 0, 0.05)`
              : "0 12px 32px -6px rgba(27, 67, 50, 0.16), 0 4px 12px rgba(0, 0, 0, 0.05)",
            cursor: isDraggingMiniTimer ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
            animation: isDraggingMiniTimer ? "none" : isNavSliding ? "ifocusSlideInFromRight 0.55s cubic-bezier(0.16, 1, 0.3, 1) both" : pillAnimation,
            transition: isDraggingMiniTimer
              ? "none"
              : "box-shadow 0.25s ease, border-color 0.25s ease, transform 0.2s ease",
          }}
          title="Drag to reposition • Click to view Focus Timer"
        >
          {/* Subtle Drag Grip Handle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(46, 125, 50, 0.45)",
              padding: "2px 0 2px 2px",
              cursor: isDraggingMiniTimer ? "grabbing" : "grab",
            }}
            title="Drag handle"
          >
            <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
              <circle cx="2" cy="2" r="1.5" />
              <circle cx="8" cy="2" r="1.5" />
              <circle cx="2" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="2" cy="14" r="1.5" />
              <circle cx="8" cy="14" r="1.5" />
            </svg>
          </div>

          {/* Status Indicator Dot with Dual Radar Pulse */}
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "16px",
              height: "16px",
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: statusColor,
                boxShadow: timerState.isRunning ? `0 0 8px ${statusColor}` : "none",
                zIndex: 2,
                transition: "background 0.25s ease, box-shadow 0.25s ease",
              }}
            />
            {timerState.isRunning && (
              <>
                <span
                  style={{
                    position: "absolute",
                    inset: "-2px",
                    borderRadius: "50%",
                    border: `2px solid ${statusColor}`,
                    animation: "ifocusRadarWave 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    inset: "-2px",
                    borderRadius: "50%",
                    border: `2px solid ${statusColor}`,
                    animation: "ifocusRadarWave 2s cubic-bezier(0, 0, 0.2, 1) infinite 1s",
                    zIndex: 1,
                    pointerEvents: "none",
                  }}
                />
    </>
            )}
          </div>

          {/* Time & Session Label */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  fontSize: "0.62rem",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  color: statusColor,
                  lineHeight: 1.1,
                  transition: "color 0.25s ease",
                }}
              >
                {statusLabel}
              </span>

              {/* Dynamic Live Equalizer Wave: ONLY when music is playing! */}
              {musicState.isPlaying ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    height: "12px",
                    padding: "0 2px",
                  }}
                  title={`Music playing: ${musicState.currentTrack}`}
                >
                  <span
                    style={{
                      width: "2px",
                      height: "6px",
                      background: statusColor,
                      borderRadius: "2px",
                      animation: "ifocusWaveBar1 1.1s ease-in-out infinite",
                    }}
                  />
                  <span
                    style={{
                      width: "2px",
                      height: "12px",
                      background: statusColor,
                      borderRadius: "2px",
                      animation: "ifocusWaveBar2 0.85s ease-in-out infinite",
                    }}
                  />
                  <span
                    style={{
                      width: "2px",
                      height: "8px",
                      background: statusColor,
                      borderRadius: "2px",
                      animation: "ifocusWaveBar3 1.25s ease-in-out infinite",
                    }}
                  />
                </div>
              ) : timerState.presencePaused ? (
                <span
                  style={{
                    fontSize: "0.55rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    padding: "1px 5px",
                    borderRadius: "9999px",
                    background: "rgba(217, 119, 6, 0.15)",
                    color: "#d97706",
                  }}
                >
                  PAUSED
                </span>
              ) : null}
            </div>

            {/* Time digits with live pulsing colon */}
            <span
              style={{
                fontSize: "1.2rem",
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "#163824",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "'Outfit', 'Inter', -apple-system, monospace",
                lineHeight: 1.15,
                display: "inline-flex",
                alignItems: "baseline",
              }}
            >
              {(() => {
                const formatted = formatTime(timerState.timeLeft || 0);
                const [mins, secs] = formatted.split(":");
                return (
                  <>
                    <span>{mins}</span>
                    <span
                      style={{
                        display: "inline-block",
                        margin: "0 1px",
                        animation: timerState.isRunning
                          ? "ifocusColonBlink 1s ease-in-out infinite"
                          : "none",
                        color: timerState.isRunning ? statusColor : "#163824",
                        fontWeight: 900,
                      }}
                    >
                      :
                    </span>
                    <span>{secs}</span>
                  </>
                );
              })()}
            </span>
          </div>

          {/* Play / Pause Toggle Button */}
          {!timerState.breakGatePending && (
            <button
              type="button"
              onClick={toggleMiniTimerPlay}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                border: `1px solid ${timerState.isRunning ? "rgba(22, 163, 74, 0.25)" : "rgba(217, 119, 6, 0.25)"}`,
                background: timerState.isRunning ? "rgba(22, 163, 74, 0.08)" : "rgba(217, 119, 6, 0.08)",
                color: timerState.isRunning ? "#1e6f3d" : "#d97706",
                cursor: "pointer",
                transition: "all 0.15s ease",
                marginLeft: "2px",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = timerState.isRunning
                  ? "rgba(22, 163, 74, 0.18)"
                  : "rgba(217, 119, 6, 0.18)";
                e.currentTarget.style.transform = "scale(1.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = timerState.isRunning
                  ? "rgba(22, 163, 74, 0.08)"
                  : "rgba(217, 119, 6, 0.08)";
                e.currentTarget.style.transform = "scale(1)";
              }}
              title={timerState.isRunning ? "Pause Session" : "Resume Session"}
            >
              {timerState.isRunning ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1.5" />
                  <rect x="14" y="4" width="4" height="16" rx="1.5" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: "1.5px" }}>
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              )}
            </button>
          )}

          {/* Jump Arrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(46, 125, 50, 0.65)",
              padding: "2px",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </div>
        </div>
      )}

      {/* Global Active Presence Check Modal (100% Emoji-Free) */}
      {showPresenceModal && (
        <div
          id="globalActivePresenceModal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
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
            {/* Visual Icon */}
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
                background: isTestPresenceModal ? "rgba(59, 130, 246, 0.12)" : "rgba(245, 158, 11, 0.12)",
                color: isTestPresenceModal ? "#1d4ed8" : "#b45309",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isTestPresenceModal ? "#2563eb" : "#d97706" }} />
              {isTestPresenceModal ? "Test Preview Modal" : "Active Presence Check"}
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
                {isTestPresenceModal ? "Test Presence Popup" : "Are you still there?"}
              </h3>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary, #64748b)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {isTestPresenceModal
                  ? "This is a test preview of how the Active Presence check appears. Testing will NOT pause or affect your active timer."
                  : "The timer won't run if you aren't there! We paused your Pomodoro session to keep your focus stats accurate. Click Continue to resume your session."}
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
                Stay Paused
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Idle AFK Coach Intervention Toast (iOS Spring Toast Style - 100% Emoji-Free) */}
      {showIdleCoachModal && !isExemptPath(getEffectivePath()) && session?.user && (
        <div className="ios-notification-toast" style={{ zIndex: 99999 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(78, 130, 83, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-accent)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {isTestIdleCoachModal ? "Coach has noticed something (AFK Test)" : "Coach has noticed something"}
              </h4>
            </div>
            <button
              onClick={() => {
                setShowIdleCoachModal(false);
                lastActivityRef.current = Date.now();
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.95rem', padding: '2px', display: 'flex', alignItems: 'center' }}
              aria-label="Close notification"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: '1.45' }}>
            You have been idle for {idleModalMinutes} {idleModalMinutes === 1 ? 'minute' : 'minutes'} with no timer running. Feeling stuck or experiencing task friction? Let us get back on track.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              onClick={() => {
                setShowIdleCoachModal(false);
                lastActivityRef.current = Date.now();

                const userName = session?.user?.name || session?.user?.username || (typeof window !== 'undefined' ? localStorage.getItem('ifocus_user_name') : '') || 'Student';
                const minText = `${idleModalMinutes} ${idleModalMinutes === 1 ? 'minute' : 'minutes'}`;
                const insightData = {
                  type: 'idle',
                  state: 'idle',
                  sentiment: 'Inactivity & Task Friction',
                  idleMinutes: idleModalMinutes,
                  timestamp: new Date().toISOString(),
                  reason: `Inactivity detected: You have been idle for ${minText} with no active timer. Student appears stuck, hesitant, or experiencing task friction.`,
                  actionPlan: `You have been idle for ${minText} without starting a focus session. Feeling stuck on where to begin? Break your upcoming task into just one simple step, or start a gentle 15m focus session to build momentum.`,
                  metrics: { dwellTime: 0, flightTime: 0, errorRate: 0 }
                };

                try {
                  localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(insightData));
                  localStorage.setItem('ifocus_telemetry_insight_anonymous', JSON.stringify(insightData));
                  localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(insightData));
                  localStorage.setItem('ifocus_active_idle_alert', JSON.stringify(insightData));
                  window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated', { detail: insightData }));
                } catch (e) {}

                if (pathname !== "/coach") {
                  router.push("/coach");
                }
              }}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem', borderRadius: '9999px', margin: 0, height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
            >
              View Coach Strategy
            </button>
            <button
              onClick={() => {
                setShowIdleCoachModal(false);
                lastActivityRef.current = Date.now();
              }}
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '9999px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', height: '36px' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Global Task Stagnation & Burnout Check Modal (100% Emoji-Free) */}
      {showBurnoutModal && (
        <div
          id="globalBurnoutCheckModal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
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
              border: "1.5px solid rgba(217, 119, 6, 0.3)",
              borderRadius: "24px",
              padding: "2rem 2.2rem",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.15rem",
            }}
          >
            {/* Visual Icon */}
            <div
              style={{
                width: "58px",
                height: "58px",
                borderRadius: "50%",
                background: "rgba(217, 119, 6, 0.12)",
                border: "1px solid rgba(217, 119, 6, 0.28)",
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
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>

            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "0.3rem 0.85rem",
                borderRadius: "9999px",
                background: isTestBurnoutModal ? "rgba(59, 130, 246, 0.12)" : "rgba(217, 119, 6, 0.12)",
                color: isTestBurnoutModal ? "#1d4ed8" : "#b45309",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: isTestBurnoutModal ? "#2563eb" : "#d97706", boxShadow: "0 0 8px rgba(217, 119, 6, 0.6)" }} />
              {isTestBurnoutModal ? "Burnout Test Preview" : "AI Study Coach Check-in"}
            </div>

            {/* Title & Body */}
            <div>
              <h3
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 800,
                  color: "var(--text-primary)",
                  margin: "0 0 0.5rem 0",
                  letterSpacing: "-0.02em",
                }}
              >
                Taking a while on this focus block?
              </h3>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary)",
                  lineHeight: "1.55",
                  margin: 0,
                }}
              >
                You have been focusing for {burnoutModalMinutes} minutes without completing a task from your list. If you are experiencing task friction or feeling stuck, consider breaking your task into smaller steps or taking a brief mental pause.
              </p>
            </div>

            {/* Action Buttons (Go to Pomodoro Timer & Dismiss only) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.65rem",
                width: "100%",
                marginTop: "0.4rem",
              }}
            >
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  setShowBurnoutModal(false);
                  if (pathname !== "/dashboard") {
                    router.push("/dashboard");
                  }
                }}
                style={{
                  width: "100%",
                  padding: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem",
                  fontSize: "0.92rem",
                  fontWeight: 700,
                  borderRadius: "12px",
                  margin: 0,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>Go to Pomodoro Timer</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowBurnoutModal(false);
                }}
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  fontSize: "0.86rem",
                  fontWeight: 600,
                  borderRadius: "12px",
                  background: "rgba(0, 0, 0, 0.04)",
                  border: "1px solid rgba(0, 0, 0, 0.08)",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  margin: 0,
                  transition: "background 0.15s ease",
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Post-Session Reflection Prompt Modal (100% Emoji-Free) */}
      {showReflectionModal && (
        <div
          id="globalReflectionPromptModal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
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
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.2rem",
            }}
          >
            {/* Visual Icon */}
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "rgba(16, 185, 129, 0.12)",
                border: "1px solid rgba(16, 185, 129, 0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#059669",
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
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
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
                background: isTestReflectionModal ? "rgba(59, 130, 246, 0.12)" : "rgba(16, 185, 129, 0.12)",
                color: isTestReflectionModal ? "#1d4ed8" : "#065f46",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.6px",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isTestReflectionModal ? "#2563eb" : "#059669" }} />
              {isTestReflectionModal ? "Test Preview Modal" : "Session Completed"}
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
                {isTestReflectionModal ? "Post-Session Reflection Preview" : "How was your focus session?"}
              </h3>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary, #64748b)",
                  margin: 0,
                  lineHeight: 1.55,
                }}
              >
                {isTestReflectionModal
                  ? "This is a preview of the prompt that appears after each focus cycle. Logging 15 seconds helps the AI Coach personalize your study plan."
                  : "Great work! Logging a quick reflection helps the AI Coach adjust your focus intervals, detect cognitive fatigue, and tune your flashcard reviews."}
              </p>
            </div>

            {/* Quick Mood Starters */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", justifyContent: "center", width: "100%" }}>
              {[
                { label: "Focused & Steady", text: "I felt focused and maintained a steady rhythm throughout this session." },
                { label: "A Bit Fatigued", text: "I started feeling tired towards the end and need a lighter task next." },
                { label: "Distracted / Stressed", text: "I felt distracted and found it hard to stay on track." }
              ].map((starter) => (
                <button
                  key={starter.label}
                  type="button"
                  onClick={() => {
                    setShowReflectionModal(false);
                    try {
                      localStorage.setItem('ifocus_prefill_reflection', starter.text);
                      let moodState = "Flow";
                      let fatigueLevel = "Low";
                      let errorRate = 0;
                      let backspaces = 0;
                      if (starter.label.includes("Stressed") || starter.label.includes("Distracted")) {
                        moodState = "Stressed";
                        fatigueLevel = "High";
                        errorRate = 45;
                        backspaces = 12;
                      } else if (starter.label.includes("Fatigued")) {
                        moodState = "Fatigued";
                        fatigueLevel = "Elevated";
                        errorRate = 25;
                        backspaces = 5;
                      }
                      const telem = {
                        state: moodState,
                        fatigueLevel: fatigueLevel,
                        sentiment: starter.label,
                        reason: starter.text,
                        errorRate: errorRate,
                        backspaces: backspaces,
                        source: 'post_session_mood_starter',
                        timestamp: new Date().toISOString()
                      };
                      localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(telem));
                      window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated', { detail: telem }));
                    } catch (e) {}
                    if (pathname === '/dashboard') {
                      window.dispatchEvent(new CustomEvent('ifocus_apply_prefill_reflection', { detail: starter.text }));
                      const card = document.getElementById('quick-reflection-card');
                      if (card) card.scrollIntoView({ behavior: 'smooth' });
                    } else {
                      router.push('/dashboard#reflection');
                    }
                  }}
                  style={{
                    background: "var(--bg-secondary, #f8fafc)",
                    border: "1px solid var(--border-color, rgba(226, 232, 240, 0.8))",
                    borderRadius: "9999px",
                    padding: "0.35rem 0.8rem",
                    fontSize: "0.78rem",
                    color: "var(--text-primary, #334155)",
                    cursor: "pointer",
                    fontWeight: 500,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#059669";
                    e.currentTarget.style.color = "#059669";
                    e.currentTarget.style.background = "rgba(16, 185, 129, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color, rgba(226, 232, 240, 0.8))";
                    e.currentTarget.style.color = "var(--text-primary, #334155)";
                    e.currentTarget.style.background = "var(--bg-secondary, #f8fafc)";
                  }}
                >
                  {starter.label}
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", width: "100%", marginTop: "0.3rem" }}>
              <button
                type="button"
                id="dismissReflectionPromptBtn"
                onClick={() => setShowReflectionModal(false)}
                style={{
                  width: "100%",
                  padding: "0.85rem 1.4rem",
                  background: "var(--bg-secondary, #f1f5f9)",
                  color: "var(--text-primary, #334155)",
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
                Skip for Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Session Cycle Completed Notification Modal */}
      {showCycleCompleteModal && (
        <div
          id="globalCycleCompletedModal"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.75)",
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
              padding: "2.2rem 2.4rem",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.35)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.2rem",
            }}
          >
            {/* Visual Icon (Award / Checkmark) */}
            <div
              style={{
                width: "60px",
                height: "60px",
                borderRadius: "50%",
                background: "rgba(34, 197, 94, 0.12)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#16a34a",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>

            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "0.3rem 0.85rem",
                borderRadius: "9999px",
                background: "rgba(34, 197, 94, 0.12)",
                color: "#15803d",
                fontSize: "0.78rem",
                fontWeight: 700,
                letterSpacing: "0.5px",
                textTransform: "uppercase",
              }}
            >
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }} />
              Session Goal Completed
            </div>

            {/* Title & Body */}
            <div>
              <h3
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 800,
                  color: "var(--text-primary, #0f172a)",
                  margin: "0 0 0.5rem 0",
                  letterSpacing: "-0.02em",
                }}
              >
                All Planned Sessions Finished!
              </h3>
              <p
                style={{
                  fontSize: "0.92rem",
                  color: "var(--text-secondary, #64748b)",
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                You completed {completedCycleDetails.sessionsCompleted} scheduled {completedCycleDetails.sessionsCompleted === 1 ? 'focus session' : 'focus sessions'}. 
                {completedCycleDetails.wasCustom
                  ? " Would you like to return to the standard 25m Focus / 5m Rest rhythm, or keep your custom settings?"
                  : " Great job staying focused! Your timer has paused and reset to Session 1."}
              </p>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", width: "100%", marginTop: "0.4rem" }}>
              {completedCycleDetails.wasCustom ? (
                <>
                  <button
                    type="button"
                    onClick={handleReturnToDefaultPreset}
                    style={{
                      width: "100%",
                      padding: "0.85rem 1.4rem",
                      background: "#163824",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "12px",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(22, 56, 36, 0.28)",
                      transition: "opacity 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                  >
                    Return to 25/5 Default Rhythm
                  </button>
                  <button
                    type="button"
                    onClick={handleKeepCurrentRhythm}
                    style={{
                      width: "100%",
                      padding: "0.75rem 1.2rem",
                      background: "transparent",
                      color: "var(--text-secondary, #64748b)",
                      border: "1px solid var(--border-color, rgba(226, 232, 240, 0.8))",
                      borderRadius: "12px",
                      fontSize: "0.88rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-secondary, #f1f5f9)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    Keep Custom Rhythm
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleKeepCurrentRhythm}
                  style={{
                    width: "100%",
                    padding: "0.85rem 1.4rem",
                    background: "#163824",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "12px",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    boxShadow: "0 4px 14px rgba(22, 56, 36, 0.28)",
                    transition: "opacity 0.2s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.92")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  Got It, Ready for Next Cycle
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global BreakGate Retrieval Modal (Accessible across any page when focus session concludes) */}
      <BreakGateModal
        isOpen={showBreakGateModal}
        deck={activeBreakGateDeck}
        onClose={() => setShowBreakGateModal(false)}
        onComplete={handleBreakGateComplete}
        onSkip={handleBreakGateSkip}
      />

      {/* Global Interactive Visual Feature Guide Modal */}
      <FeatureGuideModal
        isOpen={guideModalOpen}
        onClose={() => setGuideModalOpen(false)}
        initialTopic={guideTopic}
      />
    </>
  );
}

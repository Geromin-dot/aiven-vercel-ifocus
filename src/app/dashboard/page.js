"use client";

// BreakGateModal is managed globally in GlobalTimer

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import HelpButton from '@/components/HelpButton';
import { reconcileCloudTelemetry } from '@/lib/telemetrySync';
import { remainingTime, settlePresence, toggleTimerState, getTimerDeviceId } from '@/lib/timerState';
import { formatFocusMinutes, sessionMinutes } from '@/lib/studyStats';
import { saveVerifiedStudySession, queueStudySession } from '@/lib/verifiedStudyClient';
import { reflectionInputError } from '@/lib/reflectionInput';
import coachStyles from '@/components/CoachLayout.module.css';

const playAlertSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1);
  } catch (e) {
    console.log("Audio play prevented", e);
  }
};

export default function CommandCenterPage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name || 'anonymous';
  const router = useRouter();

  // To-Do State
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [todoPriority, setTodoPriority] = useState('medium');
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = useState(false);
  const [todoFilter, setTodoFilter] = useState('All');
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [activeMenuTodoId, setActiveMenuTodoId] = useState(null);
  const [closingMenuTodoId, setClosingMenuTodoId] = useState(null);
  const [deletingTodoIds, setDeletingTodoIds] = useState(new Set());
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingPriority, setEditingPriority] = useState('medium');

  // AI Coach State
  const [reflectionInput, setReflectionInput] = useState('');
  const [aiFeedback, setAiFeedback] = useState(null);
  const [reflectionError, setReflectionError] = useState('');
  const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);

  // Past Entries State (LocalStorage)
  const [pastEntries, setPastEntries] = useState([]);

  // Pomodoro State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFocus, setIsFocus] = useState(true);
  const [timerPreset, setTimerPreset] = useState('25/5');
  const [sessionCount, setSessionCount] = useState(1);
  
  // BreakGate Modal State
  const [showBreakGate, setShowBreakGate] = useState(false);
  const [activeBreakGateDeck, setActiveBreakGateDeck] = useState(null);
  const [showNoBreakGateModal, setShowNoBreakGateModal] = useState(false);

  // Active presence is managed globally by GlobalTimer across all pages

  // Custom Timer State
  const [isCustomTimerModalOpen, setIsCustomTimerModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [customWorkTime, setCustomWorkTime] = useState({ min: '', sec: '' });
  const [customBreakTime, setCustomBreakTime] = useState({ min: '', sec: '' });
  const [sessionTotalTime, setSessionTotalTime] = useState(25 * 60);
  const [customSessions, setCustomSessions] = useState(1);
  const [customBreakGateQuestions, setCustomBreakGateQuestions] = useState('');
  const [showQuitModal, setShowQuitModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [saveSessionToast, setSaveSessionToast] = useState({ show: false, message: '' });

  // AI-Adapted Timer State & Override Confirmation Prompt
  const [isAiAdjustedTimer, setIsAiAdjustedTimer] = useState(false);
  const [aiAdjustedDetails, setAiAdjustedDetails] = useState(null);
  const [pendingTimerChange, setPendingTimerChange] = useState(null);
  const [isAiRestRecovery, setIsAiRestRecovery] = useState(false);
  const [showAiRestExitModal, setShowAiRestExitModal] = useState(false);

  const getEntryAiReply = (entry) => {
    if (entry?.aiReply) return entry.aiReply;
    const s = String(entry?.state || 'Engaged');
    const isStressed = s.toLowerCase().includes('stress');
    const isDistracted = s.toLowerCase().includes('distract');
    const isMotivated = s.toLowerCase().includes('motivat') || s.toLowerCase().includes('energetic');

    if (isStressed) {
      return {
        title: "Gentle Focus (Stressed)",
        state: "Stressed",
        rhythm: "15m Focus / 5m Rest",
        sessions: 2,
        message: "Coach recommended a calming 15-minute gentle focus interval across 2 short cycles with lighter tasks first to ease mental tension."
      };
    }
    if (isDistracted) {
      return {
        title: "Strict Pomodoro (Distracted)",
        state: "Distracted",
        rhythm: "20m Focus / 5m Rest",
        sessions: 3,
        message: "Coach recommended 20-minute structured single-task intervals across 3 paced sessions to eliminate task-switching."
      };
    }
    if (isMotivated) {
      return {
        title: "Flow State (Motivated)",
        state: "Motivated",
        rhythm: "50m Focus / 10m Rest",
        sessions: 4,
        message: "Coach recommended tackling high-impact priority tasks across 4 deep work cycles to capitalize on peak alertness."
      };
    }
    return {
      title: "Balanced Cadence (Engaged)",
      state: "Engaged",
      rhythm: "25m Focus / 5m Rest",
      sessions: 4,
      message: "Coach recommended steady 25-minute Pomodoro intervals across 4 cycles with active BreakGate pacing."
    };
  };

  const applyEntryAiRhythm = (reply) => {
    setIsActive(false);
    setIsFocus(true);
    setTimerPreset('Custom');

    let wMin = 25, bMin = 5;
    if (reply?.rhythm?.includes('15m')) { wMin = 15; bMin = 5; }
    else if (reply?.rhythm?.includes('20m')) { wMin = 20; bMin = 5; }
    else if (reply?.rhythm?.includes('50m')) { wMin = 50; bMin = 10; }
    else if (reply?.rhythm?.includes('60m')) { wMin = 60; bMin = 10; }

    const targetSess = Math.min(5, Math.max(1, reply?.sessions || (reply?.state === 'Stressed' ? 2 : 4)));
    setCustomWorkTime({ min: wMin, sec: 0 });
    setCustomBreakTime({ min: bMin, sec: 0 });
    setCustomSessions(targetSess);
    setSessionCount(1);
    setTimeLeft(wMin * 60);

    const details = {
      state: reply?.state || 'Adaptive',
      rhythm: reply?.rhythm || `${wMin}m Focus / ${bMin}m Rest`,
      sessions: targetSess,
      title: reply?.title || 'AI Optimized Focus'
    };
    setIsAiAdjustedTimer(true);
    setAiAdjustedDetails(details);

    try {
      localStorage.setItem('ifocus_ai_adjusted_active', 'true');
      localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify(details));
      localStorage.setItem('ifocus_custom_timer', JSON.stringify({
        customWorkTime: { min: wMin, sec: 0 },
        customBreakTime: { min: bMin, sec: 0 },
        customSessions: targetSess,
        customWorkDuration: wMin * 60,
        customBreakDuration: bMin * 60
      }));
      const syncPayload = {
        isRunning: false,
        isFocus: true,
        timeLeft: wMin * 60,
        totalTime: wMin * 60,
        timerPreset: 'Custom',
        customWorkDuration: wMin * 60,
        customBreakDuration: bMin * 60,
        customSessions: targetSess,
        sessionCount: 1,
        presencePaused: false,
        lastPresenceElapsed: 0,
        lastPresenceRemaining: wMin * 60,
        lastPresenceCheckElapsed: 0,
        breakGatePending: false
      };
      localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));
    } catch (e) {}
  };

  // Dynamic Focus Quotes
  const FOCUS_QUOTES = [
    { quote: "Focus is saying no to 1,000 other good ideas.", author: "Steve Jobs" },
    { quote: "You fall to the level of your systems. Master the daily routine.", author: "James Clear" },
    { quote: "Deep uninterrupted work is the superpower of the modern economy.", author: "Cal Newport" },
    { quote: "Small daily improvements over time compound into massive results.", author: "Robin Sharma" },
    { quote: "Simplicity is the prerequisite for reliability and peace of mind.", author: "Edsger Dijkstra" },
    { quote: "Action is the foundational key to all success and progress.", author: "Pablo Picasso" },
    { quote: "Energy flows where your mindful attention goes.", author: "Tony Robbins" },
    { quote: "Do what you can, with what you have, right where you are.", author: "Theodore Roosevelt" }
  ];
  const [quoteIndex, setQuoteIndex] = useState(0);
  const currentQuote = FOCUS_QUOTES[quoteIndex % FOCUS_QUOTES.length];

  const shuffleQuote = () => {
    setQuoteIndex(prev => (prev + 1) % FOCUS_QUOTES.length);
  };

  // Keystroke Telemetrics Engine State & Refs (Always-On Real-time Reading)
  const [telemetryStats, setTelemetryStats] = useState({
    flight: 0,
    dwell: 0,
    backspaces: 0,
    errorRate: 0,
    totalKeystrokes: 0,
    state: 'idle', // 'idle', 'flow', 'fast', 'friction', 'hesitant'
    speedLabel: 'Ready'
  });
  const [telemetryToast, setTelemetryToast] = useState({
    show: false,
    reason: '',
    actionPlan: '',
    metrics: { dwellTime: 0, flightTime: 0, errorRate: 0 }
  });

  const [dailyFocusStats, setDailyFocusStats] = useState({ minutes: 0, sessions: 0, streak: 1 });

  useEffect(() => {
    const updateStats = () => {
      try {
        const s = JSON.parse(localStorage.getItem('ifocus_focus_stats') || '{}');
        const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
        
        const todayStr = new Date().toDateString();
        const todaySessions = history.filter(item => item.verification !== 'pending' && new Date(item.date).toDateString() === todayStr);
        // Match Analytics: derive today's total from the same history on every update.
        const focusMinutes = todaySessions.reduce((sum, item) => sum + sessionMinutes(item), 0);
        const sessionCount = todaySessions.length;
        const streak = s.streak || 1;

        setDailyFocusStats({
          minutes: focusMinutes,
          sessions: sessionCount,
          streak: streak
        });
      } catch (e) {}
    };
    updateStats();
    window.addEventListener('ifocus_stats_updated', updateStats);
    window.addEventListener('storage', updateStats);
    return () => {
      window.removeEventListener('ifocus_stats_updated', updateStats);
      window.removeEventListener('storage', updateStats);
    };
  }, []);

  // Hydrate user focus sessions directly from PostgreSQL database on load
  useEffect(() => {
    if (status !== 'authenticated') return;
    let isMounted = true;
    fetch('/api/study-sessions')
      .then(res => res.json())
      .then(data => {
        if (!isMounted || !Array.isArray(data?.sessions)) return;

        const now = new Date();
        const todayStr = now.toDateString();

        const dbList = data.sessions.map(s => {
          const rawSec = Number(s.duration) || 0;
          const mins = Math.max(1, Math.round(rawSec / 60));
          return {
            id: s.id,
            duration: mins,
            durationSeconds: rawSec,
            date: s.createdAt,
            deckName: s.deck?.title || 'General Focus',
            type: 'pomodoro',
            score: s.score || 100,
            synced: true
          };
        });

        if (dbList.length > 0) {
          let local = [];
          try {
            local = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
          } catch (e) {}

          const unsynced = local.filter(l => !l.synced && !dbList.some(d => Math.abs(new Date(d.date).getTime() - new Date(l.date).getTime()) < 10000));
          const combined = [...dbList, ...unsynced].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          localStorage.setItem('ifocus_session_history', JSON.stringify(combined));

          const todaySessions = combined.filter(item => item.verification !== 'pending' && new Date(item.date).toDateString() === todayStr);
          const todayMins = todaySessions.reduce((sum, item) => sum + sessionMinutes(item), 0);
          const todayCount = todaySessions.length;

          const dates = new Set(combined.filter(s => s.verification !== 'pending').map(s => {
            const d = new Date(s.date);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          }));
          let computedStreak = 0;
          let checkDate = new Date();
          const todayKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
          if (!dates.has(todayKey)) checkDate.setDate(checkDate.getDate() - 1);
          while (true) {
            const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            if (dates.has(key)) {
              computedStreak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
          const finalStreak = Math.max(1, computedStreak);

          setDailyFocusStats({
            minutes: todayMins,
            sessions: todayCount,
            streak: finalStreak
          });

          localStorage.setItem('ifocus_focus_stats', JSON.stringify({
            date: todayStr,
            minutes: todayMins,
            sessions: todayCount,
            streak: finalStreak
          }));

          window.dispatchEvent(new CustomEvent('ifocus_stats_updated'));
        }
      })
      .catch(() => {});

    return () => { isMounted = false; };
  }, [status]);

  const keydownTimesRef = useRef({});
  const lastKeyupTimeRef = useRef(null);
  const dwellTimesRef = useRef([]);
  const flightTimesRef = useRef([]);
  const backspaceCountRef = useRef(0);
  const totalKeystrokesRef = useRef(0);
  const anomalyTriggeredRef = useRef(false);
  const recentKeyTimestampsRef = useRef([]);

  // Comprehensive Frustration / Profanity / Anxiety Trigger Words (Legacy Prototype Parity)
  const profanityList = [
    'fuck', 'fucking', 'fucked', 'shit', 'bitch', 'asshole', 'damn', 'dammit',
    'stupid', 'hate', 'useless', 'idiot', 'crap', 'sucks', 'annoying', 'pissed',
    'furious', 'trash', 'dumb', 'bullshit', 'screw this'
  ];
  const anxietyList = [
    'worry', 'worried', 'stress', 'stressed', 'anxious', 'anxiety', 'scared',
    'terrified', 'overwhelmed', 'nervous', 'fail', 'failing', 'failure',
    'hopeless', 'panic', 'panicking', 'paralyzed', 'exhausted', 'burnt out',
    'cant do this', "can't do this", 'give up', 'giving up', 'lost'
  ];

  const dismissTelemetryToast = () => {
    setTelemetryToast(prev => ({ ...prev, show: false }));
    anomalyTriggeredRef.current = false; // Allow re-triggering when subsequent errors happen!
  };

  const goToCoach = () => {
    if (router) {
      router.push('/coach');
    } else {
      window.location.href = '/coach';
    }
  };

  const playNotificationChime = () => {
    try {
      let chimeEnabled = true;
      let volFactor = 0.7;
      try {
        const soundPrefs = JSON.parse(localStorage.getItem('ifocus_sound_preferences') || '{}');
        if (soundPrefs.telemetryChime !== undefined) chimeEnabled = soundPrefs.telemetryChime;
        if (soundPrefs.ambientVolume !== undefined) volFactor = Math.max(0, Math.min(100, Number(soundPrefs.ambientVolume))) / 100;
      } catch (e) {}

      if (!chimeEnabled || volFactor <= 0) return;

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      
      // Note 1: E5 (659.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.18 * volFactor, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: B5 (987.77 Hz) - iOS Harmonic Chime
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.1);
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.22 * volFactor, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn("Web Audio chime failed:", e);
    }
  };

  const triggerTelemetryAlert = (reason, actionPlan, dwell, flight, bsRatio, customTitle = "Coach has noticed something") => {
    const isHesitant = reason.toLowerCase().includes('hesitation') || reason.toLowerCase().includes('fatigue');
    const stateType = isHesitant ? 'Fatigued' : 'Stressed';
    const nowIso = new Date().toISOString();
    const telemetryData = {
      timestamp: nowIso,
      reason: reason,
      state: stateType,
      sentiment: stateType,
      type: 'friction',
      actionPlan: actionPlan || "We recommend pausing your current task. Take a 5-minute deep breathing break away from the screen before attempting to refocus.",
      metrics: {
        dwellTime: Math.round(dwell),
        flightTime: Math.round(flight),
        errorRate: Math.round(bsRatio * 100)
      }
    };
    try {
      const latestPayload = {
        state: stateType,
        sentiment: stateType,
        type: 'friction',
        fatigueLevel: isHesitant ? 'Elevated' : 'High',
        reason: reason,
        backspaces: Math.round(bsRatio * 10),
        errorRate: Math.round(bsRatio * 100),
        dwell: Math.round(dwell),
        flight: Math.round(flight),
        source: 'keystroke_anomaly',
        timestamp: nowIso
      };
      localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(telemetryData));
      localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(latestPayload));
      window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated', { detail: telemetryData }));

      // Sync telemetry anomaly to database for cross-device consistency (e.g. PC to iPhone PWA)
      fetch('/api/user/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryState: {
            latestTelemetry: latestPayload,
            insightData: telemetryData,
            updatedAt: nowIso
          }
        })
      }).catch(() => {});
    } catch (e) {
      console.warn("Telemetry storage failed:", e);
    }

    // Play subtle crystal-clear iOS chime
    playNotificationChime();

    setTelemetryToast({
      show: true,
      title: customTitle,
      reason: reason,
      actionPlan: actionPlan,
      metrics: telemetryData.metrics
    });
  };

  const updateTelemetryStats = () => {
    const avgDwell = dwellTimesRef.current.length
      ? dwellTimesRef.current.reduce((a, b) => a + b, 0) / dwellTimesRef.current.length
      : 0;
    const avgFlight = flightTimesRef.current.length
      ? flightTimesRef.current.reduce((a, b) => a + b, 0) / flightTimesRef.current.length
      : 0;
    const total = totalKeystrokesRef.current || 1;
    const bsCount = backspaceCountRef.current;
    const bsRatio = bsCount / total;

    let detectedState = 'flow';
    let label = 'Steady Flow';

    // Disregard fast typing as friction (fast typers are just fast!)
    if (avgFlight > 0 && avgFlight < 75) {
      detectedState = 'fast';
      label = 'Fast Flow';
    } else if (bsRatio > 0.40 && bsCount >= 6) {
      detectedState = 'friction';
      label = 'High Friction';
    } else if (avgDwell > 300) {
      detectedState = 'hesitant';
      label = 'Hesitant';
    } else if (totalKeystrokesRef.current < 4) {
      detectedState = 'idle';
      label = 'Calibrating...';
    }

    setTelemetryStats({
      flight: Math.round(avgFlight),
      dwell: Math.round(avgDwell),
      backspaces: bsCount,
      errorRate: Math.round(bsRatio * 100),
      totalKeystrokes: totalKeystrokesRef.current,
      state: detectedState,
      speedLabel: label
    });

    // Update real-time cognitive telemetry if corrections or friction detected
    if (bsCount >= 4 || bsRatio > 0.25 || detectedState === 'friction' || detectedState === 'hesitant') {
      try {
        const payload = {
          state: detectedState === 'friction' ? 'Stressed' : detectedState === 'hesitant' ? 'Fatigued' : 'Flow',
          fatigueLevel: detectedState === 'friction' ? 'High' : detectedState === 'hesitant' ? 'Elevated' : 'Moderate',
          reason: label,
          backspaces: bsCount,
          errorRate: Math.round(bsRatio * 100),
          dwell: Math.round(avgDwell),
          flight: Math.round(avgFlight),
          source: 'keystroke_cadence',
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(payload));
        window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated', { detail: payload }));
      } catch (e) {}
    }

    // Check Actual Cognitive Friction Anomalies (Ignoring fast typing!)
    if (bsRatio > 0.45 && bsCount >= 6 && !anomalyTriggeredRef.current) {
      anomalyTriggeredRef.current = true;
      triggerTelemetryAlert(
        "High correction rate detected. You might be experiencing cognitive friction or feeling stuck on this topic.",
        "Step away from the keyboard and explain the concept out loud. If still stuck, break the task down into smaller steps.",
        avgDwell, avgFlight, bsRatio
      );
    } else if (avgDwell > 360 && totalKeystrokesRef.current >= 10 && !anomalyTriggeredRef.current) {
      anomalyTriggeredRef.current = true;
      triggerTelemetryAlert(
        "Significant keystroke hesitation detected. Your brain might be experiencing mental fatigue.",
        "Stand up, stretch your legs, and get a glass of water. A quick physical reset will restore your energy.",
        avgDwell, avgFlight, bsRatio
      );
    }
  };

  const handleTelemetryKeyDown = (e) => {
    const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'];
    if (ignoredKeys.includes(e.key)) return;

    const now = performance.now();
    keydownTimesRef.current[e.code] = now;

    // 1. Multiple Simultaneous Keys Down Check (Hammering / Dabog: 5 or more keys held together)
    const simultaneousKeysDown = Object.keys(keydownTimesRef.current).length;
    if (simultaneousKeysDown >= 5 && !anomalyTriggeredRef.current) {
      anomalyTriggeredRef.current = true;
      const avgDwell = dwellTimesRef.current.length ? dwellTimesRef.current.reduce((a, b) => a + b, 0) / dwellTimesRef.current.length : 0;
      const avgFlight = flightTimesRef.current.length ? flightTimesRef.current.reduce((a, b) => a + b, 0) / flightTimesRef.current.length : 0;
      const backspaceRatio = totalKeystrokesRef.current > 0 ? backspaceCountRef.current / totalKeystrokesRef.current : 0;

      triggerTelemetryAlert(
        "Multiple simultaneous keys detected. It looks like you might be feeling overwhelmed or experiencing keyboard friction.",
        "Take your hands off the keyboard for a moment. Take a slow, deep breath to reset before writing your reflection.",
        avgDwell, avgFlight, backspaceRatio,
        "Coach has noticed something"
      );
    }

    // 2. High-speed Keyboard Spamming / Key Mashing Check (e.g. rapid gibberish spamming)
    recentKeyTimestampsRef.current.push(now);
    if (recentKeyTimestampsRef.current.length > 8) {
      recentKeyTimestampsRef.current.shift();
    }
    if (recentKeyTimestampsRef.current.length >= 6) {
      const windowDuration = now - recentKeyTimestampsRef.current[0];
      // 6 keystrokes in under 320ms indicates rapid key spamming / keyboard mashing
      if (windowDuration < 320 && !anomalyTriggeredRef.current) {
        anomalyTriggeredRef.current = true;
        const avgDwell = dwellTimesRef.current.length ? dwellTimesRef.current.reduce((a, b) => a + b, 0) / dwellTimesRef.current.length : 0;
        const avgFlight = flightTimesRef.current.length ? flightTimesRef.current.reduce((a, b) => a + b, 0) / flightTimesRef.current.length : 0;
        const backspaceRatio = totalKeystrokesRef.current > 0 ? backspaceCountRef.current / totalKeystrokesRef.current : 0;

        triggerTelemetryAlert(
          "Unusually rapid keystrokes or key mashing detected. It seems like frustration or cognitive tension.",
          "Pause for a moment and take a gentle mental breath. You do not have to rush your reflection.",
          avgDwell, avgFlight, backspaceRatio,
          "Coach has noticed something"
        );
      }
    }

    if (e.repeat) {
      const ignoreRepeatKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
      if (!ignoreRepeatKeys.includes(e.key)) {
        if (keydownTimesRef.current[e.code]) {
          const heldDuration = now - keydownTimesRef.current[e.code];
          if (heldDuration > 2000 && !anomalyTriggeredRef.current) {
            anomalyTriggeredRef.current = true;
            const avgDwell = dwellTimesRef.current.length ? dwellTimesRef.current.reduce((a, b) => a + b, 0) / dwellTimesRef.current.length : 0;
            const avgFlight = flightTimesRef.current.length ? flightTimesRef.current.reduce((a, b) => a + b, 0) / flightTimesRef.current.length : 0;
            const backspaceRatio = totalKeystrokesRef.current > 0 ? backspaceCountRef.current / totalKeystrokesRef.current : 0;
            triggerTelemetryAlert(
              "You seem to be holding down a key. This often indicates frustration or zoning out.",
              "Take your hands off the keyboard for a moment. Close your eyes, take a deep breath, and reset before continuing.",
              avgDwell, avgFlight, backspaceRatio,
              "Coach has noticed something"
            );
          }
        }
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        backspaceCountRef.current++;
        totalKeystrokesRef.current++;
        updateTelemetryStats();
      }
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      backspaceCountRef.current++;
    }
    totalKeystrokesRef.current++;
    updateTelemetryStats();
  };

  const handleTelemetryKeyUp = (e) => {
    const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'];
    if (ignoredKeys.includes(e.key)) return;

    const now = performance.now();

    if (keydownTimesRef.current[e.code]) {
      const dwell = now - keydownTimesRef.current[e.code];
      if (dwell > 0 && dwell < 2000) {
        dwellTimesRef.current.push(dwell);
        if (dwellTimesRef.current.length > 20) dwellTimesRef.current.shift();
      }
      delete keydownTimesRef.current[e.code];
    }

    if (lastKeyupTimeRef.current) {
      const flight = now - lastKeyupTimeRef.current;
      if (flight >= 0 && flight < 2000) {
        flightTimesRef.current.push(flight);
        if (flightTimesRef.current.length > 20) flightTimesRef.current.shift();
      }
    }
    lastKeyupTimeRef.current = now;

    updateTelemetryStats();
  };

  const handleTelemetryInput = (e) => {
    const text = e.target.value.toLowerCase();
    if (anomalyTriggeredRef.current) return;

    let triggerWord = null;
    let isProfanity = false;

    for (let word of profanityList) {
      if (text.includes(word)) {
        triggerWord = word;
        isProfanity = true;
        break;
      }
    }

    if (!triggerWord) {
      for (let word of anxietyList) {
        if (text.includes(word)) {
          triggerWord = word;
          isProfanity = false;
          break;
        }
      }
    }

    if (triggerWord) {
      anomalyTriggeredRef.current = true;
      const reason = isProfanity
        ? "Strong emotional frustration detected in your reflection. It is completely okay to feel stuck when studying."
        : "You seem to be expressing worry or overwhelm. Remember that learning is a gradual process.";
      const actionPlan = isProfanity
        ? "Frustration blocks effective learning. Walk away for exactly 5 minutes, do something unrelated, and come back fresh."
        : "When anxiety hits, try a quick grounding exercise or tackle a small bite-sized subtask to rebuild momentum.";

      const avgDwell = dwellTimesRef.current.length ? dwellTimesRef.current.reduce((a, b) => a + b, 0) / dwellTimesRef.current.length : 0;
      const avgFlight = flightTimesRef.current.length ? flightTimesRef.current.reduce((a, b) => a + b, 0) / flightTimesRef.current.length : 0;
      const backspaceRatio = totalKeystrokesRef.current > 0 ? backspaceCountRef.current / totalKeystrokesRef.current : 0;

      triggerTelemetryAlert(reason, actionPlan, avgDwell, avgFlight, backspaceRatio);
    }
  };

  const resetTelemetry = () => {
    anomalyTriggeredRef.current = false;
    totalKeystrokesRef.current = 0;
    backspaceCountRef.current = 0;
    flightTimesRef.current = [];
    dwellTimesRef.current = [];
    keydownTimesRef.current = {};
    lastKeyupTimeRef.current = null;
    setTelemetryStats({ flight: 0, dwell: 0, backspaces: 0, errorRate: 0, totalKeystrokes: 0, state: 'idle', speedLabel: 'Ready' });
  };

  // Ambient Audio State
  const [currentTrack, setCurrentTrack] = useState('Chill Lofi');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const audioRef = useRef(null);
  const tracks = [
    { id: 'Chill Lofi', name: 'Chill Lofi', desc: 'Calming Lo-Fi beats & ambient chill study vibes', tag: 'Lo-Fi', icon: 'coffee' },
    { id: 'Study Music', name: 'Study Music', desc: 'Classical acoustic focus melodies for deep work', tag: 'Acoustic', icon: 'book' },
    { id: 'Rain Ambient', name: 'Rain Ambient', desc: 'Gentle rainfall & soothing natural drops', tag: 'Nature', icon: 'rain' },
    { id: 'Ocean Waves', name: 'Ocean Waves', desc: 'Rhythmic rolling ocean surf & calming sea tide', tag: 'Water', icon: 'wave' },
    { id: 'Binaural Alpha (432Hz)', name: 'Binaural Alpha (432Hz)', desc: '10Hz alpha brainwave pulses for deep memory retention', tag: 'Binaural', icon: 'brain' },
    { id: 'Warm Campfire', name: 'Warm Campfire', desc: 'Cozy fireplace embers & relaxing warm crackle', tag: 'Ambiance', icon: 'fire' },
    { id: 'Pink Noise', name: 'Pink Noise', desc: 'Balanced 1/f noise for distraction masking', tag: 'Noise', icon: 'wind' },
    { id: 'Cosmic Deep Space', name: 'Cosmic Deep Space', desc: 'Ethereal ambient celestial drone & meditation pad', tag: 'Drone', icon: 'moon' },
  ];

  // Load To-Dos from API and History from LocalStorage
  useEffect(() => {
    if (status === 'loading') return;
    
    // Fetch Todos from Database
    if (status === 'authenticated') {
      fetch('/api/todos')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTodos(data);
          setLoadingTodos(false);
        })
        .catch(err => {
          console.error("Failed to load todos:", err);
          setLoadingTodos(false);
        });
    } else {
      setLoadingTodos(false);
    }
    
    // Fetch Journal History from LocalStorage
    const historyKey = `ifocus_journal_history_${userName}`;
    let storedHistory = localStorage.getItem(historyKey);
    if (!storedHistory && userName === 'richardx') {
      storedHistory = localStorage.getItem('ifocus_journal_history');
      if (storedHistory) localStorage.setItem(historyKey, storedHistory); // migrate
    }
    
    if (storedHistory) {
      setPastEntries(JSON.parse(storedHistory));
    } else {
      setPastEntries([]);
    }
  }, [userName, status]);

  const saveHistory = (newHistory) => {
    setPastEntries(newHistory);
    try {
      localStorage.setItem(`ifocus_journal_history_${userName}`, JSON.stringify(newHistory));
      localStorage.setItem('ifocus_journal_history', JSON.stringify(newHistory));
      window.dispatchEvent(new CustomEvent('ifocus_journal_updated', { detail: newHistory }));
      fetch('/api/user/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryState: {
            journalHistory: newHistory,
            updatedAt: new Date().toISOString()
          }
        })
      }).catch(() => {});
    } catch (e) {
      console.warn("LocalStorage failed:", e);
    }
  };

  // Bi-Directional Cloud Telemetry & Checkpoint Reconciliation on Mount
  useEffect(() => {
    if (status !== 'authenticated') return;
    reconcileCloudTelemetry().then((res) => {
      if (res?.mergedJournal && Array.isArray(res.mergedJournal) && res.mergedJournal.length > 0) {
        setPastEntries(res.mergedJournal);
      }
      if (res?.effectiveTimerState) {
        const ts = res.effectiveTimerState;
        if (ts.timerPreset) setTimerPreset(ts.timerPreset);
        if (typeof ts.timeLeft === 'number') setTimeLeft(ts.timeLeft);
        if (typeof ts.totalTime === 'number' && ts.totalTime > 0) setSessionTotalTime(ts.totalTime);
        if (ts.isRunning !== undefined) setIsActive(ts.isRunning);
      }
    }).catch(() => {});
  }, [status]);

  // Real-time listener for Journal updates across devices
  useEffect(() => {
    const handleJournalUpdate = (e) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setPastEntries(e.detail);
      } else {
        try {
          const stored = localStorage.getItem(`ifocus_journal_history_${userName}`) || localStorage.getItem('ifocus_journal_history');
          if (stored) setPastEntries(JSON.parse(stored));
        } catch (e) {}
      }
    };
    window.addEventListener('ifocus_journal_updated', handleJournalUpdate);
    return () => window.removeEventListener('ifocus_journal_updated', handleJournalUpdate);
  }, [userName]);

  // Audio Track Source Map
  const getTrackSrc = (name) => {
    if (name === 'Chill Lofi') return '/music/Lofi Chill.mp3';
    if (name === 'Study Music') return '/music/Study Music.mp3';
    if (name === 'Rain Ambient') return '/music/rain.mp3';
    return '/music/Lofi Chill.mp3';
  };

  // Ambient Soundscape Sync with Global Engine
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ifocus_music_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.currentTrack) setCurrentTrack(parsed.currentTrack);
        if (typeof parsed.isPlaying === 'boolean') setIsPlaying(parsed.isPlaying);
        if (typeof parsed.volume === 'number') setVolume(parsed.volume);
      } else {
        const savedSound = localStorage.getItem('ifocus_sound_preferences');
        if (savedSound) {
          const parsed = JSON.parse(savedSound);
          if (parsed.defaultAmbientTrack && parsed.defaultAmbientTrack !== 'None') {
            setCurrentTrack(parsed.defaultAmbientTrack);
          }
          if (parsed.ambientVolume !== undefined) {
            setVolume(parsed.ambientVolume);
          }
        }
      }
    } catch (e) {}

    const handleSync = (e) => {
      if (e?.detail) {
        if (e.detail.currentTrack) setCurrentTrack(e.detail.currentTrack);
        if (typeof e.detail.isPlaying === 'boolean') setIsPlaying(e.detail.isPlaying);
        if (typeof e.detail.volume === 'number') setVolume(e.detail.volume);
      }
    };
    window.addEventListener('ifocus_music_sync', handleSync);
    return () => window.removeEventListener('ifocus_music_sync', handleSync);
  }, []);

  const handleTogglePlayback = (explicitState) => {
    const nextState = typeof explicitState === 'boolean' ? explicitState : !isPlaying;
    setIsPlaying(nextState);
    const detail = { isPlaying: nextState, currentTrack, volume };
    try {
      localStorage.setItem('ifocus_music_state', JSON.stringify(detail));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('ifocus_music_sync', { detail }));
  };

  const handleSelectTrack = (trackName) => {
    setCurrentTrack(trackName);
    setIsPlaying(true);
    const detail = { isPlaying: true, currentTrack: trackName, volume };
    try {
      localStorage.setItem('ifocus_music_state', JSON.stringify(detail));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('ifocus_music_sync', { detail }));
  };

  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    const detail = { isPlaying, currentTrack, volume: newVol };
    try {
      localStorage.setItem('ifocus_music_state', JSON.stringify(detail));
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('ifocus_music_sync', { detail }));
  };

  // Load and sync active BreakGate deck
  const checkActiveDeck = () => {
    try {
      const bgDeckRaw = localStorage.getItem('ifocus_active_breakgate_deck');
      if (bgDeckRaw) {
        const parsed = JSON.parse(bgDeckRaw);
        // Security check: if deck has userId and doesn't match current logged in user, purge it!
        if (session?.user?.id && parsed?.userId && parsed.userId !== session.user.id) {
          localStorage.removeItem('ifocus_active_breakgate_deck');
          setActiveBreakGateDeck(null);
          return;
        }
        if (parsed && (parsed.id || parsed.title)) {
          setActiveBreakGateDeck(parsed);
          return;
        }
      }
      setActiveBreakGateDeck(null);
    } catch (e) {
      setActiveBreakGateDeck(null);
    }
  };

  // Validate active BreakGate deck against logged-in user's database decks
  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/decks')
        .then(res => res.ok ? res.json() : [])
        .then(userDecks => {
          if (Array.isArray(userDecks)) {
            const raw = localStorage.getItem('ifocus_active_breakgate_deck');
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                const belongsToUser = userDecks.some(d => d.id === parsed.id);
                if (!belongsToUser) {
                  // Deck was created by another student or deleted! Purge from this account!
                  localStorage.removeItem('ifocus_active_breakgate_deck');
                  setActiveBreakGateDeck(null);
                  window.dispatchEvent(new CustomEvent('ifocus_breakgate_deck_changed', { detail: { active: false, deck: null } }));
                }
              } catch(e) {}
            }
          }
        })
        .catch(() => {});
    }
  }, [session?.user?.id]);

  // Handle prefilled reflection from Post-Session modal
  useEffect(() => {
    try {
      const prefill = localStorage.getItem('ifocus_prefill_reflection');
      if (prefill) {
        setReflectionInput(prefill);
        localStorage.removeItem('ifocus_prefill_reflection');
      }
    } catch (e) {}

    const handlePrefillEvent = (e) => {
      if (e?.detail) {
        setReflectionInput(e.detail);
      }
    };
    window.addEventListener('ifocus_apply_prefill_reflection', handlePrefillEvent);
    return () => window.removeEventListener('ifocus_apply_prefill_reflection', handlePrefillEvent);
  }, []);

  // Pomodoro Logic & Global Timer Synchronization
  useEffect(() => {
    // 1. Load initial timer state from localStorage
    try {
      const saved = localStorage.getItem('ifocus_timer_state');
      if (saved) {
        const parsed = settlePresence(JSON.parse(saved), JSON.parse(localStorage.getItem('ifocus_timer_preferences') || '{}'));
        localStorage.setItem('ifocus_timer_state', JSON.stringify(parsed));
        if (parsed.timeLeft !== undefined) {
          if (parsed.isRunning && parsed.targetEndTime) {
            const currentLeft = remainingTime(parsed);
            setTimeLeft(currentLeft);
            setIsActive(true);
          } else {
            setTimeLeft(parsed.timeLeft);
            setIsActive(Boolean(parsed.isRunning));
          }
        }
        if (parsed.isFocus !== undefined) setIsFocus(parsed.isFocus);
        if (parsed.timerPreset) setTimerPreset(parsed.timerPreset);
        let maxS = 4;
        if (parsed.timerPreset === 'Custom') {
          try {
            const c = localStorage.getItem('ifocus_custom_timer');
            if (c) maxS = Number(JSON.parse(c).customSessions) || 1;
            else if (parsed.customSessions) maxS = Number(parsed.customSessions) || 1;
          } catch(e) {}
        }
        if (parsed.sessionCount) {
          const clamped = parsed.sessionCount > maxS ? 1 : parsed.sessionCount;
          setSessionCount(clamped);
        }
        if (parsed.totalTime && typeof parsed.totalTime === 'number' && parsed.totalTime > 0) {
          setSessionTotalTime(parsed.totalTime);
        }
      }

      checkActiveDeck();

      // Load saved custom timer and BreakGate configuration
      const savedCustom = localStorage.getItem('ifocus_custom_timer');
      if (savedCustom) {
        const parsed = JSON.parse(savedCustom);
        if (parsed.customWorkTime) setCustomWorkTime(parsed.customWorkTime);
        if (parsed.customBreakTime) setCustomBreakTime(parsed.customBreakTime);
        if (parsed.customSessions) setCustomSessions(parsed.customSessions);
        if (parsed.customBreakGateQuestions) setCustomBreakGateQuestions(parsed.customBreakGateQuestions);
      } else {
        const bgStored = localStorage.getItem('ifocus_breakgate_question_count');
        if (bgStored) setCustomBreakGateQuestions(parseInt(bgStored) || 3);
      }

      // Check if AI adjusted timer schedule is active
      const aiActive = localStorage.getItem('ifocus_ai_adjusted_active');
      if (aiActive === 'true') {
        setIsAiAdjustedTimer(true);
        const details = localStorage.getItem('ifocus_ai_adjusted_details');
        if (details) setAiAdjustedDetails(JSON.parse(details));
      }

      // Check if AI Prescribed Rest Recovery is active
      try {
        const restStored = localStorage.getItem('ifocus_ai_rest_recovery');
        if (restStored) {
          const parsed = JSON.parse(restStored);
          if (parsed && parsed.active) {
            setIsAiRestRecovery(true);
          }
        }
      } catch (e) {}

      // Check if arriving from AI Coach with applied cadence toast
      const appliedToast = localStorage.getItem('ifocus_applied_toast');
      if (appliedToast) {
        try {
          const parsed = JSON.parse(appliedToast);
          setSaveSessionToast({
            show: true,
            title: parsed.title || "AI Coach Rhythm Active",
            message: parsed.message || "Adapted focus timer cadence applied."
          });
          localStorage.removeItem('ifocus_applied_toast');
          setTimeout(() => {
            setSaveSessionToast({ show: false, message: '', title: '' });
          }, 4500);
        } catch (e) {
          localStorage.removeItem('ifocus_applied_toast');
        }
      }
    } catch (e) {}

    // 2. Listen for timer ticks and state sync events from GlobalTimer
    const handleTick = (e) => {
      if (e?.detail) {
        setTimeLeft(e.detail.timeLeft);
        setIsActive(e.detail.isRunning);
        setIsFocus(e.detail.isFocus);
        if (e.detail.totalTime && typeof e.detail.totalTime === 'number' && e.detail.totalTime > 0) {
          setSessionTotalTime(e.detail.totalTime);
        }
        if (e.detail.isAiRestRecovery !== undefined) {
          setIsAiRestRecovery(Boolean(e.detail.isAiRestRecovery));
        } else {
          try {
            const restStored = localStorage.getItem('ifocus_ai_rest_recovery');
            if (restStored) {
              const parsed = JSON.parse(restStored);
              setIsAiRestRecovery(Boolean(parsed && parsed.active));
            } else {
              setIsAiRestRecovery(false);
            }
          } catch (err) {
            setIsAiRestRecovery(false);
          }
        }
      }
    };

    const handleSync = (e) => {
      if (e?.detail) {
        if (e.detail.timeLeft !== undefined) setTimeLeft(e.detail.timeLeft);
        if (e.detail.isRunning !== undefined) setIsActive(e.detail.isRunning);
        if (e.detail.isFocus !== undefined) setIsFocus(e.detail.isFocus);
        if (e.detail.timerPreset) setTimerPreset(e.detail.timerPreset);
        if (e.detail.totalTime && typeof e.detail.totalTime === 'number' && e.detail.totalTime > 0) {
          setSessionTotalTime(e.detail.totalTime);
        }
        if (e.detail.isAiRestRecovery !== undefined) {
          setIsAiRestRecovery(Boolean(e.detail.isAiRestRecovery));
        } else {
          try {
            const restStored = localStorage.getItem('ifocus_ai_rest_recovery');
            if (restStored) {
              const parsed = JSON.parse(restStored);
              setIsAiRestRecovery(Boolean(parsed && parsed.active));
            } else {
              setIsAiRestRecovery(false);
            }
          } catch (err) {
            setIsAiRestRecovery(false);
          }
        }
        if (e.detail.customSessions !== undefined) setCustomSessions(Number(e.detail.customSessions) || 1);
        if (e.detail.customWorkDuration !== undefined) {
          const wMin = Math.floor(e.detail.customWorkDuration / 60);
          const wSec = e.detail.customWorkDuration % 60;
          setCustomWorkTime({ min: wMin, sec: wSec });
        }
        if (e.detail.customBreakDuration !== undefined) {
          const bMin = Math.floor(e.detail.customBreakDuration / 60);
          const bSec = e.detail.customBreakDuration % 60;
          setCustomBreakTime({ min: bMin, sec: bSec });
        }
        if (e.detail.sessionCount) {
          let maxS = 4;
          const currentPreset = e.detail.timerPreset || timerPreset;
          if (currentPreset === 'Custom') {
            try {
              const c = localStorage.getItem('ifocus_custom_timer');
              if (c) maxS = Number(JSON.parse(c).customSessions) || 1;
              else maxS = Number(e.detail.customSessions || customSessions) || 1;
            } catch(err) {
              maxS = Number(e.detail.customSessions || customSessions) || 1;
            }
          }
          const clamped = e.detail.sessionCount > maxS ? 1 : e.detail.sessionCount;
          setSessionCount(clamped);
        }
      }

      // Re-read storage state for custom timer & AI adjusted banner
      try {
        const customRaw = localStorage.getItem('ifocus_custom_timer');
        if (customRaw) {
          const parsed = JSON.parse(customRaw);
          if (parsed.customWorkTime) setCustomWorkTime(parsed.customWorkTime);
          if (parsed.customBreakTime) setCustomBreakTime(parsed.customBreakTime);
          if (parsed.customSessions) setCustomSessions(Number(parsed.customSessions) || 1);
        }
        const aiActive = localStorage.getItem('ifocus_ai_adjusted_active');
        if (aiActive === 'true') {
          setIsAiAdjustedTimer(true);
          const details = localStorage.getItem('ifocus_ai_adjusted_details');
          if (details) setAiAdjustedDetails(JSON.parse(details));
        } else {
          setIsAiAdjustedTimer(false);
          setAiAdjustedDetails(null);
        }
      } catch (err) {}
    };

    const handleBreakGate = (e) => {
      if (e?.detail) {
        setActiveBreakGateDeck(e.detail);
        setShowBreakGate(true);
      }
    };

    const handleWindowFocusSync = () => {
      checkActiveDeck();
      handleSync();
      reconcileCloudTelemetry().catch(() => {});
    };

    const handleCycleCompleted = (e) => {
      const count = e?.detail?.sessionsCompleted || 1;
      setSaveSessionToast({
        show: true,
        title: "Session Goal Completed!",
        message: `All ${count} planned focus sessions finished. Great job staying focused!`
      });
      setTimeout(() => {
        setSaveSessionToast({ show: false, message: '', title: '' });
      }, 5500);
    };

    window.addEventListener('ifocus_timer_tick', handleTick);
    window.addEventListener('ifocus_timer_sync', handleSync);
    window.addEventListener('ifocus_breakgate_trigger', handleBreakGate);
    window.addEventListener('ifocus_cycle_completed', handleCycleCompleted);
    window.addEventListener('focus', handleWindowFocusSync);
    window.addEventListener('storage', handleWindowFocusSync);
    window.addEventListener('ifocus_breakgate_deck_changed', checkActiveDeck);

    return () => {
      window.removeEventListener('ifocus_timer_tick', handleTick);
      window.removeEventListener('ifocus_timer_sync', handleSync);
      window.removeEventListener('ifocus_breakgate_trigger', handleBreakGate);
      window.removeEventListener('ifocus_cycle_completed', handleCycleCompleted);
      window.removeEventListener('focus', handleWindowFocusSync);
      window.removeEventListener('storage', handleWindowFocusSync);
      window.removeEventListener('ifocus_breakgate_deck_changed', checkActiveDeck);
    };
  }, []);

  const handleBreakGateComplete = () => {
    setShowBreakGate(false);
    const breakMin = parseInt(customBreakTime.min) || 0;
    const breakSec = parseInt(customBreakTime.sec) || 0;
    const customBreakDuration = (breakMin * 60 + breakSec) || 5 * 60;
    const workMin = parseInt(customWorkTime.min) || 0;
    const workSec = parseInt(customWorkTime.sec) || 0;
    const customWorkDuration = (workMin * 60 + workSec) || 25 * 60;

    const breakTime = timerPreset === 'Custom' 
      ? customBreakDuration 
      : timerPreset === '50/10' ? 10 * 60 : timerPreset === '15/3' ? 3 * 60 : timerPreset === '90/20' ? 20 * 60 : 5 * 60;
    
    setIsActive(true);
    setIsFocus(false);
    setTimeLeft(breakTime);

    const nextState = {
      isRunning: true,
      isFocus: false,
      timeLeft: breakTime,
      totalTime: breakTime,
      targetEndTime: Date.now() + (breakTime * 1000),
      timerPreset,
      customWorkDuration,
      customBreakDuration,
      sessionCount,
      presencePaused: false,
      lastPresenceElapsed: 0,
      lastPresenceRemaining: timeLeft,
      lastPresenceCheckElapsed: 0,
      breakGatePending: false
    };
    try {
      localStorage.setItem('ifocus_timer_state', JSON.stringify(nextState));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: nextState }));
    } catch(e) {}
  };

  const handleBreakGateSkip = () => {
    handleBreakGateComplete();
  };

  const handleSkipBreak = () => {
    if (!isFocus && isAiRestRecovery) {
      setShowAiRestExitModal(true);
      return;
    }
    window.dispatchEvent(new CustomEvent('ifocus_skip_break'));
  };

  const startTimerDirectly = () => {
    setShowNoBreakGateModal(false);
    const current = JSON.parse(localStorage.getItem('ifocus_timer_state') || 'null');
    const preferences = JSON.parse(localStorage.getItem('ifocus_timer_preferences') || '{}');
    const total = getTotalTime();

    const workMin = parseInt(customWorkTime.min) || 0;
    const workSec = parseInt(customWorkTime.sec) || 0;
    const currentCustomWorkDuration = (workMin * 60 + workSec) || 25 * 60;
    const breakMin = parseInt(customBreakTime.min) || 0;
    const breakSec = parseInt(customBreakTime.sec) || 0;
    const currentCustomBreakDuration = (breakMin * 60 + breakSec) || 5 * 60;
    const currentCustomSessions = Number(customSessions) || 1;

    const baseState = current || {
      isRunning: false,
      isFocus,
      timeLeft,
      totalTime: total,
      targetEndTime: null,
      timerPreset,
      customWorkDuration: currentCustomWorkDuration,
      customBreakDuration: currentCustomBreakDuration,
      customSessions: currentCustomSessions,
      sessionCount,
      presencePaused: false,
      lastPresenceElapsed: 0,
      lastPresenceRemaining: timeLeft,
      lastPresenceCheckElapsed: 0,
      breakGatePending: false,
      updatedAt: Date.now()
    };
    const nextState = {
      ...toggleTimerState(baseState, preferences),
      deviceId: getTimerDeviceId(),
      userId: session?.user?.id,
      timerSessionId: baseState.timerSessionId || crypto.randomUUID(),
    };
    setIsActive(nextState.isRunning);
    setTimeLeft(nextState.timeLeft);
    try {
      localStorage.setItem('ifocus_timer_state', JSON.stringify(nextState));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: nextState }));
    } catch (e) {}

    // Cloud session checkpoint
    fetch('/api/user/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telemetryState: {
          activeTimerState: nextState,
          updatedAt: new Date().toISOString()
        }
      })
    }).catch(() => {});
  };

  const toggleTimer = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (e) {}
    }
    if (!isFocus && isAiRestRecovery && isActive) {
      setShowAiRestExitModal(true);
      return;
    }
    if (!isActive) {
      // User is starting a focus session: check if a BreakGate deck is active
      let hasDeck = Boolean(activeBreakGateDeck);
      if (!hasDeck) {
        try {
          const stored = localStorage.getItem('ifocus_active_breakgate_deck');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && (parsed.id || parsed.title)) {
              hasDeck = true;
              setActiveBreakGateDeck(parsed);
            }
          }
        } catch(e) {}
      }

      if (!hasDeck) {
        setShowNoBreakGateModal(true);
        return;
      }
    }
    startTimerDirectly();
  };

  const forceResetTimer = () => {
    setIsActive(false);
    setSessionCount(1);
    setIsFocus(true);
    const workMin = parseInt(customWorkTime.min) || 0;
    const workSec = parseInt(customWorkTime.sec) || 0;
    const customWorkDuration = (workMin * 60 + workSec) || 25 * 60;
    const breakMin = parseInt(customBreakTime.min) || 0;
    const breakSec = parseInt(customBreakTime.sec) || 0;
    const customBreakDuration = (breakMin * 60 + breakSec) || 5 * 60;
    const currentCustomSessions = Number(customSessions) || 1;

    let newTime = 25 * 60;
    if (timerPreset === 'Custom') {
      newTime = customWorkDuration;
    } else {
      const focusTime = parseInt(timerPreset.split('/')[0]) || 25;
      newTime = focusTime * 60;
    }
    setTimeLeft(newTime);
    const nextState = {
      isRunning: false,
      isFocus: true,
      timeLeft: newTime,
      totalTime: newTime,
      targetEndTime: null,
      timerPreset,
      customWorkDuration,
      customBreakDuration,
      customSessions: currentCustomSessions,
      sessionCount: 1,
      presencePaused: false,
      lastPresenceElapsed: 0,
      lastPresenceRemaining: newTime,
      lastPresenceCheckElapsed: 0,
      breakGatePending: false,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem('ifocus_timer_state', JSON.stringify(nextState));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: nextState }));
      window.dispatchEvent(new CustomEvent('ifocus_stats_updated'));
    } catch (e) {}

    // Cloud reset sync
    fetch('/api/user/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telemetryState: {
          activeTimerState: nextState,
          updatedAt: new Date().toISOString()
        }
      })
    }).catch(() => {});
  };

  const resetTimer = () => {
    if (!isFocus && isAiRestRecovery) {
      setShowAiRestExitModal(true);
      return;
    }
    setShowResetConfirmModal(true);
  };

  const confirmExitRestEarly = () => {
    setShowAiRestExitModal(false);
    setIsAiRestRecovery(false);
    try {
      localStorage.removeItem('ifocus_ai_rest_recovery');
      localStorage.removeItem('ifocus_recovery_completed');
      localStorage.removeItem('ifocus_cognitive_reset');
    } catch (e) {}
    forceResetTimer();
    window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated'));
  };

  const confirmResetTimer = () => {
    setShowResetConfirmModal(false);
    forceResetTimer();
  };

  const handleSaveAndEndSession = async () => {
    setShowQuitModal(false);
    setIsActive(false);
    const current = JSON.parse(localStorage.getItem('ifocus_timer_state') || 'null');
    if (!current) return;
    const remaining = remainingTime(current);
    const elapsed = Math.max(0, Number(current.totalTime) - remaining);
    if (elapsed < 60) { forceResetTimer(); return; }
    const paused = { ...current, timeLeft: remaining, isRunning: false, targetEndTime: null, updatedAt: Date.now() };
    localStorage.setItem('ifocus_timer_state', JSON.stringify(paused));
    window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: paused }));
    const payload = { timerSessionId: current.timerSessionId, duration: elapsed };
    try {
      const { session: saved } = await saveVerifiedStudySession(payload);
      forceResetTimer();
      playTaskAddSound();
      setSaveSessionToast({ show: true, message: `${Math.floor(saved.duration / 60)} minute(s) recorded to Analytics & Stats.` });
    } catch (error) {
      if (!navigator.onLine) {
        queueStudySession(payload);
        forceResetTimer();
        setSaveSessionToast({ show: true, message: 'Study time saved locally. It will be verified when you reconnect.' });
      } else {
        setSaveSessionToast({ show: true, message: error.message });
      }
    }
  };

  const executePresetChange = (preset) => {
    if (preset === 'Custom') {
      setIsCustomTimerModalOpen(true);
    } else {
      setTimerPreset(preset);
      setIsActive(false);
      setIsFocus(true);
      const focusTime = parseInt(preset.split('/')[0]) || 25;
      const newTime = focusTime * 60;
      setTimeLeft(newTime);
      const nextState = {
        isRunning: false,
        isFocus: true,
        timeLeft: newTime,
        totalTime: newTime,
        targetEndTime: null,
        timerPreset: preset,
        sessionCount,
        presencePaused: false,
        lastPresenceElapsed: 0,
        lastPresenceRemaining: newTime,
        lastPresenceCheckElapsed: 0,
        breakGatePending: false,
        updatedAt: Date.now()
      };
      try {
        localStorage.setItem('ifocus_timer_state', JSON.stringify(nextState));
        window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: nextState }));
      } catch (e) {}

      // Cloud timer checkpoint
      fetch('/api/user/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryState: {
            activeTimerState: nextState,
            updatedAt: new Date().toISOString()
          },
          timerPreferences: {
            focusDuration: focusTime,
            timerPreset: preset
          }
        })
      }).catch(() => {});
    }
  };

  const setPreset = (preset) => {
    if (!isFocus && isAiRestRecovery) {
      setShowAiRestExitModal(true);
      return;
    }
    if (isAiAdjustedTimer) {
      setPendingTimerChange({ type: 'preset', value: preset });
      return;
    }
    executePresetChange(preset);
  };

  const handleOpenCustomSettings = () => {
    if (!isFocus && isAiRestRecovery) {
      setShowAiRestExitModal(true);
      return;
    }
    if (isAiAdjustedTimer) {
      setPendingTimerChange({ type: 'open_custom' });
      return;
    }
    setIsCustomTimerModalOpen(true);
  };

  const executeSaveCustomSettings = () => {
    setIsCustomTimerModalOpen(false);
    setTimerPreset('Custom');
    setIsActive(false);
    setIsFocus(true);
    const workMin = parseInt(customWorkTime.min) || 0;
    const workSec = parseInt(customWorkTime.sec) || 0;
    const customWorkDuration = (workMin * 60 + workSec) || 25 * 60;

    const breakMin = parseInt(customBreakTime.min) || 0;
    const breakSec = parseInt(customBreakTime.sec) || 0;
    const customBreakDuration = (breakMin * 60 + breakSec) || 5 * 60;

    const validatedSessions = Math.min(5, Math.max(1, parseInt(customSessions, 10) || 1));
    setCustomSessions(validatedSessions);

    const customQuestionCount = parseInt(customBreakGateQuestions) || 3;
    localStorage.setItem('ifocus_breakgate_question_count', String(customQuestionCount));

    try {
      localStorage.setItem('ifocus_custom_timer', JSON.stringify({
        customWorkTime,
        customBreakTime,
        customSessions: validatedSessions,
        customWorkDuration,
        customBreakDuration,
        customBreakGateQuestions: customQuestionCount
      }));
    } catch (e) {}

    setTimeLeft(customWorkDuration);
    setSessionTotalTime(customWorkDuration);
    setSessionCount(1);
    const nextState = {
      isRunning: false,
      isFocus: true,
      timeLeft: customWorkDuration,
      totalTime: customWorkDuration,
      targetEndTime: null,
      timerPreset: 'Custom',
      customWorkDuration,
      customBreakDuration,
      customSessions: validatedSessions,
      sessionCount: 1,
      presencePaused: false,
      lastPresenceElapsed: 0,
      lastPresenceRemaining: customWorkDuration,
      lastPresenceCheckElapsed: 0,
      breakGatePending: false,
      updatedAt: Date.now()
    };
    try {
      localStorage.setItem('ifocus_timer_state', JSON.stringify(nextState));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: nextState }));
    } catch (e) {}

    // Cloud custom schedule checkpoint
    fetch('/api/user/telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telemetryState: {
          activeTimerState: nextState,
          customTimer: {
            customWorkTime,
            customBreakTime,
            customSessions: validatedSessions,
            customWorkDuration,
            customBreakDuration,
            customBreakGateQuestions: customQuestionCount
          },
          updatedAt: new Date().toISOString()
        },
        timerPreferences: {
          focusDuration: Math.round(customWorkDuration / 60),
          breakGateQuestionCount: customQuestionCount
        }
      })
    }).catch(() => {});
  };

  const saveCustomSettings = () => {
    if (isAiAdjustedTimer) {
      setPendingTimerChange({ type: 'save_custom' });
      return;
    }
    executeSaveCustomSettings();
  };

  const confirmOverrideAi = () => {
    setIsAiAdjustedTimer(false);
    setAiAdjustedDetails(null);
    try {
      localStorage.removeItem('ifocus_ai_adjusted_active');
      localStorage.removeItem('ifocus_ai_adjusted_details');
    } catch (e) {}

    const pending = pendingTimerChange;
    setPendingTimerChange(null);

    if (!pending) return;
    if (pending.type === 'preset') {
      executePresetChange(pending.value);
    } else if (pending.type === 'open_custom') {
      setIsCustomTimerModalOpen(true);
    } else if (pending.type === 'save_custom') {
      executeSaveCustomSettings();
    }
  };

  const cancelOverrideAi = () => {
    setPendingTimerChange(null);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

    // Task Add Apple-Style Sound Effect
  const playTaskAddSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch (e) {
      console.log("Audio play error", e);
    }
  };

  // To-Do Logic (Cloud Synced)
  const addTodo = async (e) => {
    if (e) e.preventDefault();
    if (!todoInput || !todoInput.trim()) {
      alert("Oops! The task input is empty.");
      return;
    }
    
    const text = todoInput;
    setTodoInput(''); // Optimistic clear
    playTaskAddSound(); // Play satisfying chime pop!
    
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, priority: todoPriority })
      });
      
      if (!res.ok) throw new Error("Failed to add task");
      
      const newTodo = await res.json();
      setTodos(current => [newTodo, ...current]);
    } catch (err) {
      alert("Error adding task: " + err.message);
    }
  };

  const startEditingTodo = (todo) => {
    setEditingTodoId(todo.id);
    setEditingText(todo.text);
    setEditingPriority(todo.priority || 'medium');
    setActiveMenuTodoId(null);
  };

  const saveEditedTodo = async (id) => {
    if (!editingText.trim()) return;
    const prevTodos = [...todos];
    setTodos(todos.map(t => t.id === id ? { ...t, text: editingText.trim(), priority: editingPriority } : t));
    setEditingTodoId(null);

    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editingText.trim(), priority: editingPriority })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to save edited todo:", err);
      alert("Failed to update task.");
      setTodos(prevTodos);
    }
  };

  const playTaskCheckSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.16, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.08); // A5
      gain2.gain.setValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.3);
    } catch (e) {
      console.log("Audio play error", e);
    }
  };

  const playTaskDeleteSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.16);

      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch (e) {
      console.log("Audio play error", e);
    }
  };

  const closeActionMenu = (id) => {
    setClosingMenuTodoId(id);
    setTimeout(() => {
      setActiveMenuTodoId(null);
      setClosingMenuTodoId(null);
    }, 180);
  };

  const handleAnimatedDelete = (id) => {
    playTaskDeleteSound();
    setDeletingTodoIds(prev => new Set(prev).add(id));
    setActiveMenuTodoId(null);
    setTimeout(() => {
      deleteTodo(id);
      setDeletingTodoIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 280);
  };

  const toggleTodo = async (id) => {
    // Optimistic UI update
    const todoToToggle = todos.find(t => t.id === id);
    if (!todoToToggle) return;
    
    const newStatus = !todoToToggle.completed;
    setTodos(todos.map(t => t.id === id ? { ...t, completed: newStatus } : t));
    
    if (newStatus) {
      playTaskCheckSound(); // Play joyful checkmark double-chime!
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent("ifocus_task_completed", { detail: { id } }));
      }
    }
    
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newStatus })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to toggle todo:", err);
      alert("Failed to update task.");
      // Revert on failure
      setTodos(todos.map(t => t.id === id ? { ...t, completed: !newStatus } : t));
    }
  };

  const deleteTodo = async (id) => {
    // Optimistic UI update
    const previousTodos = [...todos];
    setTodos(todos.filter(t => t.id !== id));
    
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to delete todo:", err);
      alert("Failed to delete task.");
      setTodos(previousTodos); // Revert on failure
    }
  };

  const clearCompleted = async () => {
    const completedTodos = todos.filter(t => t.completed);
    if (completedTodos.length === 0) return;
    
    // Optimistic UI update
    const previousTodos = [...todos];
    setTodos(todos.filter(t => !t.completed));
    
    try {
      // The API doesn't have a bulk delete, so we fire them individually
      const responses = await Promise.all(completedTodos.map(t => 
        fetch(`/api/todos/${t.id}`, { method: 'DELETE' })
      ));
      
      const failed = responses.filter(r => !r.ok);
      if (failed.length > 0) throw new Error("Some deletions failed");
    } catch (err) {
      console.error("Failed to clear completed todos:", err);
      alert("Failed to clear some tasks.");
      setTodos(previousTodos); // Revert on failure
    }
  };

  const filteredTodos = todos.filter(t => {
    if (todoFilter === 'Active') return !t.completed;
    if (todoFilter === 'Done') return t.completed;
    return true;
  });

  // AI Coach Logic
  const submitReflection = async () => {
    const text = reflectionInput.trim();
    const inputError = reflectionInputError(text);
    setReflectionError(inputError);
    if (inputError) return;
    setIsSubmittingReflection(true);
    setAiFeedback(null);

    let feedback = "Keep up the great work!";
    let state = "Engaged";
    let timerLabel = "Focus Time";
    let rhythmStr = "25m Focus / 5m Rest";
    let targetSessions = 4;
    let customWork = { min: 25, sec: 0 };
    let customBreak = { min: 5, sec: 0 };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25-second robust timeout
      
      const activeTasks = todos.filter(t => !t.completed).map(t => ({ id: t.id, text: t.text, priority: t.priority }));
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tasks: activeTasks }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (res.ok) {
        feedback = data.actionPlan || "Focus plan optimized.";
        state = data.state || "Engaged";
        
        playAlertSound();
        
        // Task Reordering
        if (data.orderedIds && data.orderedIds.length > 0) {
            const activeTodos = todos.filter(t => !t.completed);
            const completedTodos = todos.filter(t => t.completed);
            const reorderedActive = [];
            
            data.orderedIds.forEach(id => {
                const cleanId = String(id).trim();
                const todo = activeTodos.find(t => String(t.id).trim() === cleanId);
                if (todo) reorderedActive.push(todo);
            });
            activeTodos.forEach(todo => {
                if (!reorderedActive.find(t => String(t.id) === String(todo.id))) reorderedActive.push(todo);
            });
            const newOrder = [...reorderedActive, ...completedTodos];
            setTodos(newOrder);
            
            // Persist order
            fetch('/api/todos/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: newOrder.map(t => t.id) })
            }).catch(e => console.error("Failed to sync order:", e));
        }
        
        // Adaptive Session & Rhythm Targeting from AI (Strictly 1 to 5)
        targetSessions = Math.min(5, Math.max(1, parseInt(data.targetSessions, 10) || (state === "Stressed" ? 2 : state === "Distracted" ? 3 : 4)));

        // Adjust Timer based on state and AI returned minutes
        setIsActive(false);
        setIsFocus(true);
        setTimerPreset('Custom');

        const workMin = parseInt(data.workMinutes, 10) || (
          state === "Stressed" ? 15 :
          state === "Distracted" ? 20 :
          state === "Motivated" ? 50 : 25
        );
        const breakMin = parseInt(data.breakMinutes, 10) || (
          workMin >= 50 ? 10 : 5
        );

        customWork = { min: workMin, sec: 0 };
        customBreak = { min: breakMin, sec: 0 };
        rhythmStr = `${workMin}m Focus / ${breakMin}m Rest`;
        timerLabel = state === "Stressed" ? "Gentle Focus (Stressed)"
          : state === "Distracted" ? "Strict Pomodoro (Distracted)"
          : state === "Motivated" ? "Flow State (Motivated)"
          : `Balanced Cadence (${state})`;

        setCustomWorkTime(customWork);
        setCustomBreakTime(customBreak);
        setCustomSessions(targetSessions);
        setSessionCount(1);
        setTimeLeft(customWork.min * 60);

        // Persist AI adapted custom timer and sync
        try {
          localStorage.setItem('ifocus_custom_timer', JSON.stringify({
            customWorkTime: customWork,
            customBreakTime: customBreak,
            customSessions: targetSessions,
            customWorkDuration: customWork.min * 60,
            customBreakDuration: customBreak.min * 60
          }));
          const syncPayload = {
            isRunning: false,
            isFocus: true,
            timeLeft: customWork.min * 60,
            totalTime: customWork.min * 60,
            timerPreset: 'Custom',
            customWorkDuration: customWork.min * 60,
            customBreakDuration: customBreak.min * 60,
            customSessions: targetSessions,
            sessionCount: 1,
            presencePaused: false,
            lastPresenceElapsed: 0,
            lastPresenceRemaining: customWork.min * 60,
            lastPresenceCheckElapsed: 0,
            breakGatePending: false
          };
          localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
          window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));
        } catch (e) {}
        
        const aiReplyData = {
          title: timerLabel,
          message: feedback,
          state: state,
          rhythm: rhythmStr,
          sessions: targetSessions,
          reorderedCount: data.orderedIds?.length || 0
        };

        setAiFeedback(aiReplyData);
        setIsAiAdjustedTimer(true);
        setAiAdjustedDetails(aiReplyData);
        try {
          localStorage.setItem('ifocus_ai_adjusted_active', 'true');
          localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify(aiReplyData));
        } catch (e) {}

        // Trigger AI Coach Intervention in Local Storage if not Engaged/Motivated
        if (state === "Stressed" || state === "Distracted") {
          const telemetryKey = `ifocus_telemetry_insight_${userName}`;
          localStorage.setItem(telemetryKey, JSON.stringify({
            reason: `Coach noticed you are feeling ${state.toLowerCase()} based on your journal entry.`,
            actionPlan: feedback,
            timestamp: new Date().toISOString()
          }));
        }

        // Save latest telemetry payload for Analytics and Coach
        try {
          const isTense = state === "Stressed" || state === "Distracted";
          const telemPayload = {
            state: state,
            fatigueLevel: isTense ? "High" : state === "Fatigued" ? "Elevated" : "Low",
            reason: feedback || text,
            sentiment: state,
            errorRate: telemetryStats.errorRate,
            backspaces: telemetryStats.backspaces,
            dwell: telemetryStats.dwell,
            flight: telemetryStats.flight,
            source: 'reflection_submission',
            timestamp: new Date().toISOString()
          };
          localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(telemPayload));
          window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated', { detail: telemPayload }));

          // Sync reflection sentiment to cloud for multi-device parity
          fetch('/api/user/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telemetryState: {
                latestTelemetry: telemPayload,
                updatedAt: new Date().toISOString()
              }
            })
          }).catch(() => {});
        } catch (e) {}

        setReflectionInput('');
        
        // Save to journal history with AI reply included
        const newEntry = {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          text: text,
          state: state,
          aiReply: aiReplyData
        };
        saveHistory([newEntry, ...pastEntries]);

      } else {
        setReflectionError(data.error || 'Could not analyze this reflection. Please try again.');
      }

    } catch (err) {
      console.warn("Reflection submit error:", err);
      // Save local telemetry fallback if catch triggered
      const lower = text.toLowerCase();
      const isStress = lower.includes('stress') || lower.includes('anxi') || lower.includes('worr') || lower.includes('frustrat') || lower.includes('tired') || lower.includes('overwhelm');
      const isDistracted = lower.includes('distract') || lower.includes('bore') || lower.includes('scroll') || lower.includes('procrastinat');
      const isMotivated = lower.includes('motivat') || lower.includes('ready') || lower.includes('energ') || lower.includes('excite');
      
      const fallbackState = isStress ? "Stressed" : isDistracted ? "Distracted" : isMotivated ? "Motivated" : "Engaged";
      const fallbackSessions = isStress ? 2 : isDistracted ? 3 : 4;
      const fallbackWork = isStress ? { min: 15, sec: 0 } : isDistracted ? { min: 20, sec: 0 } : isMotivated ? { min: 50, sec: 0 } : { min: 25, sec: 0 };
      const fallbackBreak = isMotivated ? { min: 10, sec: 0 } : { min: 5, sec: 0 };
      const fallbackRhythm = `${fallbackWork.min}m Focus / ${fallbackBreak.min}m Rest`;
      const fallbackTitle = fallbackState === "Stressed" ? "Gentle Focus (Stressed)" 
        : fallbackState === "Distracted" ? "Strict Pomodoro (Distracted)"
        : fallbackState === "Motivated" ? "Flow State (Motivated)"
        : "Balanced Cadence (Engaged)";

      let fallbackMessage = "Solid reflection logged! Maintain a steady focus pace with periodic restorative micro-breaks.";
      if (fallbackState === "Stressed") {
        fallbackMessage = "I noticed friction and pressure in your reflection. I've adjusted your timer to a gentle 15-minute interval across 2 short sessions with lighter tasks first to build calm momentum.";
      } else if (fallbackState === "Distracted") {
        fallbackMessage = "Distractions happen—the key is lowering friction. I've set a focused 20-minute Pomodoro across 3 structured cycles to eliminate task-switching.";
      } else if (fallbackState === "Motivated") {
        fallbackMessage = "Great energy detected! I've scheduled 50-minute deep work intervals across 4 cycles to capitalize on your peak alertness.";
      }

      try {
        const telemPayload = {
          state: fallbackState,
          fatigueLevel: isStress ? "High" : isDistracted ? "Elevated" : "Low",
          reason: isStress ? "Frustration / stress sentiment detected in journal reflection." : "Focus reflection logged.",
          sentiment: fallbackState,
          errorRate: telemetryStats.errorRate,
          backspaces: telemetryStats.backspaces,
          source: 'reflection_submission_fallback',
          timestamp: new Date().toISOString()
        };
        localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(telemPayload));
        window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated', { detail: telemPayload }));
      } catch (e) {}
      
      // In fallback, also smartly reorder tasks locally so tasks NEVER stay stuck
      const activeTodos = todos.filter(t => !t.completed);
      const completedTodos = todos.filter(t => t.completed);
      let reorderedActive = [...activeTodos];
      if (fallbackState === 'Stressed') {
        const pMap = { Low: 1, Medium: 2, High: 3 };
        reorderedActive.sort((a, b) => (pMap[a.priority] || 2) - (pMap[b.priority] || 2));
      } else {
        const pMap = { High: 1, Medium: 2, Low: 3 };
        reorderedActive.sort((a, b) => (pMap[a.priority] || 2) - (pMap[b.priority] || 2));
      }
      const newOrder = [...reorderedActive, ...completedTodos];
      setTodos(newOrder);
      fetch('/api/todos/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: newOrder.map(t => t.id) })
      }).catch(() => {});

      const fallbackReply = {
        title: fallbackTitle,
        message: fallbackMessage,
        state: fallbackState,
        rhythm: fallbackRhythm,
        sessions: fallbackSessions,
        reorderedCount: activeTodos.length
      };

      // In fallback, also ACTUALLY adjust timer so it matches!
      setTimerPreset('Custom');
      setCustomWorkTime(fallbackWork);
      setCustomBreakTime(fallbackBreak);
      setCustomSessions(fallbackSessions);
      setSessionCount(1);
      setTimeLeft(fallbackWork.min * 60);

      try {
        localStorage.setItem('ifocus_custom_timer', JSON.stringify({
          customWorkTime: fallbackWork,
          customBreakTime: fallbackBreak,
          customSessions: fallbackSessions,
          customWorkDuration: fallbackWork.min * 60,
          customBreakDuration: fallbackBreak.min * 60
        }));
        const syncPayload = {
          isRunning: false,
          isFocus: true,
          timeLeft: fallbackWork.min * 60,
          totalTime: fallbackWork.min * 60,
          timerPreset: 'Custom',
          customWorkDuration: fallbackWork.min * 60,
          customBreakDuration: fallbackBreak.min * 60,
          customSessions: fallbackSessions,
          sessionCount: 1,
          presencePaused: false,
          lastPresenceElapsed: 0,
          lastPresenceRemaining: fallbackWork.min * 60,
          lastPresenceCheckElapsed: 0,
          breakGatePending: false
        };
        localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
        window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));
      } catch (e) {}

      setAiFeedback(fallbackReply);
      setIsAiAdjustedTimer(true);
      setAiAdjustedDetails(fallbackReply);
      try {
        localStorage.setItem('ifocus_ai_adjusted_active', 'true');
        localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify(fallbackReply));
      } catch (e) {}

      setReflectionInput('');

      const fallbackEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        text: text,
        state: fallbackState,
        aiReply: fallbackReply
      };
      saveHistory([fallbackEntry, ...pastEntries]);
    } finally {
      setIsSubmittingReflection(false);
    }
  };

  // Calculate Progress Percent for Pomodoro Progress Bar
  const getTotalTime = () => {
    // If AI Prescribed Rest Recovery is active, break is strictly 5 minutes (300s)
    if (!isFocus && isAiRestRecovery) {
      return 5 * 60;
    }
    const workMin = parseInt(customWorkTime.min) || 0;
    const workSec = parseInt(customWorkTime.sec) || 0;
    const customWorkDuration = (workMin * 60 + workSec) || 25 * 60;
    const breakMin = parseInt(customBreakTime.min) || 0;
    const breakSec = parseInt(customBreakTime.sec) || 0;
    const customBreakDuration = (breakMin * 60 + breakSec) || 5 * 60;

    if (timerPreset === 'Custom') {
      return isFocus ? customWorkDuration : customBreakDuration;
    }

    if (sessionTotalTime && sessionTotalTime > 0) {
      if (isFocus && sessionTotalTime >= 60) return sessionTotalTime;
      if (!isFocus && sessionTotalTime >= 30) return sessionTotalTime;
    }

    if (isFocus) {
      return (parseInt(timerPreset.split('/')[0]) || 25) * 60;
    } else {
      return (parseInt(timerPreset.split('/')[1]) || 5) * 60;
    }
  };
  const totalTime = getTotalTime();
  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / (totalTime || 1)) * 100));
  const activeTask = todos.find(t => !t.completed);

  return (
    <div className="command-center-layout" onClick={() => { setActiveMenuTodoId(null); setIsPriorityDropdownOpen(false); }}>
      {/* Background Audio Element */}
      {/* Global audio is managed in GlobalTimer */}

      {/* Column 1: Task Command Center (Apple Reminders iOS Style) */}
      <div className="glass-panel dashboard-tasks-column" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '1.4rem 1.45rem', overflow: 'hidden' }}>
        
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Tasks List</h2>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {todos.filter(t => t.completed).length}/{todos.length} Done
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            {todos.some(t => t.completed) && (
              <button 
                onClick={clearCompleted} 
                style={{ 
                  background: 'rgba(239, 68, 68, 0.08)', 
                  border: '1px solid rgba(239, 68, 68, 0.15)', 
                  fontSize: '0.72rem', 
                  fontWeight: 500,
                  color: '#ef4444', 
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                title="Clear all completed tasks"
              >
                Clear Done
              </button>
            )}
            <div className="sync-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
              <span className="dot"></span>
              Cloud Synced
            </div>
          </div>
        </div>

        {/* Quick Add Bar */}
        <div className="task-quick-add" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: '#ffffff',
          border: '1px solid rgba(0, 0, 0, 0.08)',
          borderRadius: '14px',
          padding: '4px 6px',
          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)',
          margin: '0.45rem 0'
        }}>
          <input 
            type="text" 
            placeholder="Add a new task..." 
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            style={{
              flex: 1,
              minWidth: '110px',
              height: '34px',
              fontSize: '0.86rem',
              padding: '0 0.55rem',
              border: 'none',
              background: 'transparent',
              outline: 'none'
            }}
          />
          {/* Custom Effort Level Dropdown Pill (iOS Style) */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsPriorityDropdownOpen(!isPriorityDropdownOpen);
              }}
              title="Select task effort level"
              style={{
                height: '32px',
                fontSize: '0.78rem',
                fontWeight: 600,
                padding: '0 0.6rem',
                border: '1px solid rgba(0,0,0,0.08)',
                borderRadius: '8px',
                background: todoPriority === 'high' ? 'rgba(239, 68, 68, 0.08)' : todoPriority === 'low' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                color: todoPriority === 'high' ? '#ef4444' : todoPriority === 'low' ? '#10b981' : '#d97706',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                flexShrink: 0,
                transition: 'all 0.18s ease'
              }}
            >
              {/* Lightning / Energy Gauge Icon */}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.9 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
              </svg>
              <span>{todoPriority === 'high' ? 'High Effort' : todoPriority === 'low' ? 'Low Effort' : 'Med Effort'}</span>
              <svg 
                width="10" 
                height="10" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                style={{
                  transform: isPriorityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  marginLeft: '2px'
                }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {/* Floating iOS Dropdown Popover */}
            {isPriorityDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 5px)',
                  right: 0,
                  width: '160px',
                  background: '#ffffff',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 0 1px rgba(0,0,0,0.1)',
                  padding: '5px',
                  zIndex: 100,
                  animation: 'iosPopupSpring 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Label */}
                <div style={{ padding: '3px 8px 6px', borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    Work Effort Level
                  </span>
                </div>

                {[
                  { value: 'low', label: 'Low Effort', sub: 'Quick • Light', color: '#10b981', bg: 'rgba(16, 185, 129, 0.08)' },
                  { value: 'medium', label: 'Med Effort', sub: 'Steady • Moderate', color: '#d97706', bg: 'rgba(245, 158, 11, 0.08)' },
                  { value: 'high', label: 'High Effort', sub: 'Deep Focus • Heavy', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setTodoPriority(p.value);
                      setIsPriorityDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '7px',
                      border: 'none',
                      background: todoPriority === p.value ? p.bg : 'transparent',
                      color: todoPriority === p.value ? p.color : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s ease',
                      marginBottom: '2px'
                    }}
                    onMouseEnter={(e) => {
                      if (todoPriority !== p.value) e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      if (todoPriority !== p.value) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: todoPriority === p.value ? 700 : 600 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.color }}></span>
                        <span>{p.label}</span>
                      </div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', marginLeft: '12px', marginTop: '1px' }}>
                        {p.sub}
                      </div>
                    </div>
                    {todoPriority === p.value && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={p.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button 
            type="button" 
            onClick={addTodo} 
            className="task-add-button"
            style={{
              background: '#4e8253',
              color: '#ffffff',
              border: 'none',
              padding: '0 0.95rem',
              height: '32px',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: '8px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(78, 130, 83, 0.3)'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            + Add
          </button>
        </div>

        {/* Category Filter Pills (Directly below Add Bar) */}
        <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.65rem' }}>
          {['All', 'Active', 'Done'].map(filter => (
            <button 
              key={filter}
              onClick={() => setTodoFilter(filter)}
              style={{ 
                background: todoFilter === filter ? '#ffffff' : 'rgba(0,0,0,0.04)',
                border: todoFilter === filter ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
                boxShadow: todoFilter === filter ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                padding: '0.22rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.76rem',
                cursor: 'pointer',
                fontWeight: todoFilter === filter ? 600 : 400,
                color: todoFilter === filter ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              {filter} {filter === 'All' ? `(${todos.length})` : filter === 'Active' ? `(${todos.filter(t => !t.completed).length})` : `(${todos.filter(t => t.completed).length})`}
            </button>
          ))}
        </div>

        {/* Tasks List */}
        <div className="todo-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingRight: '2px' }}>
          {loadingTodos ? (
            <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading tasks...</p>
          ) : filteredTodos.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: '2.5rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              <p>No tasks in this category.</p>
            </div>
          ) : (
            filteredTodos.map((todo) => (
              <div 
                key={todo.id} 
                className={`todo-item ${todo.completed ? 'completed' : ''} ${deletingTodoIds.has(todo.id) ? 'deleting' : ''}`}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderLeft: `3.5px solid ${todo.priority === 'high' ? '#ef4444' : todo.priority === 'low' ? '#10b981' : '#f59e0b'}`
                }}
              >
                <div 
                  className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id)}
                  title={todo.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {todo.completed && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  )}
                </div>

                {editingTodoId === todo.id ? (
                  <div style={{ display: 'flex', flex: 1, gap: '0.35rem', alignItems: 'center' }}>
                    <input 
                      type="text"
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditedTodo(todo.id);
                        if (e.key === 'Escape') setEditingTodoId(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        height: '30px',
                        fontSize: '0.86rem',
                        padding: '0 0.45rem',
                        borderRadius: '6px',
                        border: '1px solid #4e8253',
                        background: '#ffffff',
                        outline: 'none'
                      }}
                    />
                    <select
                      value={editingPriority}
                      onChange={(e) => setEditingPriority(e.target.value)}
                      style={{
                        height: '30px',
                        fontSize: '0.75rem',
                        padding: '0 0.25rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(0,0,0,0.1)',
                        background: 'rgba(0,0,0,0.03)'
                      }}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Med</option>
                      <option value="high">High</option>
                    </select>
                    <button
                      onClick={() => saveEditedTodo(todo.id)}
                      style={{
                        background: '#4e8253',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0 0.5rem',
                        height: '30px',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                      title="Save changes"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </button>
                    <button
                      onClick={() => setEditingTodoId(null)}
                      style={{
                        background: 'rgba(0,0,0,0.06)',
                        color: 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0 0.5rem',
                        height: '30px',
                        fontSize: '0.8rem',
                        cursor: 'pointer'
                      }}
                      title="Cancel"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="todo-text">{todo.text}</span>
                    
                    {/* Action Menu: Smooth Animated Action Pill */}
                    {activeMenuTodoId === todo.id || closingMenuTodoId === todo.id ? (
                      <div 
                        className={`todo-action-pill ${closingMenuTodoId === todo.id ? 'closing' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="action-pill-btn edit"
                          onClick={() => startEditingTodo(todo)}
                          title="Edit this task"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="action-pill-btn delete"
                          onClick={() => handleAnimatedDelete(todo.id)}
                          title="Delete this task"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          Delete
                        </button>
                        <button
                          type="button"
                          className="action-pill-close"
                          onClick={() => closeActionMenu(todo.id)}
                          title="Close options"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span className={`todo-priority-badge ${todo.priority || 'medium'}`}>{todo.priority || 'medium'}</span>
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuTodoId(todo.id);
                          }}
                          title="Task options"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '50%',
                            width: '26px',
                            height: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2"></circle>
                            <circle cx="12" cy="12" r="2"></circle>
                            <circle cx="12" cy="19" r="2"></circle>
                          </svg>
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 2: Pomodoro Timer & Audio Centerpiece (Full Height) */}
      <div className="glass-panel dashboard-timer-column" id="dashboardTimerSection" style={{ overflow: 'hidden', minWidth: 0, boxSizing: 'border-box' }}>
        
        {/* Dynamic Ambient Audio Island Widget */}
        <div 
          className="ambient-island-widget"
          onClick={() => setIsAudioModalOpen(true)}
          title="Click to open Soundscape Player"
          style={{ marginBottom: '0.25rem' }}
        >
          <div className={`ambient-wave ${isPlaying ? 'playing' : ''}`}>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
              {currentTrack}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              {isPlaying ? 'Playing • Click for tracks' : 'Audio • Soundscapes'}
            </span>
          </div>
          <button 
            type="button"
            id="dashboardMusicToggleBtn"
            onClick={(e) => { e.stopPropagation(); handleTogglePlayback(); }}
            style={{ 
              background: isPlaying ? 'var(--primary-accent)' : 'rgba(0,0,0,0.06)', 
              color: isPlaying ? 'white' : 'var(--text-primary)',
              border: 'none', 
              borderRadius: '50%', 
              width: '28px', 
              height: '28px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.8rem',
              marginLeft: '4px'
            }}
          >
            {isPlaying ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
          </button>
        </div>

        {/* Ongoing / Break Status Indicator (Automatic Pomodoro Phase Badge - Non-interactive) */}
        <div 
          className="ios-segmented-control" 
          style={{ 
            margin: '0.25rem 0', 
            pointerEvents: 'none', 
            userSelect: 'none', 
            cursor: 'default' 
          }}
          title={isFocus ? "Current Mode: Ongoing Focus Session" : "Current Mode: Rest Break"}
        >
          <div 
            className={`ios-segment-btn ${isFocus ? 'active' : ''}`}
            style={{ cursor: 'default' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>Ongoing</span>
          </div>
          <div 
            className={`ios-segment-btn ${!isFocus ? 'active' : ''}`}
            style={{ cursor: 'default' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            <span>Break</span>
          </div>
        </div>

        {/* Active BreakGate Status Indicator Badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', width: '100%', marginBottom: '0.4rem' }}>
          {activeBreakGateDeck ? (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(46, 125, 50, 0.1)',
                border: '1px solid rgba(46, 125, 50, 0.28)',
                borderRadius: '999px',
                padding: '0.3rem 0.85rem',
                fontSize: '0.78rem',
                color: '#2e7d32',
                fontWeight: 600,
                boxShadow: '0 1px 4px rgba(46, 125, 50, 0.08)'
              }}
              title="Flashcard challenge active on break"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span>BreakGate Active: <strong>{activeBreakGateDeck.title}</strong></span>
            </div>
          ) : (
            <div 
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                background: 'rgba(0, 0, 0, 0.03)',
                border: '1px solid rgba(0, 0, 0, 0.08)',
                borderRadius: '999px',
                padding: '0.3rem 0.85rem',
                fontSize: '0.78rem',
                color: 'var(--text-secondary)',
                fontWeight: 500
              }}
              title="No flashcard deck active for BreakGate"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>BreakGate: Inactive</span>
            </div>
          )}
          <HelpButton topic="breakgate" title="BreakGate Challenge Tutorial" />
        </div>

        {/* AI Prescribed Rest Recovery Banner */}
        {isAiRestRecovery && !isFocus && (
          <div 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: 'rgba(39, 82, 45, 0.08)',
              border: '1px solid rgba(39, 82, 45, 0.22)',
              borderRadius: '999px',
              padding: '0.32rem 0.95rem',
              fontSize: '0.78rem',
              color: '#27522d',
              fontWeight: 700,
              marginBottom: '0.45rem',
              boxShadow: '0 1px 4px rgba(39, 82, 45, 0.06)',
              animation: 'fadeIn 0.2s ease-out'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>AI Prescribed Rest: 5m Recovery Protocol</span>
          </div>
        )}

        {/* Grand Circular Pomodoro Timer Ring - Enlarged Centerpiece Hero */}
        <div 
          className={`timer-circle ${!isFocus ? 'break-mode' : ''}`}
          style={{ 
            '--progress': `${progressPercent}%`
          }}
        >
          <div className="timer-inner">
            <div className="timer-display">
              {formatTime(timeLeft)}
            </div>
            <div className="timer-label">
              {isFocus ? 'Focus Time' : (isAiRestRecovery ? 'AI Restorative Break' : 'Break Time')}
            </div>
          </div>
        </div>

        {/* Controls (Reset, Start/Stop Pill, Settings) */}
        <div className="ios-timer-actions" style={{ margin: '0.35rem 0' }}>
          <button 
            id="timerResetBtn"
            className="ios-circle-action-btn"
            onClick={resetTimer}
            title="Reset Timer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>

          <button 
            id="timerToggleBtn"
            className={`ios-pill-action-btn ${isActive ? 'paused' : ''}`}
            onClick={toggleTimer}
            style={{
              background: isActive ? '#1e3f23' : '#27522d',
              padding: '0.7rem 2.4rem',
              borderRadius: '9999px',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '0.98rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px -4px rgba(39, 82, 45, 0.35)',
              transition: 'all 0.2s ease'
            }}
          >
            {isActive ? (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                <span>Stop</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                <span>Start</span>
              </>
            )}
          </button>

          <button 
            className="ios-circle-action-btn"
            onClick={handleOpenCustomSettings}
            title="Custom Timer Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>

        {/* Skip Break Action (Appears during Break mode to advance to next Focus session immediately) */}
        {!isFocus && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.45rem', animation: 'fadeIn 0.2s ease-out' }}>
            <button
              type="button"
              id="skipBreakBtn"
              onClick={handleSkipBreak}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.45rem 1.15rem',
                borderRadius: '9999px',
                background: '#27522d',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(39, 82, 45, 0.28)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#1e4023';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#27522d';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title="Skip remaining break and begin your next focus block"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                <line x1="19" y1="5" x2="19" y2="19"></line>
              </svg>
              <span>Skip Break & Start Session {isAiRestRecovery ? (sessionCount || 1) : Math.min((sessionCount || 1) + 1, timerPreset === 'Custom' ? (customSessions || 1) : 4)}</span>
            </button>
          </div>
        )}

        {/* Quit & Save Progress Option (Appears only after focusing for at least 1 full minute) */}
        {isFocus && (totalTime - timeLeft >= 60) && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.35rem', animation: 'fadeIn 0.2s ease-out' }}>
            <button
              type="button"
              id="finishAndSaveEarlyBtn"
              onClick={() => setShowQuitModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.35rem 0.95rem',
                borderRadius: '9999px',
                background: 'rgba(39, 82, 45, 0.08)',
                border: '1px solid rgba(39, 82, 45, 0.24)',
                color: '#1b4324',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 2px 6px rgba(39, 82, 45, 0.06)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(39, 82, 45, 0.16)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(39, 82, 45, 0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
              title="End session now and record your study time in Analytics"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                <polyline points="17 21 17 13 7 13 7 21"></polyline>
                <polyline points="7 3 7 8 15 8"></polyline>
              </svg>
              <span>Quit & Save Progress ({Math.floor((totalTime - timeLeft) / 60)}m)</span>
            </button>
          </div>
        )}

        {/* Presets Row */}
        <div className="pomodoro-settings" style={{ margin: 0 }}>
          {['25/5', '50/10', '15/3', '90/20'].map(preset => (
            <button 
              key={preset}
              className={`pomodoro-preset ${timerPreset === preset ? 'active' : ''}`}
              onClick={() => setPreset(preset)}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              {preset}
            </button>
          ))}
        </div>

        {isAiAdjustedTimer && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.35rem' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#27522d',
              background: 'rgba(39, 82, 45, 0.1)',
              border: '1px solid rgba(39, 82, 45, 0.22)',
              borderRadius: '20px',
              padding: '2px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 14 14"/>
              </svg>
              AI Optimized Rhythm Active
            </span>
          </div>
        )}

        {/* Session Indicator Dots */}
        {(() => {
          const totalSessions = timerPreset === 'Custom' ? (customSessions || 1) : 4;
          const currentDisplaySession = Math.min(Math.max(1, sessionCount || 1), totalSessions);
          return (
            <div className="session-counter" style={{ margin: 0, fontSize: '0.8rem' }}>
              {isFocus 
                ? `Session ${currentDisplaySession} of ${totalSessions}` 
                : (isAiRestRecovery 
                    ? `Rest Recovery • Next: Session ${currentDisplaySession} of ${totalSessions}` 
                    : `Break Time • Next: Session ${Math.min(currentDisplaySession + 1, totalSessions)} of ${totalSessions}`)
              }
              <div className="session-dots" style={{ marginTop: '0.4rem' }}>
                {Array.from({ length: totalSessions }).map((_, i) => (
                  <div key={i} className={`session-dot ${isAiRestRecovery ? '' : (i < currentDisplaySession ? 'current' : '')}`}></div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Column 3: Daily Progress + Quick Reflection & AI Coach */}
      <div className="dashboard-column-3" style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', height: '100%', minHeight: 0 }}>
        
        {/* Top Card: Enlarged Daily Progress & Luxury Inspiring Quote */}
        <div className="glass-panel dashboard-daily-progress-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.35rem 1.45rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Daily Progress</h2>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                <span style={{ fontWeight: 600, color: 'var(--primary-accent)' }}>{todos.filter(t => t.completed).length}/{todos.length || 0}</span> Tasks was done
              </div>
            </div>

            {/* Silky-Smooth Animated SVG Progress Ring */}
            <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                {/* Background Track */}
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="5"
                />
                {/* Smooth Animated Progress Stroke */}
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="var(--primary-accent)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 * (1 - (todos.length ? todos.filter(t => t.completed).length / todos.length : 0))}
                  style={{ transition: 'stroke-dashoffset 0.75s cubic-bezier(0.4, 0, 0.2, 1)' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {Math.round((todos.filter(t => t.completed).length / (todos.length || 1)) * 100)}%
              </div>
            </div>
          </div>

          {/* Daily Momentum Mini Stats (Focus Time, Sessions, Streak) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.5rem',
            padding: '0.65rem 0.6rem',
            background: 'rgba(0, 0, 0, 0.02)',
            borderRadius: '14px',
            border: '1px solid rgba(0, 0, 0, 0.05)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Focus
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--primary-accent)', marginTop: '2px' }}>
                {formatFocusMinutes(dailyFocusStats.minutes)}
              </div>
            </div>
            <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(0, 0, 0, 0.06)', borderRight: '1px solid rgba(0, 0, 0, 0.06)' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Sessions
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2563eb', marginTop: '2px' }}>
                {dailyFocusStats.sessions}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.64rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Streak
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 800, color: '#d97706', marginTop: '2px' }}>
                {dailyFocusStats.streak} {dailyFocusStats.streak === 1 ? 'Day' : 'Days'}
              </div>
            </div>
          </div>

          {/* Luxury High-Contrast Focus Quote Widget */}
          <div style={{
            marginTop: '0.15rem',
            padding: '0.95rem 1.15rem',
            background: '#f2f7f3',
            border: '1px solid rgba(78, 130, 83, 0.18)',
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(78, 130, 83, 0.05)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ 
                fontSize: '0.68rem', 
                fontWeight: 700, 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px', 
                color: '#346b3a',
                background: 'rgba(78, 130, 83, 0.12)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                Daily Mindset
              </span>
              <button
                type="button"
                onClick={shuffleQuote}
                title="Get another quote"
                style={{
                  background: '#ffffff',
                  border: '1px solid rgba(0,0,0,0.06)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--primary-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path></svg>
              </button>
            </div>
            <div style={{ fontSize: '0.86rem', color: '#0f172a', fontStyle: 'italic', lineHeight: '1.45', fontWeight: 500 }}>
              "{currentQuote.quote}"
            </div>
            <div style={{ fontSize: '0.74rem', color: '#346b3a', fontWeight: 600, marginTop: '5px' }}>
              — {currentQuote.author}
            </div>
          </div>

          {/* Task Completion Health Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.55rem 0.85rem',
            background: 'rgba(78, 130, 83, 0.06)',
            borderRadius: '12px',
            border: '1px solid rgba(78, 130, 83, 0.12)',
            fontSize: '0.76rem',
            color: 'var(--text-secondary)'
          }}>
            <span>
              Active: <strong style={{ color: 'var(--text-primary)' }}>{todos.filter(t => !t.completed).length}</strong> pending · <strong style={{ color: 'var(--primary-accent)' }}>{todos.filter(t => t.completed).length}</strong> done
            </span>
            <span style={{ fontWeight: 700, color: '#2e7d32', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {todos.length > 0 && todos.filter(t => t.completed).length === todos.length ? 'All Clear' : 'In Flow'}
            </span>
          </div>
        </div>

        {/* Bottom Card: Quick Reflection & Adaptive AI Coach (Seamless Fit) */}
        <div id="quick-reflection-card" className="glass-panel" style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', padding: '1.35rem 1.4rem', overflow: 'hidden', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.2rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Quick Reflection</h2>
            <HelpButton topic="reflection" title="Quick Reflection & AI Coach Tutorial" />
          </div>
          <p className="subtitle" style={{ fontSize: '0.78rem', marginBottom: '0.6rem', lineHeight: '1.3' }}>Clear your mind. AI coach will adapt your plan.</p>
          
          {/* Quick Starter Inspiration Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.45rem' }}>
            {[
              { label: 'Stressed / Overwhelmed', text: "I'm feeling really stressed with all these deadlines, help me start small." },
              { label: 'Energetic & Ready', text: "I have high energy right now, want to tackle my hardest task first!" },
              { label: 'Start with Medium', text: "I want to start with a medium difficulty task to build momentum." }
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => setReflectionInput(chip.text)}
                style={{
                  background: 'rgba(0,0,0,0.03)',
                  border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: '9999px',
                  padding: '3px 9px',
                  fontSize: '0.72rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(78,130,83,0.1)'; e.currentTarget.style.color = 'var(--primary-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.03)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Always-On Live Keystroke Telemetrics Dashboard Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.35rem 0.75rem',
            marginBottom: '0.5rem',
            background: telemetryStats.state === 'friction' ? 'rgba(239, 68, 68, 0.08)' : telemetryStats.state === 'fast' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(78, 130, 83, 0.08)',
            border: `1px solid ${telemetryStats.state === 'friction' ? 'rgba(239, 68, 68, 0.2)' : telemetryStats.state === 'fast' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(78, 130, 83, 0.2)'}`,
            borderRadius: '10px',
            fontSize: '0.72rem',
            color: telemetryStats.state === 'friction' ? '#dc2626' : telemetryStats.state === 'fast' ? '#2563eb' : 'var(--primary-accent)',
            fontFamily: 'monospace',
            transition: 'all 0.2s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: telemetryStats.state === 'friction' ? '#dc2626' : telemetryStats.state === 'fast' ? '#3b82f6' : '#16a34a',
                boxShadow: telemetryStats.totalKeystrokes > 0 ? `0 0 8px ${telemetryStats.state === 'friction' ? '#dc2626' : telemetryStats.state === 'fast' ? '#3b82f6' : '#16a34a'}` : 'none'
              }}></span>
              <span>
                Flight: <strong>{telemetryStats.flight ? `${telemetryStats.flight}ms` : '--'}</strong> | Dwell: <strong>{telemetryStats.dwell ? `${telemetryStats.dwell}ms` : '--'}</strong> | BS: <strong>{telemetryStats.backspaces}</strong> ({telemetryStats.errorRate}%)
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', fontWeight: 600 }}>
              {telemetryStats.speedLabel}
            </span>
          </div>

          {/* Expanded Textarea with Telemetry Event Listeners */}
          <textarea 
            className="journal-textarea" 
            value={reflectionInput}
            onChange={(e) => {
              setReflectionInput(e.target.value);
              handleTelemetryInput(e);
            }}
            onKeyDown={handleTelemetryKeyDown}
            onKeyUp={handleTelemetryKeyUp}
            aria-describedby={reflectionError ? "reflection-input-error" : undefined}
              aria-invalid={Boolean(reflectionError)}
              placeholder="Type how you feel or pick a starter above..."
            disabled={isSubmittingReflection}
            style={{ 
              flex: 1,
              width: '100%',
              minHeight: '120px',
              fontSize: '0.88rem', 
              padding: '0.85rem', 
              marginBottom: '0.75rem', 
              resize: 'none', 
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(0,0,0,0.08)',
              boxSizing: 'border-box'
            }}
          ></textarea>
          {reflectionError && <p id="reflection-input-error" role="alert" className="reflection-input-error">{reflectionError}</p>}
          
          {/* Submit Button */}
          <button 
            className="btn-primary" 
            onClick={() => {
              submitReflection();
              resetTelemetry();
            }}
            disabled={isSubmittingReflection || !reflectionInput.trim()}
            style={{ width: '100%', height: '42px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '9999px', margin: '0 0 0.75rem 0' }}
          >
            {isSubmittingReflection ? (
              "Analyzing with AI Coach..."
            ) : (
              <>
                <span>Submit & Analyze</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>
              </>
            )}
          </button>

          {/* AI Coaching Strategy Tip Box */}
          <div style={{ padding: '0.75rem 0.9rem', background: 'rgba(34, 197, 94, 0.07)', border: '1px solid rgba(34, 197, 94, 0.16)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.2rem' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
              Adaptive AI Coach
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>
              AI analyzes emotional friction, reorders your to-dos, and adapts your focus session.
            </p>
          </div>
        </div>
      </div>

      {/* Ambient Soundscapes Modal */}
      {isAudioModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '460px', width: '92%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Ambient Soundscapes</h2>
                <HelpButton topic="pomodoro" title="Ambient Soundscapes Tutorial" />
              </div>
              <button onClick={() => setIsAudioModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <p className="subtitle" style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>Background audio streams to help you focus.</p>

            {/* Track Selection Cards - Expanded Soundscapes Library */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
              {tracks.map(t => {
                const isCurrent = currentTrack === t.name;
                return (
                  <div 
                    key={t.id}
                    className={`soundscape-card ${isCurrent ? 'active' : ''}`}
                    onClick={() => handleSelectTrack(t.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.85rem',
                      padding: '0.75rem 0.95rem',
                      borderRadius: '14px',
                      background: isCurrent ? 'rgba(46, 125, 50, 0.08)' : 'rgba(0,0,0,0.02)',
                      border: isCurrent ? '1.5px solid var(--primary-accent, #2e7d32)' : '1px solid rgba(0,0,0,0.06)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ 
                      width: '38px', 
                      height: '38px', 
                      borderRadius: '12px', 
                      background: isCurrent ? 'var(--primary-accent, #2e7d32)' : 'rgba(46, 125, 50, 0.12)', 
                      color: isCurrent ? '#ffffff' : 'var(--primary-accent, #2e7d32)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {t.icon === 'coffee' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                      )}
                      {t.icon === 'book' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      )}
                      {t.icon === 'rain' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><line x1="8" y1="19" x2="8" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><line x1="16" y1="19" x2="16" y2="21"></line></svg>
                      )}
                      {t.icon === 'wave' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12c.6 0 1.2-.4 1.7-.8 1.1-.9 2.2-.9 3.3 0 1.1.9 2.2.9 3.3 0 1.1-.9 2.2-.9 3.3 0 1.1.9 2.2.9 3.3 0 .5.4 1.1.8 1.7.8"></path><path d="M2 18c.6 0 1.2-.4 1.7-.8 1.1-.9 2.2-.9 3.3 0 1.1.9 2.2.9 3.3 0 1.1-.9 2.2-.9 3.3 0 1.1.9 2.2.9 3.3 0 .5.4 1.1.8 1.7.8"></path></svg>
                      )}
                      {t.icon === 'brain' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                      )}
                      {t.icon === 'fire' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                      )}
                      {t.icon === 'wind' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path></svg>
                      )}
                      {t.icon === 'moon' && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{t.name}</span>
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', fontWeight: 600 }}>{t.tag}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.desc}</div>
                    </div>
                    {isCurrent && isPlaying ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-accent, #2e7d32)', background: 'rgba(46,125,50,0.12)', padding: '0.25rem 0.65rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary-accent, #2e7d32)' }}></span>
                        Playing
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0.2rem 0.5rem' }}>Select</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary-accent)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '35px' }}>{volume}%</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button"
                id="modalMusicPlayBtn"
                onClick={() => handleTogglePlayback()}
                className="btn-primary" 
                style={{ margin: 0, padding: '0.55rem 1.5rem', borderRadius: '9999px', fontSize: '0.88rem' }}
              >
                {isPlaying ? 'Pause Audio' : 'Play Soundscape'}
              </button>
              <button onClick={() => setIsAudioModalOpen(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem 1.25rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Coach Adaptive Adjustment Modal (Modern Cognitive Design) */}
      {aiFeedback && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.72)', 
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div className={coachStyles.adaptationModal}
            role="dialog" aria-modal="true" aria-label="AI Coach adaptation"
            style={{ 
              background: '#ffffff',
              borderRadius: '20px',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              maxWidth: '430px', 
              width: '100%', 
              maxHeight: 'min(80vh, 520px)',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '1.1rem 1.15rem 1.25rem',
              display: 'flex', 
              flexDirection: 'column', 
              gap: '0.75rem',
              position: 'relative',
              animation: 'slideDown 0.25s ease'
            }}
          >
            {/* Top Close Button */}
            <button
              type="button"
              onClick={() => setAiFeedback(null)}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '0.85rem',
                right: '0.85rem',
                background: 'rgba(0, 0, 0, 0.05)',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.15s ease',
                zIndex: 2
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#1e293b'; e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>

            {/* Header / State Banner */}
            <div style={{ paddingRight: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{
                  background: aiFeedback.state === 'Stressed' ? 'rgba(220, 38, 38, 0.12)' : aiFeedback.state === 'Distracted' ? 'rgba(217, 119, 6, 0.12)' : 'rgba(46, 125, 50, 0.12)',
                  color: aiFeedback.state === 'Stressed' ? '#dc2626' : aiFeedback.state === 'Distracted' ? '#b45309' : '#2e7d32',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  AI COACH ADAPTATION: {String(aiFeedback.state || 'Pacing').toUpperCase()}
                </span>
              </div>
              <h2 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                {aiFeedback.title?.replace('AI Adjusted Timer:\n', '') || 'Pacing Routine Updated'}
              </h2>
            </div>

            {/* 3 Diagnostic Key Chips */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
              <div style={{
                background: '#f8faf8',
                border: '1px solid rgba(95, 143, 94, 0.18)',
                borderRadius: '10px',
                padding: '0.55rem 0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ fontSize: '0.66rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Focus Cadence</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#163824', wordBreak: 'break-word' }}>{aiFeedback.rhythm || 'Adaptive Rhythm'}</div>
              </div>

              <div style={{
                background: '#f8faf8',
                border: '1px solid rgba(95, 143, 94, 0.18)',
                borderRadius: '10px',
                padding: '0.55rem 0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ fontSize: '0.66rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Target Sessions</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#163824' }}>
                  {aiFeedback.sessions || (aiFeedback.state === 'Stressed' ? 2 : 4)} Cycles
                </div>
              </div>

              <div style={{
                background: '#f8faf8',
                border: '1px solid rgba(95, 143, 94, 0.18)',
                borderRadius: '10px',
                padding: '0.55rem 0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ fontSize: '0.66rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase' }}>Task Priority</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#163824' }}>
                  {aiFeedback.state === 'Stressed' ? 'Gentle Momentum' : aiFeedback.state === 'Distracted' ? 'Concrete Steps' : 'High Impact'}
                </div>
              </div>
            </div>

            {/* Coach Action Plan Box */}
            <div className={coachStyles.adaptationGuidance} style={{
              background: '#fafcfa',
              borderLeft: '4px solid #2e7d32',
              borderRadius: '0 12px 12px 0',
              padding: '0.75rem 0.9rem',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
              maxHeight: '170px',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch'
            }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                Strategy & Mentorship Guidance
              </div>
              <p style={{
                margin: 0,
                color: '#334155',
                fontSize: '0.82rem',
                lineHeight: 1.5,
                fontWeight: 500
              }}>
                {aiFeedback.message}
              </p>
            </div>

            {/* Modal Action Button */}
            <button 
              type="button"
              onClick={() => setAiFeedback(null)} 
              className="btn-primary" 
              style={{ 
                width: '100%', 
                padding: '0.65rem 1rem',
                fontSize: '0.86rem',
                fontWeight: 600,
                borderRadius: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(46, 125, 50, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                marginTop: '0.15rem',
                flexShrink: 0
              }}
            >
              <span>Continue to Focus Session</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Custom Timer Modal */}
      {isCustomTimerModalOpen && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            background: 'rgba(15, 23, 42, 0.65)', 
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 1000, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            className="glass-panel modal-content" 
            style={{ 
              maxWidth: '480px', 
              width: '100%', 
              background: 'rgba(255, 255, 255, 0.98)', 
              borderRadius: '24px', 
              padding: '1.75rem',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '0.35rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(39, 82, 45, 0.1)', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, color: '#163824', letterSpacing: '-0.02em' }}>Custom Timer Settings</h2>
                <p className="subtitle" style={{ margin: 0, fontSize: '0.82rem', color: '#557060', marginTop: '2px' }}>Set custom durations and number of sessions.</p>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1.25rem', marginBottom: '1.5rem' }}>
              {/* Work Time Inputs */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#27522d', fontSize: '0.84rem', fontWeight: 700 }}>Work Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      min="0" 
                      max="180" 
                      value={customWorkTime.min === 0 || customWorkTime.min === '0' ? '' : customWorkTime.min} 
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                        setCustomWorkTime(prev => ({ ...prev, min: val }));
                      }} 
                      placeholder="Minutes" 
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '12px', border: '1.5px solid rgba(0, 0, 0, 0.12)', background: '#ffffff', color: '#163824', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }} 
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      min="0" 
                      max="59" 
                      value={customWorkTime.sec === 0 || customWorkTime.sec === '0' ? '' : customWorkTime.sec} 
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                        setCustomWorkTime(prev => ({ ...prev, sec: val }));
                      }} 
                      placeholder="Seconds" 
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '12px', border: '1.5px solid rgba(0, 0, 0, 0.12)', background: '#ffffff', color: '#163824', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }} 
                    />
                  </div>
                </div>
              </div>

              {/* Break Time Inputs */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', color: '#27522d', fontSize: '0.84rem', fontWeight: 700 }}>Break Duration</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      min="0" 
                      max="60" 
                      value={customBreakTime.min === 0 || customBreakTime.min === '0' ? '' : customBreakTime.min} 
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                        setCustomBreakTime(prev => ({ ...prev, min: val }));
                      }} 
                      placeholder="Minutes" 
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '12px', border: '1.5px solid rgba(0, 0, 0, 0.12)', background: '#ffffff', color: '#163824', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }} 
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" 
                      min="0" 
                      max="59" 
                      value={customBreakTime.sec === 0 || customBreakTime.sec === '0' ? '' : customBreakTime.sec} 
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                        setCustomBreakTime(prev => ({ ...prev, sec: val }));
                      }} 
                      placeholder="Seconds" 
                      style={{ width: '100%', padding: '0.65rem 0.85rem', borderRadius: '12px', border: '1.5px solid rgba(0, 0, 0, 0.12)', background: '#ffffff', color: '#163824', fontSize: '0.92rem', fontWeight: 600, outline: 'none' }} 
                    />
                  </div>
                </div>
              </div>

              {/* Total Sessions (1 to 5 Selector) */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <label style={{ margin: 0, color: '#27522d', fontSize: '0.84rem', fontWeight: 700 }}>Total Sessions</label>
                    <span style={{ fontSize: '0.7rem', color: '#166534', fontWeight: 700, background: 'rgba(34, 197, 94, 0.12)', padding: '1px 7px', borderRadius: '4px' }}>
                      {Number(customSessions) || 1} Selected
                    </span>
                  </div>

                  {/* Modern 1 to 5 Selector Bar (No useless text input) */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '4px', 
                    padding: '3px',
                    borderRadius: '12px', 
                    background: '#f3f6f3',
                    border: '1.5px solid rgba(0, 0, 0, 0.1)',
                    height: '42px',
                    boxSizing: 'border-box'
                  }}>
                    {[1, 2, 3, 4, 5].map(n => {
                      const isSelected = (Number(customSessions) || 1) === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCustomSessions(n)}
                          style={{
                            flex: 1,
                            borderRadius: '8px',
                            fontSize: '0.92rem',
                            fontWeight: 700,
                            border: 'none',
                            background: isSelected ? 'var(--primary-accent, #27522d)' : 'transparent',
                            color: isSelected ? '#ffffff' : '#4b5563',
                            cursor: 'pointer',
                            transition: 'all 0.18s ease',
                            boxShadow: isSelected ? '0 2px 8px rgba(39, 82, 45, 0.28)' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: '#6b7280', display: 'block', marginTop: '4px' }}>
                    Click 1 to 5 to set focus session cycles.
                  </span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.4rem' }}>
                    <label style={{ display: 'block', margin: 0, color: '#27522d', fontSize: '0.84rem', fontWeight: 700 }}>BreakGate Questions</label>
                    <HelpButton topic="breakgate" title="BreakGate Questions Tutorial" size={12} style={{ width: '20px', height: '20px' }} />
                  </div>
                  <input 
                    type="number" 
                    min="1" 
                    max="10" 
                    disabled={!activeBreakGateDeck}
                    value={!activeBreakGateDeck ? 0 : (customBreakGateQuestions === 0 || customBreakGateQuestions === '0' ? '' : customBreakGateQuestions)} 
                    onChange={e => {
                      if (!activeBreakGateDeck) return;
                      const val = e.target.value === '' ? '' : Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                      setCustomBreakGateQuestions(val);
                    }} 
                    placeholder={!activeBreakGateDeck ? '0 (Locked)' : 'e.g. 3 Questions'} 
                    style={{ 
                      width: '100%', 
                      padding: '0.65rem 0.85rem', 
                      borderRadius: '12px', 
                      border: '1.5px solid rgba(0, 0, 0, 0.12)', 
                      background: !activeBreakGateDeck ? '#f3f4f6' : '#ffffff', 
                      color: !activeBreakGateDeck ? '#9ca3af' : '#163824', 
                      fontSize: '0.92rem', 
                      fontWeight: 600, 
                      outline: 'none',
                      cursor: !activeBreakGateDeck ? 'not-allowed' : 'text',
                      opacity: !activeBreakGateDeck ? 0.75 : 1
                    }} 
                  />
                  {!activeBreakGateDeck && (
                    <span style={{ fontSize: '0.72rem', color: '#6b7280', display: 'block', marginTop: '0.2rem' }}>
                      Locked to 0. Activate a deck in Flashcards first.
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <button 
                type="button"
                onClick={() => setIsCustomTimerModalOpen(false)} 
                style={{ background: 'transparent', border: '1px solid rgba(0,0,0,0.15)', padding: '0.6rem 1.2rem', borderRadius: '9999px', cursor: 'pointer', color: '#4b5563', fontWeight: 600, fontSize: '0.88rem', transition: 'all 0.15s ease' }}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={saveCustomSettings} 
                className="btn-primary" 
                style={{ padding: '0.6rem 1.4rem', margin: 0, borderRadius: '9999px', fontWeight: 700, fontSize: '0.9rem', boxShadow: '0 4px 14px rgba(39, 82, 45, 0.35)' }}
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* No BreakGate Confirmation Modal */}
      {showNoBreakGateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
          <div className="glass-panel" style={{ maxWidth: '440px', width: '100%', padding: '1.75rem', borderRadius: '20px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(217, 119, 6, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>
                No Active BreakGate
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                You do not have a flashcard deck activated for BreakGate. Would you like to proceed with your focus session without flashcard break gates?
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={startTimerDirectly}
                style={{ width: '100%', padding: '0.75rem', margin: 0 }}
              >
                Proceed Without BreakGate
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowNoBreakGateModal(false);
                  router.push('/flashcards');
                }}
                style={{ width: '100%', padding: '0.7rem' }}
              >
                Choose Deck in Flashcards
              </button>
              <button
                type="button"
                onClick={() => setShowNoBreakGateModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.82rem', padding: '0.35rem' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Finish / Quit Focus Session Early Modal */}
      {showQuitModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
        >
          <div
            style={{
              maxWidth: '440px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '1.85rem',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.28)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'ifocusModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '16px',
                  background: 'rgba(46, 125, 50, 0.12)',
                  color: '#2e7d32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid rgba(46, 125, 50, 0.25)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                  <polyline points="17 21 17 13 7 13 7 21"></polyline>
                  <polyline points="7 3 7 8 15 8"></polyline>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#163824', letterSpacing: '-0.02em' }}>
                  Finish Focus Session?
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#557060', marginTop: '2px' }}>
                  Save your partial study progress to analytics.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(46, 125, 50, 0.08)',
                border: '1px solid rgba(46, 125, 50, 0.22)',
                borderRadius: '14px',
                padding: '0.9rem 1rem',
                fontSize: '0.88rem',
                color: '#163824',
                lineHeight: 1.45,
              }}
            >
              You have focused for <strong>{Math.floor(Math.max(0, totalTime - timeLeft) / 60)} min {Math.max(0, totalTime - timeLeft) % 60} sec</strong>. Would you like to log this study time to your dashboard and analytics?
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.4rem' }}>
              <button
                type="button"
                id="confirmSaveProgressBtn"
                onClick={handleSaveAndEndSession}
                style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: '9999px',
                  background: 'linear-gradient(135deg, #27522d, #1c3d22)',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.94rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(39, 82, 45, 0.4)',
                  transition: 'all 0.15s ease',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Save & Log Progress ({Math.floor(Math.max(0, totalTime - timeLeft) / 60)} min{Math.floor(Math.max(0, totalTime - timeLeft) / 60) > 1 ? 's' : ''})
              </button>

              <button
                type="button"
                id="discardAndResetBtn"
                onClick={() => {
                  setShowQuitModal(false);
                  forceResetTimer();
                }}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                Discard Progress & Reset
              </button>

              <button
                type="button"
                onClick={() => setShowQuitModal(false)}
                style={{
                  padding: '0.35rem 1rem',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontWeight: 500,
                  fontSize: '0.80rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Resume Studying
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Timer Confirmation Modal (Zero Emojis, 100% English) */}
      {showResetConfirmModal && (
        <div
          id="pomodoroResetConfirmModal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
        >
          <div
            style={{
              maxWidth: '430px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '1.85rem',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.28)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'ifocusModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              textAlign: 'center',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(239, 68, 68, 0.22)',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
              </svg>
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.35rem 0', color: '#111827', letterSpacing: '-0.02em' }}>
                Reset to Session 1?
              </h3>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#6b7280', lineHeight: 1.5 }}>
                Are you sure you want to reset the Pomodoro cycle? Current progress on session {sessionCount} will be reset back to session 1.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '0.4rem' }}>
              <button
                type="button"
                id="confirmResetSessionBtn"
                onClick={confirmResetTimer}
                style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  background: '#dc2626',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(220, 38, 38, 0.35)',
                  transition: 'background 0.15s ease',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
                <span>Reset to Session 1</span>
              </button>

              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                style={{
                  padding: '0.75rem',
                  background: 'rgba(0, 0, 0, 0.04)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  borderRadius: '12px',
                  color: '#4b5563',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Prescribed Rest Recovery Early Exit Confirmation Modal */}
      {showAiRestExitModal && (
        <div
          id="aiRestExitModal"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.68)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out forwards',
          }}
          onClick={() => setShowAiRestExitModal(false)}
        >
          <div
            style={{
              maxWidth: '450px',
              width: '100%',
              background: '#ffffff',
              borderRadius: '24px',
              padding: '1.85rem',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.32)',
              border: '1px solid rgba(220, 38, 38, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'ifocusModalPop 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              textAlign: 'center',
              alignItems: 'center',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                background: 'rgba(220, 38, 38, 0.1)',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(220, 38, 38, 0.22)',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>

            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.45rem 0', color: '#111827', letterSpacing: '-0.02em' }}>
                Exit Restorative Break Early?
              </h3>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.55 }}>
                Your AI Study Coach specifically prescribed this 5-minute restorative recovery to prevent cognitive saturation and protect long-term retention. Are you sure you want to end your recovery early?
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '0.4rem' }}>
              <button
                type="button"
                id="continueRestingBtn"
                onClick={() => setShowAiRestExitModal(false)}
                className="btn-primary"
                style={{
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  background: '#27522d',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 8px 20px -4px rgba(39, 82, 45, 0.35)',
                  transition: 'background 0.15s ease',
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Continue Resting (Recommended)
              </button>

              <button
                type="button"
                id="exitRestAnywayBtn"
                onClick={confirmExitRestEarly}
                style={{
                  padding: '0.75rem',
                  background: 'transparent',
                  border: '1px solid rgba(220, 38, 38, 0.35)',
                  borderRadius: '12px',
                  color: '#dc2626',
                  fontWeight: 600,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                Exit Rest Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Schedule Override Confirmation Modal */}
      {pendingTimerChange && (
        <div 
          className="modal-overlay" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(15, 23, 42, 0.7)', 
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            zIndex: 99999, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            padding: '1.25rem',
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            style={{ 
              maxWidth: '460px', 
              width: '100%', 
              background: '#ffffff', 
              borderRadius: '22px', 
              padding: '1.75rem', 
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'slideDown 0.25s ease'
            }}
          >
            {/* Header Icon + Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(46, 125, 50, 0.12)',
                color: '#2e7d32',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: '#163824' }}>
                  Override AI Recommendation?
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  AI Study Coach Pacing Active
                </span>
              </div>
            </div>

            {/* Explanation Box */}
            <div style={{
              background: '#f8faf7',
              border: '1px solid rgba(46, 125, 50, 0.18)',
              borderLeft: '4px solid #2e7d32',
              borderRadius: '10px',
              padding: '0.9rem 1rem'
            }}>
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#334155', lineHeight: 1.55 }}>
                This schedule was given by your <strong>AI Study Coach</strong> as the best suited for you based on your current focus telemetry and cognitive state
                {aiAdjustedDetails?.state ? ` (${aiAdjustedDetails.state})` : ''} to prevent fatigue and sustain momentum.
              </p>
              {aiAdjustedDetails && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '0.65rem' }}>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(46, 125, 50, 0.1)', color: '#27522d', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    {aiAdjustedDetails.rhythm}
                  </span>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(46, 125, 50, 0.1)', color: '#27522d', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                    {aiAdjustedDetails.sessions} Sessions
                  </span>
                </div>
              )}
            </div>

            <p style={{ margin: 0, fontSize: '0.84rem', color: '#6b7280', lineHeight: 1.45 }}>
              Are you sure you want to manually change this schedule?
            </p>

            {/* Modal Buttons (Clean Symmetrical 42px Grid) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={cancelOverrideAi}
                style={{
                  height: '42px',
                  background: 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(39, 82, 45, 0.25)',
                  margin: 0,
                  padding: '0 1rem'
                }}
              >
                Keep AI Schedule
              </button>
              <button
                type="button"
                onClick={confirmOverrideAi}
                style={{
                  height: '42px',
                  background: '#ffffff',
                  border: '1.5px solid rgba(0, 0, 0, 0.16)',
                  color: '#374151',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  margin: 0,
                  padding: '0 1rem'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#dc2626';
                  e.currentTarget.style.color = '#dc2626';
                  e.currentTarget.style.background = '#fef2f2';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                  e.currentTarget.style.color = '#4b5563';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                Yes, Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Progress Saved Toast */}
      {saveSessionToast.show && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            background: '#ffffff',
            border: '1px solid rgba(46, 125, 50, 0.35)',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.18), 0 0 0 1px rgba(0,0,0,0.04)',
            borderRadius: '16px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            zIndex: 99999,
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'rgba(46, 125, 50, 0.12)',
              color: '#2e7d32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#163824' }}>{saveSessionToast.title || 'Progress Saved!'}</div>
            <div style={{ fontSize: '0.78rem', color: '#557060', marginTop: '1px' }}>{saveSessionToast.message}</div>
          </div>
          <button
            type="button"
            onClick={() => setSaveSessionToast({ show: false, message: '' })}
            style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '4px', marginLeft: '6px', display: 'flex', alignItems: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

            {/* Keystroke Telemetrics Intervention Toast (iOS Spring Popup Style) */}
      {telemetryToast.show && (
        <div className="ios-notification-toast">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(78, 130, 83, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-accent)' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              </div>
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{telemetryToast.title || "Coach has noticed something"}</h4>
            </div>
            <button
              onClick={dismissTelemetryToast}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.95rem', padding: '2px', display: 'flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem 0', lineHeight: '1.45' }}>
            {telemetryToast.reason}
          </p>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn-primary"
              onClick={goToCoach}
              style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem', borderRadius: '9999px', margin: 0, height: '36px' }}
            >
              View Coach Strategy
            </button>
            <button
              onClick={dismissTelemetryToast}
              style={{ background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '9999px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

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
  const [todoFilter, setTodoFilter] = useState('All');
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [activeMenuTodoId, setActiveMenuTodoId] = useState(null);
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [editingPriority, setEditingPriority] = useState('medium');

  // AI Coach State
  const [reflectionInput, setReflectionInput] = useState('');
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);

  // Past Entries State (LocalStorage)
  const [pastEntries, setPastEntries] = useState([]);

  // Pomodoro State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFocus, setIsFocus] = useState(true);
  const [timerPreset, setTimerPreset] = useState('25/5');
  const [sessionCount, setSessionCount] = useState(1);
  
  // Custom Timer State
  const [isCustomTimerModalOpen, setIsCustomTimerModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [customWorkTime, setCustomWorkTime] = useState({ min: 0, sec: 0 });
  const [customBreakTime, setCustomBreakTime] = useState({ min: 0, sec: 0 });
  const [customSessions, setCustomSessions] = useState(0);

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

  const keydownTimesRef = useRef({});
  const lastKeyupTimeRef = useRef(null);
  const dwellTimesRef = useRef([]);
  const flightTimesRef = useRef([]);
  const backspaceCountRef = useRef(0);
  const totalKeystrokesRef = useRef(0);
  const anomalyTriggeredRef = useRef(false);

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
      gain1.gain.setValueAtTime(0.18, now);
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
      gain2.gain.setValueAtTime(0.22, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.55);
    } catch (e) {
      console.warn("Web Audio chime failed:", e);
    }
  };

  const triggerTelemetryAlert = (reason, actionPlan, dwell, flight, bsRatio) => {
    const telemetryData = {
      timestamp: new Date().toISOString(),
      reason: reason,
      actionPlan: actionPlan || "We recommend pausing your current task. Take a 5-minute deep breathing break away from the screen before attempting to refocus.",
      metrics: {
        dwellTime: Math.round(dwell),
        flightTime: Math.round(flight),
        errorRate: Math.round(bsRatio * 100)
      }
    };
    try {
      localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(telemetryData));
    } catch (e) {
      console.warn("Telemetry storage failed:", e);
    }

    // Play subtle crystal-clear iOS chime
    playNotificationChime();

    setTelemetryToast({
      show: true,
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
    let label = '🟢 Steady Flow';

    // Disregard fast typing as friction (fast typers are just fast!)
    if (avgFlight > 0 && avgFlight < 75) {
      detectedState = 'fast';
      label = '⚡ Fast Flow';
    } else if (bsRatio > 0.40 && bsCount >= 6) {
      detectedState = 'friction';
      label = '🔴 High Friction';
    } else if (avgDwell > 300) {
      detectedState = 'hesitant';
      label = '🟡 Hesitant';
    } else if (totalKeystrokesRef.current < 4) {
      detectedState = 'idle';
      label = '⌨️ Calibrating...';
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
              avgDwell, avgFlight, backspaceRatio
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

    keydownTimesRef.current[e.code] = now;
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
  const tracks = ['Chill Lofi', 'Study Music', 'Rain Ambient'];

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
    } catch (e) {
      console.warn("LocalStorage failed:", e);
    }
  };

  // Audio Track Source Map
  const getTrackSrc = (name) => {
    if (name === 'Chill Lofi') return '/music/Lofi Chill.mp3';
    if (name === 'Study Music') return '/music/Study Music.mp3';
    if (name === 'Rain Ambient') return '/music/rain.mp3';
    return '/music/Lofi Chill.mp3';
  };

  // Audio Playback Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.warn("Audio autoplay blocked:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, volume]);

  // Pomodoro Logic
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log("Audio play prevented", e));
      } catch (e) {}
      
      if (isFocus) {
        setIsFocus(false);
        const breakTime = timerPreset === 'Custom' 
          ? customBreakTime.min * 60 + customBreakTime.sec 
          : timerPreset === '50/10' ? 10 * 60 : timerPreset === '15/3' ? 3 * 60 : timerPreset === '90/20' ? 20 * 60 : 5 * 60;
        setTimeLeft(breakTime);
      } else {
        setIsFocus(true);
        const focusTime = timerPreset === 'Custom'
          ? customWorkTime.min * 60 + customWorkTime.sec
          : (parseInt(timerPreset.split('/')[0]) || 25) * 60;
        setTimeLeft(focusTime);
        setSessionCount(c => c + 1);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isFocus, timerPreset, customWorkTime, customBreakTime]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    if (timerPreset === 'Custom') {
      setTimeLeft(isFocus ? customWorkTime.min * 60 + customWorkTime.sec : customBreakTime.min * 60 + customBreakTime.sec);
    } else {
      const focusTime = parseInt(timerPreset.split('/')[0]) || 25;
      setTimeLeft(isFocus ? focusTime * 60 : 5 * 60);
    }
  };

  const setPreset = (preset) => {
    if (preset === 'Custom') {
      setIsCustomTimerModalOpen(true);
    } else {
      setTimerPreset(preset);
      setIsActive(false);
      setIsFocus(true);
      const focusTime = parseInt(preset.split('/')[0]);
      setTimeLeft(focusTime * 60);
    }
  };

  const saveCustomSettings = () => {
    setIsCustomTimerModalOpen(false);
    setTimerPreset('Custom');
    setIsActive(false);
    setIsFocus(true);
    setTimeLeft(customWorkTime.min * 60 + customWorkTime.sec);
    setSessionCount(1);
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

  const toggleTodo = async (id) => {
    // Optimistic UI update
    const todoToToggle = todos.find(t => t.id === id);
    if (!todoToToggle) return;
    
    const newStatus = !todoToToggle.completed;
    setTodos(todos.map(t => t.id === id ? { ...t, completed: newStatus } : t));
    
    if (newStatus) {
      playTaskCheckSound(); // Play joyful checkmark double-chime!
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
    if (!text) return;
    setIsSubmittingReflection(true);
    setAiFeedback(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
      
      const activeTasks = todos.filter(t => !t.completed).map(t => ({ id: t.id, text: t.text, priority: t.priority }));
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tasks: activeTasks }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();
      
      let feedback = "Keep up the great work!";
      let state = "Engaged";
      
      if (res.ok) {
        feedback = data.actionPlan;
        state = data.state;
        
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
        
        // Adjust Timer based on state
        setIsActive(false);
        setIsFocus(true);
        let timerLabel = "Focus Time";
        if (state === "Stressed") {
            setTimerPreset('Custom');
            setCustomWorkTime({ min: 15, sec: 0 });
            setCustomBreakTime({ min: 3, sec: 0 });
            setTimeLeft(15 * 60);
            timerLabel = "Gentle Focus (Stressed)";
        } else if (state === "Distracted") {
            setTimerPreset('Custom');
            setCustomWorkTime({ min: 20, sec: 0 });
            setCustomBreakTime({ min: 5, sec: 0 });
            setTimeLeft(20 * 60);
            timerLabel = "Strict Pomodoro (Distracted)";
        } else if (state === "Engaged" || state === "Motivated") {
            setTimerPreset('Custom');
            setCustomWorkTime({ min: 60, sec: 0 });
            setCustomBreakTime({ min: 10, sec: 0 });
            setTimeLeft(60 * 60);
            timerLabel = "Flow State (Engaged)";
        }
        
        setAiFeedback({
            title: `AI Adjusted Timer:\n${timerLabel}`,
            message: feedback
        });

        // Trigger AI Coach Intervention in Local Storage if not Engaged/Motivated
        if (state === "Stressed" || state === "Distracted") {
          const telemetryKey = `ifocus_telemetry_insight_${userName}`;
          localStorage.setItem(telemetryKey, JSON.stringify({
            reason: `Coach noticed you are feeling ${state.toLowerCase()} based on your journal entry.`,
            actionPlan: feedback,
            timestamp: new Date().toISOString()
          }));
        }
      } else {
        setAiFeedback({ title: "Error", message: `Failed to generate AI response. ${data.error || ''}` });
      }
      
      setReflectionInput('');
      
      // Save to journal history
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        text: text,
        state: state
      };
      saveHistory([newEntry, ...pastEntries]);

    } catch (err) {
      setAiFeedback({ title: "Error", message: "Failed to reach AI Coach." });
    } finally {
      setIsSubmittingReflection(false);
    }
  };

  // Calculate Progress Percent for Pomodoro Progress Bar
  const getTotalTime = () => {
    if (isFocus) {
      if (timerPreset === 'Custom') return (customWorkTime.min * 60 + customWorkTime.sec) || 25 * 60;
      return (parseInt(timerPreset.split('/')[0]) || 25) * 60;
    } else {
      if (timerPreset === 'Custom') return (customBreakTime.min * 60 + customBreakTime.sec) || 5 * 60;
      return (parseInt(timerPreset.split('/')[1]) || 5) * 60;
    }
  };
  const totalTime = getTotalTime();
  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / (totalTime || 1)) * 100));
  const activeTask = todos.find(t => !t.completed);

  return (
    <div className="command-center-layout" onClick={() => setActiveMenuTodoId(null)}>
      {/* Background Audio Element */}
      <audio ref={audioRef} loop src={getTrackSrc(currentTrack)} />

      {/* Column 1: Task Command Center (Apple Reminders iOS Style) */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '1.4rem 1.45rem' }}>
        
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Tasks List</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {todos.filter(t => t.completed).length}/{todos.length} Done
            </span>
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

        {/* Quick Add Bar (Placed ON TOP of Categories!) */}
        <div style={{
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
          <select 
            value={todoPriority} 
            onChange={(e) => setTodoPriority(e.target.value)} 
            style={{
              height: '32px',
              fontSize: '0.78rem',
              padding: '0 0.4rem',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.03)',
              cursor: 'pointer'
            }}
          >
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </select>
          <button 
            type="button" 
            onClick={addTodo} 
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
        <div className="todo-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: '2px' }}>
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
                className={`todo-item ${todo.completed ? 'completed' : ''}`}
                style={{
                  position: 'relative',
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
                        background: 'rgba(0,0,0,0.03)',
                        cursor: 'pointer'
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
                      ✓
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
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="todo-text">{todo.text}</span>
                    
                    {/* Action Menu: Inline iOS Action Pill on Click */}
                    {activeMenuTodoId === todo.id ? (
                      <div 
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          background: 'rgba(0,0,0,0.04)',
                          padding: '2px 4px',
                          borderRadius: '9999px',
                          animation: 'iosActionSlideIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => startEditingTodo(todo)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            background: '#ffffff',
                            border: '1px solid rgba(0,0,0,0.08)',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: 'var(--primary-accent)',
                            cursor: 'pointer',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                          }}
                          title="Edit this task"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            deleteTodo(todo.id);
                            setActiveMenuTodoId(null);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '9999px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#ef4444',
                            cursor: 'pointer'
                          }}
                          title="Delete this task"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveMenuTodoId(null)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                          }}
                          title="Close options"
                        >
                          ✕
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
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', height: '100%', minHeight: 0, padding: '1.5rem 1.4rem' }}>
        
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
            onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
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

        {/* Ongoing / Break Pill Switcher */}
        <div className="ios-segmented-control" style={{ margin: '0.25rem 0' }}>
          <button 
            className={`ios-segment-btn ${isFocus ? 'active' : ''}`}
            onClick={() => {
              setIsFocus(true);
              setIsActive(false);
              const focusTime = timerPreset === 'Custom'
                ? customWorkTime.min * 60 + customWorkTime.sec
                : (parseInt(timerPreset.split('/')[0]) || 25) * 60;
              setTimeLeft(focusTime);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            Ongoing
          </button>
          <button 
            className={`ios-segment-btn ${!isFocus ? 'active' : ''}`}
            onClick={() => {
              setIsFocus(false);
              setIsActive(false);
              const breakTime = timerPreset === 'Custom'
                ? customBreakTime.min * 60 + customBreakTime.sec
                : timerPreset === '50/10' ? 10 * 60 : timerPreset === '15/3' ? 3 * 60 : timerPreset === '90/20' ? 20 * 60 : 5 * 60;
              setTimeLeft(breakTime);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
            Break
          </button>
        </div>

        {/* Grand Circular Pomodoro Timer Ring */}
        <div 
          className="timer-circle" 
          style={{ 
            '--progress': `${progressPercent}%`,
            width: '225px',
            height: '225px',
            margin: '0.4rem auto'
          }}
        >
          <div className="timer-inner">
            <div className="timer-display" style={{ fontSize: '3.3rem' }}>
              {formatTime(timeLeft)}
            </div>
            <div className="timer-label">
              {isFocus ? 'Focus Time' : 'Break Time'}
            </div>
          </div>
        </div>

        {/* Controls (Reset, Start/Stop Pill, Settings) */}
        <div className="ios-timer-actions" style={{ margin: '0.35rem 0' }}>
          <button 
            className="ios-circle-action-btn"
            onClick={resetTimer}
            title="Reset Timer"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
          </button>

          <button 
            className={`ios-pill-action-btn ${isActive ? 'paused' : ''}`}
            onClick={toggleTimer}
            style={{
              background: isActive ? '#d97706' : '#4e8253',
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
              boxShadow: '0 8px 20px -4px rgba(78, 130, 83, 0.4)'
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
            onClick={() => setIsCustomTimerModalOpen(true)}
            title="Custom Timer Settings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>

        {/* Presets Row */}
        <div className="pomodoro-settings" style={{ margin: 0 }}>
          {['25/5', '50/10', '15/3', '90/20', 'Custom'].map(preset => (
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

        {/* Session Indicator Dots */}
        <div className="session-counter" style={{ margin: 0, fontSize: '0.8rem' }}>
          Session {sessionCount} of {timerPreset === 'Custom' ? (customSessions || 1) : 4}
          <div className="session-dots" style={{ marginTop: '0.4rem' }}>
            {Array.from({ length: timerPreset === 'Custom' ? (customSessions || 1) : 4 }).map((_, i) => (
              <div key={i} className={`session-dot ${i < sessionCount ? 'current' : ''}`}></div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 3: Daily Progress + Quick Reflection & AI Coach */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', height: '100%', minHeight: 0 }}>
        
        {/* Top Card: Enlarged Daily Progress & Luxury Inspiring Quote */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1.35rem 1.45rem' }}>
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

          {/* Luxury Apple-Style Focus Quote Widget */}
          <div style={{
            marginTop: '0.25rem',
            padding: '0.85rem 1rem',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.75) 0%, rgba(238,247,241,0.65) 100%)',
            border: '1px solid rgba(255,255,255,0.95)',
            borderRadius: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--primary-accent)' }}>
                Daily Mindset
              </span>
              <button
                type="button"
                onClick={shuffleQuote}
                title="Get another quote"
                style={{
                  background: 'rgba(0,0,0,0.04)',
                  border: 'none',
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
                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(78,130,83,0.15)'; e.currentTarget.style.color = 'var(--primary-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"></path></svg>
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#1e293b', fontStyle: 'italic', lineHeight: '1.45', fontWeight: 500 }}>
              "{currentQuote.quote}"
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--primary-accent)', fontWeight: 600, marginTop: '4px' }}>
              — {currentQuote.author}
            </div>
          </div>
        </div>

        {/* Bottom Card: Quick Reflection & Adaptive AI Coach (Seamless Fit) */}
        <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: '1.35rem 1.4rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Quick Reflection</h2>
            <button 
              onClick={() => setIsHistoryModalOpen(true)}
              style={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                padding: '0.3rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              History {pastEntries.length > 0 && `(${pastEntries.length})`}
            </button>
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
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Ambient Soundscapes</h2>
              <button onClick={() => setIsAudioModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <p className="subtitle" style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>Background audio streams to help you focus.</p>

            {/* Track Selection Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {tracks.map(track => {
                const isCurrent = currentTrack === track;
                const desc = track === 'Chill Lofi' ? 'Calming Lo-Fi beats & ambient vibes' : track === 'Study Music' ? 'Alpha wave melodies for concentration' : 'Gentle rain shower & soothing drops';
                return (
                  <div 
                    key={track}
                    className={`soundscape-card ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentTrack(track);
                      setIsPlaying(true);
                    }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(78, 130, 83, 0.12)', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {track === 'Chill Lofi' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                      ) : track === 'Study Music' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><line x1="8" y1="19" x2="8" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><line x1="16" y1="19" x2="16" y2="21"></line></svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{track}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{desc}</div>
                    </div>
                    {isCurrent && isPlaying ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-accent)', background: 'rgba(34,197,94,0.1)', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                        Playing
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select</span>
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
                onChange={(e) => setVolume(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary-accent)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '35px' }}>{volume}%</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="btn-primary" 
                style={{ margin: 0, padding: '0.5rem 1.5rem', borderRadius: '9999px', fontSize: '0.88rem' }}
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

      {/* AI Coach Modal */}
      {aiFeedback && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', lineHeight: '1.3', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{aiFeedback.title}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>{aiFeedback.message}</p>
            <button onClick={() => setAiFeedback(null)} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', borderRadius: '9999px' }}>Continue</button>
          </div>
        </div>
      )}

      {/* Custom Timer Modal */}
      {isCustomTimerModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <h2>Custom Timer Settings</h2>
            <p className="subtitle" style={{ marginBottom: '1rem' }}>Set custom durations and number of sessions.</p>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Work Time</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" min="0" max="120" value={customWorkTime.min} onChange={e => setCustomWorkTime({ ...customWorkTime, min: parseInt(e.target.value) || 0 })} placeholder="Min" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                        <input type="number" min="0" max="59" value={customWorkTime.sec} onChange={e => setCustomWorkTime({ ...customWorkTime, sec: parseInt(e.target.value) || 0 })} placeholder="Sec" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Break Time</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" min="0" max="60" value={customBreakTime.min} onChange={e => setCustomBreakTime({ ...customBreakTime, min: parseInt(e.target.value) || 0 })} placeholder="Min" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                        <input type="number" min="0" max="59" value={customBreakTime.sec} onChange={e => setCustomBreakTime({ ...customBreakTime, sec: parseInt(e.target.value) || 0 })} placeholder="Sec" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Sessions</label>
                <input type="number" min="0" max="10" value={customSessions} onChange={e => setCustomSessions(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setIsCustomTimerModalOpen(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '9999px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                <button onClick={saveCustomSettings} className="btn-primary" style={{ padding: '0.5rem 1.25rem', margin: 0, borderRadius: '9999px' }}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Reflection History Modal */}
      {isHistoryModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '540px', width: '92%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Reflection History</h2>
              <button onClick={() => setIsHistoryModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <p className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Past reflection journal entries and detected emotional states.</p>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '4px', maxHeight: '420px' }}>
              {pastEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <p>No reflection entries recorded yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Submit a quick reflection to start building your mental clarity history.</p>
                </div>
              ) : (
                pastEntries.map(entry => (
                  <div key={entry.id} className="journal-entry" style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {new Date(entry.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className={`state-badge state-${entry.state}`} style={{ margin: 0, padding: '0.15rem 0.55rem', fontSize: '0.7rem' }}>
                        {entry.state}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4', fontStyle: 'italic' }}>
                      "{entry.text}"
                    </p>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setIsHistoryModalOpen(false)} className="btn-primary" style={{ padding: '0.5rem 1.25rem', margin: 0, fontSize: '0.85rem', borderRadius: '9999px' }}>Close</button>
            </div>
          </div>
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
              <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>Coach Intervened</h4>
            </div>
            <button
              onClick={dismissTelemetryToast}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.95rem', padding: '2px', display: 'flex', alignItems: 'center' }}
            >
              ✕
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

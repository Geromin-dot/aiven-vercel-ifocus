"use client";

import { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import HelpButton from '@/components/HelpButton';
import TimerNotificationSettings from '@/components/TimerNotificationSettings';

// Curated avatar styles and presets for customization (clean names, no emojis)
const AVATAR_PRESETS = [
  { id: 'adv-1', label: 'Felix', style: 'adventurer', seed: 'Felix', bg: 'b6e3f4' },
  { id: 'adv-2', label: 'Daisy', style: 'adventurer', seed: 'Daisy', bg: 'ffd5dc' },
  { id: 'adv-3', label: 'Milo', style: 'adventurer', seed: 'Milo', bg: 'c0aede' },
  { id: 'adv-4', label: 'Luna', style: 'adventurer', seed: 'Luna', bg: 'd1d4f9' },
  { id: 'bot-1', label: 'Spark', style: 'bottts', seed: 'Spark', bg: 'ffdfbf' },
  { id: 'bot-2', label: 'Echo', style: 'bottts', seed: 'Echo', bg: 'c0aede' },
  { id: 'bot-3', label: 'Bolt', style: 'bottts', seed: 'Bolt', bg: 'b6e3f4' },
  { id: 'bot-4', label: 'Byte', style: 'bottts', seed: 'Byte', bg: 'ffd5dc' },
  { id: 'fun-1', label: 'Joy', style: 'fun-emoji', seed: 'JoyStar', bg: 'ffdfbf' },
  { id: 'fun-2', label: 'Zen', style: 'fun-emoji', seed: 'ZenCalm', bg: 'c0aede' },
  { id: 'lore-1', label: 'Maya', style: 'lorelei', seed: 'Maya', bg: 'd1d4f9' },
  { id: 'lore-2', label: 'Leo', style: 'lorelei', seed: 'Leo', bg: 'b6e3f4' },
];

const getDicebearUrl = (style, seed, bg = 'c0aede') => {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${bg}`;
};


// Web Audio API Synthesis: Uplifting Harmonic E-Major Chime for Successful Save (Scales with Volume / Silent if Muted)
const playSaveSuccessChime = (volInput = 70) => {
  try {
    let vol = volInput;
    if (typeof vol === 'object') {
      try {
        const soundPrefs = JSON.parse(localStorage.getItem('ifocus_sound_preferences') || '{}');
        vol = soundPrefs.ambientVolume !== undefined ? Number(soundPrefs.ambientVolume) : 70;
      } catch (e) {
        vol = 70;
      }
    }
    const volNum = Math.max(0, Math.min(100, Number(vol !== undefined ? vol : 70)));
    if (volNum <= 0) return; // Muted (0%): Completely silent

    const volFactor = volNum / 100;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Harmonic ascending triad (E5, G#5, B5)
    const chord = [
      { freq: 659.25, offset: 0, dur: 0.30, gain: 0.055 },
      { freq: 830.61, offset: 0.06, dur: 0.35, gain: 0.065 },
      { freq: 987.77, offset: 0.12, dur: 0.50, gain: 0.085 }
    ];

    chord.forEach(({ freq, offset, dur, gain: peak }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + offset);
      g.gain.setValueAtTime(0.0001, now + offset);
      g.gain.linearRampToValueAtTime(peak * volFactor, now + offset + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.02);
    });
  } catch (e) {
    console.warn('Save audio blocked:', e);
  }
};

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  
  // Selected Section among the 4 Cards ('focus' | 'notifications' | 'privacy' | 'feedback')
  const [activeSection, setActiveSection] = useState('focus');

  // User Profile Data - Synchronously initialized from cache or session to eliminate flickering
  // User Profile Data - Initialized safely to prevent SSR hydration mismatches
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [createdAt, setCreatedAt] = useState(null);

  // Instant session synchronization to ensure zero delay or flash
  useEffect(() => {
    if (session?.user) {
      if (session.user.image && !avatarUrl) {
        setAvatarUrl(session.user.image);
        try { localStorage.setItem('ifocus_user_avatar', session.user.image); } catch (e) {}
      }
      if (session.user.name && !name) {
        setName(session.user.name);
        try { localStorage.setItem('ifocus_user_name', session.user.name); } catch (e) {}
      }
      if (session.user.email && !email) {
        setEmail(session.user.email);
      }
      if (session.user.username && !username) {
        setUsername(session.user.username);
      }
    }
  }, [session, avatarUrl, name, email, username]);

  // Stats State (Accurately computed from sessions and history)
  const [stats, setStats] = useState({
    totalSessions: 0,
    focusHours: 0,
    streakDays: 0
  });

  // Avatar Modal State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [tempAvatarUrl, setTempAvatarUrl] = useState('');
  const [customDirectUrl, setCustomDirectUrl] = useState('');
  const [isSavingAvatar, setIsSavingAvatar] = useState(false);

  // Profile Save State
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password Update State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // 1. Focus Preferences State
  const [focusDuration, setFocusDuration] = useState(25);
  const [breakGateQuestionCount, setBreakGateQuestionCount] = useState(3);
  const [hasActiveBreakGateDeck, setHasActiveBreakGateDeck] = useState(false);
  const [activeDeckTitle, setActiveDeckTitle] = useState('');
  const [autoStartBreaks, setAutoStartBreaks] = useState(true);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [timerChimeSound, setTimerChimeSound] = useState(true);
  const [activePresenceEnabled, setActivePresenceEnabled] = useState(true);
  const [activePresenceInterval, setActivePresenceInterval] = useState(5);
  const [afkCoachEnabled, setAfkCoachEnabled] = useState(true);
  const [afkCoachMinutes, setAfkCoachMinutes] = useState(1);
  const [burnoutCheckEnabled, setBurnoutCheckEnabled] = useState(true);
  const [burnoutCheckMinutes, setBurnoutCheckMinutes] = useState(20);

  // 2. Notifications & Sound Preferences State
  const [defaultAmbientTrack, setDefaultAmbientTrack] = useState('Chill Lofi');
  const [ambientVolume, setAmbientVolume] = useState(70);
  const [telemetryChime, setTelemetryChime] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);

  // 3. Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState('feedback');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Unsaved Changes Baseline State
  const [initialFocusPrefs, setInitialFocusPrefs] = useState({
    focusDuration: 25,
    breakGateQuestionCount: 3,
    timerChimeSound: true,
    activePresenceEnabled: true,
    activePresenceInterval: 5,
    afkCoachEnabled: true,
    afkCoachMinutes: 1,
    burnoutCheckEnabled: true,
    burnoutCheckMinutes: 20,
  });

  const [initialSoundPrefs, setInitialSoundPrefs] = useState({
    defaultAmbientTrack: 'Chill Lofi',
    ambientVolume: 70,
    dailyReminder: true,
  });

  const [initialProfile, setInitialProfile] = useState({
    name: '',
    username: '',
  });

  const [pendingNavigation, setPendingNavigation] = useState(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Toast / Alert Notification
  const [toast, setToast] = useState({ type: null, message: '' });

  const showToast = (type, message, title = '') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ type, message, title });
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ type: null, message: '', title: '' });
    }, 4500);
  };

  // Helper: Accurately calculate consecutive active streak from dates
  const calculateAccurateStreak = (history) => {
    if (!history || history.length === 0) return 0;
    const uniqueDates = new Set(
      history.map(s => {
        const d = new Date(s.date);
        return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
      }).filter(Boolean)
    );

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let checkDate = uniqueDates.has(todayStr) ? today : (uniqueDates.has(yesterdayStr) ? yesterday : null);
    if (!checkDate) return 0;

    let streak = 0;
    let curr = new Date(checkDate);
    while (true) {
      const ds = curr.toISOString().slice(0, 10);
      if (uniqueDates.has(ds)) {
        streak++;
        curr.setDate(curr.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };

  // 1. Initial Load: Fetch Profile and Real Stats from Backend & LocalStorage
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/user/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setName(data.user.name || '');
            setUsername(data.user.username || '');
            setEmail(data.user.email || '');
            setInitialProfile({ name: data.user.name || '', username: data.user.username || '' });
            setCreatedAt(data.user.createdAt);
            
            const initialAvatar = data.user.image 
              || session?.user?.image 
              || (typeof window !== 'undefined' ? localStorage.getItem('ifocus_user_avatar') : '')
              || getDicebearUrl('adventurer', data.user.username || data.user.name || 'FocusUser', 'c0aede');
            setAvatarUrl(initialAvatar);
            setTempAvatarUrl(initialAvatar);
            try { 
              localStorage.setItem('ifocus_user_avatar', initialAvatar);
              if (data.user.name) localStorage.setItem('ifocus_user_name', data.user.name);
            } catch (e) {}
          }

          // Calculate real session statistics from local history and database
          const sessionHistory = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
          const focusStats = JSON.parse(localStorage.getItem('ifocus_focus_stats') || '{}');

          let localMinutes = 0;
          if (sessionHistory.length > 0) {
            localMinutes = sessionHistory.reduce((sum, s) => sum + (s.duration || 0), 0);
          } else if (focusStats.minutes) {
            localMinutes = focusStats.minutes;
          }

          const calculatedHours = (localMinutes / 60).toFixed(1);
          const totalSessionsCount = Math.max(
            data.stats?.totalSessions || 0,
            sessionHistory.length,
            focusStats.sessions || 0
          );
          const realStreak = calculateAccurateStreak(sessionHistory) || focusStats.streak || (totalSessionsCount > 0 ? 1 : 0);

          setStats({
            totalSessions: totalSessionsCount,
            focusHours: parseFloat(calculatedHours) || (data.stats?.focusHours || 0),
            streakDays: realStreak
          });
        }
      } catch (err) {
        console.error("Failed to load user profile:", err);
      }
    };

    fetchUserData();

    // Load Local Saved Preferences and sync initial baselines
    try {
      const savedTimer = localStorage.getItem('ifocus_timer_preferences');
      let loadedTimerPrefs = {
        focusDuration: 25,
        breakGateQuestionCount: 3,
        timerChimeSound: true,
        activePresenceEnabled: true,
        activePresenceInterval: 5,
        afkCoachEnabled: true,
        afkCoachMinutes: 1,
        burnoutCheckEnabled: true,
        burnoutCheckMinutes: 20,
      };

      if (savedTimer) {
        const parsed = JSON.parse(savedTimer);
        if (parsed.focusDuration) {
          const fd = Number(parsed.focusDuration) || 25;
          setFocusDuration(fd);
          loadedTimerPrefs.focusDuration = fd;
        }
        if (parsed.breakGateQuestionCount !== undefined) {
          const bgCount = Number(parsed.breakGateQuestionCount) || 3;
          setBreakGateQuestionCount(bgCount);
          loadedTimerPrefs.breakGateQuestionCount = bgCount;
        }
        if (parsed.timerChimeSound !== undefined) {
          const ch = Boolean(parsed.timerChimeSound);
          setTimerChimeSound(ch);
          loadedTimerPrefs.timerChimeSound = ch;
        }
        if (parsed.activePresenceEnabled !== undefined) {
          const pe = Boolean(parsed.activePresenceEnabled);
          setActivePresenceEnabled(pe);
          loadedTimerPrefs.activePresenceEnabled = pe;
        }
        if (parsed.activePresenceInterval) {
          const pi = Number(parsed.activePresenceInterval) || 5;
          setActivePresenceInterval(pi);
          loadedTimerPrefs.activePresenceInterval = pi;
        }
        if (parsed.afkCoachEnabled !== undefined) {
          const ae = Boolean(parsed.afkCoachEnabled);
          setAfkCoachEnabled(ae);
          loadedTimerPrefs.afkCoachEnabled = ae;
        }
        if (parsed.afkCoachMinutes !== undefined) {
          const am = Number(parsed.afkCoachMinutes) || 1;
          setAfkCoachMinutes(am);
          loadedTimerPrefs.afkCoachMinutes = am;
        }
        if (parsed.burnoutCheckEnabled !== undefined) {
          const be = Boolean(parsed.burnoutCheckEnabled);
          setBurnoutCheckEnabled(be);
          loadedTimerPrefs.burnoutCheckEnabled = be;
        }
        if (parsed.burnoutCheckMinutes !== undefined) {
          const bm = Number(parsed.burnoutCheckMinutes) || 20;
          setBurnoutCheckMinutes(bm);
          loadedTimerPrefs.burnoutCheckMinutes = bm;
        }
      }

      // Sync latest timer preferences from cloud database
      fetch('/api/user/telemetry')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.timerPreferences) {
            const tp = data.timerPreferences;
            if (tp.activePresenceInterval) {
              setActivePresenceInterval(Number(tp.activePresenceInterval));
            }
            if (tp.activePresenceEnabled !== undefined) {
              setActivePresenceEnabled(Boolean(tp.activePresenceEnabled));
            }
            if (tp.afkCoachMinutes !== undefined) {
              setAfkCoachMinutes(Number(tp.afkCoachMinutes));
            }
            try {
              const cur = JSON.parse(localStorage.getItem('ifocus_timer_preferences') || '{}');
              localStorage.setItem('ifocus_timer_preferences', JSON.stringify({ ...cur, ...tp }));
            } catch (e) {}
          }
        })
        .catch(() => {});

      // Check if active breakgate deck exists
      const checkActiveBreakGate = () => {
        try {
          const rawDeck = localStorage.getItem('ifocus_active_breakgate_deck');
          if (rawDeck) {
            const parsedDeck = JSON.parse(rawDeck);
            if (parsedDeck && (parsedDeck.id || parsedDeck.title)) {
              setHasActiveBreakGateDeck(true);
              setActiveDeckTitle(parsedDeck.title || 'Active Deck');
            } else {
              setHasActiveBreakGateDeck(false);
            }
          } else {
            setHasActiveBreakGateDeck(false);
          }
        } catch (err) {
          setHasActiveBreakGateDeck(false);
        }
      };
      checkActiveBreakGate();
      window.addEventListener('focus', checkActiveBreakGate);
      window.addEventListener('storage', checkActiveBreakGate);
      window.addEventListener('ifocus_breakgate_deck_changed', checkActiveBreakGate);

      // Check if separate ifocus_breakgate_question_count exists
      const savedBgCount = localStorage.getItem('ifocus_breakgate_question_count');
      if (savedBgCount) {
        const bgNum = parseInt(savedBgCount) || 3;
        setBreakGateQuestionCount(bgNum);
        loadedTimerPrefs.breakGateQuestionCount = bgNum;
      }
      setInitialFocusPrefs(loadedTimerPrefs);

      const savedSound = localStorage.getItem('ifocus_sound_preferences');
      let loadedSoundPrefs = {
        defaultAmbientTrack: 'Chill Lofi',
        ambientVolume: 70,
        dailyReminder: true,
      };

      if (savedSound) {
        const parsed = JSON.parse(savedSound);
        if (parsed.defaultAmbientTrack) {
          setDefaultAmbientTrack(String(parsed.defaultAmbientTrack));
          loadedSoundPrefs.defaultAmbientTrack = String(parsed.defaultAmbientTrack);
        }
        if (parsed.ambientVolume !== undefined) {
          const vol = Number(parsed.ambientVolume);
          setAmbientVolume(vol);
          loadedSoundPrefs.ambientVolume = vol;
        }
        if (parsed.dailyReminder !== undefined) {
          const dr = Boolean(parsed.dailyReminder);
          setDailyReminder(dr);
          loadedSoundPrefs.dailyReminder = dr;
        }
      }
      setInitialSoundPrefs(loadedSoundPrefs);
    } catch (e) {
      console.warn("Error loading local settings:", e);
    }
  }, []);

  // Format Join Date

  // Compute Dirty State Across All Settings Forms
  const hasFocusChanges =
    Number(breakGateQuestionCount) !== Number(initialFocusPrefs.breakGateQuestionCount) ||
    Boolean(timerChimeSound) !== Boolean(initialFocusPrefs.timerChimeSound) ||
    Boolean(activePresenceEnabled) !== Boolean(initialFocusPrefs.activePresenceEnabled) ||
    Number(activePresenceInterval) !== Number(initialFocusPrefs.activePresenceInterval) ||
    Boolean(afkCoachEnabled) !== Boolean(initialFocusPrefs.afkCoachEnabled) ||
    Number(afkCoachMinutes) !== Number(initialFocusPrefs.afkCoachMinutes);

  const hasSoundChanges =
    String(defaultAmbientTrack) !== String(initialSoundPrefs.defaultAmbientTrack) ||
    Number(ambientVolume) !== Number(initialSoundPrefs.ambientVolume) ||
    Boolean(dailyReminder) !== Boolean(initialSoundPrefs.dailyReminder);

  const hasProfileChanges =
    Boolean(initialProfile.name && name.trim() !== initialProfile.name.trim()) ||
    Boolean(initialProfile.username && username.trim() !== initialProfile.username.trim());

  const hasUnsavedChanges = hasFocusChanges || hasSoundChanges || hasProfileChanges;

  // Intercept Navigation Attempts & Browser Unload
  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.__ifocusHasUnsavedChanges = hasUnsavedChanges;
    window.__ifocusOnAttemptedNav = (targetUrl) => {
      setPendingNavigation(targetUrl);
      setShowUnsavedModal(true);
    };

    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.__ifocusHasUnsavedChanges = false;
      window.__ifocusOnAttemptedNav = null;
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Save All Unsaved Changes & Continue Navigation
  const handleSaveAndContinue = async () => {
    await handleSavePreferences();
    window.__ifocusHasUnsavedChanges = false;
    setShowUnsavedModal(false);

    if (pendingNavigation) {
      const dest = pendingNavigation;
      setPendingNavigation(null);
      if (dest === 'SIGNOUT') {
        signOut({ callbackUrl: '/login' });
      } else {
        router.push(dest);
      }
    }
  };

  // Discard All Changes & Continue Navigation
  const handleDiscardAndContinue = () => {
    if (initialFocusPrefs) {
      setFocusDuration(initialFocusPrefs.focusDuration);
      setBreakGateQuestionCount(initialFocusPrefs.breakGateQuestionCount);
      setTimerChimeSound(initialFocusPrefs.timerChimeSound);
      setActivePresenceEnabled(initialFocusPrefs.activePresenceEnabled);
      setActivePresenceInterval(initialFocusPrefs.activePresenceInterval);
      setAfkCoachEnabled(initialFocusPrefs.afkCoachEnabled !== undefined ? initialFocusPrefs.afkCoachEnabled : true);
      setAfkCoachMinutes(initialFocusPrefs.afkCoachMinutes || 1);
    }

    if (initialSoundPrefs) {
      setDefaultAmbientTrack(initialSoundPrefs.defaultAmbientTrack);
      setAmbientVolume(initialSoundPrefs.ambientVolume);
      setDailyReminder(initialSoundPrefs.dailyReminder);
    }

    if (initialProfile.name) {
      setName(initialProfile.name);
      setUsername(initialProfile.username);
    }

    window.__ifocusHasUnsavedChanges = false;
    setShowUnsavedModal(false);

    if (pendingNavigation) {
      const dest = pendingNavigation;
      setPendingNavigation(null);
      if (dest === 'SIGNOUT') {
        signOut({ callbackUrl: '/login' });
      } else {
        router.push(dest);
      }
    }
  };

  // Discard all changes in-place
  const handleDiscardAll = () => {
    if (initialFocusPrefs) {
      setFocusDuration(initialFocusPrefs.focusDuration);
      setBreakGateQuestionCount(initialFocusPrefs.breakGateQuestionCount);
      setTimerChimeSound(initialFocusPrefs.timerChimeSound);
      setActivePresenceEnabled(initialFocusPrefs.activePresenceEnabled);
      setActivePresenceInterval(initialFocusPrefs.activePresenceInterval);
      setAfkCoachEnabled(initialFocusPrefs.afkCoachEnabled !== undefined ? initialFocusPrefs.afkCoachEnabled : true);
      setAfkCoachMinutes(initialFocusPrefs.afkCoachMinutes || 1);
    }

    if (initialSoundPrefs) {
      setDefaultAmbientTrack(initialSoundPrefs.defaultAmbientTrack);
      setAmbientVolume(initialSoundPrefs.ambientVolume);
      setDailyReminder(initialSoundPrefs.dailyReminder);
    }

    if (initialProfile.name) {
      setName(initialProfile.name);
      setUsername(initialProfile.username);
    }

    showToast('success', 'Changes discarded.', 'Reverted');
  };

  // Save all modified preferences from floating banner
  const handleSaveAllChanges = async () => {
    await handleSaveAndContinue();
  };

  const memberSinceText = createdAt 
    ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '2026';

  // 2. Save Avatar Selection
  const handleSaveAvatar = async () => {
    let finalUrl = tempAvatarUrl;
    if (customDirectUrl.trim()) {
      finalUrl = customDirectUrl.trim();
    }

    setIsSavingAvatar(true);
    setAvatarUrl(finalUrl);
    try { localStorage.setItem('ifocus_user_avatar', finalUrl); } catch (e) {}
    setIsAvatarModalOpen(false);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: finalUrl })
      });
      if (res.ok) {
        if (updateSession) {
          await updateSession({ user: { image: finalUrl } });
        }
        playSaveSuccessChime(ambientVolume);
      showToast('success', 'Profile avatar updated.', 'Avatar Saved');
      }
    } catch (err) {
      console.error("Avatar save error:", err);
      showToast('error', 'Failed to save avatar.');
    } finally {
      setIsSavingAvatar(false);
    }
  };

  const handleRandomizeAvatar = () => {
    const randomSeeds = ['Aria', 'Nova', 'Pixel', 'Sonic', 'Zoe', 'Atlas', 'Zephyr', 'Orion', 'Blaze', 'Kira', 'Shadow', 'Jasper'];
    const randomStyles = ['adventurer', 'bottts', 'fun-emoji', 'lorelei'];
    const chosenSeed = randomSeeds[Math.floor(Math.random() * randomSeeds.length)] + Math.floor(Math.random() * 100);
    const chosenStyle = randomStyles[Math.floor(Math.random() * randomStyles.length)];
    const bgColors = ['b6e3f4', 'ffd5dc', 'c0aede', 'd1d4f9', 'ffdfbf'];
    const chosenBg = bgColors[Math.floor(Math.random() * bgColors.length)];

    setTempAvatarUrl(getDicebearUrl(chosenStyle, chosenSeed, chosenBg));
  };

  // Unified Master Save Preferences Handler (Saves All Preferences Across Tabs)
  const handleSavePreferences = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setIsSavingProfile(true);
    try {
      const cleanBgCount = Number(breakGateQuestionCount || 3);
      setBreakGateQuestionCount(cleanBgCount);

      const cleanInterval = Number(activePresenceInterval || 5);
      setActivePresenceInterval(cleanInterval);

      const cleanVolume = Number(ambientVolume);
      setAmbientVolume(cleanVolume);

      // 1. Save Focus & Timer Preferences
      const timerPrefs = {
        focusDuration: Number(focusDuration || 25),
        breakGateQuestionCount: cleanBgCount,
        timerChimeSound: Boolean(timerChimeSound),
        activePresenceEnabled: Boolean(activePresenceEnabled),
        activePresenceInterval: cleanInterval,
        afkCoachEnabled: Boolean(afkCoachEnabled),
        afkCoachMinutes: Number(afkCoachMinutes || 1),
        burnoutCheckEnabled: Boolean(burnoutCheckEnabled),
        burnoutCheckMinutes: Number(burnoutCheckMinutes || 20),
      };
      localStorage.setItem('ifocus_timer_preferences', JSON.stringify(timerPrefs));
      localStorage.setItem('ifocus_breakgate_question_count', String(cleanBgCount));
      setInitialFocusPrefs(timerPrefs);
      window.dispatchEvent(new CustomEvent('ifocus_timer_prefs_updated', { detail: timerPrefs }));

      // Sync focus preferences to cloud for cross-device consistency (e.g. PC to iPhone PWA)
      fetch('/api/user/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timerPreferences: timerPrefs })
      }).catch(() => {});

      // 2. Save Sound & Notification Preferences
      const soundPrefs = {
        defaultAmbientTrack: String(defaultAmbientTrack || 'Chill Lofi'),
        ambientVolume: cleanVolume,
        dailyReminder: Boolean(dailyReminder),
      };
      localStorage.setItem('ifocus_sound_preferences', JSON.stringify(soundPrefs));
      setInitialSoundPrefs(soundPrefs);

      if (defaultAmbientTrack && defaultAmbientTrack !== 'None') {
        try {
          const currentMusic = JSON.parse(localStorage.getItem('ifocus_music_state') || '{}');
          const updatedMusic = { ...currentMusic, currentTrack: defaultAmbientTrack, volume: cleanVolume };
          localStorage.setItem('ifocus_music_state', JSON.stringify(updatedMusic));
          window.dispatchEvent(new CustomEvent('ifocus_music_sync', { detail: updatedMusic }));
        } catch (mErr) {}
      }

      // 3. Save Profile if modified
      if (name.trim() && username.trim()) {
        const cleanName = name.trim();
        const cleanUsername = username.trim();
        try {
          const res = await fetch('/api/user/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: cleanName,
              username: cleanUsername,
              image: avatarUrl,
            }),
          });
          if (res.ok) {
            setInitialProfile({ name: cleanName, username: cleanUsername });
            if (updateSession) {
              await updateSession({
                user: { name: cleanName, username: cleanUsername, image: avatarUrl },
              });
            }
          } else {
            setInitialProfile({ name: cleanName, username: cleanUsername });
          }
        } catch (pErr) {
          setInitialProfile({ name: cleanName, username: cleanUsername });
        }
      }

      window.__ifocusHasUnsavedChanges = false;
      playSaveSuccessChime(cleanVolume);
      showToast('success', 'Preferences saved successfully.', 'Settings Saved');
      return true;
    } catch (err) {
      console.error('Save preferences error:', err);
      showToast('error', 'Failed to save preferences.');
      return false;
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSaveFocusPreferences = handleSavePreferences;
  const handleSaveNotifications = handleSavePreferences;
  const handleSaveProfileDetails = handleSavePreferences;

  // 6. Change Password (in Privacy & Security)
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast('error', 'New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'New passwords do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      playSaveSuccessChime(ambientVolume);
      showToast('success', 'Password updated successfully.', 'Password Changed');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // 7. Clear Session Cache
  const handleClearCache = () => {
    if (confirm("Are you sure you want to clear your local session cache? Your cloud data will remain safe.")) {
      localStorage.removeItem('ifocus_session_history');
      localStorage.removeItem('ifocus_focus_stats');
      setStats(prev => ({ ...prev, totalSessions: 0, focusHours: 0, streakDays: 0 }));
      showToast('success', 'Local session cache cleared.');
    }
  };

  // 8. Send Feedback
  const handleSendFeedback = (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      showToast('error', 'Please write a message before sending.');
      return;
    }
    setIsSendingFeedback(true);
    setTimeout(() => {
      setIsSendingFeedback(false);
      setFeedbackText('');
      showToast('success', 'Thank you! Your feedback has been sent.');
    }, 600);
  };

  // Play audio test chime scaled by user-selected volume (Silent if Muted 0%)
  const playSampleChime = (vol = ambientVolume) => {
    try {
      const volNum = Math.max(0, Math.min(100, Number(vol !== undefined ? vol : ambientVolume)));
      if (volNum <= 0) {
        // Muted (0%): Completely silent, zero audio output
        return;
      }
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const volFactor = volNum / 100;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2 * volFactor, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.52);
    } catch (e) {
      console.log("Audio preview blocked", e);
    }
  };

  return (
    <div className="settings-viewport-layout">
      
      {/* Redesigned Luxury Frosted Glass Toast Notification */}
      {toast.type && (
        <div
          id="ifocusSettingsToast"
          className={`settings-toast-banner ${toast.type}`}
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '2rem',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '0.75rem 1.25rem 0.75rem 0.85rem',
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: toast.type === 'success'
              ? '1.5px solid rgba(34, 197, 94, 0.45)'
              : '1.5px solid rgba(239, 68, 68, 0.45)',
            borderRadius: '9999px',
            boxShadow: toast.type === 'success'
              ? '0 20px 45px -10px rgba(27, 67, 50, 0.25), 0 6px 16px rgba(0, 0, 0, 0.05), 0 0 18px rgba(34, 197, 94, 0.2)'
              : '0 20px 45px -10px rgba(153, 27, 27, 0.25), 0 6px 16px rgba(0, 0, 0, 0.05)',
            animation: 'ifocusToastDropIn 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards',
            userSelect: 'none',
            maxWidth: '440px',
          }}
        >
          {/* Animated Glowing Badge */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: toast.type === 'success'
                ? 'linear-gradient(135deg, #16a34a, #15803d)'
                : 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: toast.type === 'success'
                ? '0 4px 12px rgba(22, 163, 74, 0.45)'
                : '0 4px 12px rgba(239, 68, 68, 0.45)',
              flexShrink: 0,
            }}
          >
            {toast.type === 'success' ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#143321', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
              {toast.title || (toast.type === 'success' ? 'Saved Successfully' : 'Notice')}
            </span>
            <span style={{ fontSize: '0.74rem', color: '#4b6354', fontWeight: 500, lineHeight: 1.2 }}>
              {toast.message}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setToast({ type: null, message: '', title: '' })}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(20, 51, 33, 0.4)',
              cursor: 'pointer',
              padding: '4px',
              marginLeft: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#143321'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(20, 51, 33, 0.4)'; }}
            title="Dismiss"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Unsaved Changes Confirmation Modal */}
      {/* Unsaved Changes Confirmation Modal (English, "Okay" button, saves must be done on the page) */}
      {showUnsavedModal && (
        <div
          id="unsavedChangesModal"
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
              background: 'rgba(255, 255, 255, 0.98)',
              borderRadius: '24px',
              padding: '1.85rem',
              boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.06)',
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
                  background: 'rgba(217, 119, 6, 0.12)',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: '1px solid rgba(217, 119, 6, 0.25)',
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#163824', letterSpacing: '-0.02em' }}>
                  Unsaved Changes
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#557060', marginTop: '2px' }}>
                  Please save your preferences before leaving.
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.22)',
                borderRadius: '14px',
                padding: '0.85rem 1rem',
                fontSize: '0.86rem',
                color: '#854d0e',
                lineHeight: 1.45,
              }}
            >
              You have unsaved changes. Please use the <strong>Save</strong> button on this page to apply your settings before navigating away.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.4rem' }}>
              <button
                type="button"
                id="unsavedModalSaveBtn"
                onClick={handleSaveAndContinue}
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
                Save Preferences & Continue
              </button>

              <button
                type="button"
                id="unsavedModalDiscardBtn"
                onClick={handleDiscardAndContinue}
                style={{
                  padding: '0.5rem 1rem',
                  background: 'none',
                  border: 'none',
                  color: '#6b7280',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.target.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.target.style.color = '#6b7280')}
              >
                Discard changes and leave
              </button>

              <button
                type="button"
                id="unsavedModalStayBtn"
                onClick={() => {
                  setShowUnsavedModal(false);
                  setPendingNavigation(null);
                }}
                style={{
                  padding: '0.35rem 1rem',
                  background: 'none',
                  border: 'none',
                  color: '#9ca3af',
                  fontWeight: 500,
                  fontSize: '0.80rem',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  transition: 'color 0.15s ease',
                }}
              >
                Stay on settings
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ================= COLUMN 1: PROFILE OVERVIEW (Compact & Full Height) ================= */}
      <div className="settings-left-card">
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
            <div className="profile-avatar-glow" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              suppressHydrationWarning
              src={
                avatarUrl || 
                session?.user?.image || 
                getDicebearUrl('adventurer', username || name || 'Focus', 'c0aede')
              } 
              alt="Avatar" 
              style={{ width: '92px', height: '92px', borderRadius: '50%', border: '3.5px solid white', boxShadow: '0 6px 18px rgba(0,0,0,0.1)', objectFit: 'cover', background: '#f0f4ee', position: 'relative', zIndex: 1 }} 
            />
            <button 
              title="Change Avatar"
              onClick={() => {
                setTempAvatarUrl(avatarUrl);
                setIsAvatarModalOpen(true);
              }}
              style={{ position: 'absolute', bottom: '2px', right: '2px', zIndex: 2, background: 'var(--primary-accent)', color: 'white', border: '2px solid white', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
          </div>

          <h3 suppressHydrationWarning style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.15rem 0', fontWeight: 700, textAlign: 'center' }}>
            {name || username || 'Focus Member'}
          </h3>
          <p suppressHydrationWarning style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
            Focus Member since {memberSinceText}
          </p>
          
          {/* Live Calculated Stats (Compact) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: '#f8faf7', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                Total Sessions
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
                {stats.totalSessions}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: '#f8faf7', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                Focus Time
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
                {stats.focusHours}h
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 0.85rem', background: '#f8faf7', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                Current Streak
              </span>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-accent)' }}>
                {stats.streakDays} {stats.streakDays === 1 ? 'Day' : 'Days'}
              </span>
            </div>
          </div>
        </div>

        {/* Student Details & Credentials (Eliminates empty void) */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.85rem' }}>
          <div style={{ padding: '0.65rem 0.85rem', background: '#f8faf7', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Account Role</span>
            <span style={{ fontSize: '0.86rem', fontWeight: 700, color: '#27522d' }}>
              {session?.user?.role === 'ADMIN' ? 'Administrator' : 'Student / Scholar'}
            </span>
          </div>
          {email && (
            <div style={{ padding: '0.65rem 0.85rem', background: '#f8faf7', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.04em' }}>Registered Email</span>
              <span style={{ fontSize: '0.84rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {email}
              </span>
            </div>
          )}

          {/* Dedicated Sign Out Button */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              marginTop: '0.65rem',
              width: '100%',
              padding: '10px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              color: '#dc2626',
              fontSize: '0.86rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.18s ease'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>

      </div>

      {/* ================= COLUMN 2: 4 CATEGORIES & ACTIVE CONTROLS ================= */}
      <div className="settings-right-card">
        
        {/* Header (Clean & Compact) */}
        <div style={{ marginBottom: '0.85rem', flexShrink: 0 }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '1.35rem', margin: '0 0 0.15rem 0', fontWeight: 700 }}>Profile & Settings</h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.86rem' }}>
            Customize your focus environment and coach behaviors.
          </p>
        </div>
        
        {/* 4 CATEGORIES BAR (1 compact row, clean SVG icons, no emojis) */}
        <div className="settings-category-bar">
          
          {/* Card 1: Focus Preferences */}
          <div 
            className={`settings-cat-btn ${activeSection === 'focus' ? 'active' : ''}`}
            onClick={() => setActiveSection('focus')}
          >
            <div className="settings-cat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
            </div>
            <div className="settings-cat-info">
              <span className="settings-cat-title">Focus Preferences</span>
              <span className="settings-cat-sub">Timer & intervals</span>
            </div>
          </div>

          {/* Card 2: Notifications */}
          <div 
            className={`settings-cat-btn ${activeSection === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveSection('notifications')}
          >
            <div className="settings-cat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
            </div>
            <div className="settings-cat-info">
              <span className="settings-cat-title">Notifications</span>
              <span className="settings-cat-sub">Reminders & audio</span>
            </div>
          </div>

          {/* Card 3: Privacy & Security */}
          <div 
            className={`settings-cat-btn ${activeSection === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveSection('privacy')}
          >
            <div className="settings-cat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <div className="settings-cat-info">
              <span className="settings-cat-title">Privacy & Security</span>
              <span className="settings-cat-sub">Account & passwords</span>
            </div>
          </div>

          {/* Card 4: Feedback & Support */}
          <div 
            className={`settings-cat-btn ${activeSection === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveSection('feedback')}
          >
            <div className="settings-cat-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div className="settings-cat-info">
              <span className="settings-cat-title">Feedback & Support</span>
              <span className="settings-cat-sub">Report bugs & help</span>
            </div>
          </div>

        </div>

        {/* ================= ACTIVE SETTINGS PANE (Fitted on Screen) ================= */}
        <div className="settings-detail-form-area">
          
          {/* 1. FOCUS PREFERENCES PANEL */}
          {activeSection === 'focus' && (
            <form onSubmit={handleSaveFocusPreferences} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>


              <div className="settings-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.45rem', marginBottom: '0.4rem' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                    <label className="settings-label" style={{ fontSize: '0.85rem', margin: 0, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      BreakGate Questions Count
                    </label>
                    <HelpButton topic="breakgate" title="BreakGate Challenge Questions Tutorial" size={12} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
                  </div>
                  <span style={{ 
                    fontSize: '0.74rem', 
                    color: hasActiveBreakGateDeck ? 'var(--text-secondary)' : '#b45309', 
                    fontWeight: 600,
                    backgroundColor: hasActiveBreakGateDeck ? 'rgba(0, 0, 0, 0.04)' : 'rgba(245, 158, 11, 0.1)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: hasActiveBreakGateDeck ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(245, 158, 11, 0.25)',
                    whiteSpace: 'nowrap'
                  }}>
                    {hasActiveBreakGateDeck ? 'Recommended: 1 to 5 questions' : 'No Deck Active in Flashcards'}
                  </span>
                </div>
                <input 
                  type="number" 
                  min="1" 
                  max="10" 
                  disabled={!hasActiveBreakGateDeck}
                  className="settings-input" 
                  value={!hasActiveBreakGateDeck ? 0 : (breakGateQuestionCount === 0 || breakGateQuestionCount === '0' ? '' : breakGateQuestionCount)} 
                  onChange={(e) => {
                    if (!hasActiveBreakGateDeck) return;
                    const val = e.target.value === '' ? '' : Math.max(1, Math.min(10, parseInt(e.target.value) || 1));
                    setBreakGateQuestionCount(val);
                  }} 
                  placeholder={!hasActiveBreakGateDeck ? '0 (Locked)' : 'e.g. 3 Questions'}
                  style={{ 
                    padding: '0.6rem 0.85rem', 
                    fontSize: '0.9rem', 
                    borderRadius: '12px',
                    background: !hasActiveBreakGateDeck ? 'rgba(0, 0, 0, 0.04)' : '#ffffff',
                    cursor: !hasActiveBreakGateDeck ? 'not-allowed' : 'text',
                    opacity: !hasActiveBreakGateDeck ? 0.75 : 1
                  }}
                />
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                  {!hasActiveBreakGateDeck 
                    ? 'Locked to 0. Activate a flashcard deck in Flashcards first to enable BreakGate questions.' 
                    : `Active Deck: "${activeDeckTitle}". Number of flashcard questions presented during BreakGate.`}
                </p>
              </div>



              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Completion Audio Chimes</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Play sound chime when work and rest cycles finish.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={timerChimeSound} 
                    onChange={(e) => setTimerChimeSound(e.target.checked)} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <TimerNotificationSettings />

              {/* Active Presence Check Setting */}
              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.15rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Active Presence Check</h4>
                    <HelpButton topic="presence" title="Active Presence Anti-Ghosting Tutorial" size={12} style={{ width: '20px', height: '20px' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Periodically pauses the timer to verify you are still focused at your desk.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={activePresenceEnabled} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setActivePresenceEnabled(val);
                    }} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {activePresenceEnabled && (
                <div style={{ padding: '0.35rem 0 0.15rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="settings-label" style={{ fontSize: '0.82rem', margin: 0, fontWeight: 700 }}>
                      Active Presence Check Interval
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--primary-accent)', fontWeight: 600 }}>
                      {activePresenceInterval === 1 ? '1 min (Rapid Test)' : `Every ${activePresenceInterval} mins`}
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                    gap: '8px',
                    width: '100%'
                  }}>
                    {[
                      { mins: 1, label: '1m (Test)' },
                      { mins: 3, label: 'Every 3m' },
                      { mins: 5, label: 'Every 5m' },
                      { mins: 10, label: 'Every 10m' },
                      { mins: 15, label: 'Every 15m' }
                    ].map(({ mins, label }) => (
                      <button 
                        key={mins} 
                        type="button" 
                        className={`option-chip ${activePresenceInterval === mins ? 'selected' : ''}`}
                        onClick={() => {
                          setActivePresenceInterval(mins);
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          borderRadius: '10px',
                          textAlign: 'center',
                          boxSizing: 'border-box',
                          margin: 0
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Idle AFK Coach Intervention Setting */}
              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.15rem' }}>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Idle AFK Coach Intervention</h4>
                    <HelpButton topic="reflection" title="Proactive AFK Coach Intervention Tutorial" size={12} style={{ width: '20px', height: '20px' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Proactively checks in when you are inactive and no study timer is running.
                  </p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={afkCoachEnabled} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setAfkCoachEnabled(val);
                      try {
                        const raw = localStorage.getItem('ifocus_timer_preferences') || '{}';
                        const parsed = JSON.parse(raw);
                        parsed.afkCoachEnabled = val;
                        parsed.afkCoachMinutes = afkCoachMinutes;
                        localStorage.setItem('ifocus_timer_preferences', JSON.stringify(parsed));
                        window.dispatchEvent(new CustomEvent('ifocus_timer_prefs_updated', { detail: parsed }));
                      } catch(err) {}
                    }} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {afkCoachEnabled && (
                <div style={{ padding: '0.35rem 0 0.15rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="settings-label" style={{ fontSize: '0.82rem', margin: 0, fontWeight: 700 }}>
                      AFK Inactivity Timeout (No Timer Running)
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--primary-accent)', fontWeight: 600 }}>
                      {afkCoachMinutes === 1 ? '1 min (Rapid Test)' : `After ${afkCoachMinutes} mins idle`}
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
                    gap: '8px',
                    width: '100%'
                  }}>
                    {[
                      { mins: 1, label: '1m (Test)' },
                      { mins: 2, label: '2 mins' },
                      { mins: 3, label: '3 mins' },
                      { mins: 5, label: '5 mins' },
                      { mins: 10, label: '10 mins' }
                    ].map(({ mins, label }) => (
                      <button 
                        key={mins} 
                        type="button" 
                        className={`option-chip ${afkCoachMinutes === mins ? 'selected' : ''}`}
                        onClick={() => {
                          setAfkCoachMinutes(mins);
                          try {
                            const raw = localStorage.getItem('ifocus_timer_preferences') || '{}';
                            const parsed = JSON.parse(raw);
                            parsed.afkCoachEnabled = afkCoachEnabled;
                            parsed.afkCoachMinutes = mins;
                            localStorage.setItem('ifocus_timer_preferences', JSON.stringify(parsed));
                            window.dispatchEvent(new CustomEvent('ifocus_timer_prefs_updated', { detail: parsed }));
                          } catch(err) {}
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          borderRadius: '10px',
                          textAlign: 'center',
                          boxSizing: 'border-box',
                          margin: 0
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Task Stagnation & Burnout Check Toggle & Options (While Timer Running) */}
              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: 700 }}>Task Stagnation & Burnout Check</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Automatically checks in if the focus timer has been active for the set threshold without any task completed.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={burnoutCheckEnabled} 
                    onChange={(e) => {
                      const val = e.target.checked;
                      setBurnoutCheckEnabled(val);
                      try {
                        const raw = localStorage.getItem('ifocus_timer_preferences') || '{}';
                        const parsed = JSON.parse(raw);
                        parsed.burnoutCheckEnabled = val;
                        parsed.burnoutCheckMinutes = burnoutCheckMinutes;
                        localStorage.setItem('ifocus_timer_preferences', JSON.stringify(parsed));
                        window.dispatchEvent(new CustomEvent('ifocus_timer_prefs_updated', { detail: parsed }));
                      } catch(err) {}
                    }} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              {burnoutCheckEnabled && (
                <div style={{ padding: '0.35rem 0 0.15rem 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <label className="settings-label" style={{ fontSize: '0.82rem', margin: 0, fontWeight: 700 }}>
                      Burnout Check Interval (During Focus Session)
                    </label>
                    <span style={{ fontSize: '0.74rem', color: 'var(--primary-accent)', fontWeight: 600 }}>
                      After {burnoutCheckMinutes} mins without completed task
                    </span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))',
                    gap: '8px',
                    width: '100%'
                  }}>
                    {[
                      { mins: 10, label: '10 mins' },
                      { mins: 20, label: '20 mins' },
                      { mins: 30, label: '30 mins' },
                      { mins: 40, label: '40 mins' },
                      { mins: 50, label: '50 mins' }
                    ].map(({ mins, label }) => (
                      <button 
                        key={mins} 
                        type="button" 
                        className={`option-chip ${burnoutCheckMinutes === mins ? 'selected' : ''}`}
                        onClick={() => {
                          setBurnoutCheckMinutes(mins);
                          try {
                            const raw = localStorage.getItem('ifocus_timer_preferences') || '{}';
                            const parsed = JSON.parse(raw);
                            parsed.burnoutCheckEnabled = burnoutCheckEnabled;
                            parsed.burnoutCheckMinutes = mins;
                            localStorage.setItem('ifocus_timer_preferences', JSON.stringify(parsed));
                            window.dispatchEvent(new CustomEvent('ifocus_timer_prefs_updated', { detail: parsed }));
                          } catch(err) {}
                        }}
                        style={{
                          width: '100%',
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 8px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          borderRadius: '10px',
                          textAlign: 'center',
                          boxSizing: 'border-box',
                          margin: 0
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Testing Utilities Row - Symmetrical Responsive Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '8px',
                marginTop: '0.65rem',
                width: '100%'
              }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    if (ambientVolume === 0) {
                      showToast('info', 'Audio is currently muted (0%). Switch to Notifications tab to increase volume.', 'Audio Muted');
                      return;
                    }
                    playSampleChime(ambientVolume);
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '0.82rem',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '10px',
                    margin: 0
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  <span>{ambientVolume === 0 ? 'Chime Muted' : 'Test Chime'}</span>
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ifocus_test_presence'));
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '0.82rem',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '10px',
                    margin: 0
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                  <span>Test Presence Popup</span>
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ifocus_trigger_afk_coach_test', { detail: { minutes: afkCoachMinutes } }));
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '0.82rem',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '10px',
                    margin: 0
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <span>Test Idle Coach</span>
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('ifocus_trigger_burnout_check_test', { detail: { minutes: burnoutCheckMinutes } }));
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '38px',
                    fontSize: '0.82rem',
                    padding: '0 12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    borderRadius: '10px',
                    margin: 0
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                  <span>Test Burnout Check</span>
                </button>
              </div>

              {/* Dedicated Save Action Row */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--glass-border)' }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ padding: '0.55rem 1.4rem', fontSize: '0.88rem', width: 'auto', margin: 0 }}
                >
                  Save Preferences
                </button>
              </div>
            </form>
          )}

          {/* 2. NOTIFICATIONS & SOUND PANEL */}
          {activeSection === 'notifications' && (
            <form onSubmit={handleSaveNotifications} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <TimerNotificationSettings />
              <div className="settings-input-group">
                <label className="settings-label" style={{ fontSize: '0.85rem' }}>Default Ambient Soundscape</label>
                <select 
                  className="settings-select"
                  value={defaultAmbientTrack}
                  onChange={(e) => setDefaultAmbientTrack(e.target.value)}
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                >
                  <option value="Chill Lofi">Chill Lofi (Calm)</option>
                  <option value="Study Music">Study Music (Instrumental)</option>
                  <option value="Rain Ambient">Rain Ambient (Raindrops)</option>
                  <option value="Ocean Waves">Ocean Waves (Gentle Surf)</option>
                  <option value="Binaural Alpha (432Hz)">Binaural Alpha (432Hz Focus)</option>
                  <option value="Warm Campfire">Warm Campfire (Fireplace Crackle)</option>
                  <option value="Pink Noise">Pink Noise (Airflow & Focus)</option>
                  <option value="Cosmic Deep Space">Cosmic Deep Space (Celestial Drone)</option>
                  <option value="None">Off (Silent)</option>
                </select>
              </div>

              <div className="settings-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <label className="settings-label" style={{ fontSize: '0.82rem' }}>Default Audio & Chime Volume</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: ambientVolume === 0 ? 'var(--text-secondary)' : 'var(--primary-accent)' }}>
                      {ambientVolume === 0 ? 'Muted (0%)' : `${ambientVolume}%`}
                    </span>
                    <button
                      type="button"
                      id="testVolumeBtn"
                      onClick={() => {
                        if (ambientVolume === 0) {
                          showToast('info', 'Audio volume is currently muted (0%). Drag slider up to test sound.', 'Volume Muted');
                          return;
                        }
                        playSampleChime(ambientVolume);
                      }}
                      className="btn-secondary"
                      style={{ 
                        padding: '0.25rem 0.6rem', 
                        fontSize: '0.75rem', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        opacity: ambientVolume === 0 ? 0.7 : 1,
                        cursor: 'pointer'
                      }}
                      title={ambientVolume === 0 ? 'Audio volume is muted (0%)' : 'Test Audio Chime at this volume'}
                    >
                      {ambientVolume === 0 ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <line x1="23" y1="9" x2="17" y2="15"></line>
                          <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                      )}
                      {ambientVolume === 0 ? 'Muted' : 'Test Volume'}
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ambientVolume}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setAmbientVolume(val);
                    try {
                      const savedMusic = JSON.parse(localStorage.getItem('ifocus_music_state') || '{}');
                      savedMusic.volume = val;
                      localStorage.setItem('ifocus_music_state', JSON.stringify(savedMusic));
                      window.dispatchEvent(new CustomEvent('ifocus_music_sync', { detail: { volume: val } }));
                    } catch (err) {}
                  }}
                  onMouseUp={() => { if (ambientVolume > 0) playSampleChime(ambientVolume); }}
                  onTouchEnd={() => { if (ambientVolume > 0) playSampleChime(ambientVolume); }}
                  style={{ accentColor: 'var(--primary-accent)', width: '100%', height: '6px', cursor: 'pointer' }}
                />
              </div>



              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Post-Session Reflection Prompts</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Reminds you to log your Quick Reflection after completing Pomodoro sessions so the AI Coach can tune your focus plan.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                  <button
                    type="button"
                    id="previewReflectionPromptBtn"
                    onClick={() => window.dispatchEvent(new CustomEvent('ifocus_test_reflection_prompt'))}
                    className="btn-secondary"
                    style={{
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.78rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Preview prompt popup"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Preview Prompt
                  </button>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={dailyReminder} 
                      onChange={(e) => setDailyReminder(e.target.checked)} 
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', paddingTop: '0.85rem', borderTop: '1px solid var(--glass-border)' }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ padding: '0.55rem 1.4rem', fontSize: '0.88rem', width: 'auto', margin: 0 }}
                >
                  Save Preferences
                </button>
              </div>
            </form>
          )}

          {/* 3. PRIVACY & SECURITY PANEL */}
          {activeSection === 'privacy' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              {/* Account Details */}
              <form onSubmit={handleSaveProfileDetails} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="settings-form-grid" style={{ gap: '0.75rem' }}>
                  <div className="settings-input-group">
                    <label className="settings-label" style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Full Name</span>
                      <span style={{ fontSize: '0.72rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '1px 7px', borderRadius: '4px', fontWeight: 600 }}>
                        Locked (Academic Record)
                      </span>
                    </label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={name} 
                      disabled
                      placeholder="Official Academic Name"
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem', background: '#f8fafc', color: '#64748b', cursor: 'not-allowed', border: '1px solid #e2e8f0' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      Official student name is locked. To update, please request in person at the College Dean's Office.
                    </span>
                  </div>
                  <div className="settings-input-group">
                    <label className="settings-label" style={{ fontSize: '0.82rem' }}>Username</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))} 
                      placeholder="Username"
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
                      required
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                      Customizable handle used to log in and on your public cards.
                    </span>
                  </div>
                  <div className="settings-input-group full-width">
                    <label className="settings-label" style={{ fontSize: '0.82rem' }}>Email Address</label>
                    <input 
                      type="email" 
                      className="settings-input" 
                      value={email} 
                      disabled 
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    disabled={isSavingProfile}
                    style={{ padding: '0.55rem 1.4rem', fontSize: '0.88rem', width: 'auto', margin: 0 }}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Preferences'}
                  </button>
                </div>
              </form>

              {/* Password Change */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', color: 'var(--text-primary)' }}>Change Password</h4>
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="settings-form-grid" style={{ gap: '0.65rem' }}>
                    <div className="settings-input-group">
                      <input 
                        type="password" 
                        className="settings-input" 
                        value={currentPassword} 
                        onChange={(e) => setCurrentPassword(e.target.value)} 
                        placeholder="Current Password"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="settings-input-group">
                      <input 
                        type="password" 
                        className="settings-input" 
                        value={newPassword} 
                        onChange={(e) => setNewPassword(e.target.value)} 
                        placeholder="New Password (min 6)"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div className="settings-input-group full-width">
                      <input 
                        type="password" 
                        className="settings-input" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        placeholder="Confirm New Password"
                        style={{ padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      type="submit" 
                      className="btn-secondary" 
                      disabled={isUpdatingPassword || !newPassword}
                      style={{ padding: '0.45rem 1rem', fontSize: '0.82rem' }}
                    >
                      {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Data Export & Cache */}
              <div style={{ display: 'flex', gap: '0.65rem', paddingTop: '0.75rem', borderTop: '1px solid var(--glass-border)' }}>
                <a 
                  href="/api/user/export"
                  className="btn-secondary" 
                  style={{ flex: 1, justifyContent: 'center', padding: '0.45rem', fontSize: '0.82rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Export Study Data (JSON)
                </a>
                <button 
                  type="button"
                  onClick={handleClearCache}
                  className="btn-secondary" 
                  style={{ padding: '0.45rem 0.85rem', fontSize: '0.82rem', color: 'var(--warning)', borderColor: 'rgba(217, 119, 6, 0.3)' }}
                >
                  Clear Cache
                </button>
              </div>

            </div>
          )}

          {/* 4. FEEDBACK & SUPPORT PANEL */}
          {activeSection === 'feedback' && (
            <form onSubmit={handleSendFeedback} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="settings-label" style={{ fontSize: '0.82rem' }}>Category</label>
                <div className="option-chips-container" style={{ gap: '0.45rem', marginTop: '0.25rem' }}>
                  {[
                    { id: 'feedback', label: 'Feature Request' },
                    { id: 'bug', label: 'Bug Report' },
                    { id: 'ui', label: 'Design Suggestion' },
                    { id: 'question', label: 'General Inquiry' }
                  ].map((c) => (
                    <button 
                      key={c.id} 
                      type="button" 
                      className={`option-chip ${feedbackCategory === c.id ? 'selected' : ''}`}
                      onClick={() => setFeedbackCategory(c.id)}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-input-group">
                <label className="settings-label" style={{ fontSize: '0.82rem' }}>Message</label>
                <textarea 
                  rows={3} 
                  className="settings-textarea" 
                  placeholder="Describe your feedback, bug report, or ideas..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem', resize: 'none' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSendingFeedback}
                  style={{ padding: '0.55rem 1.4rem', fontSize: '0.88rem' }}
                >
                  {isSendingFeedback ? 'Sending...' : 'Submit Feedback'}
                </button>
              </div>
            </form>
          )}

        </div>

      </div>

      {/* ================= AVATAR CUSTOMIZER MODAL ================= */}
      {isAvatarModalOpen && (
        <div className="avatar-modal-overlay" onClick={() => setIsAvatarModalOpen(false)}>
          <div className="avatar-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="settings-card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--glass-border)' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>Choose Profile Picture</h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Select a character, roll a random avatar, or enter a custom image URL.
                </p>
              </div>
              <button 
                onClick={() => setIsAvatarModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              
              {/* Preview Box */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#f8faf7', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={tempAvatarUrl || avatarUrl} 
                  alt="Avatar Preview" 
                  style={{ width: '56px', height: '56px', borderRadius: '50%', border: '2.5px solid white', boxShadow: '0 3px 10px rgba(0,0,0,0.1)', objectFit: 'cover' }}
                />
                <div>
                  <h4 style={{ margin: '0 0 0.15rem 0', fontSize: '0.92rem', color: 'var(--text-primary)' }}>Live Preview</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Appears on your profile and navigation sidebar.</p>
                </div>
              </div>

              {/* Preset Characters (Clean labels, no emojis) */}
              <div>
                <label className="settings-label" style={{ marginBottom: '0.4rem', display: 'block', fontSize: '0.82rem' }}>Preset Characters</label>
                <div className="avatar-presets-grid" style={{ maxHeight: '180px', gap: '0.65rem' }}>
                  {AVATAR_PRESETS.map((preset) => {
                    const url = getDicebearUrl(preset.style, preset.seed, preset.bg);
                    const isSelected = tempAvatarUrl === url;
                    return (
                      <div 
                        key={preset.id}
                        className={`avatar-preset-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setTempAvatarUrl(url);
                          setCustomDirectUrl('');
                        }}
                        style={{ padding: '0.45rem' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={preset.label} style={{ width: '48px', height: '48px' }} />
                        <span className="avatar-preset-label">{preset.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Randomize Action */}
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={handleRandomizeAvatar}
                  style={{ flex: 1, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem', fontSize: '0.82rem' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
                  Randomize Avatar
                </button>
              </div>

              {/* Custom Image URL Option */}
              <div className="settings-input-group">
                <label className="settings-label" style={{ fontSize: '0.8rem' }}>Or Custom Image URL</label>
                <input 
                  type="url" 
                  className="settings-input" 
                  placeholder="https://example.com/avatar.png"
                  value={customDirectUrl}
                  onChange={(e) => {
                    setCustomDirectUrl(e.target.value);
                    if (e.target.value.startsWith('http')) {
                      setTempAvatarUrl(e.target.value);
                    }
                  }}
                  style={{ padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}
                />
              </div>

            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', padding: '0.75rem 1.25rem', borderTop: '1px solid var(--glass-border)', background: '#fafbfa' }}>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setIsAvatarModalOpen(false)}
                style={{ padding: '0.45rem 0.9rem', fontSize: '0.82rem' }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                disabled={isSavingAvatar}
                onClick={handleSaveAvatar}
                style={{ padding: '0.45rem 1.15rem', fontSize: '0.82rem' }}
              >
                {isSavingAvatar ? 'Applying...' : 'Apply Avatar'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

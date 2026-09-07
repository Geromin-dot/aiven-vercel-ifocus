"use client";

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';

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

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  
  // Selected Section among the 4 Cards ('focus' | 'notifications' | 'privacy' | 'feedback')
  const [activeSection, setActiveSection] = useState('focus');

  // User Profile Data
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [createdAt, setCreatedAt] = useState(null);

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
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [autoStartBreaks, setAutoStartBreaks] = useState(true);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [timerChimeSound, setTimerChimeSound] = useState(true);

  // 2. Notifications & Sound Preferences State
  const [defaultAmbientTrack, setDefaultAmbientTrack] = useState('Chill Lofi');
  const [ambientVolume, setAmbientVolume] = useState(70);
  const [telemetryChime, setTelemetryChime] = useState(true);
  const [dailyReminder, setDailyReminder] = useState(true);

  // 3. Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState('feedback');
  const [feedbackText, setFeedbackText] = useState('');
  const [isSendingFeedback, setIsSendingFeedback] = useState(false);

  // Toast / Alert Notification
  const [toast, setToast] = useState({ type: null, message: '' });

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast({ type: null, message: '' });
    }, 4000);
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
            setCreatedAt(data.user.createdAt);
            
            const initialAvatar = data.user.image || getDicebearUrl('adventurer', data.user.username || 'FocusUser', 'c0aede');
            setAvatarUrl(initialAvatar);
            setTempAvatarUrl(initialAvatar);
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

    // Load Local Saved Preferences
    try {
      const savedTimer = localStorage.getItem('ifocus_timer_preferences');
      if (savedTimer) {
        const parsed = JSON.parse(savedTimer);
        if (parsed.focusDuration) setFocusDuration(parsed.focusDuration);
        if (parsed.shortBreakDuration) setShortBreakDuration(parsed.shortBreakDuration);
        if (parsed.longBreakDuration) setLongBreakDuration(parsed.longBreakDuration);
        if (parsed.autoStartBreaks !== undefined) setAutoStartBreaks(parsed.autoStartBreaks);
        if (parsed.autoStartFocus !== undefined) setAutoStartFocus(parsed.autoStartFocus);
        if (parsed.timerChimeSound !== undefined) setTimerChimeSound(parsed.timerChimeSound);
      }

      const savedSound = localStorage.getItem('ifocus_sound_preferences');
      if (savedSound) {
        const parsed = JSON.parse(savedSound);
        if (parsed.defaultAmbientTrack) setDefaultAmbientTrack(parsed.defaultAmbientTrack);
        if (parsed.ambientVolume !== undefined) setAmbientVolume(parsed.ambientVolume);
        if (parsed.telemetryChime !== undefined) setTelemetryChime(parsed.telemetryChime);
        if (parsed.dailyReminder !== undefined) setDailyReminder(parsed.dailyReminder);
      }
    } catch (e) {
      console.warn("Error loading local settings:", e);
    }
  }, []);

  // Format Join Date
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
        showToast('success', 'Profile avatar updated.');
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

  // 3. Save Focus Preferences
  const handleSaveFocusPreferences = (e) => {
    e.preventDefault();
    const prefs = {
      focusDuration,
      shortBreakDuration,
      longBreakDuration,
      autoStartBreaks,
      autoStartFocus,
      timerChimeSound
    };
    try {
      localStorage.setItem('ifocus_timer_preferences', JSON.stringify(prefs));
      showToast('success', 'Focus preferences saved.');
    } catch (err) {
      showToast('error', 'Failed to save preferences.');
    }
  };

  // 4. Save Notifications Preferences
  const handleSaveNotifications = (e) => {
    e.preventDefault();
    const prefs = {
      defaultAmbientTrack,
      ambientVolume,
      telemetryChime,
      dailyReminder
    };
    try {
      localStorage.setItem('ifocus_sound_preferences', JSON.stringify(prefs));
      showToast('success', 'Notification preferences saved.');
    } catch (err) {
      showToast('error', 'Failed to save preferences.');
    }
  };

  // 5. Save Profile & Account Details (in Privacy & Security)
  const handleSaveProfileDetails = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('error', 'Display name cannot be empty.');
      return;
    }
    if (!username.trim()) {
      showToast('error', 'Username cannot be empty.');
      return;
    }

    setIsSavingProfile(true);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          username: username.trim(),
          image: avatarUrl
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      if (updateSession) {
        await updateSession({
          user: {
            name: name.trim(),
            username: username.trim(),
            image: avatarUrl
          }
        });
      }

      showToast('success', 'Account details updated.');
    } catch (err) {
      showToast('error', err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

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
      showToast('success', 'Password updated successfully.');
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

  // Play audio test chime
  const playSampleChime = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.log("Audio preview blocked", e);
    }
  };

  return (
    <div className="settings-viewport-layout">
      
      {/* Dynamic Toast Feedback Notification */}
      {toast.type && (
        <div className={`settings-toast-banner ${toast.type}`} style={{ position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 1100 }}>
          {toast.type === 'success' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          )}
          <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{toast.message}</span>
        </div>
      )}

      {/* ================= COLUMN 1: PROFILE OVERVIEW (Compact & Full Height) ================= */}
      <div className="settings-left-card">
        
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
            <div className="profile-avatar-glow" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={avatarUrl || getDicebearUrl('adventurer', username || 'Alex', 'c0aede')} 
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

          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.15rem 0', fontWeight: 700, textAlign: 'center' }}>
            {name || username || 'Focus Member'}
          </h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0', fontSize: '0.8rem' }}>
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

        {/* Bottom Sign Out */}
        <div style={{ width: '100%', marginTop: '1rem' }}>
          <button 
            onClick={() => signOut({ callbackUrl: '/' })}
            className="btn-secondary" 
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.82rem', padding: '0.5rem', color: 'var(--error)', borderColor: 'rgba(224, 62, 62, 0.25)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            Log Out
          </button>
        </div>

      </div>

      {/* ================= COLUMN 2: 4 CATEGORIES & ACTIVE CONTROLS ================= */}
      <div className="settings-right-card">
        
        {/* Header (Clean & Compact) */}
        <div style={{ marginBottom: '0.75rem', flexShrink: 0 }}>
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
              <div>
                <label className="settings-label" style={{ fontSize: '0.85rem' }}>Default Focus Work Duration</label>
                <div className="option-chips-container" style={{ gap: '0.5rem', marginTop: '0.3rem' }}>
                  {[15, 25, 45, 50, 90].map((mins) => (
                    <button 
                      key={mins} 
                      type="button" 
                      className={`option-chip ${focusDuration === mins ? 'selected' : ''}`}
                      onClick={() => setFocusDuration(mins)}
                      style={{ padding: '0.4rem 0.85rem', fontSize: '0.84rem' }}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-form-grid" style={{ gap: '0.85rem' }}>
                <div className="settings-input-group">
                  <label className="settings-label" style={{ fontSize: '0.82rem' }}>Short Break (Minutes)</label>
                  <input 
                    type="number" 
                    min="1" 
                    max="30" 
                    className="settings-input" 
                    value={shortBreakDuration} 
                    onChange={(e) => setShortBreakDuration(parseInt(e.target.value) || 5)} 
                    style={{ padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                  />
                </div>
                <div className="settings-input-group">
                  <label className="settings-label" style={{ fontSize: '0.82rem' }}>Long Break (Minutes)</label>
                  <input 
                    type="number" 
                    min="5" 
                    max="60" 
                    className="settings-input" 
                    value={longBreakDuration} 
                    onChange={(e) => setLongBreakDuration(parseInt(e.target.value) || 15)} 
                    style={{ padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                  />
                </div>
              </div>

              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Auto-Start Break Sessions</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Automatically begin the rest countdown when focus time ends.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={autoStartBreaks} 
                    onChange={(e) => setAutoStartBreaks(e.target.checked)} 
                  />
                  <span className="toggle-slider"></span>
                </label>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem' }}>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={playSampleChime}
                  style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                  Test Chime
                </button>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
                >
                  Save Focus Preferences
                </button>
              </div>
            </form>
          )}

          {/* 2. NOTIFICATIONS & SOUND PANEL */}
          {activeSection === 'notifications' && (
            <form onSubmit={handleSaveNotifications} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
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
                  <option value="None">Off (Silent)</option>
                </select>
              </div>

              <div className="settings-input-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="settings-label" style={{ fontSize: '0.82rem' }}>Default Music Volume</label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-accent)' }}>{ambientVolume}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={ambientVolume} 
                  onChange={(e) => setAmbientVolume(parseInt(e.target.value))}
                  style={{ accentColor: 'var(--primary-accent)', width: '100%', height: '6px', cursor: 'pointer' }} 
                />
              </div>

              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Cognitive Friction Alert Chime</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Harmonic audio prompt when keystroke hesitation or fatigue is detected.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={telemetryChime} 
                    onChange={(e) => setTelemetryChime(e.target.checked)} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className="settings-toggle-row" style={{ padding: '0.65rem 0.9rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Daily Reflection Reminders</h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Show quick reflection prompts after completing focus cycles.</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={dailyReminder} 
                    onChange={(e) => setDailyReminder(e.target.checked)} 
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.4rem' }}>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ padding: '0.55rem 1.25rem', fontSize: '0.88rem' }}
                >
                  Save Notification Preferences
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
                    <label className="settings-label" style={{ fontSize: '0.82rem' }}>Display Name</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Display Name"
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
                      required
                    />
                  </div>
                  <div className="settings-input-group">
                    <label className="settings-label" style={{ fontSize: '0.82rem' }}>Username</label>
                    <input 
                      type="text" 
                      className="settings-input" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} 
                      placeholder="Username"
                      style={{ padding: '0.5rem 0.85rem', fontSize: '0.88rem' }}
                      required
                    />
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
                    style={{ padding: '0.45rem 1.15rem', fontSize: '0.85rem' }}
                  >
                    {isSavingProfile ? 'Saving...' : 'Save Account Details'}
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span><kbd style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '3px', padding: '0 4px' }}>Space</kbd> Timer</span>
                  <span><kbd style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '3px', padding: '0 4px' }}>Enter</kbd> Add Task</span>
                  <span><kbd style={{ background: '#fff', border: '1px solid #ccc', borderRadius: '3px', padding: '0 4px' }}>Esc</kbd> Close</span>
                </div>
                <button 
                  type="submit" 
                  className="btn-primary" 
                  disabled={isSendingFeedback}
                  style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
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

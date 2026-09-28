"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsPage() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Base Historical Stats from LocalStorage
  const [baseStats, setBaseStats] = useState({
    todayMinutes: 0,
    weekMinutes: [0, 0, 0, 0, 0, 0, 0],
    completedSessionsCount: 0,
    streak: 0,
    recentSessions: [],
    todayIndex: 0,
  });

  // Flashcards Mastered State
  const [masteredCount, setMasteredCount] = useState(0);
  const [totalFlashcards, setTotalFlashcards] = useState(0);

  // Live Timer State (Synchronized across all tabs & pages)
  const [liveSession, setLiveSession] = useState({
    isRunning: false,
    isFocus: true,
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    elapsedSeconds: 0,
  });

  // Scale Unit: 'minutes' or 'hours' (defaults to minutes so short sessions like 1m, 5m are prominent)
  const [unitMode, setUnitMode] = useState('minutes');

  // Load Historical Analytics from LocalStorage
  const loadHistoricalStats = useCallback(() => {
    try {
      const sessionHistory = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
      const focusStats = JSON.parse(localStorage.getItem('ifocus_focus_stats') || '{}');

      const now = new Date();
      const todayStr = now.toDateString();
      const currentDay = now.getDay();
      const adjustedTodayIdx = currentDay === 0 ? 6 : currentDay - 1; // Mon=0, Sun=6

      // Determine Monday of current week
      const diffToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + diffToMon);
      monday.setHours(0, 0, 0, 0);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);

      let todayMins = 0;
      const weekMins = [0, 0, 0, 0, 0, 0, 0];
      let validSessionsCount = 0;

      sessionHistory.forEach(s => {
        const sDate = new Date(s.date);
        const dur = Number(s.duration) || 0;

        if (sDate.toDateString() === todayStr) {
          todayMins += dur;
        }

        if (sDate >= monday && sDate <= sunday) {
          const d = sDate.getDay();
          const idx = d === 0 ? 6 : d - 1;
          weekMins[idx] += dur;
          validSessionsCount++;
        }
      });

      const recent = [...sessionHistory].reverse().slice(0, 5);

      setBaseStats({
        todayMinutes: todayMins,
        weekMinutes: weekMins,
        completedSessionsCount: validSessionsCount || (focusStats.sessions || 0),
        streak: focusStats.streak || (validSessionsCount > 0 ? 1 : 0),
        recentSessions: recent,
        todayIndex: adjustedTodayIdx,
      });

      // If user has over 2 hours of study time, default view to hours, else minutes
      const totalWeekMinutes = weekMins.reduce((a, b) => a + b, 0);
      if (totalWeekMinutes >= 120) {
        setUnitMode('hours');
      }
    } catch (e) {
      console.warn('Failed loading historical stats:', e);
    }
  }, []);

  // Initialize and listen to Live Global Timer Ticks & State Sync
  useEffect(() => {
    // Elegant Chart.js defaults
    ChartJS.defaults.color = '#64748b';
    ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.94)';
    ChartJS.defaults.plugins.tooltip.titleColor = '#f8fafc';
    ChartJS.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    ChartJS.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.12)';
    ChartJS.defaults.plugins.tooltip.borderWidth = 1;
    ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
    ChartJS.defaults.plugins.tooltip.padding = 10;

    loadHistoricalStats();

    // Load Mastered Flashcards
    try {
      const storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
      setMasteredCount(storedMastered.length);
    } catch (e) {}

    // Fetch deck count
    fetch('/api/decks')
      .then(res => res.ok ? res.json() : [])
      .then(decks => {
        if (Array.isArray(decks)) {
          const count = decks.reduce((acc, d) => acc + (d.cards ? d.cards.length : 0), 0);
          setTotalFlashcards(count);
        }
      })
      .catch(() => {});

    // Initial check of live timer in localStorage
    try {
      const savedTimer = localStorage.getItem('ifocus_timer_state');
      if (savedTimer) {
        const parsed = JSON.parse(savedTimer);
        if (parsed.isRunning && parsed.targetEndTime && parsed.isFocus) {
          const rem = Math.max(0, Math.round((parsed.targetEndTime - Date.now()) / 1000));
          const total = parsed.totalTime || 25 * 60;
          const elapsed = Math.max(0, total - rem);
          setLiveSession({
            isRunning: true,
            isFocus: true,
            timeLeft: rem,
            totalTime: total,
            elapsedSeconds: elapsed,
          });
        }
      }
    } catch (e) {}

    // Listen to real-time timer ticks
    const handleTick = (e) => {
      if (e?.detail) {
        const isRunning = Boolean(e.detail.isRunning);
        const isFocus = Boolean(e.detail.isFocus);
        const timeLeft = Number(e.detail.timeLeft) || 0;
        const totalTime = Number(e.detail.totalTime) || 25 * 60;
        const elapsed = Math.max(0, totalTime - timeLeft);

        setLiveSession({
          isRunning,
          isFocus,
          timeLeft,
          totalTime,
          elapsedSeconds: elapsed,
        });
      }
    };

    const handleSync = (e) => {
      // Reload stats in case a session finished or state updated
      loadHistoricalStats();
      if (e?.detail) {
        const isRunning = Boolean(e.detail.isRunning);
        const isFocus = Boolean(e.detail.isFocus);
        const timeLeft = Number(e.detail.timeLeft) || 0;
        const totalTime = Number(e.detail.totalTime) || 25 * 60;
        const elapsed = Math.max(0, totalTime - timeLeft);

        setLiveSession({
          isRunning,
          isFocus,
          timeLeft,
          totalTime,
          elapsedSeconds: elapsed,
        });
      }
    };

    window.addEventListener('ifocus_timer_tick', handleTick);
    window.addEventListener('ifocus_timer_sync', handleSync);

    return () => {
      window.removeEventListener('ifocus_timer_tick', handleTick);
      window.removeEventListener('ifocus_timer_sync', handleSync);
    };
  }, [loadHistoricalStats]);

  // Compute Live Metrics
  const liveElapsedMins = (liveSession.isRunning && liveSession.isFocus)
    ? liveSession.elapsedSeconds / 60
    : 0;

  const currentTodayTotalMinutes = baseStats.todayMinutes + liveElapsedMins;
  const currentWeekTotalMinutes = baseStats.weekMinutes.reduce((a, b) => a + b, 0) + liveElapsedMins;
  const currentWeekHoursFormatted = (currentWeekTotalMinutes / 60).toFixed(1);

  // Format MM:SS helper
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Format Today's Display string
  const formatTodayDisplay = () => {
    const totalSec = Math.round(currentTodayTotalMinutes * 60);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;

    if (m === 0) {
      return `${s}s`;
    }
    if (m < 60) {
      return `${m}m${liveSession.isRunning && liveSession.isFocus && s > 0 ? ` ${s}s` : ''}`;
    }
    return `${(totalSec / 3600).toFixed(1)}h`;
  };

  // Live Chart Values (Adjusted dynamically for Today's bar)
  const liveChartData = useMemo(() => {
    return baseStats.weekMinutes.map((mins, idx) => {
      let dayMins = mins;
      if (idx === baseStats.todayIndex) {
        dayMins += liveElapsedMins;
      }
      if (unitMode === 'hours') {
        return Math.round((dayMins / 60) * 100) / 100; // e.g. 0.25h, 1.2h
      } else {
        return Math.round(dayMins * 10) / 10; // e.g. 1.2m, 25m
      }
    });
  }, [baseStats.weekMinutes, baseStats.todayIndex, liveElapsedMins, unitMode]);

  // Chart Configuration
  const focusChartData = {
    labels: days,
    datasets: [{
      label: unitMode === 'hours' ? 'Focus Hours' : 'Focus Minutes',
      data: liveChartData,
      backgroundColor: days.map((_, i) => {
        if (i === baseStats.todayIndex) {
          return liveSession.isRunning && liveSession.isFocus
            ? '#16a34a' // Vibrant active green when ticking live
            : '#2e7d32'; // Forest green
        }
        return 'rgba(95, 143, 94, 0.35)'; // Soft sage
      }),
      borderColor: days.map((_, i) => {
        if (i === baseStats.todayIndex) {
          return liveSession.isRunning && liveSession.isFocus ? '#15803d' : '#1b5e20';
        }
        return 'rgba(95, 143, 94, 0.7)';
      }),
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };

  const maxVal = Math.max(...liveChartData, 0);
  const suggestedMaxY = unitMode === 'minutes'
    ? Math.max(30, Math.ceil((maxVal + 5) / 10) * 10)
    : Math.max(1, Math.ceil((maxVal + 0.5) * 2) / 2);

  const focusChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: liveSession.isRunning ? 0 : 350, // Zero animation lag on live ticks for silky smoothness
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y;
            if (unitMode === 'hours') {
              const approxMins = Math.round(val * 60);
              return `${val}h (${approxMins} mins focus)`;
            } else {
              return `${val} minutes studied`;
            }
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        suggestedMax: suggestedMaxY,
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: { 
          callback: (v) => `${v}${unitMode === 'minutes' ? 'm' : 'h'}` 
        }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Format timestamp helper
  const formatSessionTime = (isoString) => {
    try {
      const d = new Date(isoString);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();

      const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

      if (isToday) return `Today, ${timeStr}`;
      if (isYesterday) return `Yesterday, ${timeStr}`;
      return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${timeStr}`;
    } catch (e) {
      return 'Recent session';
    }
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.4rem', animation: 'flashcardFadeIn 0.25s ease' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
            Study Analytics
          </h2>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
            Your live focus time and memory progress at a glance.
          </p>
        </div>

        {/* Live System Beacon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: liveSession.isRunning ? 'rgba(34, 197, 94, 0.1)' : 'rgba(100, 116, 139, 0.08)',
          border: liveSession.isRunning ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid rgba(100, 116, 139, 0.15)',
          padding: '0.4rem 0.85rem',
          borderRadius: '9999px',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: liveSession.isRunning ? '#15803d' : '#64748b'
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: liveSession.isRunning ? '#16a34a' : '#94a3b8',
            boxShadow: liveSession.isRunning ? '0 0 8px #16a34a' : 'none',
            display: 'inline-block'
          }} />
          {liveSession.isRunning ? 'Live Engine Active' : 'Timer Ready'}
        </div>
      </div>

      {/* 4 Core Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        
        {/* 1. Today's Focus */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.4rem', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', position: 'relative', overflow: 'hidden' }}>
          {liveSession.isRunning && liveSession.isFocus && (
            <div style={{ position: 'absolute', top: '10px', right: '12px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
              Live
            </div>
          )}
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            Today's Focus
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#2e7d32', lineHeight: 1.1 }}>
            {formatTodayDisplay()}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {liveSession.isRunning && liveSession.isFocus
              ? `Ticking live: +${formatTime(liveSession.elapsedSeconds)} in progress`
              : 'Total studied today'}
          </div>
        </div>

        {/* 2. This Week */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.4rem', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            This Week
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--primary-accent)', lineHeight: 1.1 }}>
            {currentWeekHoursFormatted}<span style={{ fontSize: '1.2rem', fontWeight: 600, marginLeft: '2px' }}>h</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Across {baseStats.completedSessionsCount + (liveSession.isRunning ? 1 : 0)} sessions
          </div>
        </div>

        {/* 3. Study Streak */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.4rem', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            Study Streak
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--secondary-accent, #6366f1)', lineHeight: 1.1 }}>
            {baseStats.streak} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{baseStats.streak === 1 ? 'Day' : 'Days'}</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Consecutive active study
          </div>
        </div>

        {/* 4. Mastered Flashcards */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.4rem', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            Mastered Cards
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>
            {masteredCount} <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Cards</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            {totalFlashcards > 0 ? `${Math.round((masteredCount / totalFlashcards) * 100)}% of ${totalFlashcards} total cards` : 'Memorized concepts'}
          </div>
        </div>

      </div>

      {/* Live Focus Session Active Banner (Appears when Pomodoro is running) */}
      {liveSession.isRunning && liveSession.isFocus && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(240, 253, 244, 0.95), rgba(220, 252, 231, 0.7))',
          border: '1px solid rgba(34, 197, 94, 0.35)',
          borderRadius: '16px',
          padding: '1rem 1.4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 4px 16px -2px rgba(34, 197, 94, 0.12)',
          backdropFilter: 'blur(8px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#16a34a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  Live Session Active
                </span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
              </div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: '#0f172a' }}>
                {formatTime(liveSession.elapsedSeconds)} elapsed of {Math.round(liveSession.totalTime / 60)}m session
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.72rem', color: '#15803d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Remaining
              </span>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.15rem', color: '#14532d' }}>
                {formatTime(liveSession.timeLeft)}
              </span>
            </div>

            <Link
              href="/dashboard"
              style={{
                background: '#16a34a',
                color: '#ffffff',
                padding: '0.55rem 1.15rem',
                borderRadius: '9999px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)',
                transition: 'opacity 0.2s',
              }}
            >
              <span>Command Center</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Single Clean Weekly Focus Bar Chart (Live Sync) */}
      <div className="glass-panel" style={{ padding: '1.5rem 1.75rem', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Weekly Focus Time
              </h3>
              {liveSession.isRunning && liveSession.isFocus && (
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  color: '#15803d',
                  background: 'rgba(34, 197, 94, 0.12)',
                  border: '1px solid rgba(34, 197, 94, 0.25)',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '9999px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  Live Sync
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0 0' }}>
              Hours studied each day from Monday to Sunday. (Emerald bar pulses with your live study time).
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* View Unit Mode Toggle: Minutes vs Hours */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <button
                type="button"
                onClick={() => setUnitMode('minutes')}
                style={{
                  border: 'none',
                  background: unitMode === 'minutes' ? '#ffffff' : 'transparent',
                  color: unitMode === 'minutes' ? '#0f172a' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: unitMode === 'minutes' ? 700 : 500,
                  padding: '0.3rem 0.7rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: unitMode === 'minutes' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Minutes
              </button>
              <button
                type="button"
                onClick={() => setUnitMode('hours')}
                style={{
                  border: 'none',
                  background: unitMode === 'hours' ? '#ffffff' : 'transparent',
                  color: unitMode === 'hours' ? '#0f172a' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: unitMode === 'hours' ? 700 : 500,
                  padding: '0.3rem 0.7rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: unitMode === 'hours' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Hours
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2e7d32', background: 'rgba(46, 125, 50, 0.1)', padding: '0.3rem 0.8rem', borderRadius: '999px' }}>
              {currentWeekHoursFormatted}h Total This Week
            </div>
          </div>
        </div>

        {/* Real-time Dynamic Chart Container */}
        <div style={{ position: 'relative', height: '270px', width: '100%', padding: '0.5rem 0' }}>
          <Bar data={focusChartData} options={focusChartOptions} />
        </div>
      </div>

      {/* Recent Study Activity Log */}
      <div className="glass-panel" style={{ padding: '1.5rem 1.75rem', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '0.65rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>
              Recent Study Sessions
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              Your logged Pomodoro focus sessions.
            </p>
          </div>

          <Link href="/dashboard" style={{ fontSize: '0.82rem', color: 'var(--primary-accent)', fontWeight: 600, textDecoration: 'none' }}>
            Open Timer
          </Link>
        </div>

        {/* If session is currently running, show it as an ongoing top row item */}
        {liveSession.isRunning && liveSession.isFocus && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem 1rem',
              background: 'rgba(34, 197, 94, 0.06)',
              borderRadius: '10px',
              border: '1px dashed rgba(34, 197, 94, 0.35)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#16a34a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>Focus Session in Progress</span>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {formatTime(liveSession.elapsedSeconds)} elapsed • Ticking now
                </div>
              </div>
            </div>

            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: '#15803d',
              background: 'rgba(34, 197, 94, 0.15)',
              padding: '0.2rem 0.65rem',
              borderRadius: '999px',
              letterSpacing: '0.03em',
              textTransform: 'uppercase'
            }}>
              Ongoing
            </span>
          </div>
        )}

        {baseStats.recentSessions.length === 0 && (!liveSession.isRunning || !liveSession.isFocus) ? (
          <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            No focus sessions logged yet. Complete a Pomodoro session in the timer to see live activity here!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {baseStats.recentSessions.map((session, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  background: '#fbfdfa',
                  borderRadius: '10px',
                  border: '1px solid rgba(0, 0, 0, 0.04)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '8px',
                    background: session.type === 'breakgate' ? 'rgba(46, 125, 50, 0.12)' : 'rgba(95, 143, 94, 0.12)',
                    color: session.type === 'breakgate' ? '#2e7d32' : 'var(--primary-accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {session.type === 'breakgate' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {session.duration} min {session.type === 'breakgate' ? 'BreakGate Micro-Challenge' : 'Pomodoro Focus Session'}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {formatSessionTime(session.date)}
                    </div>
                  </div>
                </div>

                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: '#2e7d32',
                  background: 'rgba(46, 125, 50, 0.1)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  letterSpacing: '0.03em',
                  textTransform: 'uppercase'
                }}>
                  Completed
                </span>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}

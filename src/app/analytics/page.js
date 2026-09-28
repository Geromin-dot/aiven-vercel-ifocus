"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
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

  // Historical Session Data from LocalStorage (Lightweight, 100% Client-side, Zero Backend Bandwidth)
  const [baseStats, setBaseStats] = useState({
    todayMinutes: 0,
    weekMinutes: [0, 0, 0, 0, 0, 0, 0],
    completedSessionsCount: 0,
    streak: 0,
    recentSessions: [],
    todayIndex: 0,
  });

  const [masteredCount, setMasteredCount] = useState(0);
  const [totalFlashcards, setTotalFlashcards] = useState(0);

  // User Scale Selection: '10mins' (every 10 minutes) or 'hours' (per hour)
  const [scaleMode, setScaleMode] = useState('10mins');

  // Load Historical Stats
  const loadStats = useCallback(() => {
    try {
      const sessionHistory = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
      const focusStats = JSON.parse(localStorage.getItem('ifocus_focus_stats') || '{}');

      const now = new Date();
      const todayStr = now.toDateString();
      const currentDay = now.getDay();
      const adjustedTodayIdx = currentDay === 0 ? 6 : currentDay - 1; // Mon=0, Sun=6

      // Calculate Monday to Sunday dates
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

      // Default to 10mins if under 2 hours for maximum clarity, else hours
      const totalWeekMinutes = weekMins.reduce((a, b) => a + b, 0);
      if (totalWeekMinutes >= 120) {
        setScaleMode('hours');
      } else {
        setScaleMode('10mins');
      }
    } catch (e) {
      console.warn('Failed loading stats:', e);
    }
  }, []);

  useEffect(() => {
    // Elegant Chart.js typography & tooltip defaults
    ChartJS.defaults.color = '#64748b';
    ChartJS.defaults.font.family = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif";
    ChartJS.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.94)';
    ChartJS.defaults.plugins.tooltip.titleColor = '#f8fafc';
    ChartJS.defaults.plugins.tooltip.bodyColor = '#e2e8f0';
    ChartJS.defaults.plugins.tooltip.borderColor = 'rgba(255, 255, 255, 0.12)';
    ChartJS.defaults.plugins.tooltip.borderWidth = 1;
    ChartJS.defaults.plugins.tooltip.cornerRadius = 8;
    ChartJS.defaults.plugins.tooltip.padding = 10;

    loadStats();

    // Load Mastered Cards
    try {
      const storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
      setMasteredCount(storedMastered.length);
    } catch (e) {}

    // Load Deck Count
    fetch('/api/decks')
      .then(res => res.ok ? res.json() : [])
      .then(decks => {
        if (Array.isArray(decks)) {
          const count = decks.reduce((acc, d) => acc + (d.cards ? d.cards.length : 0), 0);
          setTotalFlashcards(count);
        }
      })
      .catch(() => {});

    // Only refresh when a completed session is dispatched (no aggressive 1-second live loop)
    const handleSync = (e) => {
      // If timer is not running or a session just finished, reload stats
      if (!e?.detail?.isRunning) {
        loadStats();
      }
    };

    window.addEventListener('ifocus_timer_sync', handleSync);

    // Refresh every 10 minutes while tab is open
    const gentleRefresh = setInterval(() => {
      loadStats();
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener('ifocus_timer_sync', handleSync);
      clearInterval(gentleRefresh);
    };
  }, [loadStats]);

  // Total Week Hours formatted
  const totalWeekMinutes = baseStats.weekMinutes.reduce((a, b) => a + b, 0);
  const weekHoursFormatted = (totalWeekMinutes / 60).toFixed(1);

  // Today Focus Display
  const todayFocusFormatted = baseStats.todayMinutes < 60
    ? `${baseStats.todayMinutes}m`
    : `${(baseStats.todayMinutes / 60).toFixed(1)}h`;

  // Chart data computed based on scaleMode (10mins vs hours)
  const chartData = useMemo(() => {
    if (scaleMode === '10mins') {
      return baseStats.weekMinutes.map(m => Math.round(m));
    } else {
      return baseStats.weekMinutes.map(m => Math.round((m / 60) * 10) / 10);
    }
  }, [baseStats.weekMinutes, scaleMode]);

  const maxVal = Math.max(...chartData, 0);

  // Suggested Max with 10-minute steps
  const suggestedMaxY = scaleMode === '10mins'
    ? Math.max(30, Math.ceil((maxVal + 5) / 10) * 10)
    : Math.max(1, Math.ceil((maxVal + 0.5) * 2) / 2);

  const focusChartData = {
    labels: days,
    datasets: [{
      label: scaleMode === '10mins' ? 'Focus Minutes (10m Intervals)' : 'Focus Hours',
      data: chartData,
      backgroundColor: days.map((_, i) =>
        i === baseStats.todayIndex ? '#2e7d32' : 'rgba(95, 143, 94, 0.45)'
      ),
      borderColor: days.map((_, i) =>
        i === baseStats.todayIndex ? '#1b5e20' : 'rgba(95, 143, 94, 0.85)'
      ),
      borderWidth: 1.5,
      borderRadius: 8,
      borderSkipped: false,
    }]
  };

  const focusChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const val = ctx.parsed.y;
            if (scaleMode === '10mins') {
              const blocks = (val / 10).toFixed(1);
              return `${val} min studied (${blocks} × 10m intervals)`;
            } else {
              return `${val} hours studied`;
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
          stepSize: scaleMode === '10mins' ? 10 : 1, // Steps of 10 minutes or 1 hour
          callback: (v) => `${v}${scaleMode === '10mins' ? 'm' : 'h'}`
        }
      },
      x: {
        grid: { display: false }
      }
    }
  };

  // Format session timestamp helper
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
            Your focus time and memory progress at a glance.
          </p>
        </div>
      </div>

      {/* 4 Core Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
        
        {/* 1. Today's Focus */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.4rem', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            Today's Focus
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: '#2e7d32', lineHeight: 1.1 }}>
            {todayFocusFormatted}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Total completed today
          </div>
        </div>

        {/* 2. This Week */}
        <div style={{ background: '#ffffff', padding: '1.25rem 1.4rem', borderRadius: '14px', border: '1px solid var(--glass-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.35rem' }}>
            This Week
          </div>
          <div style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--primary-accent)', lineHeight: 1.1 }}>
            {weekHoursFormatted}<span style={{ fontSize: '1.2rem', fontWeight: 600, marginLeft: '2px' }}>h</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Across {baseStats.completedSessionsCount} completed sessions
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

      {/* Weekly Focus Bar Chart (Per 10 Mins / Per Hours Scale) */}
      <div className="glass-panel" style={{ padding: '1.5rem 1.75rem', background: '#ffffff', borderRadius: '16px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.15rem 0' }}>
              Weekly Focus Activity
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: 0 }}>
              {scaleMode === '10mins'
                ? 'Focus time measured in 10-minute intervals. (Green bar indicates today).'
                : 'Focus time measured in total hours. (Green bar indicates today).'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Resolution Toggle: Per 10 Mins vs Per Hour */}
            <div style={{
              display: 'flex',
              background: '#f1f5f9',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(0,0,0,0.06)'
            }}>
              <button
                type="button"
                onClick={() => setScaleMode('10mins')}
                style={{
                  border: 'none',
                  background: scaleMode === '10mins' ? '#ffffff' : 'transparent',
                  color: scaleMode === '10mins' ? '#0f172a' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: scaleMode === '10mins' ? 700 : 500,
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: scaleMode === '10mins' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Per 10 Mins
              </button>
              <button
                type="button"
                onClick={() => setScaleMode('hours')}
                style={{
                  border: 'none',
                  background: scaleMode === 'hours' ? '#ffffff' : 'transparent',
                  color: scaleMode === 'hours' ? '#0f172a' : '#64748b',
                  fontSize: '0.78rem',
                  fontWeight: scaleMode === 'hours' ? 700 : 500,
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  boxShadow: scaleMode === 'hours' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Per Hours
              </button>
            </div>

            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2e7d32', background: 'rgba(46, 125, 50, 0.1)', padding: '0.3rem 0.8rem', borderRadius: '999px' }}>
              {weekHoursFormatted}h Total
            </div>
          </div>
        </div>

        {/* Dynamic Chart Container */}
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

        {baseStats.recentSessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            No focus sessions logged yet. Complete a Pomodoro session in the timer to see activity here!
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

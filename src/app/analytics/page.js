"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { reconcileCloudTelemetry } from '@/lib/telemetrySync';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Auto-sync existing client-side sessions to PostgreSQL database when authenticated
  useEffect(() => {
    if (status === 'authenticated') {
      try {
        const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
        const unSynced = history.filter(s => !s.synced);
        if (unSynced.length > 0) {
          fetch('/api/study-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch: unSynced })
          })
            .then(res => res.json())
            .then(data => {
              if (data?.success) {
                const marked = history.map(s => ({ ...s, synced: true }));
                localStorage.setItem('ifocus_session_history', JSON.stringify(marked));
              }
            })
            .catch(() => { });
        }
      } catch (e) { }

      // Bi-Directional Cloud Telemetry & Events Reconciliation
      reconcileCloudTelemetry()
        .then(() => setForceUpdate(prev => prev + 1))
        .catch(() => {});

      // Hydrate study session history from PostgreSQL database for cross-device parity
      fetch('/api/study-sessions')
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.sessions && Array.isArray(data.sessions)) {
            try {
              const localHistory = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
              const existingDates = new Set(localHistory.map(s => s.id || s.date));
              let added = false;
              data.sessions.forEach(remote => {
                const remoteKey = remote.id || remote.createdAt;
                if (!existingDates.has(remoteKey)) {
                  localHistory.push({
                    id: remote.id,
                    date: remote.createdAt,
                    duration: remote.duration,
                    score: remote.score,
                    deckTitle: remote.deck?.title || 'General Focus',
                    synced: true
                  });
                  added = true;
                }
              });
              if (added || localHistory.length === 0) {
                localHistory.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                localStorage.setItem('ifocus_session_history', JSON.stringify(localHistory));
                setForceUpdate(prev => prev + 1);
              }
            } catch (err) {}
          }
        })
        .catch(() => {});
    }
  }, [status]);

  // Historical Session Data from LocalStorage (Lightweight, 100% Client-side, Zero Backend Bandwidth)
  const [baseStats, setBaseStats] = useState({
    todayMinutes: 0,
    weekMinutes: [0, 0, 0, 0, 0, 0, 0],
    completedSessionsCount: 0,
    streak: 0,
    todayIndex: 0,
    recentSessions: []
  });

  const [totalFlashcards, setTotalFlashcards] = useState(0);
  const [masteredCount, setMasteredCount] = useState(0);
  const [scaleMode, setScaleMode] = useState('10mins'); // '10mins' or 'hours'

  const userName = session?.user?.name || session?.user?.username || 'anonymous';

  const [complianceData, setComplianceData] = useState({
    gateCompliance: {
      label: '100% On-Track',
      color: '#16a34a',
      bg: 'rgba(22, 163, 74, 0.12)',
      subtext: 'Break challenges met on schedule'
    },
    focusRestRatio: {
      label: '5:1 (Optimal)',
      color: '#27522d',
      bg: 'rgba(39, 82, 45, 0.12)',
      subtext: 'Active micro-rest pacing'
    },
    cognitiveFatigue: {
      label: 'Low (Resilient)',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.12)',
      subtext: 'Keystroke cadence & stability optimal'
    }
  });

  const loadComplianceData = useCallback(() => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      let recoveryCompletedTime = 0;
      try {
        const rc = localStorage.getItem('ifocus_recovery_completed');
        if (rc) recoveryCompletedTime = Number(rc) || 0;
      } catch (e) {}

      let cognitiveResetTime = 0;
      try {
        const cr = localStorage.getItem('ifocus_cognitive_reset');
        if (cr) cognitiveResetTime = Number(cr) || 0;
      } catch (e) {}

      const effectiveResetTime = Math.max(recoveryCompletedTime, cognitiveResetTime);

      // 1. BreakGate Compliance (Events: completed vs skipped - Daily Reset Aware)
      let gateComp = {
        label: '100% On-Track',
        color: '#16a34a',
        bg: 'rgba(22, 163, 74, 0.12)',
        subtext: recoveryCompletedTime >= todayStart
          ? 'Recovery break completed: cognitive baseline restored'
          : 'Fresh study day: ready for your first focus session'
      };

      const rawEvents = localStorage.getItem('ifocus_breakgate_events');
      if (rawEvents) {
        try {
          const events = JSON.parse(rawEvents);
          if (Array.isArray(events) && events.length > 0) {
            // Daily reset: strictly isolate events logged today (starting from 12:00 AM)
            const todayEvents = events.filter(e => {
              const t = e.timestamp ? new Date(e.timestamp).getTime() : (e.date ? new Date(e.date).getTime() : (e.time || 0));
              return t >= todayStart;
            });

            // If recovery was completed today, any skipped BreakGate events that occurred BEFORE recovery completed have been reconciled!
            const unrecoveredEvents = recoveryCompletedTime >= todayStart
              ? todayEvents.filter(e => {
                  const t = e.timestamp ? new Date(e.timestamp).getTime() : (e.date ? new Date(e.date).getTime() : (e.time || 0));
                  return t > recoveryCompletedTime;
                })
              : todayEvents;

            if (unrecoveredEvents.length > 0) {
              const total = unrecoveredEvents.length;
              const completed = unrecoveredEvents.filter(e => e.status === 'completed').length;
              const skips = total - completed;
              const pct = Math.max(0, Math.min(100, 100 - (skips * 20) + (completed * 5)));
              const latest = unrecoveredEvents[unrecoveredEvents.length - 1];

              if (skips >= 3 || pct < 60) {
                gateComp = {
                  label: `${pct}% Low Compliance`,
                  color: '#dc2626',
                  bg: 'rgba(220, 38, 38, 0.12)',
                  subtext: `${skips} challenges skipped (${completed} of ${total} completed)`
                };
              } else if (skips > 0 || pct < 80) {
                gateComp = {
                  label: `${pct}% Pacing Lag`,
                  color: '#d97706',
                  bg: 'rgba(217, 119, 6, 0.12)',
                  subtext: `${skips} challenge skipped (${completed} of ${total} completed)`
                };
              } else {
                gateComp = {
                  label: `${pct}% On-Track`,
                  color: '#16a34a',
                  bg: 'rgba(22, 163, 74, 0.12)',
                  subtext: `${completed} of ${total} challenges completed today`
                };
              }
            } else if (recoveryCompletedTime >= todayStart) {
              gateComp = {
                label: '100% On-Track',
                color: '#16a34a',
                bg: 'rgba(22, 163, 74, 0.12)',
                subtext: 'Recovery break completed: cognitive baseline restored'
              };
            }
          }
        } catch (e) {}
      }

      // 2. Focus-to-Rest Ratio
      let ratioData = {
        label: '5:1 (Optimal)',
        color: '#27522d',
        bg: 'rgba(39, 82, 45, 0.12)',
        subtext: 'Active micro-rest pacing (25m / 5m)'
      };

      try {
        const customTimerRaw = localStorage.getItem('ifocus_custom_timer');
        const timerStateRaw = localStorage.getItem('ifocus_timer_state');
        let workMin = null;
        let breakMin = null;

        if (customTimerRaw) {
          const parsed = JSON.parse(customTimerRaw);
          if (parsed.customWorkDuration) workMin = Math.round(parsed.customWorkDuration / 60);
          else if (parsed.customWorkTime?.min) workMin = Number(parsed.customWorkTime.min);
          else if (parsed.workDuration) workMin = Number(parsed.workDuration);

          if (parsed.customBreakDuration) breakMin = Math.round(parsed.customBreakDuration / 60);
          else if (parsed.customBreakTime?.min) breakMin = Number(parsed.customBreakTime.min);
          else if (parsed.breakDuration) breakMin = Number(parsed.breakDuration);
        }

        if (timerStateRaw) {
          const tState = JSON.parse(timerStateRaw);
          if (tState.timerPreset && tState.timerPreset.includes('/')) {
            const parts = tState.timerPreset.split('/');
            workMin = parseInt(parts[0]);
            breakMin = parseInt(parts[1]);
          }
        }

        if (workMin && breakMin && breakMin > 0) {
          const ratio = Math.round(workMin / breakMin);
          const ratioLabel = ratio >= 6 ? 'Extended' : ratio <= 4 ? 'Gentle' : 'Optimal';
          ratioData = {
            label: `${ratio}:1 (${ratioLabel})`,
            color: '#27522d',
            bg: 'rgba(39, 82, 45, 0.12)',
            subtext: `${workMin}m focus to ${breakMin}m rest cadence`
          };
        }
      } catch (e) { }

      // 3. Cognitive Fatigue Status
      let fatigueData = {
        label: 'Low (Resilient)',
        color: '#059669',
        bg: 'rgba(5, 150, 105, 0.12)',
        subtext: recoveryCompletedTime >= todayStart
          ? 'Restorative break completed: cognitive baseline restored'
          : 'Fresh study day: cognitive baseline optimal'
      };

      let latestTelem = null;
      try {
        const telemRaw = localStorage.getItem('ifocus_latest_telemetry');
        if (telemRaw) latestTelem = JSON.parse(telemRaw);
      } catch (e) { }

      if (!latestTelem) {
        try {
          const insightRaw = localStorage.getItem(`ifocus_telemetry_insight_${userName}`);
          if (insightRaw) latestTelem = JSON.parse(insightRaw);
        } catch (e) { }
      }

      if (!latestTelem) {
        try {
          const journalRaw = localStorage.getItem(`ifocus_journal_history_${userName}`);
          if (journalRaw) {
            const list = JSON.parse(journalRaw);
            if (Array.isArray(list) && list.length > 0) {
              const lastEntry = list[0];
              latestTelem = {
                state: lastEntry.state,
                reason: lastEntry.text,
                timestamp: lastEntry.date || lastEntry.timestamp || lastEntry.createdAt
              };
            }
          }
        } catch (e) { }
      }

      // Daily Reset & Recovery Aware: If telemetry/reflection is from yesterday or resolved by recovery/reset, clear it
      if (latestTelem) {
        const telemTime = latestTelem.timestamp ? new Date(latestTelem.timestamp).getTime() : (latestTelem.date ? new Date(latestTelem.date).getTime() : null);
        if (telemTime && (telemTime < todayStart || (effectiveResetTime > 0 && telemTime <= effectiveResetTime))) {
          latestTelem = null;
        }
      }

      if (latestTelem) {
        const stateStr = String(latestTelem.state || '').toLowerCase();
        const sentimentStr = String(latestTelem.sentiment || '').toLowerCase();
        const reasonStr = String(latestTelem.reason || '').toLowerCase();
        const errorRate = Number(latestTelem.errorRate) || 0;
        const backspaces = Number(latestTelem.backspaces) || 0;

        const isStress = stateStr.includes('stress') || sentimentStr.includes('stress') || reasonStr.includes('stress') || stateStr === 'friction' || backspaces >= 8 || errorRate > 35;
        const isDistracted = stateStr.includes('distract') || sentimentStr.includes('distract') || reasonStr.includes('distract') || errorRate > 20 || backspaces >= 4;
        const isFatigued = stateStr.includes('fatigue') || sentimentStr.includes('fatigue') || stateStr === 'hesitant';

        if (isStress) {
          fatigueData = {
            label: 'High (Tension / Stress)',
            color: '#dc2626',
            bg: 'rgba(220, 38, 38, 0.12)',
            subtext: backspaces > 0 ? `Keystroke friction & tension logged (${backspaces} corrections)` : 'Stress & tension sentiment logged'
          };
        } else if (isDistracted) {
          fatigueData = {
            label: 'Elevated (Friction / Pacing)',
            color: '#d97706',
            bg: 'rgba(217, 119, 6, 0.12)',
            subtext: errorRate > 0 ? `Elevated typing friction detected (${errorRate}% correction rate)` : 'Distracted focus pattern logged'
          };
        } else if (isFatigued) {
          fatigueData = {
            label: 'Moderate (Fatigued)',
            color: '#d97706',
            bg: 'rgba(217, 119, 6, 0.12)',
            subtext: 'Mental fatigue & hesitation logged'
          };
        }
      }

      setComplianceData({
        gateCompliance: gateComp,
        focusRestRatio: ratioData,
        cognitiveFatigue: fatigueData
      });
    } catch (e) {
      console.error('Error loading compliance data:', e);
    }
  }, [userName]);

  const computeStreakFromHistory = (history) => {
    if (!history || history.length === 0) return 0;
    const dates = new Set(
      history.map(s => {
        const d = new Date(s.date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      })
    );
    let streak = 0;
    let checkDate = new Date();
    
    // If no sessions today, check starting from yesterday
    const todayKey = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    if (!dates.has(todayKey)) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    
    while (true) {
      const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (dates.has(key)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return Math.max(1, streak);
  };

  const loadStats = useCallback(() => {
    try {
      const stored = localStorage.getItem('ifocus_session_history');
      const sessionHistory = stored ? JSON.parse(stored) : [];

      const focusStatsRaw = localStorage.getItem('ifocus_stats');
      const focusStats = focusStatsRaw ? JSON.parse(focusStatsRaw) : {};

      const now = new Date();
      const todayStr = now.toDateString();

      // Today index: Monday = 0, Sunday = 6
      const currentDay = now.getDay();
      const adjustedTodayIdx = currentDay === 0 ? 6 : currentDay - 1;

      // Start of current week (Monday at 00:00:00)
      const diffToMon = currentDay === 0 ? -6 : 1 - currentDay;
      const mondayDate = new Date(now);
      mondayDate.setDate(now.getDate() + diffToMon);
      mondayDate.setHours(0, 0, 0, 0);

      let todayMins = 0;
      const weekMins = [0, 0, 0, 0, 0, 0, 0];
      let validSessionsCount = 0;

      sessionHistory.forEach(s => {
        const sDate = new Date(s.date);
        const rawDur = Number(s.duration) || 0;
        const mins = rawDur > 180 ? Math.max(1, Math.round(rawDur / 60)) : rawDur;

        if (sDate.toDateString() === todayStr) {
          todayMins += mins;
        }

        if (sDate >= mondayDate) {
          const d = sDate.getDay();
          const idx = d === 0 ? 6 : d - 1;
          if (idx >= 0 && idx < 7) {
            weekMins[idx] += mins;
          }
          validSessionsCount++;
        }
      });

      const recent = [...sessionHistory].reverse().slice(0, 4);
      const computedStreak = computeStreakFromHistory(sessionHistory);

      setBaseStats({
        todayMinutes: todayMins,
        weekMinutes: weekMins,
        completedSessionsCount: validSessionsCount,
        streak: computedStreak || focusStats.streak || (validSessionsCount > 0 ? 1 : 0),
        todayIndex: adjustedTodayIdx,
        recentSessions: recent
      });
    } catch (e) {
      console.error('Failed to parse focus stats:', e);
    }
  }, []);

  // Sync cloud study sessions from PostgreSQL database and hydrate accurately
  useEffect(() => {
    if (status !== 'authenticated') return;

    let isMounted = true;

    fetch('/api/study-sessions')
      .then(res => res.json())
      .then(data => {
        if (!isMounted || !Array.isArray(data?.sessions)) return;

        // Convert DB duration (stored in SECONDS) directly to minutes (e.g. 60s -> 1m, 600s -> 10m)
        const dbList = data.sessions.map(s => {
          const rawSec = Number(s.duration) || 0;
          const mins = Math.max(1, Math.round(rawSec / 60));
          return {
            id: s.id,
            duration: mins,
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
          window.dispatchEvent(new CustomEvent('ifocus_stats_updated'));
          loadStats();
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [status, loadStats]);

  useEffect(() => {
    loadStats();
    loadComplianceData();

    // Fetch Decks & Retention Mastery Rate
    const loadDeckMastery = () => {
      let storedMastered = [];
      try {
        storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
      } catch (e) { }

      fetch('/api/decks')
        .then(res => res.json())
        .then(decks => {
          if (Array.isArray(decks)) {
            let cardTotal = 0;
            let masteredTotal = 0;
            decks.forEach(d => {
              const cards = d.cards || [];
              cardTotal += cards.length;
              cards.forEach(c => {
                const isMastered = Boolean(
                  c.mastered ||
                  (c.front && storedMastered.includes(c.front)) ||
                  (c.id && storedMastered.includes(c.id))
                );
                if (isMastered) masteredTotal++;
              });
            });
            setTotalFlashcards(cardTotal);
            setMasteredCount(masteredTotal);
          }
        })
        .catch(() => { });
    };

    loadDeckMastery();

    const handleSync = (e) => {
      if (!e?.detail?.isRunning) {
        loadStats();
      }
    };

    window.addEventListener('ifocus_timer_sync', handleSync);
    window.addEventListener('ifocus_stats_updated', loadStats);
    window.addEventListener('ifocus_breakgate_updated', loadComplianceData);
    window.addEventListener('ifocus_telemetry_updated', loadComplianceData);
    window.addEventListener('ifocus_mastery_updated', loadDeckMastery);
    window.addEventListener('storage', loadDeckMastery);
    const gentleRefresh = setInterval(() => {
      loadStats();
      loadComplianceData();
      loadDeckMastery();
    }, 10 * 60 * 1000);

    return () => {
      window.removeEventListener('ifocus_timer_sync', handleSync);
      window.removeEventListener('ifocus_stats_updated', loadStats);
      window.removeEventListener('ifocus_breakgate_updated', loadComplianceData);
      window.removeEventListener('ifocus_telemetry_updated', loadComplianceData);
      window.removeEventListener('ifocus_mastery_updated', loadDeckMastery);
      window.removeEventListener('storage', loadDeckMastery);
      clearInterval(gentleRefresh);
    };
  }, [loadStats, loadComplianceData]);

  // Total Week Hours formatted
  const totalWeekMinutes = baseStats.weekMinutes.reduce((a, b) => a + b, 0);
  const weekHoursFormatted = (totalWeekMinutes / 60).toFixed(1);

  // Today Focus Display
  const todayFocusFormatted = baseStats.todayMinutes < 60
    ? `${baseStats.todayMinutes}m`
    : `${(baseStats.todayMinutes / 60).toFixed(1)}h`;

  // Dynamic Chart Data with 10-Minute Resolution Option
  const focusChartData = useMemo(() => {
    const isHours = scaleMode === 'hours';
    const values = baseStats.weekMinutes.map(mins => {
      return isHours ? Number((mins / 60).toFixed(2)) : mins;
    });

    const backgroundColors = values.map((_, i) =>
      i === baseStats.todayIndex
        ? 'rgba(46, 125, 50, 0.92)'
        : 'rgba(95, 143, 94, 0.38)'
    );

    const borderColors = values.map((_, i) =>
      i === baseStats.todayIndex
        ? 'rgba(46, 125, 50, 1)'
        : 'rgba(95, 143, 94, 0.75)'
    );

    return {
      labels: days,
      datasets: [
        {
          label: isHours ? 'Focus Hours' : 'Focus (Minutes)',
          data: values,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          maxBarThickness: 38,
        },
      ],
    };
  }, [baseStats.weekMinutes, baseStats.todayIndex, scaleMode]);

  const focusChartOptions = useMemo(() => {
    const isHours = scaleMode === 'hours';
    const maxVal = Math.max(...baseStats.weekMinutes);
    let stepSize = 10;
    let suggestedMax = 30;

    if (isHours) {
      stepSize = 1;
      suggestedMax = Math.max(3, Math.ceil(maxVal / 60) + 1);
    } else {
      if (maxVal > 90) stepSize = 30;
      else if (maxVal > 40) stepSize = 20;
      suggestedMax = Math.max(30, Math.ceil(maxVal / 10) * 10 + 10);
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          padding: 10,
          titleFont: { size: 12, weight: '700' },
          bodyFont: { size: 12 },
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              if (isHours) {
                return ` ${val} hrs (${Math.round(val * 60)} mins)`;
              }
              const hrs = Math.floor(val / 60);
              const m = val % 60;
              return hrs > 0 ? ` ${hrs}h ${m}m (${val} mins)` : ` ${val} mins`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { weight: '700', size: 11.5 }, color: '#334155' },
        },
        y: {
          beginAtZero: true,
          suggestedMax: suggestedMax,
          grid: { color: 'rgba(226, 232, 240, 0.7)' },
          ticks: {
            stepSize: stepSize,
            callback: (v) => `${v}${isHours ? 'h' : 'm'}`,
            font: { size: 10.5, weight: '600' },
            color: '#64748b',
          },
        },
      },
    };
  }, [baseStats.weekMinutes, scaleMode]);

  const formatSessionTime = (dateStr) => {
    try {
      const d = new Date(dateStr);
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

  const masteryPercent = totalFlashcards > 0 ? Math.round((masteredCount / totalFlashcards) * 100) : 0;

  return (
    <div className="analytics-page-root">
      <style>{`
        .analytics-page-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100%;
          width: 100%;
          max-width: 1440px;
          margin: 0 auto;
          gap: 0.65rem;
          overflow: hidden;
          box-sizing: border-box;
          animation: flashcardFadeIn 0.25s ease;
        }
        .analytics-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
          flex-shrink: 0;
        }
        .analytics-grid-2x2 {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          grid-template-rows: 1.25fr 1fr;
          gap: 0.65rem;
        }
        @media (max-width: 960px) {
          .analytics-page-root {
            height: auto !important;
            max-height: none !important;
            overflow-y: visible !important;
            padding-bottom: 5.5rem;
            gap: 1rem;
          }
          .analytics-stat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .analytics-grid-2x2 {
            display: flex !important;
            flex-direction: column !important;
            flex: none !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <div style={{ flexShrink: 0, marginBottom: '0.05rem' }}>
        <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          Study Analytics
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0.15rem 0 0 0', fontSize: '0.82rem' }}>
          Your real-time Pomodoro focus metrics, BreakGate compliance, and retention health.
        </p>
      </div>

      {/* Offline Notice (Unauthenticated) */}
      {status === 'unauthenticated' && (
        <div style={{
          padding: '6px 12px',
          background: 'rgba(217, 119, 6, 0.08)',
          border: '1px solid rgba(217, 119, 6, 0.25)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span style={{ fontSize: '0.74rem', color: '#92400e', fontWeight: 600 }}>
              Offline Local Mode: Metrics stored locally. Sign in to sync across devices.
            </span>
          </div>
          <Link
            href="/login"
            style={{
              padding: '3px 10px',
              background: 'var(--primary-accent)',
              color: '#ffffff',
              borderRadius: '6px',
              fontWeight: 600,
              fontSize: '0.74rem',
              textDecoration: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            Sign In
          </Link>
        </div>
      )}

      {/* 4 Core Stat Cards with Large Punchy Numbers & Icons */}
      <div className="analytics-stat-grid">

        {/* 1. Today's Focus */}
        <div style={{
          background: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
              Today's Focus
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#27522d', lineHeight: 1.1 }}>
              {todayFocusFormatted}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Total completed today
            </div>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(39, 82, 45, 0.08)',
            color: '#27522d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
        </div>

        {/* 2. This Week */}
        <div style={{
          background: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
              This Week
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: 'var(--primary-accent)', lineHeight: 1.1 }}>
              {weekHoursFormatted}<span style={{ fontSize: '1.1rem', fontWeight: 600, marginLeft: '2px' }}>h</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Across {baseStats.completedSessionsCount} sessions
            </div>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(95, 143, 94, 0.12)',
            color: 'var(--primary-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10" />
              <path d="M12 20V4" />
              <path d="M6 20v-6" />
            </svg>
          </div>
        </div>

        {/* 3. Study Streak */}
        <div style={{
          background: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
              Study Streak
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#4338ca', lineHeight: 1.1 }}>
              {baseStats.streak} <span style={{ fontSize: '1rem', fontWeight: 600 }}>{baseStats.streak === 1 ? 'Day' : 'Days'}</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              Consecutive active study
            </div>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(67, 56, 202, 0.1)',
            color: '#4338ca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          </div>
        </div>

        {/* 4. Mastered Concepts */}
        <div style={{
          background: '#ffffff',
          padding: '0.75rem 1rem',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
              Mastered Concepts
            </div>
            <div style={{ fontSize: '1.9rem', fontWeight: 800, color: '#059669', lineHeight: 1.1 }}>
              {masteredCount} <span style={{ fontSize: '1rem', fontWeight: 600 }}>Cards</span>
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
              {totalFlashcards > 0 ? `${masteryPercent}% of ${totalFlashcards} total cards` : 'Memorized concepts'}
            </div>
          </div>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'rgba(5, 150, 105, 0.1)',
            color: '#059669',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
        </div>

      </div>

      {/* Main 2x2 Dashboard Grid */}
      <div className="analytics-grid-2x2">

        {/* Row 1, Col 1: Weekly Focus Bar Chart */}
        <div style={{
          padding: '0.9rem 1.15rem',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', paddingBottom: '0.45rem', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', flexShrink: 0 }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                Weekly Focus Activity
              </h3>
              <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0 0' }}>
                {scaleMode === '10mins'
                  ? 'Measured in 10-minute intervals (Green indicates today).'
                  : 'Measured in total hours (Green indicates today).'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', border: '1px solid rgba(0,0,0,0.06)' }}>
                <button
                  type="button"
                  onClick={() => setScaleMode('10mins')}
                  style={{
                    border: 'none',
                    background: scaleMode === '10mins' ? '#ffffff' : 'transparent',
                    color: scaleMode === '10mins' ? '#0f172a' : '#64748b',
                    fontSize: '0.74rem',
                    fontWeight: scaleMode === '10mins' ? 700 : 500,
                    padding: '0.25rem 0.65rem',
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
                    fontSize: '0.74rem',
                    fontWeight: scaleMode === 'hours' ? 700 : 500,
                    padding: '0.25rem 0.65rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    boxShadow: scaleMode === 'hours' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Per Hours
                </button>
              </div>

              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#27522d', background: 'rgba(95, 143, 94, 0.12)', padding: '0.25rem 0.7rem', borderRadius: '999px' }}>
                {weekHoursFormatted}h Total
              </div>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0, position: 'relative', width: '100%', height: '100%', paddingTop: '0.35rem' }}>
            <Bar data={focusChartData} options={focusChartOptions} />
          </div>
        </div>

        {/* Row 1, Col 2: BreakGate Compliance */}
        <div style={{
          padding: '0.9rem 1.15rem',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0
        }}>
          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.45rem', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              BreakGate Compliance
            </h3>
            <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
              Cognitive pacing and recovery telemetry.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', flex: 1, justifyContent: 'center', padding: '0.35rem 0' }}>

            {/* Tile 1 */}
            <div style={{
              padding: '0.65rem 0.95rem',
              background: '#f8faf8',
              borderRadius: '12px',
              border: '1px solid rgba(95, 143, 94, 0.14)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${complianceData.gateCompliance.bg}`, color: complianceData.gateCompliance.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1f2937' }}>Gate Compliance</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{complianceData.gateCompliance.subtext}</div>
                </div>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: complianceData.gateCompliance.color, background: complianceData.gateCompliance.bg, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                {complianceData.gateCompliance.label}
              </span>
            </div>

            {/* Tile 2 */}
            <div style={{
              padding: '0.65rem 0.95rem',
              background: '#f8faf8',
              borderRadius: '12px',
              border: '1px solid rgba(95, 143, 94, 0.14)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${complianceData.focusRestRatio.bg}`, color: complianceData.focusRestRatio.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1f2937' }}>Focus-to-Rest Ratio</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{complianceData.focusRestRatio.subtext}</div>
                </div>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: complianceData.focusRestRatio.color, background: complianceData.focusRestRatio.bg, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                {complianceData.focusRestRatio.label}
              </span>
            </div>

            {/* Tile 3 */}
            <div style={{
              padding: '0.65rem 0.95rem',
              background: '#f8faf8',
              borderRadius: '12px',
              border: '1px solid rgba(95, 143, 94, 0.14)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `${complianceData.cognitiveFatigue.bg}`, color: complianceData.cognitiveFatigue.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1f2937' }}>Cognitive Fatigue Status</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{complianceData.cognitiveFatigue.subtext}</div>
                </div>
              </div>
              <span style={{ fontSize: '0.82rem', fontWeight: 800, color: complianceData.cognitiveFatigue.color, background: complianceData.cognitiveFatigue.bg, padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                {complianceData.cognitiveFatigue.label}
              </span>
            </div>

          </div>
        </div>

        {/* Row 2, Col 1: Recent Study Sessions */}
        <div style={{
          padding: '0.9rem 1.15rem',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0, 0, 0, 0.05)', paddingBottom: '0.4rem', marginBottom: '0.45rem', flexShrink: 0 }}>
            <div>
              <h3 style={{ fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                Recent Study Sessions
              </h3>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0 0' }}>
                Your logged Pomodoro focus sessions.
              </p>
            </div>

            <Link href="/dashboard" style={{ fontSize: '0.78rem', color: 'var(--primary-accent)', fontWeight: 700, textDecoration: 'none' }}>
              Open Timer →
            </Link>
          </div>

          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem', justifyContent: 'flex-start' }}>
            {baseStats.recentSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                No focus sessions logged yet. Complete a Pomodoro session in the timer to see activity here!
              </div>
            ) : (
              <>
                {baseStats.recentSessions.slice(0, 2).map((session, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.55rem 0.85rem',
                      background: '#fbfdfa',
                      borderRadius: '10px',
                      border: '1px solid rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: session.type === 'breakgate' ? 'rgba(46, 125, 50, 0.12)' : 'rgba(95, 143, 94, 0.12)',
                        color: session.type === 'breakgate' ? '#2e7d32' : 'var(--primary-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {session.type === 'breakgate' ? (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                        ) : (
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {session.duration} min {session.type === 'breakgate' ? 'BreakGate Micro-Challenge' : 'Pomodoro Focus Session'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                          {formatSessionTime(session.date)}
                        </div>
                      </div>
                    </div>

                    <span style={{
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      color: '#2e7d32',
                      background: 'rgba(46, 125, 50, 0.1)',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      letterSpacing: '0.03em',
                      textTransform: 'uppercase'
                    }}>
                      Completed
                    </span>
                  </div>
                ))}

                {/* Helpful Goal Tile when only 1 session is logged, to keep card filled & purposeful */}
                {baseStats.recentSessions.length === 1 && (
                  <div style={{
                    padding: '0.5rem 0.85rem',
                    background: 'rgba(95, 143, 94, 0.05)',
                    borderRadius: '10px',
                    border: '1px dashed rgba(95, 143, 94, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "rgba(95, 143, 94, 0.15)", color: "#27522d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <circle cx="12" cy="12" r="6" />
                          <circle cx="12" cy="12" r="2" />
                        </svg>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          Ready for your next round?
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                          Start another focus block to level up today's streak.
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/dashboard"
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#27522d',
                        textDecoration: 'none',
                        background: '#ffffff',
                        padding: '0.25rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid rgba(0,0,0,0.08)',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Start Timer →
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Row 2, Col 2: Active Recall Retention */}
        <div style={{
          padding: '0.9rem 1.15rem',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0
        }}>
          <div>
            <div style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', paddingBottom: '0.4rem', marginBottom: '0.45rem', flexShrink: 0 }}>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
                Active Recall Retention
              </h3>
              <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                Mastery distribution across study decks.
              </p>
            </div>

            {/* Mastered Progress Bar */}
            <div style={{ marginTop: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#374151' }}>Mastered Concepts</span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#059669' }}>{masteryPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                <div style={{ width: `${masteryPercent}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Mini Stats Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', marginTop: '0.55rem' }}>
              <div style={{ background: '#f8faf8', padding: '0.45rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(95, 143, 94, 0.12)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Total Cards</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1px' }}>{totalFlashcards}</div>
              </div>
              <div style={{ background: '#f8faf8', padding: '0.45rem 0.75rem', borderRadius: '10px', border: '1px solid rgba(95, 143, 94, 0.12)' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase' }}>Mastered</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#059669', marginTop: '1px' }}>{masteredCount}</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', marginTop: '0.45rem' }}>
            <Link
              href="/flashcards"
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                padding: '0.55rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: '#27522d',
                color: '#ffffff',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(39, 82, 45, 0.22)',
                transition: 'all 0.15s ease'
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Practice Flashcards
            </Link>
          </div>
        </div>

      </div>

    </div>
  );
}

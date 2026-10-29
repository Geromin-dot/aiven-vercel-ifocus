"use client";

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import HelpButton from '@/components/HelpButton';

export default function CoachPage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name || session?.user?.username || 'anonymous';
  const router = useRouter();

  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  // Reflection Journal State (Loaded from Quick Reflection history)
  const [journalEntries, setJournalEntries] = useState([]);
  const [expandedJournalId, setExpandedJournalId] = useState(null);

  const getEntryAiReply = (entry) => {
    if (entry?.aiReply) return entry.aiReply;
    const s = String(entry?.state || entry?.sentiment || 'Engaged');
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

  const [applyingHome, setApplyingHome] = useState(false);

  const applyCoachAiRhythm = (reply) => {
    let wMin = 25, bMin = 5;
    if (reply?.rhythm?.includes('15m')) { wMin = 15; bMin = 5; }
    else if (reply?.rhythm?.includes('20m')) { wMin = 20; bMin = 5; }
    else if (reply?.rhythm?.includes('50m')) { wMin = 50; bMin = 10; }
    else if (reply?.rhythm?.includes('60m')) { wMin = 60; bMin = 10; }

    const targetSess = Math.min(5, Math.max(1, reply?.sessions || (reply?.state === 'Stressed' ? 2 : 4)));
    const stateName = reply?.state || (wMin === 15 ? 'Stressed' : wMin === 20 ? 'Distracted' : wMin >= 50 ? 'Motivated' : 'Engaged');
    const title = reply?.title || (wMin === 15 ? 'Gentle Focus (Stressed)' : wMin === 20 ? 'Strict Pomodoro (Distracted)' : wMin >= 50 ? 'Flow State (Motivated)' : 'Balanced Cadence (Engaged)');

    try {
      localStorage.setItem('ifocus_custom_timer', JSON.stringify({
        customWorkTime: { min: wMin, sec: 0 },
        customBreakTime: { min: bMin, sec: 0 },
        customSessions: targetSess,
        customWorkDuration: wMin * 60,
        customBreakDuration: bMin * 60
      }));

      localStorage.setItem('ifocus_ai_adjusted_active', 'true');
      localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify({
        title,
        state: stateName,
        rhythm: reply?.rhythm || `${wMin}m Focus / ${bMin}m Rest`,
        sessions: targetSess,
        message: reply?.message || "AI Coach recommended cadence applied."
      }));

      const syncPayload = {
        isRunning: false,
        isFocus: true,
        timeLeft: wMin * 60,
        totalTime: wMin * 60,
        targetEndTime: null,
        timerPreset: 'Custom',
        customWorkDuration: wMin * 60,
        customBreakDuration: bMin * 60,
        customSessions: targetSess,
        sessionCount: 1,
        presencePaused: false,
        lastPresenceElapsed: 0,
        lastPresenceRemaining: wMin * 60,
        breakGatePending: false
      };
      localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));
    } catch (e) {
      console.error("Failed writing timer override:", e);
    }

    window.location.href = '/dashboard';
  };

  // Dynamic Live Diagnostics State
  const [telemetryDiagnostics, setTelemetryDiagnostics] = useState({
    cognitiveState: {
      title: 'In the Zone',
      status: 'Active',
      color: '#27522d',
      dotColor: '#16a34a',
      subtext: 'Silent observation: Attention levels optimal'
    },
    studyStamina: {
      title: '94% Resilience',
      color: '#2e7d32',
      subtext: 'BreakGate cycle compliance on track'
    },
    recommendedRhythm: {
      title: '25m Work / 5m Gate',
      color: '#059669',
      subtext: 'Prevents cognitive burnout during intense study sessions'
    }
  });

  const loadDiagnostics = useCallback(() => {
    try {
      // 1. Telemetry / Cognitive State
      let telem = null;
      try {
        const raw = localStorage.getItem('ifocus_latest_telemetry');
        if (raw) telem = JSON.parse(raw);
      } catch (e) {}

      if (!telem) {
        try {
          const insightRaw = localStorage.getItem(`ifocus_telemetry_insight_${userName}`);
          if (insightRaw) telem = JSON.parse(insightRaw);
        } catch (e) {}
      }

      if (!telem) {
        try {
          const journalRaw = localStorage.getItem(`ifocus_journal_history_${userName}`);
          if (journalRaw) {
            const list = JSON.parse(journalRaw);
            if (Array.isArray(list) && list.length > 0) telem = list[0];
          }
        } catch (e) {}
      }

      const stateStr = String(telem?.state || telem?.sentiment || '').toLowerCase();
      const reasonStr = String(telem?.reason || '').toLowerCase();
      const backspaces = Number(telem?.backspaces) || 0;
      const errorRate = Number(telem?.errorRate) || 0;

      const isStress = stateStr.includes('stress') || reasonStr.includes('stress') || stateStr === 'friction' || backspaces >= 6 || errorRate > 30;
      const isDistracted = stateStr.includes('distract') || reasonStr.includes('distract') || errorRate > 15;
      const isFatigued = stateStr.includes('fatigue') || reasonStr.includes('fatigue') || stateStr === 'hesitant';
      const isMotivated = stateStr.includes('motivat') || stateStr.includes('energetic') || stateStr.includes('ready');

      let cogState = {
        title: 'In the Zone',
        status: 'Optimal',
        color: '#27522d',
        dotColor: '#16a34a',
        subtext: 'Silent observation: Attention levels optimal'
      };

      let recRhythm = {
        title: '25m Work / 5m Gate',
        color: '#059669',
        subtext: 'Prevents cognitive burnout during intense study sessions'
      };

      if (isStress) {
        cogState = {
          title: 'High Tension / Stress',
          status: 'Tension',
          color: '#dc2626',
          dotColor: '#dc2626',
          subtext: backspaces > 0 ? `Keystroke friction & stress logged (${backspaces} corrections)` : 'Stress & tension sentiment logged'
        };
        recRhythm = {
          title: '15m Work / 5m Gate',
          color: '#d97706',
          subtext: 'Short 15m focus sprints to mitigate cognitive overload'
        };
      } else if (isDistracted) {
        cogState = {
          title: 'Distracted / Pacing Drift',
          status: 'Drift',
          color: '#d97706',
          dotColor: '#d97706',
          subtext: 'Attention fragmentation & corrections detected'
        };
        recRhythm = {
          title: '20m Work / 5m Gate',
          color: '#d97706',
          subtext: 'Structured intervals to eliminate task-switching'
        };
      } else if (isFatigued) {
        cogState = {
          title: 'Mental Fatigue',
          status: 'Fatigue',
          color: '#d97706',
          dotColor: '#d97706',
          subtext: 'Energy depletion & hesitation logged'
        };
        recRhythm = {
          title: '15m Work / 5m Gate',
          color: '#d97706',
          subtext: 'Lighter intervals with frequent restorative breaks'
        };
      } else if (isMotivated) {
        cogState = {
          title: 'High Energy / Driven',
          status: 'Peak',
          color: '#16a34a',
          dotColor: '#16a34a',
          subtext: 'Optimal readiness for high-demand tasks'
        };
        recRhythm = {
          title: '50m Work / 10m Gate',
          color: '#16a34a',
          subtext: 'Deep work block while mental stamina is peaked'
        };
      }

      // Check custom timer overrides if not currently in high stress
      if (!isStress) {
        try {
          const customTimerRaw = localStorage.getItem('ifocus_custom_timer');
          if (customTimerRaw) {
            const parsed = JSON.parse(customTimerRaw);
            const w = parsed.customWorkDuration ? Math.round(parsed.customWorkDuration / 60) : (Number(parsed.customWorkTime?.min) || null);
            const b = parsed.customBreakDuration ? Math.round(parsed.customBreakDuration / 60) : (Number(parsed.customBreakTime?.min) || null);
            if (w && b) {
              recRhythm = {
                title: `${w}m Work / ${b}m Gate`,
                color: '#059669',
                subtext: `Active custom schedule: ${w}m focus with ${b}m micro-rest`
              };
            }
          }
        } catch (e) {}
      }

      // 2. BreakGate / Study Stamina
      let stamina = {
        title: '94% Resilience',
        color: '#2e7d32',
        subtext: 'BreakGate cycle compliance on track'
      };

      const rawEvents = localStorage.getItem('ifocus_breakgate_events');
      if (rawEvents) {
        const events = JSON.parse(rawEvents);
        if (Array.isArray(events) && events.length > 0) {
          const completed = events.filter(e => e.status === 'completed').length;
          const total = events.length;
          const pct = Math.round((completed / total) * 100);
          const latest = events[events.length - 1];

          if (latest?.status === 'skipped' || pct < 60) {
            stamina = {
              title: `${pct}% Resilience`,
              color: '#dc2626',
              subtext: `Break challenges skipped (${completed} of ${total} met) - rest needed`
            };
          } else if (pct < 80) {
            stamina = {
              title: `${pct}% Resilience`,
              color: '#d97706',
              subtext: `Pacing lag detected (${completed} of ${total} challenges completed)`
            };
          } else {
            stamina = {
              title: `${pct}% Resilience`,
              color: '#16a34a',
              subtext: `High consistency: ${completed} of ${total} BreakGates completed`
            };
          }
        }
      } else if (isStress) {
        stamina = {
          title: '65% Resilience',
          color: '#d97706',
          subtext: 'Cognitive strain detected - lighter study block advised'
        };
      }

      setTelemetryDiagnostics({
        cognitiveState: cogState,
        studyStamina: stamina,
        recommendedRhythm: recRhythm
      });

    } catch (err) {
      console.error('Error loading coach diagnostics:', err);
    }
  }, [userName]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`ifocus_journal_history_${userName}`);
      if (stored) {
        setJournalEntries(JSON.parse(stored));
      }
    } catch (e) {}
  }, [userName]);

  useEffect(() => {
    if (status === 'loading') return;

    loadDiagnostics();

    // Load insight from localStorage using namespaced key
    const telemetryKey = `ifocus_telemetry_insight_${userName}`;
    const storedInsight = localStorage.getItem(telemetryKey);

    if (storedInsight) {
      try {
        const data = JSON.parse(storedInsight);
        setInsight(data);
      } catch (e) {
        console.error("Error parsing telemetry data", e);
      }
    } else {
      try {
        const telemRaw = localStorage.getItem('ifocus_latest_telemetry');
        if (telemRaw) {
          const t = JSON.parse(telemRaw);
          const s = String(t.state || t.sentiment || '').toLowerCase();
          if (s.includes('stress') || s.includes('distract') || t.errorRate > 25) {
            setInsight({
              reason: t.reason || "High correction rate & stress indicators logged in your recent study telemetry.",
              actionPlan: "1. Take a 5-minute hydration & stretch break away from your screen.\n2. We've adjusted your next focus interval to a gentle 15-minute block.\n3. Tackle one small bite-sized subtask to rebuild calm momentum."
            });
          }
        }
      } catch (e) {}
    }

    setLoading(false);

    const handleJournalUpdate = () => {
      try {
        const stored = localStorage.getItem(`ifocus_journal_history_${userName}`);
        if (stored) setJournalEntries(JSON.parse(stored));
      } catch (e) {}
    };

    window.addEventListener('ifocus_telemetry_updated', loadDiagnostics);
    window.addEventListener('ifocus_breakgate_updated', loadDiagnostics);
    window.addEventListener('ifocus_timer_sync', loadDiagnostics);
    window.addEventListener('storage', handleJournalUpdate);

    return () => {
      window.removeEventListener('ifocus_telemetry_updated', loadDiagnostics);
      window.removeEventListener('ifocus_breakgate_updated', loadDiagnostics);
      window.removeEventListener('ifocus_timer_sync', loadDiagnostics);
      window.removeEventListener('storage', handleJournalUpdate);
    };
  }, [status, userName, loadDiagnostics]);

  const handleReturnHome = () => {
    setApplyingHome(true);

    try {
      // 1. Determine recommended work, break, and sessions from diagnostics & alert text
      let wMin = 25;
      let bMin = 5;
      let targetSessions = 4;
      let cadenceTitle = "Balanced Cadence (Engaged)";
      let detectedState = "Engaged";

      const rhythmTitle = String(telemetryDiagnostics?.recommendedRhythm?.title || '');
      const cogTitle = String(telemetryDiagnostics?.cognitiveState?.title || '');
      const alertBody = `${insight?.actionPlan || ''} ${insight?.reason || ''}`.toLowerCase();
      const combined = `${rhythmTitle} ${cogTitle} ${alertBody}`.toLowerCase();

      if (combined.includes('15m') || combined.includes('15 minute') || combined.includes('15-minute') || combined.includes('stress') || combined.includes('tension') || combined.includes('fatigue')) {
        wMin = 15;
        bMin = 5;
        targetSessions = 2;
        cadenceTitle = "Gentle Focus (Stressed)";
        detectedState = "Stressed";
      } else if (combined.includes('20m') || combined.includes('20 minute') || combined.includes('20-minute') || combined.includes('distract') || combined.includes('drift')) {
        wMin = 20;
        bMin = 5;
        targetSessions = 3;
        cadenceTitle = "Strict Pomodoro (Distracted)";
        detectedState = "Distracted";
      } else if (combined.includes('50m') || combined.includes('50 minute') || combined.includes('50-minute') || combined.includes('peak') || combined.includes('motivated')) {
        wMin = 50;
        bMin = 10;
        targetSessions = 4;
        cadenceTitle = "Flow State (Motivated)";
        detectedState = "Motivated";
      } else {
        const match = rhythmTitle.match(/(\d+)m Work \/ (\d+)m Gate/i);
        if (match) {
          wMin = parseInt(match[1], 10) || 25;
          bMin = parseInt(match[2], 10) || 5;
        }
      }

      // 2. Persist custom timer schedule so it actually applies to the dashboard
      const customTimer = {
        customWorkTime: { min: wMin, sec: 0 },
        customBreakTime: { min: bMin, sec: 0 },
        customSessions: targetSessions,
        customWorkDuration: wMin * 60,
        customBreakDuration: bMin * 60
      };
      localStorage.setItem('ifocus_custom_timer', JSON.stringify(customTimer));

      const aiDetails = {
        title: cadenceTitle,
        state: detectedState,
        rhythm: `${wMin}m Focus / ${bMin}m Rest`,
        sessions: targetSessions,
        message: insight?.actionPlan || telemetryDiagnostics?.recommendedRhythm?.subtext || "AI Coach recommended cadence applied."
      };
      localStorage.setItem('ifocus_ai_adjusted_active', 'true');
      localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify(aiDetails));

      const syncPayload = {
        isRunning: false,
        isFocus: true,
        timeLeft: wMin * 60,
        totalTime: wMin * 60,
        targetEndTime: null,
        timerPreset: 'Custom',
        customWorkDuration: wMin * 60,
        customBreakDuration: bMin * 60,
        customSessions: targetSessions,
        sessionCount: 1,
        presencePaused: false,
        lastPresenceElapsed: 0,
        lastPresenceRemaining: wMin * 60,
        breakGatePending: false
      };
      localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
      window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));

      // Clear the insight notification so it doesn't prompt again
      const telemetryKey = `ifocus_telemetry_insight_${userName}`;
      localStorage.removeItem(telemetryKey);
      localStorage.removeItem('ifocus_latest_telemetry');
      setInsight(null);

      // Save notification toast for Dashboard
      localStorage.setItem('ifocus_applied_toast', JSON.stringify({
        title: cadenceTitle,
        message: `${wMin}m Focus / ${bMin}m Rest cadence applied across ${targetSessions} sessions.`
      }));
    } catch (e) {
      console.error("Error applying coach rhythm:", e);
    }

    // Client-side smooth navigation to dashboard
    try {
      router.push('/dashboard');
    } catch (navErr) {
      window.location.href = '/dashboard';
    }
  };

  const handleSimulateIntervention = () => {
    const sampleIntervention = {
      reason: "High cognitive dwell time detected: Your study pace slowed by 38% over the past 20 minutes, indicating onset of mental fatigue.",
      actionPlan: "1. Take a 5-minute hydration & stretch break.\n2. Switch to low-effort flashcard review before tackling difficult topics.\n3. Re-engage with 15-minute focused bursts."
    };
    setInsight(sampleIntervention);
    const telemetryKey = `ifocus_telemetry_insight_${userName}`;
    localStorage.setItem(telemetryKey, JSON.stringify(sampleIntervention));
  };

  if (loading) return null;

  return (
    <div className="coach-page-root" style={{ maxWidth: '1440px', width: '100%', minHeight: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.15rem' }}>
            <h2 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
              Your AI Study Coach
            </h2>
            <HelpButton topic="reflection" title="AI Coach & Reflection Telemetry Tutorial" />
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.86rem' }}>
            Adaptive cognitive telemetry, attention diagnostics, and personalized study strategies.
          </p>
        </div>

        <button
          onClick={() => router.push('/dashboard')}
          className="btn-primary"
          style={{ padding: '0.55rem 1.3rem', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
          Start Focus Session
        </button>
      </div>

      {/* Main 2-Column Responsive Dashboard Layout (50/50 Cards) */}
      <div className="coach-main-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', flex: 1, minHeight: 0, alignItems: 'stretch' }}>
        
        {/* Card 1 (Left 50%): Cognitive Telemetry Diagnostics & Coach Intervention */}
        <div 
          className="coach-card coach-card-telemetry"
          style={{ 
            background: '#ffffff', 
            padding: '1.35rem 1.45rem', 
            borderRadius: '16px', 
            border: insight ? '1.5px solid var(--warning)' : '1px solid var(--glass-border)', 
            boxShadow: insight ? '0 4px 18px rgba(217, 119, 6, 0.1)' : '0 2px 10px rgba(0,0,0,0.02)', 
            height: '100%', 
            minHeight: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden' 
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.85rem' }}>
            
            {/* Top Telemetry Diagnostic Metrics Row */}
            <div className="coach-metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.65rem', paddingBottom: '0.85rem', borderBottom: '1px solid rgba(0, 0, 0, 0.07)', flexShrink: 0 }}>
              
              {/* Metric 1: Attention State */}
              <div className="coach-metric-card coach-metric-primary" style={{ background: '#f8faf8', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem', gap: '8px' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    Cognitive State
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: telemetryDiagnostics.cognitiveState.color, fontWeight: 700, whiteSpace: 'nowrap', background: `${telemetryDiagnostics.cognitiveState.dotColor}18`, padding: '2px 8px', borderRadius: '10px' }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: telemetryDiagnostics.cognitiveState.dotColor, boxShadow: `0 0 6px ${telemetryDiagnostics.cognitiveState.dotColor}` }} />
                    {telemetryDiagnostics.cognitiveState.status}
                  </span>
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: telemetryDiagnostics.cognitiveState.color, lineHeight: 1.25 }}>
                  {telemetryDiagnostics.cognitiveState.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.35 }}>
                  {telemetryDiagnostics.cognitiveState.subtext}
                </div>
              </div>

              {/* Metric 2: Focus Stamina */}
              <div className="coach-metric-card" style={{ background: '#f8faf8', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  Study Stamina
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: telemetryDiagnostics.studyStamina.color, lineHeight: 1.25 }}>
                  {telemetryDiagnostics.studyStamina.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.35 }}>
                  {telemetryDiagnostics.studyStamina.subtext}
                </div>
              </div>

              {/* Metric 3: Pacing Strategy */}
              <div className="coach-metric-card" style={{ background: '#f8faf8', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  Recommended Rhythm
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: telemetryDiagnostics.recommendedRhythm.color, lineHeight: 1.25 }}>
                  {telemetryDiagnostics.recommendedRhythm.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.35 }}>
                  {telemetryDiagnostics.recommendedRhythm.subtext}
                </div>
              </div>

            </div>

            {/* Coach Section below the Metrics */}
            {insight ? (
              /* Active Telemetry Intervention */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(217, 119, 6, 0.15)', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                      <line x1="12" y1="9" x2="12" y2="13"></line>
                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--warning)' }}>
                      Coach Intervention Triggered
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>Automated Cognitive Telemetry Alert</span>
                  </div>
                </div>

                {/* Reason Banner */}
                <div style={{ background: '#fefcf8', border: '1px solid rgba(217, 119, 6, 0.22)', padding: '0.85rem 1.05rem', borderRadius: '12px', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500 }}>
                    {insight.reason}
                  </p>
                </div>

                {/* Action Plan (Fills the available vertical height gracefully) */}
                {insight.actionPlan && (
                  <div style={{ 
                    flex: 1, 
                    minHeight: 0, 
                    background: 'rgba(95, 143, 94, 0.06)', 
                    padding: '1.15rem 1.25rem', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(95, 143, 94, 0.2)', 
                    display: 'flex', 
                    flexDirection: 'column' 
                  }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', color: '#27522d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                      Recommended Action Plan
                    </h4>
                    <div style={{ flex: 1, minHeight: 0, color: '#374151', fontSize: '0.9rem', lineHeight: 1.65, whiteSpace: 'pre-line', overflowY: 'auto' }}>
                      {insight.actionPlan}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Standard Adaptive Coaching Feed */
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.65rem', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Adaptive Coaching Strategy
                    </h3>
                    <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Continuous focus optimization and memory consolidation protocols
                    </p>
                  </div>
                  <span style={{ fontSize: '0.72rem', background: 'rgba(95, 143, 94, 0.12)', color: '#27522d', padding: '4px 9px', borderRadius: '6px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Active Observation
                  </span>
                </div>

                {/* Pacing & BreakGate Compliance Box (flex: 1 to fill card cleanly) */}
                <div style={{ 
                  flex: 1, 
                  minHeight: 0, 
                  padding: '1.15rem 1.35rem', 
                  background: '#f8faf8', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(95, 143, 94, 0.16)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  gap: '0.45rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27522d', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#27522d' }}>
                      Pacing & BreakGate Compliance
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.65 }}>
                    Your dwell times on flashcards indicate healthy active recall. Continue using the 25-minute Pomodoro rhythm to maximize memory consolidation without mental overload.
                  </p>
                </div>

                {/* High-Yield Memory Reinforcement Box (flex: 1 to fill card cleanly) */}
                <div style={{ 
                  flex: 1, 
                  minHeight: 0, 
                  padding: '1.15rem 1.35rem', 
                  background: '#f8faf8', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(95, 143, 94, 0.16)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  gap: '0.45rem' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27522d', flexShrink: 0 }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#27522d' }}>
                      High-Yield Memory Reinforcement
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.65 }}>
                    When self-testing on flashcards, practice active verbalization: state the reasoning out loud before flipping to activate dual auditory-visual memory pathways.
                  </p>
                </div>

              </div>
            )}
          </div>

          {/* Action Footer for Card 1 */}
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
            {insight ? (
              <div style={{ display: 'flex', gap: '0.65rem' }}>
                <button
                  type="button"
                  onClick={handleReturnHome}
                  disabled={applyingHome}
                  className="btn-primary"
                  style={{
                    padding: '0.65rem 1.25rem',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    cursor: applyingHome ? 'wait' : 'pointer',
                    margin: 0,
                    flex: 1.2,
                    opacity: applyingHome ? 0.75 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  {applyingHome ? (
                    <span>Applying Cadence...</span>
                  ) : (
                    <span>Apply & Return to Dashboard</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setInsight(null);
                    try {
                      localStorage.removeItem(`ifocus_telemetry_insight_${userName}`);
                      localStorage.removeItem('ifocus_latest_telemetry');
                      loadDiagnostics();
                    } catch (e) {}
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.65rem 1rem', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', margin: 0, flex: 0.8 }}
                >
                  Dismiss Alert
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Interactive Demo:</span>
                <button
                  type="button"
                  onClick={handleSimulateIntervention}
                  className="btn-secondary"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.95rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  Simulate Focus Intervention
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Card 2 (Right 50%): Reflection Journal & Sentiment Log */}
        <div 
          className="coach-card coach-card-journal"
          style={{ 
            background: '#ffffff', 
            padding: '1.35rem 1.45rem', 
            borderRadius: '16px', 
            border: '1px solid var(--glass-border)', 
            boxShadow: '0 2px 10px rgba(0,0,0,0.02)', 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%', 
            minHeight: 0,
            justifyContent: 'space-between',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.65rem', borderBottom: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: '0 0 0.15rem 0', fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Reflection Journal & Sentiment Log
                </h3>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Live history of your Quick Reflections and cognitive pacing check-ins.
                </p>
              </div>
              <span style={{ fontSize: '0.72rem', background: 'rgba(95, 143, 94, 0.1)', color: '#27522d', padding: '3px 8px', borderRadius: '6px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                {journalEntries.length} {journalEntries.length === 1 ? 'Entry' : 'Entries'}
              </span>
            </div>

            {/* Scrollable Journal Entries with flex: 1 (fills remaining height, no window scroll) */}
            <div className="coach-journal-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.65rem', paddingRight: '4px' }}>
              {journalEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#fafbfa', borderRadius: '12px', border: '1px dashed rgba(0,0,0,0.1)' }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.5rem auto', display: 'block' }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    No journal reflections yet
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    Log a Quick Reflection on your Dashboard to track cognitive fatigue, stress, and study momentum.
                  </p>
                </div>
              ) : (
                journalEntries.map((entry, idx) => {
                  const stateStr = String(entry.state || entry.sentiment || 'Reflective');
                  const isStress = stateStr.toLowerCase().includes('stress');
                  const isDistracted = stateStr.toLowerCase().includes('distract');
                  const isMotivated = stateStr.toLowerCase().includes('motivat') || stateStr.toLowerCase().includes('energetic');

                  const badgeBg = isStress ? '#fef2f2' : isDistracted ? '#fffbeb' : isMotivated ? '#f0fdf4' : '#f3f6f3';
                  const badgeBorder = isStress ? '#fecaca' : isDistracted ? '#fef3c7' : isMotivated ? '#bbf7d0' : 'rgba(95, 143, 94, 0.2)';
                  const badgeColor = isStress ? '#dc2626' : isDistracted ? '#b45309' : isMotivated ? '#16a34a' : '#27522d';

                  let formattedDate = 'Recent';
                  try {
                    const d = new Date(entry.date || entry.timestamp || entry.createdAt);
                    if (!isNaN(d.getTime())) {
                      formattedDate = d.toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit'
                      });
                    }
                  } catch (e) {}

                  const reply = getEntryAiReply(entry);
                  const entryKey = entry.id || idx;
                  const isExpanded = expandedJournalId === entryKey;

                  return (
                    <div
                      key={entryKey}
                      style={{
                        background: isExpanded ? '#ffffff' : '#fafcfa',
                        border: isExpanded ? '1.5px solid rgba(46, 125, 50, 0.45)' : '1px solid rgba(0, 0, 0, 0.07)',
                        borderRadius: '12px',
                        padding: '0.75rem 0.95rem',
                        boxShadow: isExpanded ? '0 4px 14px rgba(46, 125, 50, 0.08)' : 'none',
                        transition: 'all 0.15s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => setExpandedJournalId(isExpanded ? null : entryKey)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.74rem', color: '#6b7280', fontWeight: 600 }}>
                          {formattedDate}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '5px',
                            background: badgeBg,
                            border: `1px solid ${badgeBorder}`,
                            color: badgeColor,
                            textTransform: 'capitalize'
                          }}>
                            {stateStr}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: isExpanded ? '#2e7d32' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
                            {isExpanded ? 'Hide Advice' : 'View AI Reply'}
                            <svg 
                              width="11" 
                              height="11" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2.5" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
                            >
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </span>
                        </div>
                      </div>

                      <p style={{ margin: 0, fontSize: '0.85rem', color: '#1f2937', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {entry.text || entry.message || entry.reflection || 'Check-in recorded.'}
                      </p>

                      {/* Expanded AI Reply View */}
                      {isExpanded && (
                        <div 
                          style={{ 
                            marginTop: '0.75rem', 
                            paddingTop: '0.75rem', 
                            borderTop: '1px solid rgba(0, 0, 0, 0.08)',
                            animation: 'fadeIn 0.2s ease-out'
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div style={{
                            background: '#f8faf7',
                            border: '1px solid rgba(46, 125, 50, 0.2)',
                            borderLeft: '4px solid #2e7d32',
                            borderRadius: '10px',
                            padding: '0.75rem 0.9rem'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '4px' }}>
                              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#27522d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                AI Coach Adaptation Advice
                              </span>
                              <div style={{ display: 'flex', gap: '5px' }}>
                                <span style={{ fontSize: '0.68rem', background: 'rgba(46, 125, 50, 0.1)', color: '#27522d', padding: '2px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                  {reply.rhythm}
                                </span>
                                <span style={{ fontSize: '0.68rem', background: 'rgba(46, 125, 50, 0.1)', color: '#27522d', padding: '2px 5px', borderRadius: '4px', fontWeight: 600 }}>
                                  {reply.sessions || (reply.state === 'Stressed' ? 2 : 4)} Sessions
                                </span>
                              </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.84rem', color: '#334155', lineHeight: 1.5 }}>
                              {reply.message}
                            </p>

                            <div style={{ display: 'flex', gap: '8px', marginTop: '0.65rem', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => applyCoachAiRhythm(reply)}
                                className="btn-primary"
                                style={{
                                  padding: '3px 10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  margin: 0
                                }}
                              >
                                Apply This AI Timer ({reply.sessions || 2} Sessions)
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action to Dashboard Quick Reflection */}
          <div style={{ marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid rgba(0,0,0,0.05)', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => router.push('/dashboard#reflection')}
              className="btn-primary"
              style={{
                width: '100%',
                padding: '0.55rem 1.4rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
                margin: 0
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
              <span>Write Reflection on Dashboard</span>
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}

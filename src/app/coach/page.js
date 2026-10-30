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
  const [isAiRestRunning, setIsAiRestRunning] = useState(false);

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

  const [adaptiveStrategies, setAdaptiveStrategies] = useState([
    {
      title: 'Pacing & BreakGate Cadence',
      badge: 'Active Protocol',
      badgeColor: '#27522d',
      badgeBg: 'rgba(95, 143, 94, 0.12)',
      text: 'Consistently reviewing 3 retrieval questions before taking a break activates the testing effect, enhancing long-term conceptual recall without mental overload.'
    },
    {
      title: 'Flow State Maintenance',
      badge: 'Optimal Flow',
      badgeColor: '#27522d',
      badgeBg: 'rgba(95, 143, 94, 0.12)',
      text: 'Attention markers are stable. Keep external distractions out of reach and maintain your current Pomodoro cadence to maximize uninterrupted knowledge encoding.'
    }
  ]);

  const loadDiagnostics = useCallback(async () => {
    try {
      // 0. Cloud Telemetry Sync: Retrieve cloud state from database (e.g. from PC when on iPhone PWA)
      try {
        const cloudRes = await fetch('/api/user/telemetry');
        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          if (cloudData?.telemetryState) {
            const cloud = cloudData.telemetryState;
            if (cloud.latestTelemetry) {
              const cloudTime = new Date(cloud.latestTelemetry.timestamp || cloud.latestTelemetry.date || 0).getTime();
              const localRaw = localStorage.getItem('ifocus_latest_telemetry');
              const localTime = localRaw ? new Date(JSON.parse(localRaw).timestamp || 0).getTime() : 0;
              if (cloudTime >= localTime) {
                localStorage.setItem('ifocus_latest_telemetry', JSON.stringify(cloud.latestTelemetry));
                if (userName) localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(cloud.latestTelemetry));
              }
            }
            if (cloud.recoveryCompleted) {
              localStorage.setItem('ifocus_recovery_completed', String(cloud.recoveryCompleted));
            }
            if (cloud.cognitiveReset) {
              localStorage.setItem('ifocus_cognitive_reset', String(cloud.cognitiveReset));
            }
            if (cloud.activeIdleAlert) {
              localStorage.setItem('ifocus_active_idle_alert', JSON.stringify(cloud.activeIdleAlert));
            }
          }
        }
      } catch (err) {}

      // 0. Check Active AI Rest Recovery status
      let restRunning = false;
      try {
        const restRaw = localStorage.getItem('ifocus_ai_rest_recovery');
        const timerRaw = localStorage.getItem('ifocus_timer_state');
        if (restRaw) {
          const restData = JSON.parse(restRaw);
          if (restData && restData.active) {
            if (timerRaw) {
              const timerData = JSON.parse(timerRaw);
              if (timerData && !timerData.isFocus && (timerData.isRunning || timerData.timeLeft > 0)) {
                restRunning = true;
              }
            } else {
              restRunning = true;
            }
          }
        }
      } catch (e) {}
      setIsAiRestRunning(restRunning);

      // Check Recovery Completed and Cognitive Reset timestamps
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
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      // If Rest Recovery is actively running, display dedicated resting state
      if (restRunning) {
        setTelemetryDiagnostics({
          cognitiveState: {
            title: 'Restorative Recovery Active',
            status: 'Resting',
            color: '#059669',
            dotColor: '#10b981',
            subtext: '5-minute restorative recovery in progress: resetting cognitive fatigue'
          },
          studyStamina: {
            title: 'Recovery In Progress',
            color: '#059669',
            subtext: '5-minute restorative protocol active to restore depleted stamina'
          },
          recommendedRhythm: {
            title: '5m Recovery Break',
            color: '#059669',
            subtext: 'Active restorative pause before beginning Session 1'
          }
        });

        setAdaptiveStrategies([
          {
            title: 'Active Restorative Protocol',
            badge: 'Recovery Active',
            badgeColor: '#059669',
            badgeBg: 'rgba(5, 150, 105, 0.12)',
            text: 'A 5-minute restorative step-away break is currently active. Step back from the screen, hydrate, and relax your breathing to clear cognitive fatigue before starting Session 1.'
          },
          {
            title: 'Session 1 Focus Readiness',
            badge: 'Upcoming Cadence',
            badgeColor: '#27522d',
            badgeBg: 'rgba(95, 143, 94, 0.12)',
            text: 'Once your 5-minute recovery break finishes, the AI Coach will transition to your focus schedule so you can start Session 1 with high cognitive clarity.'
          }
        ]);
        return;
      }

      // 1. Telemetry / Cognitive State: Gather all candidates and pick newest
      const telemCandidates = [];
      try {
        const raw = localStorage.getItem('ifocus_latest_telemetry');
        if (raw) telemCandidates.push(JSON.parse(raw));
      } catch (e) {}

      try {
        const insightRaw = localStorage.getItem(`ifocus_telemetry_insight_${userName}`);
        if (insightRaw) telemCandidates.push(JSON.parse(insightRaw));
      } catch (e) {}

      try {
        const anonRaw = localStorage.getItem('ifocus_telemetry_insight_anonymous');
        if (anonRaw) telemCandidates.push(JSON.parse(anonRaw));
      } catch (e) {}

      try {
        const idleRaw = localStorage.getItem('ifocus_active_idle_alert');
        if (idleRaw) telemCandidates.push(JSON.parse(idleRaw));
      } catch (e) {}

      try {
        const journalRaw = localStorage.getItem(`ifocus_journal_history_${userName}`);
        if (journalRaw) {
          const list = JSON.parse(journalRaw);
          if (Array.isArray(list) && list.length > 0) telemCandidates.push(list[0]);
        }
      } catch (e) {}

      // Sort candidate telemetry by newest timestamp
      telemCandidates.sort((a, b) => {
        const tA = a?.timestamp ? new Date(a.timestamp).getTime() : (a?.date ? new Date(a.date).getTime() : 0);
        const tB = b?.timestamp ? new Date(b.timestamp).getTime() : (b?.date ? new Date(b.date).getTime() : 0);
        return tB - tA;
      });

      let telem = telemCandidates.length > 0 ? telemCandidates[0] : null;

      // Check if telemetry/reflection is from today and not invalidated by a newer recovery/reset
      if (telem) {
        const telemTime = telem.timestamp ? new Date(telem.timestamp).getTime() : (telem.date ? new Date(telem.date).getTime() : null);
        if (telemTime && (telemTime < todayStart || (effectiveResetTime > 0 && telemTime <= effectiveResetTime))) {
          telem = null;
        }
      }

      const stateStr = String(telem?.state || telem?.sentiment || telem?.type || '').toLowerCase();
      const reasonStr = String(telem?.reason || telem?.actionPlan || '').toLowerCase();
      const backspaces = Number(telem?.backspaces) || 0;
      const errorRate = Number(telem?.errorRate || telem?.metrics?.errorRate) || 0;

      const isIdle = stateStr.includes('idle') || stateStr.includes('inactivity') || reasonStr.includes('idle') || reasonStr.includes('inactivity');
      const isStress = !isIdle && (
        stateStr.includes('stress') ||
        stateStr.includes('friction') ||
        stateStr.includes('tension') ||
        stateStr.includes('frustrat') ||
        stateStr.includes('overwhelm') ||
        reasonStr.includes('stress') ||
        reasonStr.includes('friction') ||
        reasonStr.includes('tension') ||
        reasonStr.includes('frustrat') ||
        reasonStr.includes('overwhelm') ||
        reasonStr.includes('mashing') ||
        reasonStr.includes('simultaneous keys') ||
        reasonStr.includes('holding down a key') ||
        backspaces >= 6 ||
        errorRate > 30
      );
      const isDistracted = !isIdle && !isStress && (stateStr.includes('distract') || reasonStr.includes('distract') || errorRate > 15);
      const isFatigued = !isIdle && !isStress && (stateStr.includes('fatigue') || reasonStr.includes('fatigue') || stateStr === 'hesitant' || reasonStr.includes('hesitation'));
      const isMotivated = !isIdle && !isStress && (stateStr.includes('motivat') || stateStr.includes('energetic') || stateStr.includes('ready'));

      let cogState = {
        title: 'In the Zone',
        status: 'Optimal',
        color: '#27522d',
        dotColor: '#16a34a',
        subtext: recoveryCompletedTime >= todayStart
          ? 'Restorative break completed: cognitive baseline restored and ready for study'
          : 'Silent observation: Attention levels optimal'
      };

      let recRhythm = {
        title: '25m Work / 5m Gate',
        color: '#059669',
        subtext: 'Prevents cognitive burnout during intense study sessions'
      };

      if (isIdle) {
        const idleMinsMatch = reasonStr.match(/(\d+)\s*minute/i) || reasonStr.match(/(\d+)m/i);
        const idleMins = telem?.idleMinutes || (idleMinsMatch ? idleMinsMatch[1] : 5);
        cogState = {
          title: 'Task Hesitation / Idle',
          status: 'Friction',
          color: '#d97706',
          dotColor: '#d97706',
          subtext: `Inactivity detected: idle for ${idleMins}m with no focus timer running`
        };
        recRhythm = {
          title: '15m Work / 5m Gate',
          color: '#d97706',
          subtext: 'Short 15m focus kickstart to break task inertia and rebuild momentum'
        };
      } else if (isStress) {
        const isSmash = reasonStr.includes('simultaneous') || reasonStr.includes('mashing') || reasonStr.includes('holding') || reasonStr.includes('friction');
        cogState = {
          title: isSmash ? 'Cognitive Friction / Frustration' : 'High Tension / Stress',
          status: 'Tension',
          color: '#dc2626',
          dotColor: '#dc2626',
          subtext: telem?.reason ? telem.reason : (backspaces > 0 ? `Keystroke friction & stress logged (${backspaces} corrections)` : 'Stress & tension sentiment logged')
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

      // Check custom timer overrides if not currently in high stress or idle
      if (!isStress && !isIdle) {
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

      // 2. BreakGate / Study Stamina Calculation (Daily Reset Aware & Recovery Aware)
      let stamina = {
        title: '100% Resilience',
        color: '#16a34a',
        subtext: recoveryCompletedTime >= todayStart
          ? 'Recovery break completed: cognitive baseline restored'
          : 'Fresh study day: ready for your first focus session'
      };

      let staminaPct = 100;
      let totalEvents = 0;
      let completedEvents = 0;
      let skippedEvents = 0;

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
              totalEvents = unrecoveredEvents.length;
              completedEvents = unrecoveredEvents.filter(e => e.status === 'completed').length;
              skippedEvents = totalEvents - completedEvents;
              // Proportional deduction: baseline 100%, -20% per skip, +5% per completed recovery
              staminaPct = Math.max(0, Math.min(100, 100 - (skippedEvents * 20) + (completedEvents * 5)));
              const latest = unrecoveredEvents[unrecoveredEvents.length - 1];

              if (skippedEvents >= 3 || staminaPct < 60) {
                stamina = {
                  title: `${staminaPct}% Resilience`,
                  color: '#dc2626',
                  subtext: `Break challenges skipped (${skippedEvents} unrecovered today) - rest needed`
                };
              } else if (skippedEvents > 0 || staminaPct < 80) {
                stamina = {
                  title: `${staminaPct}% Resilience`,
                  color: '#d97706',
                  subtext: `Pacing lag detected (${skippedEvents} break challenge skipped today)`
                };
              } else {
                stamina = {
                  title: `${staminaPct}% Resilience`,
                  color: '#16a34a',
                  subtext: `High consistency: ${completedEvents} of ${totalEvents} BreakGates completed today`
                };
              }
            } else if (recoveryCompletedTime >= todayStart) {
              // Recovery completed today and no new unaddressed skips
              totalEvents = 0;
              completedEvents = 0;
              skippedEvents = 0;
              staminaPct = 100;
              stamina = {
                title: '100% Resilience',
                color: '#16a34a',
                subtext: 'Recovery break completed: cognitive baseline restored'
              };
            } else if (isStress) {
              // BreakGate inactive/no events today, but user has cognitive stress/frustration
              stamina = {
                title: '65% Resilience',
                color: '#d97706',
                subtext: 'Cognitive strain detected - lighter study block advised'
              };
              staminaPct = 65;
            } else {
              // No sessions recorded yet today -> Full 100% Resilience reset for the fresh day
              totalEvents = 0;
              completedEvents = 0;
              skippedEvents = 0;
              staminaPct = 100;
              stamina = {
                title: '100% Resilience',
                color: '#16a34a',
                subtext: 'BreakGate cycle compliance on track'
              };
            }
          }
        } catch (e) {}
      } else if (recoveryCompletedTime >= todayStart) {
        stamina = {
          title: '100% Resilience',
          color: '#16a34a',
          subtext: 'Recovery break completed: cognitive baseline restored'
        };
        staminaPct = 100;
      } else if (isStress) {
        stamina = {
          title: '65% Resilience',
          color: '#d97706',
          subtext: 'Cognitive strain detected - lighter study block advised'
        };
        staminaPct = 65;
      }

      // 4. Generate Truly Dynamic Adaptive Coaching Strategy Cards
      const dynamicStrategies = [];

      // Strategy Card 1: Pacing & Inactivity / BreakGate Strategy
      if (recoveryCompletedTime >= todayStart && skippedEvents === 0 && !isStress) {
        dynamicStrategies.push({
          title: 'Pacing & Recovery Rebalanced',
          badge: 'Deficit Resolved',
          badgeColor: '#16a34a',
          badgeBg: 'rgba(22, 163, 74, 0.12)',
          text: 'You completed your 5-minute restorative recovery break. Spaced recovery clears cognitive saturation and primes working memory for encoding new concepts.'
        });
      } else if (isIdle) {
        const idleMinsMatch = reasonStr.match(/(\d+)\s*minute/i) || reasonStr.match(/(\d+)m/i);
        const idleMins = telem?.idleMinutes || (idleMinsMatch ? idleMinsMatch[1] : 5);
        dynamicStrategies.push({
          title: 'Inactivity & Executive Inertia Kickstart',
          badge: 'Inactivity Alert',
          badgeColor: '#d97706',
          badgeBg: 'rgba(217, 119, 6, 0.12)',
          text: `You have been idle for ${idleMins} minutes with no active timer. Cognitive hesitation or task friction detected. Lower the cognitive barrier: start with a gentle 15-minute focus session on an easy, low-friction task to rebuild flow.`
        });
      } else if (isMotivated && (staminaPct < 60 || skippedEvents >= 2)) {
        dynamicStrategies.push({
          title: 'Protective Pacing: High Drive vs Recovery Cadence',
          badge: 'Retention Safeguard',
          badgeColor: '#d97706',
          badgeBg: 'rgba(217, 119, 6, 0.12)',
          text: `You reported feeling energetic and driven, which provides excellent cognitive momentum for study! However, ${skippedEvents} BreakGate recovery intervals were skipped today (${staminaPct}% compliance). In cognitive psychology, studying without spaced recovery creates hidden cognitive saturation and weakens long-term retention. The AI Coach prescribes a steady 25m cadence with completed breaks so your physical endurance sustains your mental motivation.`
        });
      } else if (skippedEvents === 1) {
        dynamicStrategies.push({
          title: 'Pacing Lag Advisory',
          badge: 'Pacing Advisory',
          badgeColor: '#d97706',
          badgeBg: 'rgba(217, 119, 6, 0.12)',
          text: 'You skipped 1 BreakGate recovery challenge. A single skip introduces subtle mental fatigue. Complete your next scheduled break to maintain peak cognitive endurance.'
        });
      } else if (staminaPct < 60 || skippedEvents >= 2) {
        dynamicStrategies.push({
          title: 'Break Recovery Deficit Alert',
          badge: 'Rest Needed',
          badgeColor: '#dc2626',
          badgeBg: 'rgba(239, 68, 68, 0.1)',
          text: `You have skipped ${skippedEvents} of your recent BreakGate recovery intervals (${staminaPct}% compliance). Skipping recovery causes cognitive saturation and lowers memory retention. We strongly recommend taking a restorative 5-minute break on your next cycle.`
        });
      } else if (staminaPct >= 80 && totalEvents > 0) {
        dynamicStrategies.push({
          title: 'Pacing & Retrieval Consistency',
          badge: 'High Compliance',
          badgeColor: '#16a34a',
          badgeBg: 'rgba(22, 163, 74, 0.12)',
          text: `High consistency detected: You have completed ${completedEvents} of ${totalEvents} BreakGate retrieval challenges (${staminaPct}%). This spacing interval primes memory consolidation and shields against late-session fatigue.`
        });
      } else {
        dynamicStrategies.push({
          title: 'Pacing & BreakGate Cadence',
          badge: 'Active Protocol',
          badgeColor: '#27522d',
          badgeBg: 'rgba(95, 143, 94, 0.12)',
          text: 'Consistently reviewing 3 retrieval questions before taking a break activates the testing effect, enhancing long-term conceptual recall without mental overload.'
        });
      }

      // Strategy Card 2: Cognitive Telemetry & Study Protocol
      if (recoveryCompletedTime >= todayStart && !isStress) {
        dynamicStrategies.push({
          title: 'Flow State Maintenance',
          badge: 'Optimal Flow',
          badgeColor: '#27522d',
          badgeBg: 'rgba(95, 143, 94, 0.12)',
          text: 'Cognitive fatigue has been mitigated. Maintain your active focus cadence to maximize uninterrupted knowledge encoding.'
        });
      } else if (isIdle) {
        dynamicStrategies.push({
          title: 'Low-Friction Task Priming Protocol',
          badge: 'Momentum Protocol',
          badgeColor: '#27522d',
          badgeBg: 'rgba(95, 143, 94, 0.12)',
          text: 'Break your upcoming task into just one simple step. Commencing a short 15-minute block bypasses task hesitation, initiates the Zeigarnik effect, and naturally transitions you into deep flow.'
        });
      } else if (isStress) {
        dynamicStrategies.push({
          title: 'Cognitive De-escalation Protocol',
          badge: 'Stress Mitigation',
          badgeColor: '#dc2626',
          badgeBg: 'rgba(239, 68, 68, 0.1)',
          text: 'Elevated friction or rapid keystroke corrections detected. Step back from the screen for a moment, hydrate, and ease into your session with a light, simple task first.'
        });
      } else if (staminaPct < 60) {
        dynamicStrategies.push({
          title: 'Restorative Pacing Protocol',
          badge: 'Low Energy Buffer',
          badgeColor: '#d97706',
          badgeBg: 'rgba(217, 119, 6, 0.12)',
          text: 'Your current study resilience is below 60%. Stand up, hydrate, and relax your visual field. When resuming, prioritize a light review task rather than heavy exam questions.'
        });
      } else if (isMotivated && staminaPct >= 80) {
        dynamicStrategies.push({
          title: 'High-Yield Memory Reinforcement',
          badge: 'Peak Flow',
          badgeColor: '#16a34a',
          badgeBg: 'rgba(22, 163, 74, 0.12)',
          text: 'Cognitive resilience and motivation are peaked. Practice active verbalization: state the concept reasoning out loud before flipping flashcards to engage dual auditory-visual memory pathways.'
        });
      } else {
        dynamicStrategies.push({
          title: 'Flow State Maintenance',
          badge: 'Optimal Flow',
          badgeColor: '#27522d',
          badgeBg: 'rgba(95, 143, 94, 0.12)',
          text: 'Attention markers are stable. Keep external distractions out of reach and maintain your current Pomodoro cadence to maximize uninterrupted knowledge encoding.'
        });
      }

      setAdaptiveStrategies(dynamicStrategies);

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

    // Load active insight from localStorage across namespaced & global keys
    let activeInsight = null;
    try {
      const stored = localStorage.getItem(`ifocus_telemetry_insight_${userName}`) || 
                     localStorage.getItem('ifocus_telemetry_insight_anonymous') ||
                     localStorage.getItem('ifocus_active_idle_alert') ||
                     localStorage.getItem('ifocus_latest_telemetry');
      if (stored) {
        const data = JSON.parse(stored);
        if (data && (data.reason || data.actionPlan)) {
          let isRestActive = false;
          try {
            const rRaw = localStorage.getItem('ifocus_ai_rest_recovery');
            if (rRaw) {
              const rData = JSON.parse(rRaw);
              if (rData && rData.active) isRestActive = true;
            }
          } catch (e) {}

          let rcTime = 0;
          try {
            rcTime = Number(localStorage.getItem('ifocus_recovery_completed')) || 0;
          } catch (e) {}

          let crTime = 0;
          try {
            crTime = Number(localStorage.getItem('ifocus_cognitive_reset')) || 0;
          } catch (e) {}

          const effectiveReset = Math.max(rcTime, crTime);
          const insightTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;

          if (!isRestActive && (effectiveReset === 0 || (insightTime > 0 && insightTime > effectiveReset))) {
            activeInsight = data;
          }
        }
      }
    } catch (e) {
      console.error("Error parsing telemetry data", e);
    }

    setInsight(activeInsight);
    setLoading(false);

    const handleTelemetryEvent = (e) => {
      loadDiagnostics();
      if (e?.detail && (e.detail.reason || e.detail.actionPlan)) {
        setInsight(e.detail);
      }
    };

    const handleJournalUpdate = () => {
      try {
        const stored = localStorage.getItem(`ifocus_journal_history_${userName}`);
        if (stored) setJournalEntries(JSON.parse(stored));
      } catch (e) {}
    };

    window.addEventListener('ifocus_telemetry_updated', handleTelemetryEvent);
    window.addEventListener('ifocus_breakgate_updated', loadDiagnostics);
    window.addEventListener('ifocus_timer_sync', loadDiagnostics);
    window.addEventListener('storage', handleJournalUpdate);

    return () => {
      window.removeEventListener('ifocus_telemetry_updated', handleTelemetryEvent);
      window.removeEventListener('ifocus_breakgate_updated', loadDiagnostics);
      window.removeEventListener('ifocus_timer_sync', loadDiagnostics);
      window.removeEventListener('storage', handleJournalUpdate);
    };
  }, [status, userName, loadDiagnostics]);

  const handleReturnHome = () => {
    // If AI Rest Recovery is currently running, return directly to dashboard without resetting
    if (isAiRestRunning) {
      try {
        router.push('/dashboard');
      } catch (e) {
        window.location.href = '/dashboard';
      }
      return;
    }

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

      // Idle / Inactivity checks: When user is idle, they need to START a focus session (not take a rest break!)
      const isIdleAlert = combined.includes('inactivity detected') || 
                          combined.includes('idle for') || 
                          combined.includes('hesitation') || 
                          combined.includes('inactivity alert') ||
                          (insight?.type === 'idle') ||
                          (insight?.state === 'idle');

      if (isIdleAlert) {
        wMin = 15;
        bMin = 5;
        targetSessions = 2;
        cadenceTitle = "Gentle Focus (Inactivity Kickstart)";
        detectedState = "Inactivity Kickstart";
      } else if (combined.includes('15m') || combined.includes('15 minute') || combined.includes('15-minute') || combined.includes('stress') || combined.includes('tension') || combined.includes('fatigue')) {
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

      // Check if current strategy or telemetry recommends rest / recovery
      // MUST NOT prescribe rest if the user was simply idle/inactive (they need to start focus, not rest!)
      const hasRestStrategy = !isIdleAlert && Array.isArray(adaptiveStrategies) && adaptiveStrategies.some(s => 
        s.badge === 'Rest Needed' || 
        s.badge === 'Stress Mitigation' || 
        s.badge === 'Low Energy Buffer' || 
        String(s.title || '').toLowerCase().includes('deficit') ||
        String(s.title || '').toLowerCase().includes('de-escalation') ||
        String(s.text || '').toLowerCase().includes('step back from the screen') ||
        String(s.text || '').toLowerCase().includes('restorative 5-minute break')
      );

      const isRestPrescribed = !isIdleAlert && (hasRestStrategy || 
        detectedState === 'Stressed' || 
        combined.includes('rest needed') || 
        combined.includes('break recovery deficit') || 
        (combined.includes('fatigue') && !combined.includes('idle')) || 
        (insight?.actionPlan && (insight.actionPlan.toLowerCase().includes('hydration') || insight.actionPlan.toLowerCase().includes('take a 5-minute'))));

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
        title: isRestPrescribed ? "Restorative Recovery Protocol" : cadenceTitle,
        state: detectedState,
        rhythm: isRestPrescribed ? "5m AI Rest Break" : `${wMin}m Focus / ${bMin}m Rest`,
        sessions: targetSessions,
        message: insight?.actionPlan || telemetryDiagnostics?.recommendedRhythm?.subtext || "AI Coach recommended strategy applied."
      };
      localStorage.setItem('ifocus_ai_adjusted_active', 'true');
      localStorage.setItem('ifocus_ai_adjusted_details', JSON.stringify(aiDetails));

      if (isRestPrescribed) {
        // Clear old recovery completion so user must complete this break to resolve
        localStorage.removeItem('ifocus_recovery_completed');
        localStorage.removeItem('ifocus_cognitive_reset');

        const restDurationSec = 5 * 60; // 5-minute restorative step-away break
        const restPayload = {
          active: true,
          durationMins: 5,
          startedAt: Date.now(),
          targetEndTime: Date.now() + restDurationSec * 1000,
          reason: "AI Coach prescribed a 5-minute restorative recovery break to prevent cognitive saturation and protect long-term retention."
        };
        localStorage.setItem('ifocus_ai_rest_recovery', JSON.stringify(restPayload));

        const syncPayload = {
          isRunning: true,
          isFocus: false, // In Rest Break mode
          timeLeft: restDurationSec,
          totalTime: restDurationSec,
          targetEndTime: Date.now() + restDurationSec * 1000,
          timerPreset: 'Custom',
          customWorkDuration: wMin * 60,
          customBreakDuration: restDurationSec,
          customSessions: targetSessions,
          sessionCount: 1,
          presencePaused: false,
          lastPresenceElapsed: 0,
          lastPresenceRemaining: restDurationSec,
          breakGatePending: false,
          isAiRestRecovery: true
        };
        localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
        window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));

        localStorage.setItem('ifocus_applied_toast', JSON.stringify({
          title: "AI Rest Recovery Active",
          message: "5-minute restorative recovery break started to protect focus and memory retention."
        }));
      } else {
        localStorage.removeItem('ifocus_ai_rest_recovery');
        localStorage.setItem('ifocus_cognitive_reset', String(Date.now()));

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
          breakGatePending: false,
          isAiRestRecovery: false
        };
        localStorage.setItem('ifocus_timer_state', JSON.stringify(syncPayload));
        window.dispatchEvent(new CustomEvent('ifocus_timer_sync', { detail: syncPayload }));

        // Save notification toast for Dashboard
        localStorage.setItem('ifocus_applied_toast', JSON.stringify({
          title: cadenceTitle,
          message: `${wMin}m Focus / ${bMin}m Rest cadence applied across ${targetSessions} sessions.`
        }));
      }

      // Clear alert keys so the alert is fulfilled
      localStorage.removeItem(`ifocus_telemetry_insight_${userName}`);
      localStorage.removeItem('ifocus_telemetry_insight_anonymous');
      localStorage.removeItem('ifocus_latest_telemetry');
      localStorage.removeItem('ifocus_active_idle_alert');
      setInsight(null);
      window.dispatchEvent(new CustomEvent('ifocus_telemetry_updated'));

      // Sync dismissal to cloud database
      fetch('/api/user/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryState: {
            latestTelemetry: null,
            activeIdleAlert: null,
            cognitiveReset: Date.now(),
            updatedAt: new Date().toISOString()
          }
        })
      }).catch(() => {});
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

  const getSynchronizedActionPlan = (planText) => {
    if (!planText) return planText;
    const rhythmTitle = String(telemetryDiagnostics?.recommendedRhythm?.title || '');
    const match = rhythmTitle.match(/(\d+)m Work/i);
    if (match && match[1]) {
      const activeWorkMin = match[1];
      return planText.replace(/start a gentle \d+m focus session/i, `start a gentle ${activeWorkMin}m focus session`);
    }
    return planText;
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
          <span>{isAiRestRunning ? 'Return to Recovery Break' : 'Start Focus Session'}</span>
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
              <div className="coach-metric-card coach-metric-primary" style={{ background: '#f8faf8', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.25rem', gap: '4px' }}>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Cognitive State
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.62rem', color: telemetryDiagnostics.cognitiveState.color, fontWeight: 700, whiteSpace: 'nowrap', background: `${telemetryDiagnostics.cognitiveState.dotColor}18`, padding: '1.5px 6px', borderRadius: '8px', flexShrink: 0 }}>
                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: telemetryDiagnostics.cognitiveState.dotColor, boxShadow: `0 0 5px ${telemetryDiagnostics.cognitiveState.dotColor}` }} />
                    {telemetryDiagnostics.cognitiveState.status}
                  </span>
                </div>
                <div style={{ fontSize: '1.02rem', fontWeight: 800, color: telemetryDiagnostics.cognitiveState.color, lineHeight: 1.25 }}>
                  {telemetryDiagnostics.cognitiveState.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.35 }}>
                  {telemetryDiagnostics.cognitiveState.subtext}
                </div>
              </div>

              {/* Metric 2: Study Resilience */}
              <div className="coach-metric-card" style={{ background: '#f8faf8', padding: '0.75rem 0.85rem', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.06)', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '84px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>
                  Study Resilience
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

                {/* Action Plan */}
                {insight.actionPlan && (
                  <div style={{ 
                    flex: '0 0 auto', 
                    background: 'rgba(95, 143, 94, 0.06)', 
                    padding: '1.05rem 1.15rem', 
                    borderRadius: '12px', 
                    border: '1px solid rgba(95, 143, 94, 0.2)', 
                    display: 'flex', 
                    flexDirection: 'column' 
                  }}>
                    <h4 style={{ margin: '0 0 0.45rem 0', fontSize: '0.78rem', color: '#27522d', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
                      Recommended Action Plan
                    </h4>
                    <div style={{ color: '#374151', fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                      {getSynchronizedActionPlan(insight.actionPlan)}
                    </div>
                  </div>
                )}

                {/* 3-Step Guided Focus Reset Protocol */}
                <div style={{
                  padding: '0.85rem 1.05rem',
                  background: 'rgba(59, 130, 246, 0.04)',
                  borderRadius: '12px',
                  border: '1px solid rgba(59, 130, 246, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  flexShrink: 0
                }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Guided Focus Reset Protocol
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.82rem', color: '#374151', lineHeight: '1.4' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>1</span>
                      <span>Disengage from the screen and take slow deep breaths</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>2</span>
                      <span>Hydrate and relax mental friction before resuming</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#dbeafe', color: '#1d4ed8', fontSize: '0.7rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>3</span>
                      <span>Resume with a low-friction warm-up task to regain flow</span>
                    </div>
                  </div>
                </div>
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

                {/* Dynamically Generated Adaptive Coaching Protocols based on BreakGate & Telemetry */}
                {adaptiveStrategies.map((strat, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      flex: 1, 
                      minHeight: 0, 
                      padding: '1.1rem 1.35rem', 
                      background: '#f8faf8', 
                      borderRadius: '12px', 
                      border: '1px solid rgba(95, 143, 94, 0.16)', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      justifyContent: 'center', 
                      gap: '0.45rem' 
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: strat.badgeColor || '#27522d', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: strat.badgeColor || '#27522d' }}>
                          {strat.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, color: strat.badgeColor, background: strat.badgeBg, padding: '2px 8px', borderRadius: '6px' }}>
                        {strat.badge}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#4b5563', lineHeight: 1.65 }}>
                      {strat.text}
                    </p>
                  </div>
                ))}

              </div>
            )}
          </div>

          {/* Action Footer for Card 1 */}
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
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
                  <span>Applying Strategy...</span>
                ) : isAiRestRunning ? (
                  <span>Return to Dashboard (Recovery Active)</span>
                ) : (
                  <span>Apply Strategy to Dashboard</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isAiRestRunning) {
                    router.push('/dashboard');
                    return;
                  }
                  if (insight) {
                    setInsight(null);
                    try {
                      localStorage.removeItem(`ifocus_telemetry_insight_${userName}`);
                      localStorage.removeItem('ifocus_telemetry_insight_anonymous');
                      localStorage.removeItem('ifocus_latest_telemetry');
                      localStorage.removeItem('ifocus_active_idle_alert');
                      localStorage.setItem('ifocus_cognitive_reset', String(Date.now()));
                      fetch('/api/user/telemetry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          telemetryState: {
                            latestTelemetry: null,
                            activeIdleAlert: null,
                            cognitiveReset: Date.now(),
                            updatedAt: new Date().toISOString()
                          }
                        })
                      }).catch(() => {});
                      loadDiagnostics();
                    } catch (e) {}
                  } else {
                    router.push('/dashboard');
                  }
                }}
                className="btn-secondary"
                style={{ padding: '0.65rem 1rem', fontSize: '0.86rem', fontWeight: 600, cursor: 'pointer', margin: 0, flex: 0.8, textAlign: 'center' }}
              >
                {isAiRestRunning ? 'Back to Dashboard' : 'Dismiss'}
              </button>
            </div>
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

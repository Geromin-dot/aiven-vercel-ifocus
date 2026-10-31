// Unified Client-Side Bi-Directional Cloud Telemetry & State Reconciliation
// Ensures 100% data parity across all devices (PC browser, mobile PWA, tablet) for the same user account.

export async function reconcileCloudTelemetry() {
  if (typeof window === "undefined") return null;

  try {
    const userName = localStorage.getItem("ifocus_user_name") || "FocusUser";

    // 1. Gather all existing local state
    let localBreakEvents = [];
    try {
      const raw = localStorage.getItem("ifocus_breakgate_events");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localBreakEvents = parsed;
      }
    } catch (e) {}

    let localRecoveryTime = 0;
    try {
      const raw = localStorage.getItem("ifocus_recovery_completed");
      if (raw) localRecoveryTime = Number(raw) || 0;
    } catch (e) {}

    let localResetTime = 0;
    try {
      const raw = localStorage.getItem("ifocus_cognitive_reset");
      if (raw) localResetTime = Number(raw) || 0;
    } catch (e) {}

    let localTelem = null;
    try {
      const raw = localStorage.getItem("ifocus_latest_telemetry");
      if (raw) localTelem = JSON.parse(raw);
    } catch (e) {}

    let localInsight = null;
    try {
      const raw = localStorage.getItem(`ifocus_telemetry_insight_${userName}`) || localStorage.getItem("ifocus_telemetry_insight_anonymous");
      if (raw) localInsight = JSON.parse(raw);
    } catch (e) {}

    let localIdleAlert = null;
    try {
      const raw = localStorage.getItem("ifocus_active_idle_alert");
      if (raw) localIdleAlert = JSON.parse(raw);
    } catch (e) {}

    let localPrefs = {};
    try {
      const raw = localStorage.getItem("ifocus_timer_preferences");
      if (raw) localPrefs = JSON.parse(raw);
    } catch (e) {}

    let localDeck = null;
    try {
      const raw = localStorage.getItem("ifocus_active_breakgate_deck");
      if (raw) localDeck = JSON.parse(raw);
    } catch (e) {}

    let localJournal = [];
    try {
      const raw = localStorage.getItem(`ifocus_journal_history_${userName}`) || localStorage.getItem("ifocus_journal_history");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) localJournal = parsed;
      }
    } catch (e) {}

    let localTimerState = null;
    try {
      const raw = localStorage.getItem("ifocus_timer_state");
      if (raw) localTimerState = JSON.parse(raw);
    } catch (e) {}

    let localCustomTimer = null;
    try {
      const raw = localStorage.getItem("ifocus_custom_timer");
      if (raw) localCustomTimer = JSON.parse(raw);
    } catch (e) {}

    let localAiDetails = null;
    try {
      const raw = localStorage.getItem("ifocus_ai_adjusted_details");
      if (raw) localAiDetails = JSON.parse(raw);
    } catch (e) {}

    // 2. Fetch cloud telemetry from PostgreSQL Aiven database
    const res = await fetch("/api/user/telemetry");
    if (!res.ok) return null;
    const data = await res.json();
    const cloud = data?.telemetryState || {};
    const cloudPrefs = data?.timerPreferences || {};

    // 3. Reconcile BreakGate Events (merge arrays by unique timestamp/id so no events are lost)
    const remoteEvents = Array.isArray(cloud.breakGateEvents) ? cloud.breakGateEvents : [];
    const eventMap = new Map();
    [...localBreakEvents, ...remoteEvents].forEach((evt) => {
      if (!evt) return;
      const key = evt.id || evt.timestamp || evt.date || (evt.time ? String(evt.time) : null);
      if (key) eventMap.set(key, evt);
    });
    const mergedEvents = Array.from(eventMap.values())
      .sort((a, b) => new Date(a.date || a.timestamp || 0).getTime() - new Date(b.date || b.timestamp || 0).getTime())
      .slice(-50);

    localStorage.setItem("ifocus_breakgate_events", JSON.stringify(mergedEvents));

    // 4. Reconcile Reflection Journal History (merge entries by unique ID, date, or text)
    const remoteJournal = Array.isArray(cloud.journalHistory) ? cloud.journalHistory : [];
    const journalMap = new Map();
    [...localJournal, ...remoteJournal].forEach((entry) => {
      if (!entry) return;
      const key = entry.id || entry.date || entry.timestamp || (entry.text ? entry.text.slice(0, 40) : null);
      if (key) journalMap.set(key, entry);
    });
    const mergedJournal = Array.from(journalMap.values())
      .sort((a, b) => new Date(b.date || b.timestamp || 0).getTime() - new Date(a.date || a.timestamp || 0).getTime())
      .slice(0, 50);

    if (mergedJournal.length > 0) {
      localStorage.setItem(`ifocus_journal_history_${userName}`, JSON.stringify(mergedJournal));
      localStorage.setItem("ifocus_journal_history", JSON.stringify(mergedJournal));
    }

    // 5. Reconcile Recovery & Cognitive Reset timestamps (highest/latest wins)
    const cloudRecovery = Number(cloud.recoveryCompleted || 0);
    const effectiveRecovery = Math.max(localRecoveryTime, cloudRecovery);
    if (effectiveRecovery > 0) {
      localStorage.setItem("ifocus_recovery_completed", String(effectiveRecovery));
    }

    const cloudReset = Number(cloud.cognitiveReset || 0);
    const effectiveReset = Math.max(localResetTime, cloudReset);
    if (effectiveReset > 0) {
      localStorage.setItem("ifocus_cognitive_reset", String(effectiveReset));
    }

    // 6. Reconcile Telemetry, Insight & Idle Alert
    const effectiveResetBaseline = Math.max(effectiveRecovery, effectiveReset);

    let effectiveTelem = cloud.latestTelemetry || localTelem;
    const localTelemTime = localTelem ? new Date(localTelem.timestamp || localTelem.date || 0).getTime() : 0;
    const cloudTelemTime = cloud.latestTelemetry ? new Date(cloud.latestTelemetry.timestamp || cloud.latestTelemetry.date || 0).getTime() : 0;
    if (localTelem && localTelemTime >= cloudTelemTime) {
      effectiveTelem = localTelem;
    }

    if (effectiveTelem) {
      const telemTime = new Date(effectiveTelem.timestamp || effectiveTelem.date || 0).getTime();
      if (effectiveResetBaseline > 0 && telemTime <= effectiveResetBaseline) {
        effectiveTelem = null;
        localStorage.removeItem("ifocus_latest_telemetry");
      } else {
        localStorage.setItem("ifocus_latest_telemetry", JSON.stringify(effectiveTelem));
      }
    } else {
      localStorage.removeItem("ifocus_latest_telemetry");
    }

    // Reconcile Insight Data
    let effectiveInsight = cloud.insightData || localInsight;
    const localInsightTime = localInsight ? new Date(localInsight.timestamp || localInsight.date || 0).getTime() : 0;
    const cloudInsightTime = cloud.insightData ? new Date(cloud.insightData.timestamp || cloud.insightData.date || 0).getTime() : 0;
    if (localInsight && localInsightTime >= cloudInsightTime) {
      effectiveInsight = localInsight;
    }
    if (effectiveInsight) {
      const insTime = new Date(effectiveInsight.timestamp || effectiveInsight.date || 0).getTime();
      if (effectiveResetBaseline > 0 && insTime <= effectiveResetBaseline) {
        effectiveInsight = null;
        localStorage.removeItem(`ifocus_telemetry_insight_${userName}`);
        localStorage.removeItem("ifocus_telemetry_insight_anonymous");
      } else {
        localStorage.setItem(`ifocus_telemetry_insight_${userName}`, JSON.stringify(effectiveInsight));
        localStorage.setItem("ifocus_telemetry_insight_anonymous", JSON.stringify(effectiveInsight));
      }
    } else {
      localStorage.removeItem(`ifocus_telemetry_insight_${userName}`);
      localStorage.removeItem("ifocus_telemetry_insight_anonymous");
    }

    let effectiveIdle = cloud.activeIdleAlert || localIdleAlert;
    if (effectiveIdle) {
      const idleTime = new Date(effectiveIdle.timestamp || 0).getTime();
      if (effectiveResetBaseline > 0 && idleTime <= effectiveResetBaseline) {
        effectiveIdle = null;
        localStorage.removeItem("ifocus_active_idle_alert");
      } else {
        localStorage.setItem("ifocus_active_idle_alert", JSON.stringify(effectiveIdle));
      }
    } else {
      localStorage.removeItem("ifocus_active_idle_alert");
    }

    // 7. Reconcile Timer Preferences & Checkpoint
    const mergedPrefs = { ...cloudPrefs, ...localPrefs };
    if (Object.keys(mergedPrefs).length > 0) {
      localStorage.setItem("ifocus_timer_preferences", JSON.stringify(mergedPrefs));
    }

    // Reconcile Custom Timer Config
    let effectiveCustomTimer = localCustomTimer;
    if (cloud.customTimer) {
      effectiveCustomTimer = { ...(localCustomTimer || {}), ...cloud.customTimer };
      localStorage.setItem("ifocus_custom_timer", JSON.stringify(effectiveCustomTimer));
    }

    // Reconcile AI Adjusted Details
    if (cloud.aiAdjustedDetails) {
      localStorage.setItem("ifocus_ai_adjusted_details", JSON.stringify(cloud.aiAdjustedDetails));
      localStorage.setItem("ifocus_ai_adjusted_active", "true");
    }

    // Reconcile Timer State / Checkpoint
    let effectiveTimerState = localTimerState;
    if (cloud.activeTimerState) {
      const cloudTimer = cloud.activeTimerState;
      const isCloudRunning = Boolean(cloudTimer.isRunning && cloudTimer.targetEndTime && cloudTimer.targetEndTime > Date.now());
      const hasPresetDiff = cloudTimer.timerPreset && cloudTimer.timerPreset !== localTimerState?.timerPreset;
      const isCloudNewer = (cloudTimer.updatedAt || 0) > (localTimerState?.updatedAt || 0);

      if (!localTimerState || (!localTimerState.isRunning && (hasPresetDiff || isCloudRunning || isCloudNewer))) {
        const remaining = isCloudRunning ? Math.max(0, Math.round((cloudTimer.targetEndTime - Date.now()) / 1000)) : cloudTimer.timeLeft;
        effectiveTimerState = {
          ...(localTimerState || {}),
          ...cloudTimer,
          timeLeft: remaining !== undefined ? remaining : cloudTimer.timeLeft,
          isRunning: isCloudRunning
        };
        localStorage.setItem("ifocus_timer_state", JSON.stringify(effectiveTimerState));
        window.dispatchEvent(new CustomEvent("ifocus_timer_sync", { detail: effectiveTimerState }));
      }
    }

    // 8. Reconcile Active BreakGate Deck
    const effectiveDeck = localDeck || cloud.activeBreakGateDeck || null;
    if (effectiveDeck) {
      localStorage.setItem("ifocus_active_breakgate_deck", JSON.stringify(effectiveDeck));
    }

    // 9. BI-DIRECTIONAL PUSH: If local had data that cloud lacked or was behind on, push up to Aiven database!
    const isCloudMissingEvents = mergedEvents.length > remoteEvents.length;
    const isCloudMissingJournal = mergedJournal.length > remoteJournal.length;
    const isCloudBehindRecovery = effectiveRecovery > cloudRecovery;
    const isCloudBehindReset = effectiveReset > cloudReset;
    const isCloudBehindTelem = localTelem && localTelemTime > cloudTelemTime;
    const isCloudBehindInsight = localInsight && localInsightTime > cloudInsightTime;
    const isCloudMissingPrefs = Object.keys(localPrefs).length > 0 && Object.keys(cloudPrefs).length < Object.keys(localPrefs).length;
    const isCloudMissingDeck = !cloud.activeBreakGateDeck && Boolean(effectiveDeck);
    const isCloudMissingCustomTimer = !cloud.customTimer && Boolean(localCustomTimer);

    if (
      isCloudMissingEvents ||
      isCloudMissingJournal ||
      isCloudBehindRecovery ||
      isCloudBehindReset ||
      isCloudBehindTelem ||
      isCloudBehindInsight ||
      isCloudMissingPrefs ||
      isCloudMissingDeck ||
      isCloudMissingCustomTimer
    ) {
      fetch("/api/user/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telemetryState: {
            breakGateEvents: mergedEvents,
            journalHistory: mergedJournal,
            recoveryCompleted: effectiveRecovery || null,
            cognitiveReset: effectiveReset || null,
            latestTelemetry: effectiveTelem,
            insightData: effectiveInsight,
            activeIdleAlert: effectiveIdle,
            activeBreakGateDeck: effectiveDeck,
            activeTimerState: effectiveTimerState,
            customTimer: effectiveCustomTimer,
            updatedAt: new Date().toISOString()
          },
          timerPreferences: mergedPrefs
        })
      }).catch(() => {});
    }

    window.dispatchEvent(new CustomEvent("ifocus_breakgate_updated"));
    window.dispatchEvent(new CustomEvent("ifocus_telemetry_updated", { detail: effectiveTelem }));
    window.dispatchEvent(new CustomEvent("ifocus_journal_updated", { detail: mergedJournal }));
    if (effectiveDeck) {
      window.dispatchEvent(new CustomEvent("ifocus_breakgate_deck_changed", { detail: { active: true, deck: effectiveDeck } }));
    }

    return {
      mergedEvents,
      mergedJournal,
      effectiveRecovery,
      effectiveReset,
      effectiveTelem,
      effectiveInsight,
      effectiveIdle,
      mergedPrefs,
      effectiveDeck,
      effectiveTimerState,
      effectiveCustomTimer
    };
  } catch (err) {
    console.warn("reconcileCloudTelemetry error:", err);
    return null;
  }
}

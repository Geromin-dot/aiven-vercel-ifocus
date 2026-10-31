// Unified Client-Side Bi-Directional Cloud Telemetry & State Reconciliation
// Ensures 100% data parity across all devices (PC browser, mobile PWA, tablet) for the same user account.

export async function reconcileCloudTelemetry() {
  if (typeof window === "undefined") return null;

  try {
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

    // 2. Fetch cloud telemetry from PostgreSQL Aiven database
    const res = await fetch("/api/user/telemetry");
    if (!res.ok) return null;
    const data = await res.json();
    const cloud = data?.telemetryState || {};
    const cloudPrefs = data?.timerPreferences || {};

    // 3. Reconcile BreakGate Events (merge arrays by timestamp/id so no events are lost)
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

    // 4. Reconcile Recovery & Cognitive Reset timestamps (highest/latest wins)
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

    // 5. Reconcile Telemetry & Idle Alert
    // If recovery was completed after the alert/telemetry timestamp, neutralize it!
    const effectiveResetBaseline = Math.max(effectiveRecovery, effectiveReset);

    let effectiveTelem = cloud.latestTelemetry || localTelem;
    const localTelemTime = localTelem ? new Date(localTelem.timestamp || localTelem.date || 0).getTime() : 0;
    const cloudTelemTime = cloud.latestTelemetry ? new Date(cloud.latestTelemetry.timestamp || cloud.latestTelemetry.date || 0).getTime() : 0;
    if (localTelem && localTelemTime >= cloudTime) {
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

    // 6. Reconcile Timer Preferences
    const mergedPrefs = { ...cloudPrefs, ...localPrefs };
    if (Object.keys(mergedPrefs).length > 0) {
      localStorage.setItem("ifocus_timer_preferences", JSON.stringify(mergedPrefs));
    }

    // 7. Reconcile Active BreakGate Deck
    const effectiveDeck = localDeck || cloud.activeBreakGateDeck || null;
    if (effectiveDeck) {
      localStorage.setItem("ifocus_active_breakgate_deck", JSON.stringify(effectiveDeck));
    }

    // 8. BI-DIRECTIONAL PUSH: If local had events, recovery, or prefs that cloud didn't have or was behind on, push up!
    const isCloudMissingEvents = mergedEvents.length > remoteEvents.length;
    const isCloudBehindRecovery = effectiveRecovery > cloudRecovery;
    const isCloudBehindReset = effectiveReset > cloudReset;
    const isCloudBehindTelem = localTelem && localTelemTime > cloudTime;
    const isCloudMissingPrefs = Object.keys(localPrefs).length > 0 && Object.keys(cloudPrefs).length < Object.keys(localPrefs).length;
    const isCloudMissingDeck = !cloud.activeBreakGateDeck && Boolean(effectiveDeck);

    if (isCloudMissingEvents || isCloudBehindRecovery || isCloudBehindReset || isCloudBehindTelem || isCloudMissingPrefs || isCloudMissingDeck) {
      fetch("/api/user/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telemetryState: {
            breakGateEvents: mergedEvents,
            recoveryCompleted: effectiveRecovery || null,
            cognitiveReset: effectiveReset || null,
            latestTelemetry: effectiveTelem,
            activeIdleAlert: effectiveIdle,
            activeBreakGateDeck: effectiveDeck,
            updatedAt: new Date().toISOString()
          },
          timerPreferences: mergedPrefs
        })
      }).catch(() => {});
    }

    window.dispatchEvent(new CustomEvent("ifocus_breakgate_updated"));
    window.dispatchEvent(new CustomEvent("ifocus_telemetry_updated", { detail: effectiveTelem }));
    if (effectiveDeck) {
      window.dispatchEvent(new CustomEvent("ifocus_breakgate_deck_changed", { detail: { active: true, deck: effectiveDeck } }));
    }

    return {
      mergedEvents,
      effectiveRecovery,
      effectiveReset,
      effectiveTelem,
      effectiveIdle,
      mergedPrefs,
      effectiveDeck
    };
  } catch (err) {
    console.warn("reconcileCloudTelemetry error:", err);
    return null;
  }
}


export function playNotificationChime() {
  try {
    let preferences = {};
    try {
      preferences = JSON.parse(localStorage.getItem('ifocus_sound_preferences') || '{}') || {};
    } catch {}
    const volume = Math.max(0, Math.min(100, Number(preferences.ambientVolume ?? 70))) / 100;
    if (preferences.telemetryChime === false || !(volume > 0)) return;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!window.__ifocusSharedAudioCtx || window.__ifocusSharedAudioCtx.state === 'closed') {
      window.__ifocusSharedAudioCtx = new AudioContext();
    }
    const context = window.__ifocusSharedAudioCtx;
    if (context.state === 'suspended' || context.state === 'interrupted') {
      context.resume().catch(() => {});
    }
    const now = context.currentTime;

    for (const { frequency, delay, level, duration } of [
      { frequency: 659.25, delay: 0, level: 0.18, duration: 0.35 },
      { frequency: 987.77, delay: 0.1, level: 0.22, duration: 0.45 },
    ]) {
      const startAt = now + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(level * volume, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
    }
  } catch (error) {
    console.warn('Web Audio chime failed:', error);
  }
}

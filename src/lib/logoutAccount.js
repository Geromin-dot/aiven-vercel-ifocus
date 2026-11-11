import { signOut } from 'next-auth/react';

const privatePrefixes = ['ifocus_user_', 'ifocus_current_user', 'ifocus_session_history', 'ifocus_focus_stats',
  'ifocus_latest_telemetry', 'ifocus_telemetry_insight_', 'ifocus_journal_history', 'ifocus_active_idle_alert',
  'ifocus_breakgate_events', 'ifocus_breakgate_guidance_dismissed_', 'ifocus_mastered_', 'ifocus_interrupted_session_', 'ifocus_resolved_timer_sessions_',
  'ifocus_pending_study_sessions', 'ifocus_timer_state', 'ifocus_custom_timer', 'ifocus_ai_',
  'ifocus_active_breakgate_deck', 'ifocus_breakgate_deck_updated_at_', 'ifocus_prefill_reflection', 'ifocus_recovery_', 'ifocus_cognitive_reset'];

export function clearPrivateCache(storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
  for (const key of keys) {
    if (key && privatePrefixes.some(prefix => key.startsWith(prefix))) storage.removeItem(key);
  }
}

export function announceAuthChange(type) {
  try { localStorage.setItem('ifocus_auth_event', JSON.stringify({ type, time: Date.now(), id: crypto.randomUUID() })); } catch {}
}

let pendingLogout = null;
export function logoutAccount(destination = '/login') {
  if (pendingLogout) return pendingLogout;
  window.dispatchEvent(new Event('ifocus_logout_started'));
  window.dispatchEvent(new Event('ifocus_emergency_stop'));
  pendingLogout = (async () => {
    try {
      await signOut({ redirect: false, callbackUrl: destination });
      const response = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok || (await response.json())?.user) throw new Error('Sign-out could not be verified');
      try { clearPrivateCache(localStorage); } catch {}
      announceAuthChange('signout');
      // Replace the protected history entry and discard the in-memory app state.
      window.location.replace(destination);
      return true;
    } catch {
      window.dispatchEvent(new Event('ifocus_logout_failed'));
      return false;
    } finally {
      pendingLogout = null;
    }
  })();
  return pendingLogout;
}

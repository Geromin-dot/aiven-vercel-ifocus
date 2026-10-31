"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getBackgroundPushStatus, pushCheckpoint } from '../lib/pushNotifications';

export default function BackgroundPushSync() {
  const { data: session } = useSession();
  useEffect(() => {
    if (!session?.user?.id || session.error) return;
    let disposed = false;
    let enabled = false;
    const report = detail => { if (!disposed) window.dispatchEvent(new CustomEvent('ifocus_push_status', { detail })); };
    const sync = () => {
      if (!enabled || disposed) return;
      try {
        const state = JSON.parse(localStorage.getItem('ifocus_timer_state') || 'null');
        pushCheckpoint(state).then(result => report({ ...result, error: '' }))
          .catch(error => report({ subscribed: true, error: error.message }));
      } catch { report({ subscribed: true, error: 'Could not read the timer checkpoint.' }); }
    };
    const refresh = async () => {
      try {
        const status = await getBackgroundPushStatus();
        if (disposed) return;
        enabled = status.configured && status.subscribed;
        report(status);
        sync();
      } catch (error) { report({ error: error.message }); }
    };
    refresh();
    const syncEvents = ['ifocus_timer_sync', 'ifocus_timer_checkpoint', 'ifocus_timer_prefs_updated', 'pagehide'];
    syncEvents.forEach(event => window.addEventListener(event, sync));
    window.addEventListener('ifocus_push_subscription_changed', refresh);
    document.addEventListener('visibilitychange', sync);
    // Also retries scheduling after a transient network/scheduler failure.
    const interval = setInterval(sync, 30000);
    return () => {
      disposed = true;
      clearInterval(interval);
      syncEvents.forEach(event => window.removeEventListener(event, sync));
      window.removeEventListener('ifocus_push_subscription_changed', refresh);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [session?.user?.id, session?.error]);
  return null;
}

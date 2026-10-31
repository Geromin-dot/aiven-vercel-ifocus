"use client";

import { useEffect, useState } from 'react';
import { remainingTime, settlePresence, presenceInterval } from '../lib/timerState';
import { formatNotificationTime, sendSystemNotification } from '../lib/timerNotifications';
import { getBackgroundPushStatus, enableBackgroundPush, disableBackgroundPush, pushRequest } from '../lib/pushNotifications';
import { getTimerDeviceId } from '../lib/timerState';

export default function TimerNotificationSettings() {
  const [snapshot, setSnapshot] = useState(null);
  const [permission, setPermission] = useState('loading');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [background, setBackground] = useState(null);

  useEffect(() => {
    let disposed = false;
    const refresh = () => getBackgroundPushStatus().then(result => { if (!disposed) setBackground(result); })
      .catch(() => { if (!disposed) setBackground({ error: 'Could not check background notifications.' }); });
    const onStatus = event => setBackground(previous => ({ ...previous, ...event.detail }));
    refresh();
    window.addEventListener('ifocus_push_subscription_changed', refresh);
    window.addEventListener('ifocus_push_status', onStatus);
    return () => { disposed = true; window.removeEventListener('ifocus_push_subscription_changed', refresh); window.removeEventListener('ifocus_push_status', onStatus); };
  }, []);

  const backgroundAction = async action => {
    setBusy(true);
    setStatus('');
    try {
      if (action === 'enable') {
        await enableBackgroundPush(background);
        setStatus('Background notifications enabled for this device.');
      } else if (action === 'disable') {
        await disableBackgroundPush();
        setStatus('Background notifications disabled for this device.');
      } else {
        await pushRequest('test', { deviceId: getTimerDeviceId() });
        setStatus('Server push sent. Check your notifications.');
      }
    } catch (error) { setStatus(error.message); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const refresh = () => {
      setPermission('Notification' in window ? Notification.permission : 'unsupported');
      try {
        const saved = JSON.parse(localStorage.getItem('ifocus_timer_state') || 'null');
        const prefs = JSON.parse(localStorage.getItem('ifocus_timer_preferences') || '{}');
        if (!saved) { setSnapshot(null); return; }
        const state = settlePresence(saved, prefs);
        const remaining = remainingTime(state);
        const untilCheck = presenceInterval(state, prefs) - ((state.totalTime - remaining) - (state.lastPresenceCheckElapsed || 0));
        setSnapshot({ remaining, isRunning: state.isRunning, presencePaused: state.presencePaused,
          untilCheck: prefs.activePresenceEnabled !== false && state.isRunning && state.isFocus && untilCheck < remaining
            ? Math.max(0, untilCheck) : null });
      } catch { setSnapshot(null); }
    };
    refresh();
    const interval = setInterval(refresh, 1000);
    const events = ['ifocus_timer_sync', 'ifocus_timer_prefs_updated', 'storage', 'focus'];
    events.forEach(event => window.addEventListener(event, refresh));
    return () => { clearInterval(interval); events.forEach(event => window.removeEventListener(event, refresh)); };
  }, []);

  const testNotification = async () => {
    setBusy(true);
    setStatus('');
    try {
      // Request directly from the tap, before awaiting registration.
      const result = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
      setPermission(result);
      if (result !== 'granted') {
        setStatus('Allow notifications in your phone or browser settings, then try again.');
        return;
      }
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
        if (!registration.active) await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('Please reopen the app and try again.')), 10000)),
        ]);
      }
      const delivered = await sendSystemNotification('iFocus Notification Test',
        `Timer: ${formatNotificationTime(snapshot?.remaining || 0)} remaining. Presence alerts open Pause and Continue controls.`, 'ifocus-test');
      setStatus(delivered ? 'Test sent. Check your notifications.' : 'Could not send the test. Check notification permissions and reopen the app.');
    } catch (error) { setStatus(error.message || 'Could not send the test. Please reopen the app.'); }
    finally { setBusy(false); }
  };

  return (
    <div style={{ padding: '1rem', border: '1px solid var(--glass-border)', borderRadius: '14px', display: 'grid', gap: '0.6rem' }}>
      <h4 style={{ margin: 0 }}>PWA Timer & Notifications</h4>
      <div role="timer" aria-label="Time remaining" style={{ fontSize: '1.8rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {snapshot ? formatNotificationTime(snapshot.remaining) : '--:--'}
      </div>
      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        {snapshot?.presencePaused ? 'Paused for presence check. Open the presence prompt to Pause or Continue.' : snapshot?.isRunning ? 'Timer running' : 'Timer paused'}
        {snapshot?.untilCheck != null && ` · Next presence check in ${formatNotificationTime(snapshot.untilCheck)}`}
      </p>
      <p style={{ margin: 0, fontSize: '0.8rem' }}>Notifications: {permission === 'granted' ? 'Allowed' : permission === 'default' ? 'Not enabled' : permission === 'denied' ? 'Blocked in device settings' : permission === 'loading' ? 'Checking…' : 'Unavailable — on iPhone, open the app from your Home Screen'}</p>
      <button type="button" className="btn-secondary" onClick={testNotification} disabled={busy || permission === 'unsupported' || permission === 'loading'}>
        {busy ? 'Sending…' : permission === 'default' ? 'Enable & Test Notifications' : 'Test Notification'}
      </button>
      <p style={{ margin: 0, fontSize: '0.8rem' }}>
        Background notifications: {background === null ? 'Checking…' : !background.configured ? 'Waiting for server setup' : background.subscribed ? 'Enabled on this device' : 'Not enabled on this device'}
        {background?.scheduled && ' · Next alert scheduled'}
      </p>
      {background?.error && <p role="status" style={{ margin: 0, fontSize: '0.8rem' }}>{background.error}</p>}
      {background?.configured && permission !== 'unsupported' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-secondary" disabled={busy} onClick={() => backgroundAction(background.subscribed ? 'disable' : 'enable')}>
            {background.subscribed ? 'Disable Background Notifications' : 'Enable Background Notifications'}
          </button>
          {background.subscribed && <button type="button" className="btn-secondary" disabled={busy} onClick={() => backgroundAction('test')}>Test Server Push</button>}
        </div>
      )}
      {status && <p role="status" style={{ margin: 0, fontSize: '0.82rem' }}>{status}</p>}
      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Alerts show the time remaining when the timer pauses. Where supported, they include Pause and Continue buttons. On iPhone, tap the alert to open these controls. The live countdown is shown here while the app is open.
        {' '}Enable background notifications on this device to receive scheduled alerts while the app is in the background. Delivery also depends on your connection and device notification settings.
      </p>
    </div>
  );
}

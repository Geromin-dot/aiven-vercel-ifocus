"use client";

import { useEffect, useState } from 'react';
import { remainingTime, settlePresence, presenceInterval } from '../lib/timerState';
import { formatNotificationTime, sendSystemNotification } from '../lib/timerNotifications';
import { getBackgroundPushStatus, enableBackgroundPush, disableBackgroundPush, pushRequest } from '../lib/pushNotifications';
import { getTimerDeviceId } from '../lib/timerState';
import styles from './TimerNotificationSettings.module.css';

export default function TimerNotificationSettings() {
  const [snapshot, setSnapshot] = useState(null);
  const [permission, setPermission] = useState('loading');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [background, setBackground] = useState(null);
  const [showPermissionHelp, setShowPermissionHelp] = useState(false);

  const requestPermission = async () => {
    setBusy('permission');
    setStatus('');
    try {
      if (!('Notification' in window)) {
        setShowPermissionHelp(true);
        setStatus('Notifications are unavailable here. On iPhone, open iFocus from your Home Screen.');
        return;
      }
      // Invoke directly from the tap. A prior block may return "denied" without a prompt.
      const result = await Notification.requestPermission();
      setPermission(result);
      setShowPermissionHelp(result === 'denied');
      setStatus(result === 'granted' ? 'Notifications are allowed. You can send a test below.'
        : result === 'denied' ? 'Notifications are blocked. Follow the steps below to allow them again.'
          : 'Permission was not granted. Tap Request Permission when you are ready.');
    } catch {
      setShowPermissionHelp(true);
      setStatus('Could not request permission. Check your notification settings below.');
    } finally { setBusy(false); }
  };

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
    setBusy(action);
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
    setBusy('test');
    setStatus('');
    try {
      const result = 'Notification' in window ? Notification.permission : 'unsupported';
      setPermission(result);
      if (result !== 'granted') {
        setShowPermissionHelp(result === 'denied' || result === 'unsupported');
        setStatus(result === 'default' ? 'Tap Request Permission first, then send a test.' : 'Allow notifications in your phone or browser settings, then try again.');
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
    <section className={styles.card} aria-label="PWA timer and notifications">
      <div className={styles.header}>
        <h4 className={styles.title}>PWA Timer & Notifications</h4>
        <span className={`${styles.badge} ${permission === 'granted' ? styles.allowed : ''}`}>
          <span className={styles.dot} aria-hidden="true" />
          {permission === 'granted' ? 'Notifications allowed' : permission === 'denied' ? 'Notifications blocked'
            : permission === 'loading' ? 'Checking permission…' : permission === 'unsupported' ? 'Unavailable here' : 'Permission needed'}
        </span>
      </div>
      <div className={styles.timerRow}>
        <div role="timer" aria-label="Time remaining" className={styles.timer}>
          {snapshot ? formatNotificationTime(snapshot.remaining) : '--:--'}
        </div>
        <div className={styles.timerDetails}>
          <p className={styles.timerLabel}>{snapshot?.presencePaused ? 'Paused for presence check' : snapshot?.isRunning ? 'Timer running' : snapshot ? 'Timer paused' : 'No active timer'}</p>
          <p className={styles.caption}>{snapshot?.untilCheck != null ? `Next check in ${formatNotificationTime(snapshot.untilCheck)}` : 'Time remaining in your session'}</p>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.permissionButton}`} onClick={requestPermission} disabled={Boolean(busy) || permission === 'loading'}>
          {busy === 'permission' ? 'Requesting…' : 'Request Permission'}
        </button>
        <button type="button" className={styles.button} onClick={testNotification} disabled={Boolean(busy) || permission === 'unsupported' || permission === 'loading'}>
          {busy === 'test' ? 'Sending…' : 'Test Notification'}
        </button>
      </div>
      {status && <p role="status" className={styles.status}>{status}</p>}
      {(showPermissionHelp || permission === 'denied') && (
        <div className={styles.help}>
          <h5>Allow notifications again</h5>
          <p><strong>iPhone:</strong> Open Settings → Notifications → iFocus → Allow Notifications. Use iFocus from your Home Screen.</p>
          <p><strong>Web / Android:</strong> Open this site’s controls beside the address bar → Site settings or Permissions → Notifications → Allow.</p>
          <p>Return here, then tap Request Permission to check again. A blocked permission must be changed in your device or browser settings.</p>
        </div>
      )}
      {background?.configured && permission !== 'unsupported' && (
        <div className={styles.background}>
          <p className={styles.caption}>Background notifications: {background.subscribed ? 'Enabled on this device' : 'Not enabled'}{background.scheduled && ' · Next alert scheduled'}</p>
          {background.error && <p role="status" className={styles.caption}>{background.error}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => backgroundAction(background.subscribed ? 'disable' : 'enable')}>
              {background.subscribed ? 'Disable Background Notifications' : 'Enable Background Notifications'}
            </button>
            {background.subscribed && <button type="button" className={styles.button} disabled={Boolean(busy)} onClick={() => backgroundAction('test')}>Test Server Push</button>}
          </div>
        </div>
      )}
      <p className={styles.caption}>
        Alerts show your remaining time. Tap an alert to open Pause / Continue. The live countdown stays here while the app is open.
      </p>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from 'react';
import styles from './InterruptedSessionRecovery.module.css';
import { applyResolvedSessions, mergeResolvedSessions } from '../lib/recoveryState';
import { saveVerifiedStudySession } from '../lib/verifiedStudyClient';

export default function InterruptedSessionRecovery({ userId }) {
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const dialogRef = useRef(null);
  const recoveryId = progress?.id;

  useEffect(() => {
    if (!userId) return;
    let disposed = false;
    let checking = false;
    let verifiedSessions = null;
    const load = () => {
      try {
        let saved = JSON.parse(localStorage.getItem(`ifocus_interrupted_session_${userId}`) || 'null');
        const resolved = JSON.parse(localStorage.getItem(`ifocus_resolved_timer_sessions_${userId}`) || '[]');
        // Another sync can dispatch a refresh before the first verification completes.
        if (saved && verifiedSessions === null) { setProgress(null); return; }
        const verified = verifiedSessions?.find(item => item.id === saved?.id);
        if (saved) saved = { ...saved, duration: Math.min(Number(saved.duration), verified?.duration ?? 0) };
        const meaningfulProgress = saved && Number.isFinite(Number(saved.duration)) && Number(saved.duration) >= 60;
        if (saved && !meaningfulProgress) localStorage.removeItem(`ifocus_interrupted_session_${userId}`);
        if (meaningfulProgress) localStorage.setItem(`ifocus_interrupted_session_${userId}`, JSON.stringify(saved));
        if (!disposed) setProgress(meaningfulProgress && !resolved.includes(saved.id) ? saved : null);
      } catch { setProgress(null); }
    };
    // A cached prompt is only shown after checking decisions made on another device.
    const sync = async (hideUntilVerified = true) => {
      if (disposed || checking || saving.current) return;
      if (!localStorage.getItem(`ifocus_interrupted_session_${userId}`)) { load(); return; }
      checking = true;
      if (hideUntilVerified) setProgress(null);
      try {
        const response = await fetch('/api/user/telemetry', { cache: 'no-store' });
        if (!response.ok) return;
        const result = await response.json();
        if (disposed || result.userId !== userId) return;
        verifiedSessions = result.recoverableFocusSessions || [];
        applyResolvedSessions(userId, result.telemetryState?.resolvedTimerSessions);
        load();
      } catch { /* Retry on focus; do not re-offer an unverified cached session offline. */ }
      finally { checking = false; }
    };
    const refresh = () => { sync(); };
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    refresh();
    const interval = setInterval(() => { if (document.visibilityState === 'visible') sync(false); }, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('ifocus_interrupted_session', refresh);
    window.addEventListener('ifocus_recovery_resolved', load);
    window.addEventListener('storage', refresh);
    return () => {
      disposed = true;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('ifocus_interrupted_session', refresh);
      window.removeEventListener('ifocus_recovery_resolved', load);
      window.removeEventListener('storage', refresh);
    };
  }, [userId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [recoveryId]);

  const resolve = async (save) => {
    if (saving.current || !progress || !userId) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const latest = await fetch('/api/user/telemetry', { cache: 'no-store' });
      if (!latest.ok) throw new Error('Could not verify this session. Please try again when connected.');
      const current = await latest.json();
      if (current.userId !== userId) throw new Error('Your account changed. Please reopen the app.');
      const alreadyResolved = applyResolvedSessions(userId, current.telemetryState?.resolvedTimerSessions);
      if (alreadyResolved.includes(progress.id)) { setProgress(null); return; }
      let savedSession = null;
      if (save) {
        const result = await saveVerifiedStudySession({ duration: progress.duration, timerSessionId: progress.id, recoveryId: progress.id });
        savedSession = result.session;
      }
      const response = await fetch('/api/user/telemetry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telemetryState: { resolvedTimerSessions: [progress.id] } }),
      });
      if (!response.ok) throw new Error('Your choice could not be synced. Please try again. Your saved time will not be duplicated.');
      const key = `ifocus_resolved_timer_sessions_${userId}`;
      const resolved = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(mergeResolvedSessions(resolved, [progress.id])));
      localStorage.removeItem(`ifocus_interrupted_session_${userId}`);
      window.dispatchEvent(new CustomEvent('ifocus_recovery_resolved'));
      if (save) {
        const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
        if (!history.some(item => item.recoveryId === progress.id || (savedSession?.id && item.id === savedSession.id))) {
          history.push({ id: savedSession?.id, date: savedSession?.createdAt || progress.date,
            duration: (savedSession?.duration ?? progress.duration) / 60,
            durationSeconds: savedSession?.duration ?? progress.duration,
            type: 'pomodoro', partial: true, synced: true, recoveryId: progress.id });
          localStorage.setItem('ifocus_session_history', JSON.stringify(history.slice(-200)));
        }
        window.dispatchEvent(new CustomEvent('ifocus_stats_updated'));
      }
      setProgress(null);
    } catch (err) {
      setError(err.message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  if (!progress) return null;
  const minutes = Math.floor(progress.duration / 60);
  const seconds = Math.floor(progress.duration % 60);
  return (
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="interrupted-session-title"
      aria-describedby="interrupted-session-description" onCancel={event => event.preventDefault()}>
      <div className={styles.content}>
        <div className={styles.icon} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
        </div>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>Unfinished session</p>
          <h2 id="interrupted-session-title">Keep your study progress?</h2>
          <p id="interrupted-session-description">Your last focus session has saved study time. Add it to your history, or discard it to start fresh.</p>
        </div>
        <div className={styles.progress}>
          <span>Study time to save</span>
          <strong>{minutes}<small>m</small>{seconds > 0 && <> {seconds}<small>s</small></>}</strong>
        </div>
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="button" autoFocus disabled={busy} onClick={() => resolve(true)} className={styles.save}>{busy ? 'Please wait…' : 'Save study time'}</button>
          <button type="button" disabled={busy} onClick={() => resolve(false)} className={styles.discard}>Discard</button>
        </div>
      </div>
    </dialog>
  );
}

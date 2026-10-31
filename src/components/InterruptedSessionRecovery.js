"use client";

import { useEffect, useRef, useState } from 'react';

export default function InterruptedSessionRecovery({ userId }) {
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);

  useEffect(() => {
    if (!userId) return;
    const load = () => {
      try {
        const saved = JSON.parse(localStorage.getItem(`ifocus_interrupted_session_${userId}`) || 'null');
        const resolved = JSON.parse(localStorage.getItem(`ifocus_resolved_timer_sessions_${userId}`) || '[]');
        setProgress(saved && !resolved.includes(saved.id) ? saved : null);
      } catch { setProgress(null); }
    };
    load();
    window.addEventListener('ifocus_interrupted_session', load);
    return () => window.removeEventListener('ifocus_interrupted_session', load);
  }, [userId]);

  const resolve = async (save) => {
    if (saving.current || !progress || !userId) return;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      if (save) {
        const response = await fetch('/api/study-sessions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration: progress.duration, score: 0, recoveryId: progress.id }),
        });
        if (!response.ok) throw new Error('Your progress could not be saved. Please try again when connected.');
      }
      const response = await fetch('/api/user/telemetry', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telemetryState: { resolvedTimerSessions: [progress.id] } }),
      });
      if (!response.ok) throw new Error('Your choice could not be synced. Please try again. Your saved time will not be duplicated.');
      const key = `ifocus_resolved_timer_sessions_${userId}`;
      const resolved = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify([...new Set([...resolved, progress.id])].slice(-100)));
      localStorage.removeItem(`ifocus_interrupted_session_${userId}`);
      if (save) {
        const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
        if (!history.some(item => item.recoveryId === progress.id)) {
          history.push({ date: progress.date, duration: progress.duration / 60, type: 'pomodoro', partial: true, synced: true, recoveryId: progress.id });
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
  const seconds = progress.duration % 60;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(15,23,42,.5)', display: 'grid', placeItems: 'center', padding: 20 }}>
      <section role="dialog" aria-modal="true" aria-labelledby="interrupted-session-title" style={{ background: '#fff', color: '#1e293b', borderRadius: 20, padding: 28, maxWidth: 420, width: '100%', boxShadow: '0 20px 60px #0003' }}>
        <h2 id="interrupted-session-title" style={{ fontSize: 21, margin: '0 0 12px' }}>Save your unfinished session?</h2>
        <p>You left a focus session on another device. Your last saved checkpoint contains <strong>{minutes}m {seconds}s</strong> of study time.</p>
        <p>Would you like to add that time to your study history?</p>
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 22 }}>
          <button autoFocus disabled={busy} onClick={() => resolve(true)} style={{ padding: '12px 18px', background: '#27522d', color: '#fff', border: 0, borderRadius: 10, cursor: 'pointer' }}>{busy ? 'Please wait…' : 'Save study time'}</button>
          <button disabled={busy} onClick={() => resolve(false)} style={{ padding: '12px 18px', background: '#f1f5f9', color: '#334155', border: 0, borderRadius: 10, cursor: 'pointer' }}>Discard</button>
        </div>
      </section>
    </div>
  );
}

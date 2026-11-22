'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import AppDialog from './AppDialog';
import { isProtectedPath } from '@/lib/sessionPaths';
import { STUDY_DEVICES } from '@/lib/studyDevice';

function subscribe(listener) {
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}

function DevicePromptForLogin({ userId, loginId }) {
  const titleId = useId();
  const markerKey = `ifocus_device_prompt_session_${userId}`;
  const needsSelection = useSyncExternalStore(subscribe, () => {
    try { return localStorage.getItem(markerKey) !== loginId; } catch { return true; }
  }, () => false);
  const [done, setDone] = useState(false);
  const [device, setDevice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event) {
    event.preventDefault();
    if (saving || !['mobile', 'pc'].includes(device)) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studyDevice: device }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your device. Please try again.');
      try { localStorage.setItem(markerKey, loginId); } catch {}
      setDone(true);
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  if (!needsSelection || done) return null;
  return <AppDialog titleId={titleId} onDismiss={() => {}} className="student-device-dialog">
    <h2 id={titleId}>What device are you using right now?</h2>
    <p>You can update your selection later in Settings.</p>
    <form onSubmit={save}>
      <fieldset>
        <legend className="sr-only">Your device</legend>
        <div className="profile-choice-options">
          {STUDY_DEVICES.filter(option => option.value !== 'both').map(option => <label key={option.value}>
            <input type="radio" name="currentDevice" value={option.value} checked={device === option.value}
              onChange={event => setDevice(event.target.value)} disabled={saving} required />
            <span>{option.label}</span>
          </label>)}
        </div>
      </fieldset>
      {error && <p role="alert" className="reflection-input-error">{error}</p>}
      <footer><button className="btn-primary" type="submit" disabled={!device || saving}>{saving ? 'Saving…' : 'Continue'}</button></footer>
    </form>
  </AppDialog>;
}

export default function StudentDevicePrompt() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const user = session?.user;
  if (!isProtectedPath(pathname) || pathname === '/complete-profile' || session?.error || user?.role !== 'STUDENT'
    || user.needsProfileSetup || !user.id || !user.sessionId) return null;
  return <DevicePromptForLogin key={`${user.id}:${user.sessionId}`} userId={user.id} loginId={user.sessionId} />;
}

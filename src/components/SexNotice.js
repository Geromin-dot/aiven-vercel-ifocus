'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import SexField from './SexField';
import { isProtectedPath } from '@/lib/sessionPaths';

export default function SexNotice() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const [identity, setIdentity] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedUserId, setSavedUserId] = useState(null);
  const [error, setError] = useState('');
  if (!isProtectedPath(pathname) || pathname === '/complete-profile' || session?.user?.role !== 'STUDENT'
    || session.user.sex || savedUserId === session.user.id) return null;

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/user/sex', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sex: identity }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your selection.');
      setSavedUserId(session.user.id);
      await update();
    } catch (error) {
      setError(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <aside className="profile-completion-notice" aria-labelledby="sex-notice-title">
    <div>
      <h2 id="sex-notice-title">Complete your profile</h2>
      <p>Select your sex. This is saved once.</p>
    </div>
    <form onSubmit={save}>
      <SexField id="existing-account-sex" value={identity} onChange={event => setIdentity(event.target.value)} />
      <button className="btn-primary" type="submit" disabled={saving || !identity}>{saving ? 'Saving…' : 'Save selection'}</button>
    </form>
    {error && <p role="alert" className="account-verification-warning">{error}</p>}
  </aside>;
}

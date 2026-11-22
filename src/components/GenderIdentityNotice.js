'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import GenderIdentityField from './GenderIdentityField';
import { isProtectedPath } from '@/lib/sessionPaths';

export default function GenderIdentityNotice() {
  const { data: session, update } = useSession();
  const pathname = usePathname();
  const [identity, setIdentity] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedUserId, setSavedUserId] = useState(null);
  const [error, setError] = useState('');
  if (!isProtectedPath(pathname) || pathname === '/complete-profile' || session?.user?.role !== 'STUDENT'
    || session.user.genderIdentity || savedUserId === session.user.id) return null;

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/user/gender', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genderIdentity: identity }),
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

  return <aside className="profile-completion-notice" aria-labelledby="gender-notice-title">
    <div>
      <h2 id="gender-notice-title">Complete your profile</h2>
      <p>Please select your gender identity. Check your choice before saving.</p>
    </div>
    <form onSubmit={save}>
      <GenderIdentityField id="existing-account-gender" value={identity} onChange={event => setIdentity(event.target.value)} />
      <button className="btn-primary" type="submit" disabled={saving || !identity}>{saving ? 'Saving…' : 'Save selection'}</button>
    </form>
    {error && <p role="alert" className="account-verification-warning">{error}</p>}
  </aside>;
}

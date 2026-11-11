"use client";

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { logoutAccount } from '@/lib/logoutAccount';
import { STUDENT_YEAR_LEVELS } from '@/lib/studentYearLevels';

export default function CompleteProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const user = session?.user;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id || user.needsProfileSetup) return;
    router.replace(user.role === 'ADMIN' || user.username === 'adminUAnursing' ? '/admin' : '/dashboard');
  }, [router, user]);

  async function completeProfile(event) {
    event.preventDefault();
    if (saving) return;
    const details = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/auth/complete-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save your account.');
      window.location.replace('/dashboard');
    } catch (error) {
      setError(error.message);
      setSaving(false);
    }
  }

  if (!user?.needsProfileSetup) return <p role="status">Opening your account…</p>;

  return (
    <section className="glass-panel" aria-labelledby="setup-title" style={{ width: '100%', maxWidth: 480, margin: '1rem auto' }}>
      <h1 id="setup-title" style={{ marginBottom: '0.4rem', fontSize: '1.45rem' }}>Complete your account</h1>
      <p className="subtitle">Add your student details and create a username and password for your next sign-in.</p>
      <p style={{ fontSize: '0.85rem', overflowWrap: 'anywhere' }}>{user.email}</p>

      <form onSubmit={completeProfile} style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
        <div className="settings-input-group">
          <label className="settings-label" htmlFor="setup-name">Full name</label>
          <input id="setup-name" name="name" className="settings-input" defaultValue={user.name ?? ''} autoComplete="name" maxLength={120} required />
        </div>
        <div className="settings-input-group">
          <label className="settings-label" htmlFor="setup-year">Year level</label>
          <select id="setup-year" name="yearLevel" className="settings-input" defaultValue="" required>
            <option value="" disabled>Select your year level</option>
            {STUDENT_YEAR_LEVELS.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="settings-input-group">
          <label className="settings-label" htmlFor="setup-username">Username</label>
          <input id="setup-username" name="username" className="settings-input" defaultValue={user.username ?? ''} autoComplete="username" autoCapitalize="none" minLength={3} maxLength={30} required />
        </div>
        <div className="settings-input-group">
          <label className="settings-label" htmlFor="setup-password">Password</label>
          <input id="setup-password" name="password" type="password" className="settings-input" autoComplete="new-password" minLength={6} required />
        </div>
        {error && <p role="alert" className="account-verification-warning">{error}</p>}
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save and continue'}</button>
        <button type="button" className="btn-secondary" disabled={saving} onClick={() => logoutAccount()}>Sign out</button>
      </form>
    </section>
  );
}

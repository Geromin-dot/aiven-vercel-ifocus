"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import IFocusLogo from './IFocusLogo';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.username === 'adminUAnursing';



  // Intercept navigation if there are unsaved settings changes
  const handleNavClick = (e, targetHref) => {
    if (pathname === targetHref) return true;
    if (typeof window !== 'undefined' && window.__ifocusHasUnsavedChanges) {
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.__ifocusOnAttemptedNav === 'function') {
        window.__ifocusOnAttemptedNav(targetHref);
      }
      return false;
    }
    return true;
  };


  const userStatus = session?.user?.status;
  const userStatusReason = session?.user?.statusReason;

  const handleSignOutAndClear = (e) => {
    if (e && !handleNavClick(e, 'SIGNOUT')) return;
    try {
      const keys = [
        'ifocus_active_breakgate_deck',
        'ifocus_current_user_id',
        'ifocus_session_history',
        'ifocus_focus_stats',
        'ifocus_latest_telemetry',
        'ifocus_ai_adjusted_active',
        'ifocus_ai_adjusted_details',
        'ifocus_applied_toast',
        'ifocus_timer_state',
        'ifocus_custom_timer',
        'ifocus_prefill_reflection',
      ];
      keys.forEach((k) => localStorage.removeItem(k));
      window.dispatchEvent(new CustomEvent('ifocus_breakgate_deck_changed', { detail: { active: false, deck: null } }));
    } catch (err) {}
    signOut({ callbackUrl: '/login' });
  };

  // Detect Account Switching on same browser and purge previous student's cache
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      try {
        const storedUserId = localStorage.getItem('ifocus_current_user_id');
        if (storedUserId && storedUserId !== session.user.id) {
          const keys = [
            'ifocus_active_breakgate_deck',
            'ifocus_session_history',
            'ifocus_focus_stats',
            'ifocus_latest_telemetry',
            'ifocus_ai_adjusted_active',
            'ifocus_ai_adjusted_details',
            'ifocus_applied_toast',
            'ifocus_timer_state',
            'ifocus_custom_timer',
            'ifocus_prefill_reflection',
          ];
          keys.forEach((k) => localStorage.removeItem(k));
          window.dispatchEvent(new CustomEvent('ifocus_breakgate_deck_changed', { detail: { active: false, deck: null } }));
        }
        localStorage.setItem('ifocus_current_user_id', session.user.id);
      } catch (err) {}
    }
  }, [status, session?.user?.id]);

  // Strict Role Redirection & Dean Account On-Hold Enforcement
  useEffect(() => {
    if (status === 'authenticated') {
      if (!isAdmin && (userStatus === 'ON_HOLD' || userStatus === 'BANNED')) {
        const reason = userStatusReason || 'Academic Integrity Review - In-person clearance with College Dean required';
        try {
          localStorage.removeItem('ifocus_active_breakgate_deck');
        } catch (e) {}
        signOut({ redirect: false }).then(() => {
          router.replace(`/login?error=ACCOUNT_ON_HOLD&reason=${encodeURIComponent(reason)}`);
        });
        return;
      }

      if (isAdmin && pathname !== '/admin') {
        router.replace('/admin');
      } else if (!isAdmin && pathname.startsWith('/admin')) {
        router.replace('/dashboard');
      }
    }
  }, [status, isAdmin, userStatus, userStatusReason, pathname, router]);

  if (pathname === '/' || pathname === '/login') return null;

  // Dedicated Admin Sidebar (Zero Student Features)
  if (isAdmin) {
    return (
      <>
        {/* Mobile Top Header for Admin */}
        <div className="mobile-top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IFocusLogo size={28} />
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              iFocus <span style={{ fontSize: '0.65rem', background: 'rgba(95, 143, 94, 0.15)', color: 'var(--primary-accent)', padding: '2px 6px', borderRadius: '6px' }}>ADMIN</span>
            </span>
          </div>
          <button
            onClick={handleSignOutAndClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--error)',
              fontWeight: 600,
              fontSize: '0.82rem',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>

        <header className="modern-sidebar">
          <div className="sidebar-header-box">
            <div className="sidebar-brand">
              <IFocusLogo size={40} />
              <div className="sidebar-brand-text">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h1 className="brand-title">
                    <span className="brand-accent">i</span>Focus
                  </h1>
                  <span className="brand-badge-admin">ADMIN</span>
                </div>
                <span className="sidebar-subtitle">Academic Monitoring</span>
              </div>
            </div>
          </div>

          <div className="nav-section-title">ADMINISTRATION</div>
          <nav className="nav-links">
            <Link href="/admin" className={pathname === '/admin' ? 'active' : ''}>
              <span>Academic Overview</span>
              {pathname === '/admin' && <span className="nav-indicator-dot" />}
            </Link>
          </nav>

          <div className="sidebar-middle-widget">
            <div className="widget-status-badge">
              <span className="pulse-dot green" />
              <span>Monitoring Cohort</span>
            </div>
            <p className="widget-text">
              Real-time student BreakGate compliance and deck inspection.
            </p>
          </div>

          <div className="sidebar-bottom-area">
            <div className="sidebar-profile-card">
              <div className="sidebar-profile-header">
                <div className="user-avatar-initials admin">D</div>
                <div className="user-text-details">
                  <span className="user-display-name">Dean / Nursing Admin</span>
                  <span className="user-subtext">UA College of Nursing</span>
                </div>
              </div>
              <button 
                onClick={handleSignOutAndClear}
                className="sidebar-signout-btn"
                title="Sign Out of Admin Console"
                aria-label="Sign Out"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </header>

        {/* Mobile Bottom Bar for Admin */}
        <nav className="mobile-bottom-nav">
          <Link href="/admin" className="mobile-tab-item active">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span>Overview</span>
          </Link>
          <button 
            onClick={handleSignOutAndClear}
            className="mobile-tab-item"
            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span>Sign Out</span>
          </button>
        </nav>
      </>
    );
  }

  // Normal Student View (Desktop Sidebar + Native GCash Mobile Nav)
  return (
    <>
      {/* Mobile Top Header (Frosted Glass with Live Status & Shortcuts) */}
      <div className="mobile-top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="mobile-brand-mark">
            <IFocusLogo size={28} />
            <span style={{ fontWeight: 800, fontSize: '1.22rem', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              <span style={{ color: 'var(--primary-accent)' }}>i</span>Focus
            </span>
          </div>
          <div className="mobile-live-chip">
            <span className="pulse-dot green" />
            <span>BreakGate</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Quick Sign Out Button on Mobile Header */}
          {session && (
            <button 
              type="button"
              onClick={handleSignOutAndClear}
              className="mobile-header-signout-btn"
              title="Sign Out"
              aria-label="Sign Out"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                color: '#dc2626',
                borderRadius: '999px',
                padding: '5px 10px',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.18s ease'
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign Out</span>
            </button>
          )}

          {/* User Avatar linking to Settings */}
          {session && (
            <Link href="/settings" onClick={(e) => handleNavClick(e, '/settings')} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              {session.user.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={session.user.image} 
                  alt="User" 
                  style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary-accent)' }} 
                />
              ) : (
                <div 
                  style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: 'rgba(95, 143, 94, 0.15)', 
                    color: 'var(--primary-accent)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700, 
                    fontSize: '0.85rem' 
                  }}
                >
                  {(session.user.name || session.user.username || 'U')[0].toUpperCase()}
                </div>
              )}
            </Link>
          )}
        </div>
      </div>

      {/* Desktop Sidebar (Minimalist White, Zero Icons on PC) */}
      <header className="modern-sidebar">
        <div className="sidebar-header-box">
          <div className="sidebar-brand">
            <IFocusLogo size={40} />
            <div className="sidebar-brand-text">
              <h1 className="brand-title">
                <span className="brand-accent">i</span>Focus
              </h1>
              <span className="sidebar-subtitle">Smart Study Hub</span>
            </div>
          </div>
        </div>
        
        <div className="nav-section-title">MENU</div>
        <nav className="nav-links">
          <Link href="/dashboard" onClick={(e) => handleNavClick(e, '/dashboard')} className={pathname === '/dashboard' ? 'active' : ''}>
            <span>Home</span>
            {pathname === '/dashboard' && <span className="nav-indicator-dot" />}
          </Link>

          <Link href="/flashcards" onClick={(e) => handleNavClick(e, '/flashcards')} className={pathname === '/flashcards' ? 'active' : ''}>
            <span>Flashcards</span>
            {pathname === '/flashcards' && <span className="nav-indicator-dot" />}
          </Link>

          <Link href="/analytics" onClick={(e) => handleNavClick(e, '/analytics')} className={pathname === '/analytics' ? 'active' : ''}>
            <span>Analytics</span>
            {pathname === '/analytics' && <span className="nav-indicator-dot" />}
          </Link>

          <Link href="/coach" onClick={(e) => handleNavClick(e, '/coach')} className={pathname === '/coach' ? 'active' : ''}>
            <span>AI Coach</span>
            {pathname === '/coach' && <span className="nav-indicator-dot" />}
          </Link>

          <Link href="/settings" onClick={(e) => handleNavClick(e, '/settings')} className={`nav-settings-link ${pathname === '/settings' ? 'active' : ''}`}>
            <span>Settings</span>
            {pathname === '/settings' && <span className="nav-indicator-dot" />}
          </Link>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ifocus_open_guide', { detail: { topic: 'pomodoro' } }));
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.55rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '12px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: 500,
              width: '100%',
              textAlign: 'left',
              marginTop: '0.2rem',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(46, 125, 50, 0.08)';
              e.currentTarget.style.color = '#2e7d32';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Open iFocus Visual Feature Tutorials"
          >
            <span style={{
              width: '18px',
              height: '18px',
              color: '#2e7d32',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
            </span>
            <span>Feature Guide</span>
          </button>
        </nav>



        <div className="sidebar-bottom-area">
          {session ? (
            <div className="sidebar-profile-card">
              <div className="sidebar-profile-header">
                {session.user.image ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img 
                    src={session.user.image} 
                    alt="User Avatar" 
                    className="user-avatar-img"
                  />
                ) : (
                  <div className="user-avatar-initials">
                    {(session.user.name || session.user.username || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="user-text-details">
                  <span className="user-display-name">
                    {session.user.name || session.user.username || 'Student'}
                  </span>
                  <span className="user-subtext">
                    {session.user.role === 'ADMIN' ? 'Administrator' : 'Student / Scholar'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignOutAndClear}
                className="sidebar-signout-btn"
                title="Sign Out of iFocus"
                aria-label="Sign Out"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link 
              href="/login" 
              className="user-signin-btn"
              style={{ 
                textAlign: 'center', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                textDecoration: 'none' 
              }}
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Native Mobile Bottom Navigation (GCash Style: Elevated Center Focus Button) */}
      <nav className="mobile-bottom-nav">
        {/* Tab 1: AI Coach (Replaced duplicate Home since center button is Timer) */}
        <Link 
          href="/coach" 
          onClick={(e) => handleNavClick(e, '/coach')}
          className={`mobile-tab-item ${pathname === '/coach' ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a8 8 0 0 0-8 8c0 3 1.7 5.5 4 6.9V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.1c2.3-1.4 4-3.9 4-6.9a8 8 0 0 0-8-8z"/>
            <path d="M9 10h6M10 14h4"/>
          </svg>
          <span>Coach</span>
        </Link>

        {/* Tab 2: Flashcards */}
        <Link 
          href="/flashcards" 
          onClick={(e) => handleNavClick(e, '/flashcards')}
          className={`mobile-tab-item ${pathname === '/flashcards' ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          <span>Cards</span>
        </Link>

        {/* CENTER GCASH HERO: Elevated Focus Timer Button */}
        <button
          onClick={(e) => {
            if (pathname === '/dashboard') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              if (!handleNavClick(e, '/dashboard')) return;
              router.push('/dashboard');
            }
          }}
          className="mobile-center-gcash-btn"
          title="Go to Focus Timer"
        >
          <div className="gcash-btn-circle">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <span className="gcash-btn-label">Timer</span>
        </button>

        {/* Tab 4: Analytics */}
        <Link 
          href="/analytics" 
          onClick={(e) => handleNavClick(e, '/analytics')}
          className={`mobile-tab-item ${pathname === '/analytics' ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          <span>Stats</span>
        </Link>

        {/* Tab 5: Settings */}
        <Link 
          href="/settings" 
          onClick={(e) => handleNavClick(e, '/settings')}
          className={`mobile-tab-item ${pathname === '/settings' ? 'active' : ''}`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          <span>Settings</span>
        </Link>
      </nav>
    </>
  );
}

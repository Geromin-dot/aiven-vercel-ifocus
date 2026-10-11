"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';
import { useEffect } from 'react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.username === 'adminUAnursing';

  // Strict Role Redirection
  useEffect(() => {
    if (status === 'authenticated') {
      if (isAdmin && pathname !== '/admin') {
        router.replace('/admin');
      } else if (!isAdmin && pathname.startsWith('/admin')) {
        router.replace('/dashboard');
      }
    }
  }, [status, isAdmin, pathname, router]);

  if (pathname === '/') return null;

  // Dedicated Admin Sidebar (Zero Student Features)
  if (isAdmin) {
    return (
      <>
        {/* Mobile Top Header for Admin */}
        <div className="mobile-top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-accent)" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" fill="var(--primary-accent)" />
            </svg>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
              iFocus <span style={{ fontSize: '0.65rem', background: 'rgba(95, 143, 94, 0.15)', color: 'var(--primary-accent)', padding: '2px 6px', borderRadius: '6px' }}>ADMIN</span>
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
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

        <header>
          <div className="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="currentColor" />
              <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h1>
              <span className="logo-accent">i</span>Focus{" "}
              <span style={{ 
                fontSize: '0.72rem', 
                fontWeight: 700, 
                color: 'var(--primary-accent)', 
                background: 'rgba(95, 143, 94, 0.15)', 
                padding: '2px 8px', 
                borderRadius: '8px', 
                marginLeft: '6px',
                letterSpacing: '0.04em'
              }}>
                ADMIN
              </span>
            </h1>
          </div>
          
          <nav className="nav-links">
            <Link href="/admin" className={pathname === '/admin' ? 'active' : ''}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
              <span>Academic Monitoring</span>
            </Link>
          </nav>

          <div className="sidebar-bottom">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
              <div className="sidebar-user-pill" style={{ cursor: 'default' }}>
                <div 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '50%', 
                    background: 'rgba(95, 143, 94, 0.2)', 
                    color: 'var(--primary-accent)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700, 
                    fontSize: '1.1rem',
                    flexShrink: 0 
                  }}
                >
                  D
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ 
                    fontSize: '0.94rem', 
                    fontWeight: 700, 
                    color: 'var(--text-primary)', 
                    whiteSpace: 'nowrap', 
                    textOverflow: 'ellipsis', 
                    overflow: 'hidden' 
                  }}>
                    Dean / Nursing Admin
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary-accent)', fontWeight: 600 }}>
                    UA College of Nursing
                  </span>
                </div>
              </div>

              <button 
                onClick={() => signOut({ callbackUrl: '/' })}
                className="sidebar-action"
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '9px 14px',
                  fontSize: '0.85rem',
                  color: 'var(--error)',
                  border: '1px solid rgba(224, 62, 62, 0.2)',
                  background: 'rgba(224, 62, 62, 0.04)',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </header>
      </>
    );
  }

  // Normal Student Sidebar (Desktop Sidebar + Native Mobile Bottom Bar)
  return (
    <>
      {/* Mobile Top Header */}
      <div className="mobile-top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--primary-accent)" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="4" fill="var(--primary-accent)" />
          </svg>
          <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            <span style={{ color: 'var(--primary-accent)' }}>i</span>Focus
          </span>
        </div>

        {session && (
          <Link href="/settings" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {session.user.image ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={session.user.image} 
                alt="User" 
                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} 
              />
            ) : (
              <div 
                style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  background: 'rgba(95, 143, 94, 0.2)', 
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

      <header>
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <line x1="12" y1="2" x2="12" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="2" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="18" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <h1><span className="logo-accent">i</span>Focus</h1>
        </div>
        
        <nav className="nav-links">
          <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Home</span>
          </Link>

          <Link href="/flashcards" className={pathname === '/flashcards' ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <span>Flashcards</span>
          </Link>

          <Link href="/analytics" className={pathname === '/analytics' ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 20V10M12 20V4M6 20v-6"/>
            </svg>
            <span>Analytics</span>
          </Link>

          <Link href="/coach" className={pathname === '/coach' ? 'active' : ''}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a8 8 0 0 0-8 8c0 3 1.7 5.5 4 6.9V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.1c2.3-1.4 4-3.9 4-6.9a8 8 0 0 0-8-8z"/>
              <path d="M9 10h6M10 14h4"/>
            </svg>
            <span>AI Coach</span>
          </Link>

          {/* Mobile Profile Tab */}
          <Link href="/settings" className={`mobile-settings-nav ${pathname === '/settings' ? 'active' : ''}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            <span>Profile</span>
          </Link>
        </nav>

        <div className="sidebar-bottom">
          {session ? (
            <Link 
              href="/settings" 
              className={`sidebar-user-pill ${pathname === '/settings' ? 'active' : ''}`}
              title="Open Profile & Settings"
            >
              {session.user.image ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img 
                  src={session.user.image} 
                  alt="User Avatar" 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    border: '2px solid var(--primary-accent)',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                  }} 
                />
              ) : (
                <div 
                  style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: '50%', 
                    background: 'rgba(95, 143, 94, 0.2)', 
                    color: 'var(--primary-accent)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    fontWeight: 700, 
                    fontSize: '1.1rem',
                    flexShrink: 0 
                  }}
                >
                  {(session.user.name || session.user.username || 'U')[0].toUpperCase()}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ 
                  fontSize: '1.02rem', 
                  fontWeight: 700, 
                  color: 'var(--text-primary)', 
                  whiteSpace: 'nowrap', 
                  textOverflow: 'ellipsis', 
                  overflow: 'hidden' 
                }}>
                  {session.user.name?.split(' ')[0] || session.user.username || 'User'}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  Settings & Profile
                </span>
              </div>
            </Link>
          ) : (
            <button 
              className="sidebar-action" 
              onClick={() => signIn('google')}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/></svg>
              Sign In
            </button>
          )}
        </div>
      </header>
    </>
  );
}

"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut, signIn } from 'next-auth/react';

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  if (pathname === '/') return null;

  return (
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
        <Link href="/dashboard" className={pathname === '/dashboard' ? 'active' : ''}>Home</Link>
        <Link href="/flashcards" className={pathname === '/flashcards' ? 'active' : ''}>Flashcards</Link>
        <Link href="/analytics" className={pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
        <Link href="/coach" className={pathname === '/coach' ? 'active' : ''}>AI Coach</Link>
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
  );
}

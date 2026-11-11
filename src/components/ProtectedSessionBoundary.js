'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { isProtectedPath } from '@/lib/sessionPaths';
import { clearPrivateCache, logoutAccount } from '@/lib/logoutAccount';

export default function ProtectedSessionBoundary({ children }) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const protectedPage = isProtectedPath(pathname);
  const needsSetup = session?.user?.needsProfileSetup && pathname !== '/complete-profile';
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const mustVerify = useRef(false);
  const logoutStarted = useRef(false);

  useEffect(() => {
    if (!logoutStarted.current && protectedPage && (status === 'unauthenticated' || (status === 'authenticated' && (!session?.user?.id || session.error)))) {
      try { clearPrivateCache(localStorage); } catch {}
      window.location.replace(session?.error === 'ACCOUNT_DELETED' ? '/login?error=ACCOUNT_DELETED' : '/login');
    }
  }, [protectedPage, status, session?.user?.id, session?.error]);

  useEffect(() => {
    if (protectedPage && needsSetup && !signingOut) window.location.replace('/complete-profile');
  }, [protectedPage, needsSetup, signingOut]);

  useEffect(() => {
    let disposed = false;
    let pending = null;
    let controller = null;
    const hide = () => { mustVerify.current = true; document.documentElement.dataset.ifocusAuthPending = 'true'; };
    const verify = () => {
      if (logoutStarted.current) return;
      hide();
      setChecking(true);
      setError('');
      if (pending) return pending;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      pending = (async () => {
        try {
          const response = await fetch('/api/auth/session', {
            cache: 'no-store', credentials: 'same-origin', signal: controller.signal,
          });
          if (!response.ok) throw new Error('Session check failed');
          const current = await response.json();
          if (disposed) return;
          if (!current?.user?.id || current.error) {
            try { clearPrivateCache(localStorage); } catch {}
            window.location.replace(current?.error === 'ACCOUNT_DELETED' ? '/login?error=ACCOUNT_DELETED' : '/login');
            return;
          }
          // A different account/login in another tab needs fresh page state.
          if (current.user.id !== session?.user?.id || current.user.sessionId !== session?.user?.sessionId) {
            window.location.replace(window.location.href);
            return;
          }
          delete document.documentElement.dataset.ifocusAuthPending;
          mustVerify.current = false;
          setChecking(false);
        } catch {
          if (!disposed) setError('Could not verify your session. Reconnect and try again.');
        } finally {
          clearTimeout(timeout);
          pending = null;
        }
      })();
      return pending;
    };
    // Hide private DOM before Chrome takes a history snapshot. Restored pages
    // stay hidden until a fresh server session check succeeds.
    const onPageHide = () => { if (isProtectedPath(window.location.pathname)) hide(); };
    const onPageShow = event => { if (event.persisted && isProtectedPath(window.location.pathname)) verify(); };
    const onHistory = () => { if (isProtectedPath(window.location.pathname)) verify(); };
    const onVisible = () => { if (document.visibilityState === 'visible' && isProtectedPath(window.location.pathname)) verify(); };
    const onLogout = () => { logoutStarted.current = true; hide(); setChecking(true); setSigningOut(true); setError(''); };
    const onLogoutFailure = () => { setError('Sign-out did not finish. Reconnect and try again.'); };
    const onStorage = event => {
      if (event.key !== 'ifocus_auth_event') return;
      try {
        if (JSON.parse(event.newValue || 'null')?.type === 'signout') {
          hide();
          try { clearPrivateCache(localStorage); } catch {}
          window.location.replace('/login');
        } else if (isProtectedPath(window.location.pathname)) verify();
      } catch {}
    };
    const resumeCheck = mustVerify.current && isProtectedPath(window.location.pathname) ? setTimeout(verify, 0) : null;
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', onHistory);
    window.addEventListener('storage', onStorage);
    window.addEventListener('ifocus_logout_started', onLogout);
    window.addEventListener('ifocus_logout_failed', onLogoutFailure);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      clearTimeout(resumeCheck);
      delete document.documentElement.dataset.ifocusAuthPending;
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ifocus_logout_started', onLogout);
      window.removeEventListener('ifocus_logout_failed', onLogoutFailure);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [protectedPage, pathname, session?.user?.id, session?.user?.sessionId]);

  const signedIn = status === 'authenticated' && session?.user?.id && !session.error && !needsSetup;
  // Keep drafts/timers mounted during verification, but hide their private DOM.
  // Actual signout or an unauthenticated session removes the private subtree.
  return <>
    {(!protectedPage || (signedIn && !signingOut)) && (
      <div style={{ width: '100%', minWidth: 0 }} hidden={protectedPage && checking} data-ifocus-private={protectedPage ? 'true' : undefined}
        data-testid={protectedPage ? 'protected-content' : undefined}>{children}</div>
    )}
    {protectedPage && (!signedIn || checking || signingOut) && <div style={{ padding: '3rem', textAlign: 'center' }}>
      <p role="status">{error || (signingOut ? 'Signing out…' : needsSetup ? 'Opening account setup…' : 'Checking your session…')}</p>
      {error && <button className="btn-primary" onClick={() => signingOut ? logoutAccount() : window.location.reload()}>Try Again</button>}
    </div>}
  </>;
}

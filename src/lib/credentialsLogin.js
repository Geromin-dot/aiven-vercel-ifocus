// Uses the installed NextAuth v4 credentials/CSRF endpoints. A full navigation
// after success starts with fresh session state instead of waiting for a second
// session request (which can also return stale state from before the sign-in).
export function createCredentialsLogin(fetchImpl = (...args) => fetch(...args)) {
  let csrfRequest = null;
  let loginRequest = null;

  const prepare = () => {
    if (!csrfRequest) {
      csrfRequest = fetchImpl('/api/auth/csrf', {
        credentials: 'same-origin', cache: 'no-store',
      }).then(async response => {
        if (!response.ok) throw new Error('Could not prepare sign-in. Please try again.');
        const data = await response.json();
        if (!data.csrfToken) throw new Error('Could not prepare sign-in. Please try again.');
        return data.csrfToken;
      }).catch(error => {
        csrfRequest = null;
        throw error;
      });
    }
    return csrfRequest;
  };

  const submit = (email, password) => {
    if (loginRequest) return loginRequest;
    loginRequest = (async () => {
      const csrfToken = await prepare();
      const response = await fetchImpl('/api/auth/callback/credentials', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ email, password, csrfToken, callbackUrl: '/dashboard', json: 'true' }),
      });
      const data = await response.json();
      if (!data.url) throw new Error('Could not complete sign-in. Please try again.');
      const url = new URL(data.url, 'http://localhost');
      const error = url.searchParams.get('error');
      if (error) return { error, ok: false };
      if (url.searchParams.has('csrf') || url.pathname.endsWith('/signin')) {
        csrfRequest = null;
        throw new Error('Your sign-in page expired. Please try again.');
      }
      if (!response.ok || url.pathname !== '/dashboard') {
        throw new Error('Could not complete sign-in. Please try again.');
      }
      return { ok: true, url: '/dashboard' };
    })().finally(() => { loginRequest = null; });
    return loginRequest;
  };
  return { prepare, submit };
}

export const credentialsLogin = createCredentialsLogin();

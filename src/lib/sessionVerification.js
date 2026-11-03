// Each watcher belongs to one signed-in session. Disposing it prevents a late
// response from an older session from stopping the student's new focus session.
export function createSessionVerifier(onConflict, fetchImpl = (...args) => fetch(...args)) {
  const controller = new AbortController();
  let disposed = false;
  let checking = false;
  return {
    async verify() {
      if (disposed || checking) return;
      checking = true;
      try {
        const response = await fetchImpl('/api/auth/active-session', {
          method: 'GET', cache: 'no-store', signal: controller.signal,
          headers: { 'Cache-Control': 'no-cache, no-store' },
        });
        if (disposed) return;
        if (response.status !== 401 && response.status !== 403) return;
        const data = await response.json();
        if (disposed) return;
        if (response.status === 401 && data.conflict) onConflict('CONCURRENT_LOGIN');
        else if (response.status === 403 && data.onHold) onConflict('ACCOUNT_ON_HOLD');
      } catch {
        // An interrupted request or temporary network failure is not a conflict.
      } finally {
        checking = false;
      }
    },
    dispose() {
      disposed = true;
      controller.abort();
    },
  };
}

export default function CoachNotice({ title = 'Coach has noticed something', message, onView, onDismiss, style }) {
  return (
    <aside className="ios-notification-toast" aria-label={title} style={style}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', background: 'rgba(78, 130, 83, 0.12)', display: 'grid', placeItems: 'center', color: 'var(--primary-accent)' }}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" /></svg>
          </span>
          <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-primary)' }}>{title}</h4>
        </div>
        <button type="button" aria-label="Close Coach notice" onClick={onDismiss}
          style={{ background: 'none', border: 0, color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, display: 'grid', placeItems: 'center' }}>
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>
      <p role="status" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0 0 0.85rem', lineHeight: 1.45 }}>{message}</p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" className="btn-primary" onClick={onView}
          style={{ flex: 1, padding: '0.5rem', fontSize: '0.82rem', borderRadius: '9999px', margin: 0, minHeight: 36 }}>
          View Coach Strategy
        </button>
        <button type="button" onClick={onDismiss}
          style={{ background: 'rgba(0,0,0,0.05)', border: 0, borderRadius: '9999px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          Dismiss
        </button>
      </div>
    </aside>
  );
}

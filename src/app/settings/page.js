"use client";

export default function SettingsPage() {
  return (
    <div className="page-layout">
      <div className="settings-grid-layout">
        
        {/* COLUMN 1: PROFILE OVERVIEW */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2.5rem 2rem' }}>
          <div className="avatar-wrapper" style={{ position: 'relative', marginBottom: '1.5rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=c0aede" 
              alt="Avatar" 
              className="profile-avatar" 
              style={{ width: '140px', height: '140px', borderRadius: '50%', border: '4px solid white', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }} 
            />
            <button className="edit-avatar-btn" style={{ position: 'absolute', bottom: '5px', right: '5px', background: 'var(--primary-accent)', color: 'white', border: 'none', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
            </button>
          </div>
          <h3 className="profile-name" style={{ fontSize: '1.8rem', color: 'var(--text-primary)', margin: '0 0 0.5rem 0', fontWeight: 700 }}>Alex Johnson</h3>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 2.5rem 0' }}>Focus Member since 2026</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Total Sessions</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-accent)' }}>124</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Focus Time</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-accent)' }}>42h</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Current Streak</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary-accent)' }}>15 Days</span>
            </div>
          </div>
        </div>

        {/* COLUMN 2: SETTINGS & PREFERENCES */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.6rem', margin: '0 0 0.5rem 0' }}>Profile & Settings</h2>
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '1rem' }}>Customize your focus environment and coach behaviors.</p>
          </div>
          
          <div className="settings-list">
            {/* Item 1 */}
            <div className="settings-item">
              <div className="settings-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
              </div>
              <div className="settings-text">
                <h4>Focus Preferences</h4>
                <p>Timer length, break intervals</p>
              </div>
              <svg className="chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            {/* Item 2 */}
            <div className="settings-item">
              <div className="settings-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
              </div>
              <div className="settings-text">
                <h4>Notifications</h4>
                <p>Reminders, daily summaries</p>
              </div>
              <svg className="chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            {/* Item 3 */}
            <div className="settings-item">
              <div className="settings-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
              </div>
              <div className="settings-text">
                <h4>Privacy & Security</h4>
                <p>Data sharing, local storage</p>
              </div>
              <svg className="chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>

            {/* Item 4 */}
            <div className="settings-item">
              <div className="settings-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <div className="settings-text">
                <h4>Feedback & Support</h4>
                <p>Report bugs, request features</p>
              </div>
              <svg className="chevron" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

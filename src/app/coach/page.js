"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function CoachPage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name || 'anonymous';
  const router = useRouter();

  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    
    // Load insight from localStorage using the namespaced key
    const telemetryKey = `ifocus_telemetry_insight_${userName}`;
    const storedInsight = localStorage.getItem(telemetryKey);
    
    if (storedInsight) {
      try {
        const data = JSON.parse(storedInsight);
        setInsight(data);
      } catch (e) {
        console.error("Error parsing telemetry data", e);
      }
    }
    
    setLoading(false);
  }, [status, userName]);

  const handleReturnHome = () => {
    const telemetryKey = `ifocus_telemetry_insight_${userName}`;
    localStorage.removeItem(telemetryKey);
    router.push('/dashboard');
  };

  if (loading) return null;

  return (
    <>
      <div className="hero-section" style={{ marginBottom: '2rem', textAlign: 'left' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Your AI Study Coach</h2>
        <p className="subtitle" style={{ maxWidth: '800px', margin: 0 }}>
          Simulate a study session to see how the AI provides data-driven interventions and personalized reinforcement based on your focus metrics.
        </p>
      </div>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        {!insight ? (
          <div id="noInsightState" className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: '600px', width: '100%' }}>
            <div className="ai-avatar pulse-animation" style={{ margin: '0 auto 2rem auto', width: '80px', height: '80px' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v2"></path>
                <path d="M12 20v2"></path>
                <path d="M4.93 4.93l1.41 1.41"></path>
                <path d="M17.66 17.66l1.41 1.41"></path>
                <path d="M2 12h2"></path>
                <path d="M20 12h2"></path>
                <path d="M6.34 17.66l-1.41 1.41"></path>
                <path d="M19.07 4.93l-1.41 1.41"></path>
              </svg>
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '1rem' }}>You're in the Zone</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: '450px', margin: '0 auto' }}>
              I am silently observing your session. Keep up the fantastic focus! I will step in if you ever need guidance or a moment to reset.
            </p>
            <button 
              onClick={() => router.push('/dashboard')} 
              className="btn-primary" 
              style={{ display: 'inline-flex', textDecoration: 'none', marginTop: '2.5rem', padding: '0.75rem 2.5rem', width: 'auto' }}
            >
              Return to Command Center
            </button>
          </div>
        ) : (
          <div id="insightState" className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', maxWidth: '600px', width: '100%', borderColor: 'var(--warning)' }}>
            <div className="ai-avatar pulse-animation-warning" style={{ margin: '0 auto 2rem auto', width: '80px', height: '80px', background: 'linear-gradient(135deg, var(--warning), #f59e0b)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
            <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: 'var(--warning)' }}>Coach Intervention</h2>
            <p id="insightReason" style={{ fontSize: '1.2rem', color: 'var(--text-primary)', lineHeight: 1.6, marginBottom: '2rem' }}>
              {insight.reason}
            </p>
            
            {insight.actionPlan && (
              <div style={{ background: 'rgba(95, 143, 94, 0.05)', padding: '1.5rem', borderRadius: 'var(--radius-md)', marginBottom: '2.5rem', border: '1px solid rgba(95, 143, 94, 0.2)' }}>
                <h3 style={{ color: 'var(--primary-accent)', marginBottom: '0.5rem' }}>Action Plan</h3>
                <p id="coachRecommendation" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
                  {insight.actionPlan}
                </p>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                id="returnHomeBtn" 
                onClick={handleReturnHome}
                className="btn-primary" 
                style={{ margin: 0, width: 'auto', padding: '0.75rem 2rem' }}
              >
                Return to Home
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";

import heroImg from "../img/hero.jpg";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("login");
  
  // Shared state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(""); // For register only
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg-default)' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
      </div>
    );
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", { redirect: false, email, password });
      if (res?.error) throw new Error(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, username: name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      const signInRes = await signIn("credentials", { redirect: false, email, password });
      if (signInRes?.error) throw new Error("Login failed after registration");
      
      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-surface)', overflow: 'hidden', zIndex: 100 }}>
      
      {/* LEFT SIDE: Image & Text Overlay */}
      <div style={{ 
        flex: '1.2', 
        position: 'relative'
      }} className="hero-side">
        <div style={{ position: 'absolute', inset: 0 }}>
          <Image 
            src={heroImg} 
            alt="Student studying with iFocus" 
            fill 
            style={{ objectFit: 'cover', objectPosition: 'center' }} 
            priority
          />
          {/* Dark gradient overlay for text readability */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.4) 100%)' }}></div>
        </div>

        <div style={{ position: 'absolute', bottom: '10%', left: '10%', right: '10%', color: 'white', zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
              <circle cx="12" cy="12" r="4" fill="white" />
              <line x1="12" y1="2" x2="12" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="12" y1="18" x2="12" y2="22" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="2" y1="12" x2="6" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <line x1="18" y1="12" x2="22" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: 0, letterSpacing: '-0.5px', color: 'white' }}>iFocus</h1>
          </div>
          <h2 style={{ fontSize: '3.5rem', fontWeight: 600, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-1px', color: 'white' }}>
            Master your time.<br/>Elevate your focus.
          </h2>
          <p style={{ fontSize: '1.25rem', opacity: 0.9, maxWidth: '500px', lineHeight: 1.6, color: 'white' }}>
            The ultimate productivity hub designed for deep work. Organize your tasks, master your flashcards, and let AI coach you to success.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes movingGradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animated-bg-container {
          background: linear-gradient(-45deg, #f7f6f3, #e8f0e8, #f5ecd8, #eef2eb);
          background-size: 400% 400%;
          animation: movingGradient 15s ease infinite;
        }
      `}</style>
      
      {/* RIGHT SIDE: Auth Form */}
      <div className="animated-bg-container" style={{ 
        flex: '1', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '2rem',
        maxWidth: '100%',
        zIndex: 10
      }}>
        <div style={{ 
          width: '100%', 
          maxWidth: '420px', 
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(247, 246, 243, 1) 100%)', 
          padding: '2.5rem 2rem', 
          borderRadius: '24px', 
          boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)',
          border: '1px solid rgba(255, 255, 255, 0.8)'
        }}>
          
          {/* Header & Indicator */}
          <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              {activeTab === "login" ? "Welcome back" : "Create Account"}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: '1.5rem' }}>
              {activeTab === "login" ? "Please enter your details to sign in." : "Start your productivity journey."}
            </p>
            
            {/* Animated Dot Indicator */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ 
                height: '6px', 
                width: activeTab === 'login' ? '24px' : '8px', 
                background: activeTab === 'login' ? 'var(--primary-accent)' : 'var(--glass-border)', 
                borderRadius: '4px', 
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
              }} />
              <div style={{ 
                height: '6px', 
                width: activeTab === 'register' ? '24px' : '8px', 
                background: activeTab === 'register' ? 'var(--primary-accent)' : 'var(--glass-border)', 
                borderRadius: '4px', 
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
              }} />
            </div>
          </div>

          {/* Toggle Buttons */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)' }}>
            <button 
              onClick={() => { setActiveTab("login"); setError(""); }}
              style={{ 
                padding: '0.75rem 0', 
                border: 'none', 
                background: 'transparent',
                color: activeTab === "login" ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === "login" ? 600 : 500,
                borderBottom: activeTab === "login" ? '2px solid var(--primary-accent)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              Sign In
            </button>
            <button 
              onClick={() => { setActiveTab("register"); setError(""); }}
              style={{ 
                padding: '0.75rem 0', 
                border: 'none', 
                background: 'transparent',
                color: activeTab === "register" ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === "register" ? 600 : 500,
                borderBottom: activeTab === "register" ? '2px solid var(--primary-accent)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'all 0.2s ease'
              }}
            >
              Register
            </button>
          </div>

          {error && (
            <div style={{ background: 'rgba(224, 62, 62, 0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(224, 62, 62, 0.2)' }}>
              {error}
            </div>
          )}

          {/* Sliding Container */}
          <div style={{ overflow: 'hidden', width: '100%', marginBottom: '1.5rem' }}>
            <div style={{ 
              display: 'flex', 
              width: '200%', 
              transform: activeTab === 'login' ? 'translateX(0)' : 'translateX(-50%)',
              transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              alignItems: 'flex-start'
            }}>
              
              {/* Login Form Panel */}
              <div style={{ width: '50%', paddingRight: '0.5rem', flexShrink: 0 }}>
                <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Username or Email</label>
                    <input 
                      type="text" 
                      placeholder="Enter your username or email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem', transition: 'border-color 0.2s ease' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                      required={activeTab === "login"}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                      <button 
                        type="button" 
                        onClick={() => alert("Password reset functionality coming soon!")}
                        style={{ background: 'none', border: 'none', color: 'var(--primary-accent)', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem', transition: 'border-color 0.2s ease' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                      required={activeTab === "login"}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="animated-gradient-btn"
                  >
                    {loading ? "Signing in..." : "Sign In"}
                  </button>
                </form>
              </div>

              {/* Register Form Panel */}
              <div style={{ width: '50%', paddingLeft: '0.5rem', flexShrink: 0 }}>
                <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Username</label>
                    <input 
                      type="text" 
                      placeholder="Choose a username" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem', transition: 'border-color 0.2s ease' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                      required={activeTab === "register"}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
                    <input 
                      type="email" 
                      placeholder="Enter your email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem', transition: 'border-color 0.2s ease' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                      required={activeTab === "register"}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
                    <input 
                      type="password" 
                      placeholder="••••••••" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem', transition: 'border-color 0.2s ease' }}
                      onFocus={(e) => e.target.style.borderColor = 'var(--primary-accent)'}
                      onBlur={(e) => e.target.style.borderColor = 'var(--glass-border)'}
                      required={activeTab === "register"}
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="animated-gradient-btn"
                  >
                    {loading ? "Creating account..." : "Create Account"}
                  </button>
                </form>
              </div>

            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'var(--text-secondary)' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
            <span style={{ padding: '0 1rem', fontSize: '0.85rem', fontWeight: 500 }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          </div>

          <button 
            onClick={() => signIn("google", { callbackUrl: '/dashboard' })}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '0.75rem', 
              padding: '0.85rem', 
              width: '100%', 
              border: '1px solid var(--glass-border)', 
              borderRadius: '8px', 
              background: 'var(--bg-surface)', 
              color: 'var(--text-primary)', 
              fontSize: '1rem', 
              fontWeight: 500, 
              cursor: 'pointer', 
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'var(--bg-default)'; e.currentTarget.style.borderColor = 'var(--text-secondary)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hero-side { display: none; }
        @media (min-width: 768px) {
          .hero-side { display: block !important; }
        }

        @keyframes bgPan {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animated-gradient-btn {
          margin-top: 1rem;
          padding: 0.85rem;
          border-radius: 8px;
          border: none;
          color: white;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          background: linear-gradient(270deg, var(--primary-accent), var(--secondary-accent), var(--primary-accent));
          background-size: 200% 200%;
          animation: bgPan 4s ease infinite;
          box-shadow: 0 4px 14px rgba(95, 143, 94, 0.4);
          transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
        }

        .animated-gradient-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(95, 143, 94, 0.5);
        }

        .animated-gradient-btn:active {
          transform: translateY(0);
        }

        .animated-gradient-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          animation: none;
          transform: none;
        }
      `}} />
    </div>
  );
}

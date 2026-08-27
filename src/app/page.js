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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (activeTab === "register") {
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
      } else {
        const res = await signIn("credentials", { redirect: false, email, password });
        if (res?.error) throw new Error(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
        router.push("/dashboard");
      }
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

      {/* RIGHT SIDE: Auth Form */}
      <div style={{ 
        flex: '1', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        padding: '2rem',
        background: 'var(--bg-surface)',
        maxWidth: '100%',
        zIndex: 10
      }}>
        <div style={{ width: '100%', maxWidth: '380px' }}>
          
          <div style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '2rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Welcome back</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Please enter your details to sign in.</p>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', borderBottom: '1px solid var(--glass-border)' }}>
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

          <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            
            {activeTab === "register" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Username</label>
                <input 
                  type="text" 
                  placeholder="Choose a username" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem' }}
                  required
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{activeTab === "login" ? "Username or Email" : "Email"}</label>
              <input 
                type="text" 
                placeholder={activeTab === "login" ? "Enter your username or email" : "Enter your email"} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem' }}
                required
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '1rem' }}
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                marginTop: '1rem', 
                padding: '0.85rem', 
                borderRadius: '8px', 
                background: 'var(--primary-accent)', 
                color: 'white', 
                border: 'none', 
                fontWeight: 600, 
                fontSize: '1rem', 
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 4px 14px rgba(118, 172, 126, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? "Please wait..." : (activeTab === "login" ? "Sign In" : "Create Account")}
            </button>
          </form>

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
              background: 'transparent', 
              color: 'var(--text-primary)', 
              fontSize: '1rem', 
              fontWeight: 500, 
              cursor: 'pointer', 
              transition: 'all 0.2s ease' 
            }}
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
      `}} />
    </div>
  );
}

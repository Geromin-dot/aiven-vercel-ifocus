"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
      <div className="page-layout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
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
        // Register flow
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Registration failed");
        }

        // Auto-login after registration
        const signInRes = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });

        if (signInRes?.error) {
          throw new Error("Login failed after registration");
        }
        
        router.push("/dashboard");
      } else {
        // Login flow
        const res = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });

        if (res?.error) {
          throw new Error(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
        }

        router.push("/dashboard");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-layout" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90vh' }}>
      <div className="glass-panel" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem 2rem' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '0.5rem' }}>Welcome to iFocus</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>Your personal study and productivity hub.</p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: '12px', padding: '0.25rem', marginBottom: '1.5rem' }}>
          <button 
            onClick={() => { setActiveTab("login"); setError(""); }}
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              border: 'none', 
              borderRadius: '8px', 
              background: activeTab === "login" ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === "login" ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === "login" ? 600 : 500,
              boxShadow: activeTab === "login" ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Sign In
          </button>
          <button 
            onClick={() => { setActiveTab("register"); setError(""); }}
            style={{ 
              flex: 1, 
              padding: '0.75rem', 
              border: 'none', 
              borderRadius: '8px', 
              background: activeTab === "register" ? 'var(--bg-surface)' : 'transparent',
              color: activeTab === "register" ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: activeTab === "register" ? 600 : 500,
              boxShadow: activeTab === "register" ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
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

        <form onSubmit={handleCredentialsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
          
          {activeTab === "register" && (
            <input 
              type="text" 
              placeholder="Full Name" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none' }}
              required
            />
          )}

          <input 
            type="email" 
            placeholder="Email Address" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none' }}
            required
          />
          
          <input 
            type="password" 
            placeholder="Password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', outline: 'none' }}
            required
          />

          <button 
            type="submit" 
            className="btn-primary" 
            disabled={loading}
            style={{ marginTop: '0.5rem', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? "Please wait..." : (activeTab === "login" ? "Sign In" : "Create Account")}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', margin: '1.5rem 0', color: 'var(--text-secondary)' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
          <span style={{ padding: '0 1rem', fontSize: '0.85rem' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--glass-border)' }}></div>
        </div>

        <button 
          onClick={() => signIn("google", { callbackUrl: '/dashboard' })}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '0.85rem', width: '100%', border: 'none', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

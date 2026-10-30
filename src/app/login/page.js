"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef, Suspense } from "react";
import Link from "next/link";
import IFocusLogo from "@/components/IFocusLogo";

const YEAR_LEVEL_OPTIONS = [
  { value: "1st Year", label: "1st Year (Level I)" },
  { value: "2nd Year", label: "2nd Year (Level II)" },
  { value: "3rd Year", label: "3rd Year (Level III)" },
  { value: "4th Year", label: "4th Year (Level IV)" },
];

function LoginContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "register" ? "register" : "login";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Register form state (starts completely blank with zero browser autofill link)
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regYearLevel, setRegYearLevel] = useState("1st Year");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [holdNotice, setHoldNotice] = useState({ active: false, reason: "" });
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false);
  const yearDropdownRef = useRef(null);

  const handleSwitchTab = (tab) => {
    setActiveTab(tab);
    setError("");
    setIsYearDropdownOpen(false);
    if (tab === "register") {
      setRegName("");
      setRegUsername("");
      setRegYearLevel("1st Year");
      setRegEmail("");
      setRegPassword("");
    }
  };
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setIsYearDropdownOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsYearDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);


  useEffect(() => {
    if (searchParams.get("tab") === "register") {
      setActiveTab("register");
    } else if (searchParams.get("tab") === "login") {
      setActiveTab("login");
    }

    const err = searchParams.get("error");
    const rsn = searchParams.get("reason");
    if (err === "ACCOUNT_ON_HOLD") {
      setHoldNotice({
        active: true,
        reason: rsn ? decodeURIComponent(rsn) : "Academic Integrity Review - In-person clearance with College Dean required"
      });
    } else if (err === "CONCURRENT_SESSION") {
      setError("Session Expired: You were logged out because this account was accessed on another device.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.role === "ADMIN" || session?.user?.username === "adminUAnursing") {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  if (status === "loading") {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <IFocusLogo size={36} />
          <span style={{ color: '#27522d', fontWeight: 600, fontSize: '1rem', letterSpacing: '-0.01em' }}>Loading iFocus...</span>
        </div>
      </div>
    );
  }

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const trimmedIdentifier = loginIdentifier.trim();
      const res = await signIn("credentials", { redirect: false, email: trimmedIdentifier, password: loginPassword });
      if (res?.error) {
        if (res.error.startsWith("ACCOUNT_ON_HOLD:") || res.error === "ACCOUNT_ON_HOLD") {
          const reasonText = res.error.replace("ACCOUNT_ON_HOLD:", "").trim();
          setHoldNotice({
            active: true,
            reason: reasonText || "Academic Integrity Review - In-person clearance with College Dean required"
          });
          return;
        }
        throw new Error(res.error === "CredentialsSignin" ? "Invalid email or password" : res.error);
      }
      try {
        const keys = [
          'ifocus_active_breakgate_deck',
          'ifocus_current_user_id',
          'ifocus_session_history',
          'ifocus_focus_stats',
          'ifocus_latest_telemetry',
          'ifocus_ai_adjusted_active',
          'ifocus_ai_adjusted_details',
          'ifocus_applied_toast',
          'ifocus_timer_state',
          'ifocus_custom_timer',
          'ifocus_prefill_reflection',
        ];
        keys.forEach((k) => localStorage.removeItem(k));
      } catch (e) { }

      if (trimmedIdentifier.toLowerCase().includes("adminuanursing")) {
        router.replace("/admin");
      } else {
        router.replace("/dashboard");
      }
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
      const cleanName = regName.trim();
      const cleanUsername = regUsername.trim();
      const cleanEmail = regEmail.trim();
      const cleanPassword = regPassword;
      const cleanYearLevel = regYearLevel.trim();

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          username: cleanUsername,
          email: cleanEmail,
          password: cleanPassword,
          yearLevel: cleanYearLevel,
          section: "",
          yearSection: cleanYearLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");

      const signInRes = await signIn("credentials", { redirect: false, email: cleanEmail, password: cleanPassword });
      if (signInRes?.error) throw new Error("Login failed after registration");

      router.push("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page-root login-root-container"
      style={{
        position: 'relative',
        minHeight: '100vh',
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        background: `
          radial-gradient(1200px 600px at 50% -30px, rgba(39, 82, 45, 0.09) 0%, rgba(187, 247, 208, 0.16) 35%, rgba(240, 253, 244, 0.05) 65%, transparent 85%),
          radial-gradient(800px 450px at 10% 120px, rgba(95, 143, 94, 0.06) 0%, transparent 60%),
          radial-gradient(800px 450px at 90% 150px, rgba(39, 82, 45, 0.06) 0%, transparent 60%),
          #ffffff
        `,
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: '#0f172a',
        boxSizing: 'border-box'
      }}
    >
      <style>{`
        /* Responsive tweaks on mobile */
        @media (max-width: 640px) {
          .login-header-bar {
            padding: 1rem 1.25rem !important;
          }
          .login-center-stage {
            padding: 4.5rem 1rem 1.5rem 1rem !important;
          }
          .auth-card-panel {
            padding: 1.5rem 1.25rem 1.35rem 1.25rem !important;
            border-radius: 16px !important;
            box-shadow: 0 10px 25px -5px rgba(39, 82, 45, 0.1) !important;
          }
        }

        /* Ambient Landing Page Dot Mesh */
        .login-grid-mesh {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(71, 85, 105, 0.16) 1.1px, transparent 1.1px);
          background-size: 24px 24px;
          pointer-events: none;
          z-index: 0;
        }

        .header-brand-lockup {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          transition: opacity 0.2s ease;
        }
        .header-brand-lockup:hover {
          opacity: 0.85;
        }
        .header-brand-name {
          font-size: 1.35rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.035em;
          line-height: 1;
        }
        .header-brand-accent {
          color: #27522d;
        }

        .back-home-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 15px;
          border-radius: 9999px;
          background: #ffffff;
          border: 1px solid #d1d5db;
          color: #334155;
          font-size: 0.86rem;
          font-weight: 600;
          text-decoration: none;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .back-home-pill:hover {
          background: #f8fafc;
          border-color: #27522d;
          color: #0f172a;
          transform: translateX(-2px);
          box-shadow: 0 4px 12px rgba(39, 82, 45, 0.1);
        }

        /* System Pill from Landing Page */
        .system-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          background-color: #eaf5ea;
          border: 1px solid #c2e2c2;
          color: #1b4324;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        @keyframes pulseIndicator {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.2);
          }
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background-color: #16a34a;
          box-shadow: 0 0 8px rgba(22, 163, 74, 0.6);
          animation: pulseIndicator 2s infinite ease-in-out;
          display: inline-block;
          flex-shrink: 0;
        }

        /* Subtle Glow Behind Card */
        .card-ambient-glow {
          position: absolute;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(39, 82, 45, 0.09) 0%, rgba(187, 247, 208, 0.14) 40%, transparent 70%);
          pointer-events: none;
          z-index: -1;
        }

        /* Auth Card - Sleek, spacious and comfortably proportioned */
        .auth-card-panel {
          width: 100%;
          max-width: 430px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 1.75rem 2rem 1.6rem 2rem;
          box-shadow: 0 20px 50px -10px rgba(39, 82, 45, 0.12), 0 4px 16px rgba(0, 0, 0, 0.03);
          box-sizing: border-box;
          position: relative;
        }

        .auth-header-wrapper {
          text-align: center;
          margin-bottom: 1.05rem;
        }

        .auth-title {
          font-size: 1.45rem;
          font-weight: 800;
          letter-spacing: -0.025em;
          color: #0f172a;
          margin: 0 0 3px 0;
        }

        .auth-subtitle {
          font-size: 0.82rem;
          color: #64748b;
          margin: 0;
          line-height: 1.4;
        }

        /* Segmented Tab Switcher */
        .auth-tab-switcher {
          display: flex;
          background: #f1f5f9;
          padding: 3.5px;
          border-radius: 12px;
          margin-bottom: 1rem;
          border: 1px solid #e2e8f0;
        }

        .tab-btn {
          flex: 1;
          padding: 7px 0;
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 9px;
          border: none;
          background: transparent;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .tab-btn.active {
          background: #ffffff;
          color: #0f172a;
          font-weight: 700;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        /* Form Inputs */
        .auth-form-body {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 3.5px;
        }

        .input-label {
          font-size: 0.79rem;
          font-weight: 600;
          color: #334155;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .forgot-password-link {
          font-size: 0.78rem;
          color: #27522d;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s ease;
          margin: 0;
        }
        .forgot-password-link:hover {
          color: #1e3f23;
          text-decoration: underline;
        }

        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .styled-input {
          width: 100%;
          padding: 9px 13px;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 9px;
          font-size: 0.86rem;
          color: #0f172a;
          outline: none;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .styled-input.has-action {
          padding-right: 42px;
        }
        .styled-input:-webkit-autofill,
        .styled-input:-webkit-autofill:hover,
        .styled-input:-webkit-autofill:focus,
        .styled-input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #f8fafc inset !important;
          -webkit-text-fill-color: #0f172a !important;
          transition: background-color 5000s ease-in-out 0s;
        }

        @keyframes authFormFade {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .auth-form-body {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          animation: authFormFade 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .styled-input:focus {
          background: #ffffff;
          border-color: #27522d;
          box-shadow: 0 0 0 3px rgba(39, 82, 45, 0.12);
        }
        .styled-input::placeholder {
          color: #94a3b8;
        }

        .password-toggle-btn {
          position: absolute;
          right: 10px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.15s ease;
        }
        .password-toggle-btn:hover {
          color: #0f172a;
        }

        /* Error Alert */
        .auth-error-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 9px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 0.8rem;
          font-weight: 500;
          margin-bottom: 0.75rem;
        }

        /* Submit Button */
        .submit-action-btn {
          width: 100%;
          padding: 10.5px;
          border-radius: 9px;
          background: #27522d;
          color: #ffffff;
          font-size: 0.88rem;
          font-weight: 600;
          border: 1px solid #1e3f23;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(39, 82, 45, 0.22);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 2px;
        }
        .submit-action-btn:hover:not(:disabled) {
          background: #1e3f23;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(39, 82, 45, 0.32);
        }
        .submit-action-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .submit-action-btn:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        /* Social Divider */
        .social-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0.85rem 0 0.75rem 0;
        }
        .divider-line {
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }
        .divider-text {
          font-size: 0.72rem;
          font-weight: 700;
          color: #94a3b8;
          letter-spacing: 0.06em;
        }

        /* Google Sign In */
        .google-signin-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 9.5px;
          border-radius: 9px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          color: #1e293b;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
        }
        .google-signin-btn:hover {
          background: #f8fafc;
          border-color: #94a3b8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
        }
      `}</style>

      {/* Atmospheric Dot Mesh */}
      <div className="login-grid-mesh" />

      {/* Top Header - Absolutely Positioned Edge-to-Edge */}
      <header
        className="login-header-bar"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          width: '100%',
          padding: '1.25rem 2.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          zIndex: 20
        }}
      >
        <Link href="/" className="header-brand-lockup">
          <IFocusLogo size={36} />
          <span className="header-brand-name">
            <span className="header-brand-accent">i</span>Focus
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" className="back-home-pill">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Home
          </Link>
        </div>
      </header>

      {/* Center Stage */}
      <div
        className="login-center-stage"
        style={{
          flex: 1,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4rem 1.25rem 3rem 1.25rem',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 1
        }}
      >
        <div className="card-ambient-glow" />

        <div className="auth-card-panel">

          {/* Header - Crisp Pure Vector SVG (size 48) with zero raster artifacts or box borders */}
          <div className="auth-header-wrapper">
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '14px' }}>
              <IFocusLogo size={48} />
            </div>
            <h1 className="auth-title">
              {activeTab === "login" ? "Welcome back" : "Create an account"}
            </h1>
            <p className="auth-subtitle">
              {activeTab === "login"
                ? "Enter your credentials to access your study space."
                : "Get started with BreakGate™ and active recall flashcards."}
            </p>
          </div>

          {/* Segmented Switcher with Gliding Pill Indicator */}
          <div className="auth-tab-switcher" style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                top: '4px',
                bottom: '4px',
                left: activeTab === 'login' ? '4px' : 'calc(50% + 2px)',
                width: 'calc(50% - 6px)',
                backgroundColor: '#ffffff',
                borderRadius: '9px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                transition: 'left 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
                zIndex: 1,
                pointerEvents: 'none'
              }}
            />
            <button
              type="button"
              onClick={() => handleSwitchTab("login")}
              className="tab-btn"
              style={{
                position: 'relative',
                zIndex: 2,
                color: activeTab === 'login' ? '#0f172a' : '#64748b',
                fontWeight: activeTab === 'login' ? 700 : 600,
                transition: 'color 0.2s ease',
                background: 'transparent',
                boxShadow: 'none'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab("register")}
              className="tab-btn"
              style={{
                position: 'relative',
                zIndex: 2,
                color: activeTab === 'register' ? '#0f172a' : '#64748b',
                fontWeight: activeTab === 'register' ? 700 : 600,
                transition: 'color 0.2s ease',
                background: 'transparent',
                boxShadow: 'none'
              }}
            >
              Register
            </button>
          </div>

          {/* Error Banner */}
          {/* Institutional On-Hold / Suspension Notice from Academic Dean */}
          {holdNotice.active && (
            <div style={{
              background: '#fffbeb',
              border: '1.5px solid #f59e0b',
              borderRadius: '14px',
              padding: '1rem 1.15rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.12)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309', fontWeight: 800, fontSize: '0.92rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span>Account Access Placed On Hold</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.82rem', color: '#78350f', lineHeight: 1.5 }}>
                Your iFocus student account has been placed on temporary hold by the Academic Dean.
              </p>
              <div style={{
                background: 'rgba(245, 158, 11, 0.12)',
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                color: '#92400e',
                fontWeight: 600
              }}>
                <strong>Dean's Note:</strong> {holdNotice.reason}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#78350f', marginTop: '0.2rem', fontWeight: 600 }}>
                <strong>Action Required:</strong> Please visit the <em>College of Nursing Dean's Office</em> in person for verification and academic clearance.
              </div>
            </div>
          )}

          {error && (
            <div className="auth-error-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Independent Forms for Login & Registration (Prevents Browser Autofill Cross-Contamination) */}
          {activeTab === 'login' ? (
            <form
              key="login-form"
              onSubmit={handleLoginSubmit}
              autoComplete="on"
              className="auth-form-body"
            >
              {/* Login Email / Username Field */}
              <div className="form-group">
                <label className="input-label" htmlFor="login-identifier">
                  Username or Email
                </label>
                <div className="input-wrapper">
                  <input
                    id="login-identifier"
                    name="login_identifier"
                    type="text"
                    required
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    placeholder="e.g. gerox or student@ua.edu.ph"
                    className="styled-input"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Login Password Field */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '2px' }}>
                  <label className="input-label" htmlFor="login-password">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="forgot-password-link"
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="input-wrapper">
                  <input
                    id="login-password"
                    name="login_password"
                    type={showLoginPassword ? "text" : "password"}
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="styled-input has-action"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="password-toggle-btn"
                    title={showLoginPassword ? "Hide password" : "Show password"}
                  >
                    {showLoginPassword ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Login Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="submit-action-btn"
              >
                {loading ? (
                  <span className="spinner-text">Authenticating...</span>
                ) : (
                  <span>Sign In to Dashboard</span>
                )}
              </button>

              {/* Quick Fill Student Testing Account (For Evaluation & Defense) */}
              <button
                type="button"
                onClick={() => {
                  setLoginIdentifier("student_tester");
                  setLoginPassword("student123");
                }}
                style={{
                  width: "100%",
                  marginTop: "10px",
                  padding: "9px 12px",
                  background: "rgba(59, 130, 246, 0.08)",
                  border: "1px dashed rgba(59, 130, 246, 0.35)",
                  borderRadius: "10px",
                  color: "#1d4ed8",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
                title="Auto-fill credentials for the Student Evaluation Account"
              >
                <span>Fill Testing Account (student_tester)</span>
              </button>
            </form>
          ) : (
            <form
              key="register-form"
              onSubmit={handleRegisterSubmit}
              autoComplete="off"
              className="auth-form-body"
            >
              {/* Full Name Field (Academic Record) */}
              <div className="form-group">
                <label className="input-label" htmlFor="reg-fullname">
                  Full Name (Academic Record)
                </label>
                <div className="input-wrapper">
                  <input
                    id="reg-fullname"
                    name="reg_student_fullname"
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder="e.g. Maria Clara Santos"
                    className="styled-input"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Username Field */}
              <div className="form-group">
                <label className="input-label" htmlFor="reg-username">
                  Username
                </label>
                <div className="input-wrapper">
                  <input
                    id="reg-username"
                    name="reg_student_username"
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''))}
                    placeholder="e.g. mariaclara"
                    className="styled-input"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck="false"
                    data-lpignore="true"
                  />
                </div>
              </div>

              {/* Year Level (Academic Record) */}
              <div className="form-group" ref={yearDropdownRef} style={{ position: 'relative' }}>
                <label className="input-label" id="reg-year-label">
                  Year Level
                </label>
                <input type="hidden" name="reg_student_year" value={regYearLevel} />
                <button
                  type="button"
                  id="reg-year"
                  aria-haspopup="listbox"
                  aria-expanded={isYearDropdownOpen}
                  aria-labelledby="reg-year-label"
                  onClick={() => setIsYearDropdownOpen((prev) => !prev)}
                  className="styled-input"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isYearDropdownOpen ? '#ffffff' : '#f8fafc',
                    borderColor: isYearDropdownOpen ? '#27522d' : '#cbd5e1',
                    boxShadow: isYearDropdownOpen ? '0 0 0 3px rgba(39, 82, 45, 0.12)' : 'none',
                    textAlign: 'left',
                    fontWeight: 500,
                    userSelect: 'none',
                    padding: '9px 13px'
                  }}
                >
                  <span style={{ color: '#0f172a' }}>
                    {YEAR_LEVEL_OPTIONS.find((opt) => opt.value === regYearLevel)?.label || regYearLevel}
                  </span>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#475569"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transform: isYearDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      flexShrink: 0
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {isYearDropdownOpen && (
                  <div
                    role="listbox"
                    aria-labelledby="reg-year-label"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      right: 0,
                      zIndex: 80,
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 12px 28px -4px rgba(39, 82, 45, 0.12), 0 6px 16px rgba(0, 0, 0, 0.06)',
                      padding: '5px',
                      animation: 'authFormFade 0.16s ease-out'
                    }}
                  >
                    {YEAR_LEVEL_OPTIONS.map((opt) => {
                      const isSelected = regYearLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setRegYearLevel(opt.value);
                            setIsYearDropdownOpen(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '9px 12px',
                            borderRadius: '8px',
                            fontSize: '0.86rem',
                            fontWeight: isSelected ? 600 : 500,
                            color: isSelected ? '#15803d' : '#334155',
                            background: isSelected ? '#ecfdf5' : 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'left'
                          }}
                          onMouseEnter={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = '#f0fdf4';
                              e.currentTarget.style.color = '#1e3f23';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isSelected) {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.color = '#334155';
                            }
                          }}
                        >
                          <span>{opt.label}</span>
                          {isSelected && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Email Address Field */}
              <div className="form-group">
                <label className="input-label" htmlFor="reg-email">
                  Email Address
                </label>
                <div className="input-wrapper">
                  <input
                    id="reg-email"
                    name="reg_student_email"
                    type="email"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="name@student.ua.edu.ph"
                    className="styled-input"
                    autoComplete="off"
                    data-lpignore="true"
                  />
                </div>
              </div>

              {/* Password Field (Creation - explicitly new-password to prevent Chrome autofilling saved login passwords) */}
              <div className="form-group">
                <label className="input-label" htmlFor="reg-password">
                  Create Password
                </label>
                <div className="input-wrapper">
                  <input
                    id="reg-password"
                    name="reg_student_password"
                    type={showRegPassword ? "text" : "password"}
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="styled-input has-action"
                    autoComplete="new-password"
                    data-lpignore="true"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="password-toggle-btn"
                    title={showRegPassword ? "Hide password" : "Show password"}
                  >
                    {showRegPassword ? (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Register Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="submit-action-btn"
              >
                {loading ? (
                  <span className="spinner-text">Creating Account...</span>
                ) : (
                  <span>Create Free Account</span>
                )}
              </button>
            </form>
          )}

          {/* Social Divider */}
          <div className="social-divider">
            <span className="divider-line" />
            <span className="divider-text">OR CONTINUE WITH</span>
            <span className="divider-line" />
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
            className="google-signin-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>

      {/* Institutional Password Assistance Modal (Dean Clearance Protocol) */}
      {showForgotModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1.25rem',
            animation: 'authFormFade 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onClick={() => setShowForgotModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '460px',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.25)',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: '1.4rem 1.5rem 1.2rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  background: 'rgba(39, 82, 45, 0.1)',
                  border: '1px solid rgba(39, 82, 45, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#27522d',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    Password Assistance
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                    University of the Assumption • College of Nursing
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.35rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem'
              }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>
                  Academic Security &amp; Integrity Protocol
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.55 }}>
                  To protect student academic evaluation records, study telemetry, and flashcard recall scores, public self-service password reset links are disabled.
                </p>
              </div>

              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '0.9rem 1.1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 700, color: '#166534', marginBottom: '4px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>In-Person Dean Clearance</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#166534', lineHeight: 1.5 }}>
                  Please visit the <strong>College Dean's Office</strong> with your Student ID card. The Academic Dean can immediately verify your identity and update or reset your password on the Academic Monitoring Portal.
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.76rem', fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '6px' }}>
                  Official Administrator Contact
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '8px 12px'
                }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#0f172a' }}>
                    adminuanursing@ua.edu.ph
                  </span>
                  <span style={{ fontSize: '0.72rem', background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                    Dean Desk
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '0.9rem 1.5rem',
              borderTop: '1px solid #f1f5f9',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="submit-action-btn"
                style={{ width: 'auto', padding: '7.5px 22px', fontSize: '0.84rem' }}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Institutional Footer - Flowing relative with clean breathing room */}
      <footer
        className="login-footer-bar"
        style={{
          position: 'relative',
          marginTop: 'auto',
          width: '100%',
          padding: '1.25rem 1rem 1.75rem 1rem',
          textAlign: 'center',
          boxSizing: 'border-box',
          zIndex: 10
        }}
      >
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
          University of the Assumption • College of Nursing &amp; Allied Health Sciences
        </div>
        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '4px' }}>
          © 2026 iFocus • Active Recall &amp; BreakGate™ Management System
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#ffffff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <IFocusLogo size={32} />
          <span style={{ color: '#27522d', fontWeight: 600 }}>Loading iFocus...</span>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import IFocusLogo from "@/components/IFocusLogo";

export default function LandingPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState(0);
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [contactForm, setContactForm] = useState({ name: "", email: "", topic: "General Feedback", message: "" });
  const [faqOpen, setFaqOpen] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [pillStyle, setPillStyle] = useState({ left: 6, top: 6, width: 0, height: 0, opacity: 0 });
  const [hasMounted, setHasMounted] = useState(false);
  const [slideDirection, setSlideDirection] = useState("right");
  const tabRefs = useRef([]);

  // Dynamic sliding indicator calculation for the active tab
  useEffect(() => {
    const updatePill = () => {
      const el = tabRefs.current[activeTab];
      if (el) {
        setPillStyle({
          left: el.offsetLeft,
          top: el.offsetTop,
          width: el.offsetWidth,
          height: el.offsetHeight,
          opacity: 1
        });
      }
    };
    updatePill();
    const timer = setTimeout(() => {
      updatePill();
      setHasMounted(true);
    }, 60);
    window.addEventListener("resize", updatePill);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePill);
    };
  }, [activeTab]);

  // Scroll detection & IntersectionObserver for scroll-triggered reveal animations
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    // IntersectionObserver to add .is-visible and persistent data-revealed attribute
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            entry.target.setAttribute("data-revealed", "true");
          }
        });
      },
      {
        threshold: 0.05,
        rootMargin: "0px 0px -20px 0px"
      }
    );

    const elements = document.querySelectorAll(".reveal-on-scroll, .reveal-scale");
    elements.forEach((el) => observer.observe(el));

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, []);

  const toggleFaq = (index) => {
    setFaqOpen(faqOpen === index ? null : index);
  };

  const handleContactSubmit = (e) => {
    e.preventDefault();
    if (!contactForm.email || !contactForm.message) return;
    setContactSubmitted(true);
    setTimeout(() => {
      setContactForm({ name: "", email: "", topic: "General Feedback", message: "" });
    }, 2500);
  };

  // The 4 REAL pages from the iFocus system with their actual screenshots and features
  const realSystemPages = [
    {
      id: "dashboard",
      name: "Home Dashboard",
      route: "/dashboard",
      badge: "Command Center",
      image: "/showcase/current/dashboard.webp",
      title: "Focus Timer, Tasks List & AI Reflection",
      description: "The core study workspace uniting task prioritization, customizable Pomodoro intervals with focus soundscapes, and real-time reflection telemetry.",
      features: [
        { title: "Prioritized Tasks List", desc: "Organize tasks with High, Medium, and Low tags. Filter by All, Active, and Done with cloud synchronization." },
        { title: "Circular Focus Timer", desc: "Choose from 50:00, 25/5, 15/3, 90/20 presets or custom durations, with Ongoing and Break modes." },
        { title: "Chill Lofi Soundscapes", desc: "Integrated focus audio player built directly into the timer so you never have to switch tabs." },
        { title: "Quick Reflection & Telemetry", desc: "Type your session reflection. Reflection and typing signals inform study suggestions and a recommended rhythm." },
        { title: "Daily Mindset Quotes", desc: "Rotating wisdom from Steve Jobs, James Clear, Cal Newport, and other thinkers on every session." },
        { title: "One-Click BreakGate Arming", desc: "Automatically gates your Pomodoro rest period with active recall questions from your deck." }
      ]
    },
    {
      id: "flashcards",
      name: "Flashcard Studio",
      route: "/flashcards",
      badge: "Deck Collections",
      image: "/showcase/current/flashcards.webp",
      title: "AI Deck Generation & Practice Exams",
      description: "Create, study, and test yourself on custom flashcard decks generated directly from your lecture notes or PDF textbooks.",
      features: [
        { title: "AI Text & Notes Extraction", desc: "Paste lecture outlines, syllabus notes, or book chapters to automatically extract question-and-answer pairs." },
        { title: "PDF Document Upload", desc: "Drag and drop PDF lecture slides or textbooks to generate instant study decks." },
        { title: "3D Flip-Card Study Mode", desc: "Interactive cards with tactile flip, 'Definition First' toggle, and 'Mark as Mastered' progress." },
        { title: "Practice Exam Mode", desc: "Multiple-choice quizzes automatically created from your flashcards with real-time scoring." },
        { title: "Active Deck Selection", desc: "Toggle any deck in your collection to become your active BreakGate recall gatekeeper." },
        { title: "Mastery Retention Tracker", desc: "Track memorization progress and percentage of cards mastered in every study deck." }
      ]
    },
    {
      id: "analytics",
      name: "Study Analytics",
      route: "/analytics",
      badge: "Real-time Metrics",
      image: "/showcase/current/analytics.webp",
      title: "Focus Consistency & Weekly Activity",
      description: "Visualize your actual study habits with clean metrics logged automatically after every completed Pomodoro block.",
      features: [
        { title: "Daily Focus Minutes", desc: "Track total focus time logged today, this week's hours, and consecutive study streak days." },
        { title: "Weekly Activity Bar Chart", desc: "Interactive Chart.js chart displaying focus intervals from Monday to Sunday in 10-minute blocks." },
        { title: "BreakGate Compliance", desc: "Monitor your focus-to-rest ratio (5:1 optimal) and cognitive fatigue recovery status." },
        { title: "Active Recall Retention", desc: "Track percentage of mastered concepts versus total cards across all study decks." },
        { title: "Recent Session History", desc: "View timestamps and durations after your focus sessions are saved and synchronized." },
        { title: "Study Streak Consistency", desc: "Monitor daily study milestones and momentum badges earned across completed focus cycles." }
      ]
    },
    {
      id: "coach",
      name: "AI Study Coach",
      route: "/coach",
      badge: "Adaptive Diagnostics",
      image: "/showcase/current/coach.webp",
      title: "Cognitive State & Personalized Advice",
      description: "Intelligent coaching engine that evaluates your study pacing, dwell times, and fatigue to adapt your study plan in real time.",
      features: [
        { title: "Cognitive State Telemetry", desc: "Detects flow states ('In the Zone') or cognitive friction based on interaction dwell times." },
        { title: "Study Resilience Diagnostics", desc: "Calculates study resilience percentage and checks BreakGate cycle compliance." },
        { title: "Recommended Rhythm", desc: "Recommends optimal work/rest intervals (e.g. 25m Work / 5m Gate) based on observed fatigue." },
        { title: "Consult Your Study Coach", desc: "Submit a study reflection and review the recommended action plan and saved journal entries." },
        { title: "Simulate Focus Intervention", desc: "Test active coaching suggestions when pacing slows down during prolonged study sessions." },
        { title: "Adaptive Study Adjustments", desc: "Real-time advice on reordering your to-do list based on emotional friction and fatigue." }
      ]
    }
  ];

  // Frequently asked questions based on genuine user flow
  const faqs = [
    {
      q: "What is the BreakGate™ Protocol?",
      a: "BreakGate is iFocus's signature mechanism. When your Pomodoro study timer ends, instead of mindlessly browsing social media, you are presented with active recall flashcards from your deck. Passing the gate unlocks your rest period and consolidates your memory."
    },
    {
      q: "Can I generate flashcards automatically from my PDF notes?",
      a: "Yes! In the Flashcard Studio, click 'Extract from PDF' or paste your raw lecture text. Our AI processor parses definitions, formulas, and concepts directly into structured flashcard sets."
    },
    {
      q: "What is Practice Exam Mode in Flashcards?",
      a: "Practice Exam Mode takes your flashcards and generates an interactive multiple-choice test with plausible distractors, grading your answers immediately and displaying your final score."
    },
    {
      q: "Where does the analytics data come from?",
      a: "Every time you finish a focus timer in the Command Center, your session duration, timestamp, and BreakGate completion are logged directly into your Study Analytics page."
    },
    {
      q: "Is iFocus free for students?",
      a: "Yes. iFocus is an academic capstone innovation developed at the University of the Assumption in Pampanga, Philippines, and is 100% free for students and learners."
    }
  ];

  return (
    <div className="landing-page-root" style={{
      minHeight: '100vh',
      width: '100%',
      backgroundColor: '#ffffff',
      color: '#1e293b',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowX: 'hidden'
    }}>

      {/* Scoped CSS for atmospheric lighting, scroll animations, micro-interactions */}
      <style>{`
        html {
          scroll-behavior: smooth;
        }
        .landing-page-root * {
          box-sizing: border-box;
        }

        /* ===== Ambient Atmospheric Lighting & Grid Pattern ===== */
        .hero-atmospheric-wrapper {
          position: relative;
          background: 
            radial-gradient(1100px 520px at 50% -40px, rgba(39, 82, 45, 0.08) 0%, rgba(187, 247, 208, 0.14) 30%, rgba(240, 253, 244, 0.05) 60%, transparent 80%),
            radial-gradient(700px 420px at 10% 120px, rgba(95, 143, 94, 0.05) 0%, transparent 60%),
            radial-gradient(700px 420px at 90% 150px, rgba(39, 82, 45, 0.05) 0%, transparent 60%),
            #ffffff;
        }

        .hero-grid-mesh {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(100, 116, 139, 0.16) 1px, transparent 1px);
          background-size: 26px 26px;
          mask-image: radial-gradient(ellipse 70% 65% at 50% 20%, #000000 25%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 70% 65% at 50% 20%, #000000 25%, transparent 80%);
          pointer-events: none;
          z-index: 0;
        }

        /* ===== Scroll-Triggered Reveal Animations (Persistent & Protected against React re-render wiping) ===== */
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.75s cubic-bezier(0.16, 1, 0.3, 1), transform 0.75s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        .reveal-on-scroll.is-visible,
        .reveal-on-scroll[data-revealed="true"] {
          opacity: 1 !important;
          transform: translateY(0) !important;
        }

        .reveal-scale {
          opacity: 0;
          transform: scale(0.97) translateY(24px);
          transition: opacity 0.85s cubic-bezier(0.16, 1, 0.3, 1), transform 0.85s cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        .reveal-scale.is-visible,
        .reveal-scale[data-revealed="true"] {
          opacity: 1 !important;
          transform: scale(1) translateY(0) !important;
        }

        /* Stagger Delays for Sequential Cards */
        .delay-1 { transition-delay: 0.08s; }
        .delay-2 { transition-delay: 0.16s; }
        .delay-3 { transition-delay: 0.24s; }
        .delay-4 { transition-delay: 0.32s; }
        .delay-5 { transition-delay: 0.40s; }

        /* Pulse Dot Animation for Live Status */
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

        /* ===== FAQ Animated Accordion ===== */
        .faq-item-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.28s ease, box-shadow 0.28s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .faq-item-card:hover {
          border-color: #27522d;
          box-shadow: 0 8px 24px -4px rgba(39, 82, 45, 0.08);
          transform: translateY(-2px);
        }
        .faq-item-card.is-active {
          border-color: #27522d;
          box-shadow: 0 10px 28px -4px rgba(39, 82, 45, 0.12);
        }
        .faq-button-trigger {
          width: 100%;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          border: none;
          cursor: pointer;
          text-align: left;
          font-size: 1.02rem;
          font-weight: 600;
          transition: color 0.2s ease;
        }
        .faq-body-collapse {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.36s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .faq-body-collapse.open {
          grid-template-rows: 1fr;
        }
        .faq-body-content {
          overflow: hidden;
        }
        .faq-answer-inner {
          padding: 0 1.5rem 1.35rem 1.5rem;
          color: #475569;
          font-size: 0.95rem;
          line-height: 1.65;
          border-top: 1px solid #f1f5f9;
          opacity: 0;
          transform: translateY(-6px);
          transition: opacity 0.28s ease, transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .faq-body-collapse.open .faq-answer-inner {
          opacity: 1;
          transform: translateY(0);
        }

        /* Nav Link Styling */
        .landing-nav-link {
          color: #475569;
          text-decoration: none;
          font-size: 0.9rem;
          font-weight: 500;
          white-space: nowrap !important;
          padding: 8px 14px;
          border-radius: 8px;
          transition: all 0.18s ease;
          letter-spacing: -0.01em;
        }
        .landing-nav-link:hover {
          color: #1b4324;
          background-color: #f1f5f9;
        }

        /* System Pills & Badges */
        .system-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          background-color: #eaf5ea;
          border: 1px solid #c2e2c2;
          color: #1b4324;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .system-pill:hover {
          transform: scale(1.02);
          box-shadow: 0 2px 8px rgba(39, 82, 45, 0.1);
        }

        /* Primary Action Button */
        .landing-btn-primary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: #27522d;
          color: #ffffff;
          padding: 12px 24px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background-color 0.18s ease, transform 0.18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.18s ease;
          box-shadow: 0 4px 14px rgba(39, 82, 45, 0.2);
          white-space: nowrap !important;
        }
        .landing-btn-primary:hover {
          background-color: #1c3d21;
          transform: translateY(-2px);
          box-shadow: 0 8px 22px rgba(39, 82, 45, 0.3);
        }

        /* Secondary Action Button */
        .landing-btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background-color: #ffffff;
          color: #1e293b;
          padding: 12px 22px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.95rem;
          text-decoration: none;
          border: 1px solid #d1d5db;
          cursor: pointer;
          transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          white-space: nowrap !important;
        }
        .landing-btn-secondary:hover {
          background-color: #f8fafc;
          border-color: #94a3b8;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
        }

        /* Trust/Highlight Badge Strip */
        .trust-highlight-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid #e2e8f0;
          border-radius: 100px;
          font-size: 0.83rem;
          font-weight: 600;
          color: #334155;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
          transition: transform 0.2s ease, border-color 0.2s ease;
        }
        .trust-highlight-card:hover {
          transform: translateY(-1px);
          border-color: #27522d;
          color: #0f172a;
        }

        /* Tab Buttons with Sliding Pill Indicator */
        .tab-btn {
          position: relative;
          z-index: 2;
          padding: 10px 18px;
          border-radius: 8px;
          border: none;
          background: transparent;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap !important;
          transition: color 0.22s ease;
        }
        .tab-btn:hover {
          color: #0f172a;
        }

        /* Feature Cards with Hover Effects */
        .system-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
        }
        @media (max-width: 900px) {
          .system-features-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 600px) {
          .system-features-grid {
            grid-template-columns: 1fr !important;
          }
        }

        .system-feature-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 11px;
          padding: 12px 14px;
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .system-feature-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px -6px rgba(39, 82, 45, 0.1);
          border-color: #27522d;
        }

        /* Browser Mockup Frame & Hover Glow (Wide & Cinematic) */
        .browser-mockup-frame {
          border-radius: 14px;
          border: 1px solid #cbd5e1;
          background-color: #ffffff;
          box-shadow: 0 18px 50px -12px rgba(39, 82, 45, 0.12), 0 6px 16px -4px rgba(0, 0, 0, 0.04);
          overflow: hidden;
          transition: box-shadow 0.3s ease, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .browser-mockup-frame:hover {
          box-shadow: 0 24px 60px -12px rgba(39, 82, 45, 0.16), 0 8px 20px -4px rgba(0, 0, 0, 0.06);
          transform: translateY(-1.5px);
        }
        .browser-window-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background-color: #f1f5f9;
          border-bottom: 1px solid #e2e8f0;
        }

        @media (max-width: 960px) {
          .nav-desktop-links {
            display: none !important;
          }
          .landing-comparison-grid {
            grid-template-columns: 1fr !important;
          }
          .tab-buttons-container {
            flex-wrap: wrap !important;
          }
          .trust-strip-container {
            flex-direction: column !important;
            align-items: center !important;
          }
        }

        @media (max-width: 640px) {
          .landing-header-inner {
            padding: 0 0.85rem !important;
            height: 60px !important;
            gap: 8px !important;
          }
          .landing-btn-nav-primary {
            padding: 7px 12px !important;
            font-size: 0.82rem !important;
          }
          .landing-btn-nav-signin {
            padding: 6px 8px !important;
            font-size: 0.82rem !important;
          }
          .desktop-only-btn-text {
            display: none !important;
          }
          .mobile-only-btn-text {
            display: inline !important;
          }
          .tab-buttons-container {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            max-width: 420px !important;
            margin: 0 auto !important;
            gap: 4px !important;
          }
          .tab-btn {
            width: 100% !important;
            text-align: center !important;
            justify-content: center !important;
            padding: 8px 6px !important;
            font-size: 0.78rem !important;
            white-space: normal !important;
            line-height: 1.25 !important;
          }
          .system-pill {
            padding: 5px 12px !important;
            font-size: 0.74rem !important;
            letter-spacing: 0.01em !important;
            max-width: 95% !important;
            text-align: center !important;
          }
          .hero-section-pad {
            padding: 3rem 1rem 2.5rem 1rem !important;
          }
        }

        @media (min-width: 641px) {
          .desktop-only-btn-text {
            display: inline !important;
          }
          .mobile-only-btn-text {
            display: none !important;
          }
        }
      `}</style>

      {/* ===== 1. TOP NAVIGATION BAR (BALANCED & RICH BRAND IDENTITY) ===== */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: scrolled ? 'rgba(255, 255, 255, 0.94)' : 'rgba(255, 255, 255, 0.85)',
        borderBottom: scrolled ? '1px solid #cbd5e1' : '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: scrolled ? '0 4px 24px rgba(0, 0, 0, 0.06)' : 'none',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        width: '100%',
        transition: 'all 0.25s ease'
      }}>
        <div className="landing-header-inner" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 1.5rem',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem'
        }}>
          {/* Authentic Brand Lockup (Clean, Human, Non-AI) */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flexShrink: 0 }}>
            <IFocusLogo size={34} />
            <span style={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.035em', lineHeight: 1 }}>
              <span style={{ color: '#27522d' }}>i</span>Focus
            </span>
          </Link>

          {/* Center Navigation Links (Neat Pills) */}
          <nav className="nav-desktop-links" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <a href="#showcase" className="landing-nav-link">Overview</a>
            <a href="#breakgate" className="landing-nav-link">BreakGate™</a>
            <a href="#pages" className="landing-nav-link">System Pages</a>
            <a href="#workflow" className="landing-nav-link">Workflow</a>
            <a href="#about" className="landing-nav-link">About UA</a>
            <a href="#contact" className="landing-nav-link">Contact</a>
          </nav>

          {/* Right Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {session ? (
              <Link href="/dashboard" className="landing-btn-primary landing-btn-nav-primary" style={{ padding: '9px 20px', fontSize: '0.9rem' }}>
                Open Dashboard &rarr;
              </Link>
            ) : (
              <>
                <Link 
                  href="/login?tab=login" 
                  className="landing-btn-nav-signin"
                  style={{
                    color: '#334155',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    textDecoration: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    whiteSpace: 'nowrap',
                    transition: 'background-color 0.15s ease, color 0.15s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.color = '#0f172a'; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#334155'; }}
                >
                  Sign In
                </Link>
                <Link 
                  href="/login?tab=register" 
                  className="landing-btn-primary landing-btn-nav-primary" 
                  style={{ 
                    padding: '9px 20px', 
                    fontSize: '0.9rem'
                  }}
                >
                  <span className="desktop-only-btn-text">Get Started Free</span>
                  <span className="mobile-only-btn-text">Start Free</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ===== 2. HERO SECTION WITH ATMOSPHERIC LIGHTING & SUBTLE GRID ===== */}
      <div className="hero-atmospheric-wrapper">
        <div className="hero-grid-mesh"></div>

        <section className="hero-section-pad" style={{
          position: 'relative',
          zIndex: 1,
          padding: '4.5rem 1.5rem 3.5rem 1.5rem',
          maxWidth: '1240px',
          margin: '0 auto',
          textAlign: 'center'
        }}>
          {/* Live System Badge with Pulsing Green Dot */}
          <div className="reveal-on-scroll" style={{ marginBottom: '1.25rem' }}>
            <span className="system-pill">
              <span className="live-dot"></span>
              Active Recall &amp; Pomodoro Management System
            </span>
          </div>

          {/* Headline with Refined Typography & Accent */}
          <h1 className="reveal-on-scroll delay-1" style={{
            fontSize: 'clamp(2.3rem, 5vw, 3.9rem)',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.15,
            letterSpacing: '-0.035em',
            maxWidth: '960px',
            margin: '0 auto 1.35rem auto'
          }}>
            Study with Uninterrupted Focus.<br />
            <span style={{
              background: 'linear-gradient(135deg, #27522d 0%, #15803d 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              display: 'inline-block'
            }}>
              Consolidate Memory
            </span> with BreakGate.
          </h1>

          {/* Clear System Description */}
          <p className="reveal-on-scroll delay-2" style={{
            fontSize: 'clamp(1rem, 2vw, 1.2rem)',
            color: '#475569',
            lineHeight: 1.65,
            maxWidth: '780px',
            margin: '0 auto 2.25rem auto'
          }}>
            iFocus unites prioritized task planning, customizable Pomodoro intervals with focus soundscapes, AI-generated flashcard decks, and gated active recall to make study sessions structured and effective.
          </p>

          {/* Hero Action Buttons */}
          <div className="reveal-on-scroll delay-3" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap', marginBottom: '3.5rem' }}>
            <Link href="/login?tab=register" className="landing-btn-primary" style={{ padding: '14px 30px', fontSize: '1.02rem' }}>
              Start Using iFocus Free &rarr;
            </Link>
            <a href="#showcase" className="landing-btn-secondary" style={{ padding: '14px 26px', fontSize: '1.02rem' }}>
              View System Screenshots &darr;
            </a>
          </div>



          {/* REAL SYSTEM DASHBOARD SCREENSHOT (IN BROWSER FRAME) */}
          <div id="showcase" className="browser-mockup-frame reveal-scale" style={{ textAlign: 'left' }}>
            {/* Top Window Bar */}
            <div className="browser-window-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                <div style={{ width: '11px', height: '11px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
              </div>
              <div style={{
                flex: 1,
                maxWidth: '480px',
                backgroundColor: '#ffffff',
                borderRadius: '7px',
                border: '1px solid #cbd5e1',
                padding: '4px 12px',
                fontSize: '0.8rem',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>https://ifocus-study.vercel.app/dashboard</span>
              </div>
              <div style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                color: '#166534',
                backgroundColor: '#eaf5ea',
                padding: '3px 9px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span className="live-dot" style={{ width: '6px', height: '6px' }}></span>
                Dashboard Preview
              </div>
            </div>

            {/* Actual Dashboard Screenshot */}
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/showcase/current/dashboard.webp"
                alt="iFocus Actual Dashboard Command Center"
                style={{
                  width: '100%',
                  height: 'auto',
                  display: 'block',
                  borderBottomLeftRadius: '15px',
                  borderBottomRightRadius: '15px'
                }}
              />
            </div>
          </div>
        </section>
      </div>

      {/* ===== 3. BREAKGATE PROTOCOL DEEP-DIVE ===== */}
      <section id="breakgate" style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '5rem 1.5rem'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
          <div className="reveal-on-scroll">
            <span className="system-pill" style={{ marginBottom: '1rem' }}>
              System Core Mechanism
            </span>
            <h2 style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.7rem)', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 1rem 0' }}>
              Why Ordinary Pomodoro Timers Fail Students
            </h2>
            <p style={{ color: '#475569', fontSize: '1.05rem', maxWidth: '720px', margin: '0 auto 3rem auto', lineHeight: 1.6 }}>
              Relying solely on a timer leaves your breaks vulnerable to mindless scrolling. BreakGate creates an active retrieval boundary before you disconnect.
            </p>
          </div>

          {/* Comparison Grid */}
          <div className="landing-comparison-grid" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2rem',
            textAlign: 'left'
          }}>
            {/* Traditional Card */}
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #fecaca',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#fee2e2',
                  color: '#dc2626',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}>
                  &times;
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#991b1b', margin: 0 }}>
                  Traditional Pomodoro
                </h3>
              </div>
              <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                Timer dings and you immediately open TikTok, YouTube, or Instagram. The cognitive switch wipes clean what you just read.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.8 }}>
                <li>No reinforcement of concepts studied during the block.</li>
                <li>Break periods bleed past 5 minutes into endless distraction.</li>
                <li>Returning to study feels difficult, resulting in prolonged breaks.</li>
              </ul>
            </div>

            {/* iFocus BreakGate Card */}
            <div className="reveal-on-scroll delay-2" style={{
              backgroundColor: '#ffffff',
              border: '2px solid #27522d',
              borderRadius: '16px',
              padding: '2rem',
              boxShadow: '0 8px 24px rgba(39, 82, 45, 0.08)',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-12px',
                right: '20px',
                backgroundColor: '#27522d',
                color: '#ffffff',
                fontSize: '0.72rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: '9999px',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                The iFocus Method
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#eaf5ea',
                  color: '#27522d',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}>
                  &#10003;
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1b4324', margin: 0 }}>
                  BreakGate™ Protocol
                </h3>
              </div>
              <p style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                When the timer expires, the screen requires you to answer flashcard recall questions from your deck before your break activates.
              </p>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#334155', fontSize: '0.9rem', lineHeight: 1.8 }}>
                <li>Locks in active recall right at the peak of short-term memory.</li>
                <li>Maintains focus-to-rest compliance (optimal 5:1 ratio) for cognitive recovery.</li>
                <li>Zero disruption to your flow; permanent retention of high-yield concepts.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 4. SYSTEM TOUR (THE 4 REAL PAGES & SCREENSHOTS) ===== */}
      <section id="pages" style={{
        padding: '1rem 1rem 2.25rem 1rem',
        maxWidth: '1160px',
        margin: '0 auto'
      }}>
        <div className="reveal-on-scroll" style={{ textAlign: 'center', marginBottom: '0.6rem' }}>
          <span className="system-pill" style={{ marginBottom: '0.2rem', padding: '2.5px 10px', fontSize: '0.72rem' }}>
            Interactive System Tour
          </span>
          <h2 style={{ fontSize: 'clamp(1.4rem, 2.2vw, 1.85rem)', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.025em' }}>
            Explore the Real Pages in iFocus
          </h2>
        </div>

        {/* Sticky Tab Controls Bar with Sliding Pill Background Indicator */}
        <div style={{
          position: 'sticky',
          top: '64px',
          zIndex: 40,
          padding: '4px 0 6px 0',
          backgroundColor: 'rgba(255, 255, 255, 0.96)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(226, 232, 240, 0.7)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
          marginBottom: '0.65rem'
        }}>
          <div className="tab-buttons-container" style={{
            position: 'relative',
            display: 'inline-flex',
            backgroundColor: '#f1f5f9',
            padding: '4px',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            gap: '3px'
          }}>
            {/* The Smooth Gliding Pill Indicator */}
            <div 
              style={{
                position: 'absolute',
                left: `${pillStyle.left}px`,
                top: `${pillStyle.top}px`,
                width: `${pillStyle.width}px`,
                height: `${pillStyle.height}px`,
                backgroundColor: '#27522d',
                borderRadius: '7px',
                boxShadow: '0 3px 12px rgba(39, 82, 45, 0.28)',
                transition: hasMounted 
                  ? 'left 0.32s cubic-bezier(0.16, 1, 0.3, 1), width 0.32s cubic-bezier(0.16, 1, 0.3, 1), top 0.32s ease, height 0.32s ease'
                  : 'opacity 0.2s ease',
                pointerEvents: 'none',
                zIndex: 1,
                opacity: pillStyle.opacity
              }}
            />

            {realSystemPages.map((page, idx) => {
              const isActive = activeTab === idx;
              return (
                <button
                  key={page.id}
                  ref={(el) => (tabRefs.current[idx] = el)}
                  onClick={() => {
                    if (idx !== activeTab) {
                      setSlideDirection(idx > activeTab ? 'right' : 'left');
                      setActiveTab(idx);
                    }
                  }}
                  className="tab-btn"
                  style={{
                    color: isActive ? '#ffffff' : '#475569',
                    padding: '6px 15px',
                    fontSize: '0.84rem'
                  }}
                >
                  {page.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Showcase Carousel Frame (Zero-Flicker Hardware-Accelerated Sliding Track) */}
        <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            width: '400%',
            transform: `translate3d(-${activeTab * 25}%, 0, 0)`,
            transition: 'transform 0.46s cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform'
          }}>
            {realSystemPages.map((page) => (
              <div 
                key={page.id} 
                style={{
                  width: '25%',
                  flexShrink: 0,
                  padding: '0.85rem 1rem 1rem 1rem'
                }}
              >
                {/* Header Row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem',
                  marginBottom: '0.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.72rem',
                      fontFamily: 'monospace',
                      backgroundColor: '#eaf5ea',
                      color: '#27522d',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '5px'
                    }}>
                      Route: {page.route}
                    </span>
                    <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      {page.title}
                    </h3>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: '#64748b',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    padding: '2px 9px',
                    borderRadius: '9999px'
                  }}>
                    {page.badge}
                  </span>
                </div>

                <p style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.4, maxWidth: '840px', margin: '0 0 0.65rem 0' }}>
                  {page.description}
                </p>

                {/* Genuine Screenshot in Wide Mockup Frame */}
                <div className="browser-mockup-frame" style={{ maxWidth: '1080px', margin: '0 auto 0.85rem auto' }}>
                  <div className="browser-window-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#ef4444' }}></div>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#f59e0b' }}></div>
                      <div style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#10b981' }}></div>
                    </div>
                    <div style={{
                      flex: 1,
                      maxWidth: '380px',
                      backgroundColor: '#ffffff',
                      borderRadius: '5px',
                      border: '1px solid #cbd5e1',
                      padding: '3px 10px',
                      fontSize: '0.74rem',
                      color: '#64748b'
                    }}>
                      iFocus Web App &bull; {page.route}
                    </div>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.image}
                    alt={page.name}
                    loading="eager"
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: '520px',
                      objectFit: 'cover',
                      objectPosition: 'top',
                      display: 'block',
                      borderBottomLeftRadius: '12px',
                      borderBottomRightRadius: '12px'
                    }}
                  />
                </div>

                {/* Verified System Features List (Compact 3x2 Grid) */}
                <div>
                  <h4 style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1b4324', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.45rem' }}>
                    Features on this page:
                  </h4>
                  <div className="system-features-grid">
                    {page.features.map((feat, i) => (
                      <div key={i} className="system-feature-card">
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.82rem', marginBottom: '2px' }}>
                          {feat.title}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.76rem', lineHeight: 1.35 }}>
                          {feat.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Direct CTA to Route */}
                <div style={{
                  marginTop: '0.85rem',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    All features shown above are live and functional in the system.
                  </span>
                  <Link
                    href={session ? page.route : "/login?tab=register"}
                    className="landing-btn-primary"
                    style={{ padding: '6px 15px', fontSize: '0.8rem' }}
                  >
                    {session ? `Go to ${page.name} →` : "Sign Up & Use Free →"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 5. HOW IT WORKS (THE 5-STEP WORKFLOW) ===== */}
      <section id="workflow" style={{
        backgroundColor: '#f8faf9',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '5.5rem 1.5rem'
      }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', textAlign: 'center' }}>
          <div className="reveal-on-scroll">
            <span className="system-pill" style={{ marginBottom: '1rem' }}>
              System Workflow
            </span>
            <h2 style={{ fontSize: 'clamp(2rem, 3.8vw, 2.9rem)', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 3rem 0' }}>
              How a Study Session Works in iFocus
            </h2>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.25rem',
            textAlign: 'left'
          }}>
            {[
              {
                num: "1",
                title: "Create Flashcards",
                desc: "Paste lecture notes or upload a PDF in Flashcards. The AI formats questions and answers."
              },
              {
                num: "2",
                title: "Organize Tasks",
                desc: "Add your study goals to the Tasks List in the Command Center with High, Med, or Low priority."
              },
              {
                num: "3",
                title: "Focus with Lofi",
                desc: "Start a 50 or 25-minute Pomodoro timer, play the embedded Chill Lofi audio, and study with zero distractions."
              },
              {
                num: "4",
                title: "Pass BreakGate",
                desc: "When the timer rings, answer active recall questions from your deck to unlock your earned break."
              },
              {
                num: "5",
                title: "Check Analytics",
                desc: "Review your daily minutes, study streaks, and weekly Chart.js activity log in Analytics."
              }
            ].map((step, idx) => (
              <div key={step.num} className={`system-feature-card reveal-on-scroll delay-${idx + 1}`} style={{ position: 'relative' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  backgroundColor: '#eaf5ea',
                  color: '#27522d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.9rem',
                  marginBottom: '1rem'
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                  {step.title}
                </h3>
                <p style={{ color: '#64748b', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 6. ABOUT UNIVERSITY OF THE ASSUMPTION (REAL RESEARCH PROJECT) ===== */}
      <section id="about" style={{
        padding: '5.5rem 1.5rem',
        maxWidth: '1100px',
        margin: '0 auto'
      }}>
        <div className="reveal-on-scroll" style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '20px',
          padding: '3rem 2.5rem',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            backgroundColor: '#27522d'
          }}></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
            <span className="system-pill">
              Academic Capstone Research
            </span>
          </div>

          <h2 style={{ fontSize: 'clamp(1.8rem, 3.4vw, 2.5rem)', fontWeight: 800, color: '#0f172a', marginBottom: '1.25rem', lineHeight: 1.25 }}>
            Developed at the University of the Assumption
          </h2>

          <p style={{ color: '#475569', fontSize: '1.05rem', lineHeight: 1.7, marginBottom: '1.5rem' }}>
            <strong>iFocus</strong> was conceptualized, designed, and engineered as an academic capstone innovation at the <strong>University of the Assumption (UA)</strong> in the City of San Fernando, Pampanga.
          </p>

          <p style={{ color: '#475569', fontSize: '1rem', lineHeight: 1.7, marginBottom: '2rem' }}>
            The system was built to solve a concrete problem observed among nursing, engineering, and IT students: ordinary study timers do not enforce memory consolidation. By introducing <strong>BreakGate™</strong>, students engage in active retrieval practice before rest, creating measurable improvements in exam retention and focus resilience.
          </p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1.25rem',
            padding: '1.5rem',
            backgroundColor: '#f8fafc',
            borderRadius: '12px',
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#27522d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Institution
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                University of the Assumption
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Pampanga, Philippines
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#27522d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Program
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                Information Technology Capstone
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Cognitive Study Tools
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#27522d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Target Student Cohort
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginTop: '2px' }}>
                Nursing &amp; Undergraduates
              </div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Active Recall Protocol Testing
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 7. FAQ ACCORDION ===== */}
      <section style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        borderBottom: '1px solid #e2e8f0',
        padding: '5.5rem 1.5rem'
      }}>
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div className="reveal-on-scroll" style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <span className="system-pill" style={{ marginBottom: '1rem' }}>
              Common Questions
            </span>
            <h2 style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 0.75rem 0' }}>
              Frequently Asked Questions
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Clear answers on how iFocus works and how to get started.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {faqs.map((faq, index) => {
              const isOpen = faqOpen === index;
              return (
                <div
                  key={index}
                  className={`faq-item-card ${isOpen ? 'is-active' : ''}`}
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="faq-button-trigger"
                    style={{
                      color: isOpen ? '#1b4324' : '#0f172a'
                    }}
                  >
                    <span>{faq.q}</span>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isOpen ? '#27522d' : '#f1f5f9',
                      color: isOpen ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      boxShadow: isOpen ? '0 3px 10px rgba(39, 82, 45, 0.25)' : 'none',
                      flexShrink: 0
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  <div className={`faq-body-collapse ${isOpen ? 'open' : ''}`}>
                    <div className="faq-body-content">
                      <div className="faq-answer-inner">
                        <div style={{ paddingTop: '0.75rem' }}>
                          {faq.a}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== 8. CONTACT & FEEDBACK FORM ===== */}
      <section id="contact" style={{
        position: 'relative',
        padding: '5.5rem 1.5rem',
        overflow: 'hidden',
        borderTop: '1px solid rgba(226, 232, 240, 0.6)'
      }}>
        {/* Crisp Architectural Dot Grid Mesh */}
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(71, 85, 105, 0.16) 1.2px, transparent 1.2px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%, #000000 35%, transparent 90%)',
            WebkitMaskImage: 'radial-gradient(ellipse 85% 75% at 50% 50%, #000000 35%, transparent 90%)',
            pointerEvents: 'none',
            zIndex: 0
          }} 
        />

        {/* Subtle Green Ambient Radial Glow */}
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '740px',
            height: '480px',
            background: 'radial-gradient(ellipse at center, rgba(39, 82, 45, 0.07) 0%, rgba(95, 143, 94, 0.03) 50%, transparent 75%)',
            pointerEvents: 'none',
            zIndex: 0
          }}
        />

        <div style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '720px',
          margin: '0 auto'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span className="system-pill" style={{ marginBottom: '1rem' }}>
              Get in Touch
            </span>
            <h2 style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)', fontWeight: 800, color: '#0f172a', margin: '0.5rem 0 0.75rem 0' }}>
              Contact the iFocus Team
            </h2>
            <p style={{ color: '#64748b', fontSize: '1rem' }}>
              Have feedback on the BreakGate algorithm or suggestions for new study tools? Let us know.
            </p>
          </div>

          <div style={{
          backgroundColor: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)'
        }}>
          {contactSubmitted ? (
            <div style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: '#166534'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: '#dcfce7',
                color: '#15803d',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                marginBottom: '1rem'
              }}>
                &#10003;
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>
                Thank you for your feedback!
              </h3>
              <p style={{ color: '#475569', fontSize: '0.95rem', margin: 0 }}>
                Your message has been received by the iFocus research team.
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria Santos"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#27522d'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. msantos@ua.edu.ph"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#27522d'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Feedback Topic
                </label>
                <select
                  value={contactForm.topic}
                  onChange={(e) => setContactForm({ ...contactForm, topic: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="General Feedback">General Feedback</option>
                  <option value="BreakGate Algorithm Suggestion">BreakGate™ Algorithm Suggestion</option>
                  <option value="Flashcard Deck Feature">Flashcard Deck Feature</option>
                  <option value="UA Academic Research Inquiry">UA Academic Research Inquiry</option>
                  <option value="Bug Report">Bug Report</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Your Message
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Share your thoughts on how iFocus helps your study sessions..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.95rem',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#27522d'}
                  onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>

              <button
                type="submit"
                className="landing-btn-primary"
                style={{ width: '100%', padding: '12px', fontSize: '1rem', marginTop: '4px' }}
              >
                Send Message &rarr;
              </button>
            </form>
          )}
        </div>
        </div>
      </section>

      {/* ===== 9. FOOTER ===== */}
      <footer style={{
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        padding: '3.5rem 1.5rem 2.5rem 1.5rem'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.5rem'
        }}>
          {/* Logo in Footer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <IFocusLogo size={30} />
            <span style={{ fontSize: '1.3rem', fontWeight: 800, color: '#172118', letterSpacing: '-0.03em' }}>
              <span style={{ color: '#27522d' }}>i</span>Focus
            </span>
          </div>

          <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '520px', margin: 0, lineHeight: 1.5 }}>
            Empowering students with active recall and distraction-proof Pomodoro study routines. Built for academic excellence.
          </p>

          {/* Quick Route Links */}
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link href="/dashboard" style={{ color: '#475569', fontSize: '0.88rem', textDecoration: 'none' }}>
              Dashboard
            </Link>
            <Link href="/flashcards" style={{ color: '#475569', fontSize: '0.88rem', textDecoration: 'none' }}>
              Flashcards
            </Link>
            <Link href="/analytics" style={{ color: '#475569', fontSize: '0.88rem', textDecoration: 'none' }}>
              Analytics
            </Link>
            <Link href="/coach" style={{ color: '#475569', fontSize: '0.88rem', textDecoration: 'none' }}>
              AI Coach
            </Link>
            <Link href="/login" style={{ color: '#475569', fontSize: '0.88rem', textDecoration: 'none' }}>
              Student Sign In
            </Link>
          </div>

          <div style={{
            fontSize: '0.8rem',
            color: '#94a3b8',
            borderTop: '1px solid #e2e8f0',
            width: '100%',
            paddingTop: '1.5rem',
            marginTop: '0.5rem'
          }}>
            &copy; {new Date().getFullYear()} iFocus &bull; University of the Assumption IT Capstone Project &bull; Pampanga, Philippines
          </div>
        </div>
      </footer>
    </div>
  );
}

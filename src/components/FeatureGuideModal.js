"use client";

import { useState, useEffect } from 'react';

const TUTORIAL_TOPICS = [
  {
    id: 'pomodoro',
    label: 'Focus Timer',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
    steps: [
      {
        title: 'Choose Presets & Focus Cycles',
        description: 'Pick quick presets like 25/5 (Pomodoro), 50/10 (Deep Work), or click Custom to dial in your own focus and break minutes. Toggle between Ongoing focus and Break rest periods anytime.',
        tip: 'Use Custom mode to set precise sprint durations for fast review or exam cramming.',
        image: '/images/tutorials/crop_pomodoro_dial.png'
      },
      {
        title: 'Ambient Audio & Soundscapes',
        description: 'Click the dynamic soundscape pill above the timer to choose audio tracks like Chill Lofi, Study Music, or Rain Ambient. Ambient audio blocks room distractions and trains your brain to enter a steady flow state.',
        tip: 'You can test or mute volume in Settings > Notifications & Sound.',
        image: '/images/tutorials/crop_pomodoro.png'
      }
    ]
  },
  {
    id: 'breakgate',
    label: 'BreakGate Challenge',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    steps: [
      {
        title: 'Earn Your Break Through Active Recall',
        description: 'BreakGate eliminates distraction by locking your rest countdown behind a flashcard challenge. When your focus cycle ends, BreakGate pops up with questions from your active deck. Answer correctly to unlock your break!',
        tip: 'This mechanism uses positive friction to stop social media rabbit holes during rest periods.',
        image: '/images/tutorials/crop_breakgate.png'
      },
      {
        title: 'Arming a Deck & Session Prompts',
        description: 'Open any deck in Flashcards and check "BreakGate Active". Your dashboard will display a green badge showing the active deck. If you start a timer without an active deck, iFocus will confirm whether you want to proceed without break gates or choose a deck.',
        tip: 'You can change the number of questions presented during BreakGate in Settings.',
        image: '/images/tutorials/crop_no_breakgate.png'
      }
    ]
  },
  {
    id: 'flashcards',
    label: 'Flashcards & Exams',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
    ),
    steps: [
      {
        title: 'Interactive Study Mode & Mastery',
        description: 'Flip cards by clicking or pressing the Spacebar. Toggle "Definition First" to test your recall in reverse. Mark cards as Mastered (or press M) to build your retention progress bar.',
        tip: 'Click Shuffle anytime to randomize card order and avoid positional memory bias.',
        image: '/images/tutorials/crop_flashcard_card.png'
      },
      {
        title: 'Smart Hints, Controls & Practice Exams',
        description: 'Check "Show Hints" (or press H) to display keyword clues directly on tough cards without flipping. Check "BreakGate Active" to arm the deck, or click "Take Exam" in the top bar to generate timed 4-choice quizzes.',
        tip: 'After completing an exam, you can immediately arm that deck for BreakGate with one click.',
        image: '/images/tutorials/crop_flashcard_controls.png'
      }
    ]
  },
  {
    id: 'presence',
    label: 'Active Presence',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
    ),
    steps: [
      {
        title: 'Anti-Ghosting Presence Verification',
        description: 'To keep your focus statistics honest and accurate, iFocus periodically pauses the timer if you step away from your desk (AFK) or when your set check interval is reached.',
        tip: 'Click "Continue Session" to resume immediately. The timer will not waste time while you are away.',
        image: '/images/tutorials/crop_active_presence.png'
      },
      {
        title: 'Customizing Intervals & Safe Testing',
        description: 'Go to Settings > Focus Preferences to adjust check intervals (1 min test, 3 min, 5 min, 10 min, 15 min). Use the "Test Presence Popup" button to safely preview the modal without pausing your active session.',
        tip: 'The test popup has a blue Test badge and will never interrupt your running timer.',
        image: '/images/tutorials/crop_active_presence.png'
      }
    ]
  },
  {
    id: 'reflection',
    label: 'AI Coach & Friction',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
    ),
    steps: [
      {
        title: 'Quick Reflection & Keystroke Telemetry',
        description: 'Type how you feel in the Quick Reflection box on the dashboard. Built-in telemetry monitors flight time, dwell time, and backspace friction to automatically assess your mental flow state in real time.',
        tip: 'Click "Submit & Analyze" to receive immediate coach recommendations and task reprioritization.',
        image: '/images/tutorials/crop_reflection.png'
      },
      {
        title: 'Personalized AI Coach Mentorship',
        description: 'Navigate to the AI Coach tab to get customized study strategies, mnemonic memory aids, and psychological reframing routines tailored to your current friction levels.',
        tip: 'The AI Coach adapts your daily plan when you are stressed or struggling with high-friction tasks.',
        image: '/images/tutorials/crop_coach_plan.png'
      }
    ]
  },
  {
    id: 'analytics',
    label: 'Analytics & Streaks',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
    steps: [
      {
        title: 'Mastery Rates & Study Streaks',
        description: 'The Analytics tab shows your daily study minutes, completed focus sessions, BreakGate pass rates, and active streaks so you can track your cognitive growth over days and weeks.',
        tip: 'Consistent 25-minute sessions compound into deep long-term retention and higher exam confidence.',
        image: '/images/tutorials/crop_analytics_cards.png'
      },
      {
        title: 'Weekly Pacing & Focus Chart',
        description: 'Review historical timeline of every focus block, BreakGate challenge result, and presence audit to identify your peak productive hours during the day.',
        tip: 'Check your weekly graphs to spot energy dips and plan heavier subjects during your peak focus windows.',
        image: '/images/tutorials/crop_analytics_chart.png'
      }
    ]
  }
];

export default function FeatureGuideModal({ isOpen, onClose, initialTopic = 'pomodoro' }) {
  const [activeTopicId, setActiveTopicId] = useState(initialTopic);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

  // Sync initial topic when modal opens
  useEffect(() => {
    if (initialTopic) {
      setActiveTopicId(initialTopic);
      setCurrentStepIndex(0);
    }
  }, [initialTopic, isOpen]);

  // Keyboard navigation: Left/Right arrows for steps, Escape to close zoom or modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isZoomed) {
          setIsZoomed(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight' && !isZoomed) {
        const topic = TUTORIAL_TOPICS.find(t => t.id === activeTopicId);
        if (topic && currentStepIndex < topic.steps.length - 1) {
          setCurrentStepIndex(i => i + 1);
        }
      } else if (e.key === 'ArrowLeft' && !isZoomed) {
        if (currentStepIndex > 0) {
          setCurrentStepIndex(i => i - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTopicId, currentStepIndex, isZoomed, onClose]);

  if (!isOpen) return null;

  const activeTopic = TUTORIAL_TOPICS.find(t => t.id === activeTopicId) || TUTORIAL_TOPICS[0];
  const step = activeTopic.steps[currentStepIndex] || activeTopic.steps[0];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === activeTopic.steps.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStepIndex(i => i + 1);
    } else {
      const topicIdx = TUTORIAL_TOPICS.findIndex(t => t.id === activeTopicId);
      if (topicIdx < TUTORIAL_TOPICS.length - 1) {
        setActiveTopicId(TUTORIAL_TOPICS[topicIdx + 1].id);
        setCurrentStepIndex(0);
      } else {
        onClose();
      }
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(i => i - 1);
    }
  };

  return (
    <>
      <div 
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Modal Main Frame - Spacious, High-Clarity View */}
        <div 
          style={{
            width: '100%',
            maxWidth: '880px',
            height: 'min(780px, 94vh)',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.45)',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* Header Bar */}
          <div 
            style={{
              padding: '1rem 1.6rem',
              borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(248, 250, 252, 0.95)',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div 
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '11px',
                  background: 'rgba(46, 125, 50, 0.12)',
                  color: '#2e7d32',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              </div>
              <div>
                <h2 style={{ fontSize: '1.18rem', fontWeight: 700, margin: 0, color: '#163824', lineHeight: 1.2 }}>
                  iFocus Feature Guide & Tutorials
                </h2>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Visual walkthroughs with screenshots to help you master every tool
                </span>
              </div>
            </div>

            <button 
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '0.45rem',
                borderRadius: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              title="Close Guide"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Feature Category Navigation - 2x3 Symmetric Grid */}
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '0.45rem',
              padding: '0.7rem 1.6rem',
              background: '#f8fafc',
              borderBottom: '1px solid rgba(0, 0, 0, 0.06)',
              flexShrink: 0
            }}
          >
            {TUTORIAL_TOPICS.map((topic) => {
              const isSelected = topic.id === activeTopicId;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => {
                    setActiveTopicId(topic.id);
                    setCurrentStepIndex(0);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.45rem',
                    padding: '0.45rem 0.6rem',
                    borderRadius: '10px',
                    fontSize: '0.82rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#1e3f23' : '#475569',
                    background: isSelected ? 'rgba(46, 125, 50, 0.15)' : '#ffffff',
                    border: isSelected ? '1.5px solid #2e7d32' : '1px solid rgba(226, 232, 240, 0.9)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: isSelected ? '0 2px 6px rgba(46, 125, 50, 0.15)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  <span style={{ color: isSelected ? '#2e7d32' : '#64748b', display: 'flex', alignItems: 'center' }}>
                    {topic.icon}
                  </span>
                  <span>{topic.label}</span>
                </button>
              );
            })}
          </div>

          {/* Modal Body - Stable, Comfortable Layout with High-Resolution Visuals */}
          <div 
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem 1.6rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}
          >
            {/* Step Counter Tag & Keyboard Hint */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <span 
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  color: '#2e7d32',
                  background: 'rgba(46, 125, 50, 0.1)',
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px'
                }}
              >
                Step {currentStepIndex + 1} of {activeTopic.steps.length}
              </span>

              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Press Left/Right arrows to flip
              </span>
            </div>

            {/* Title & Description with stable min-height */}
            <div style={{ minHeight: '56px', flexShrink: 0 }}>
              <h3 style={{ fontSize: '1.22rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: '#163824', lineHeight: 1.25 }}>
                {step.title}
              </h3>
              <p style={{ fontSize: '0.88rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                {step.description}
              </p>
            </div>

            {/* High-Definition Cropped Feature Picture Container with Click-to-Zoom */}
            <div 
              onClick={() => setIsZoomed(true)}
              title="Click to view full image in high resolution"
              style={{
                height: '275px',
                width: '100%',
                flexShrink: 0,
                borderRadius: '16px',
                overflow: 'hidden',
                background: '#f8fafc',
                border: '1.5px solid rgba(0, 0, 0, 0.09)',
                boxShadow: '0 4px 18px -4px rgba(0, 0, 0, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'zoom-in',
                padding: '0.5rem'
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={step.image} 
                alt={step.title}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.06))'
                }}
              />

              {/* Zoom pill badge */}
              <div 
                style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '12px',
                  background: 'rgba(15, 23, 42, 0.78)',
                  backdropFilter: 'blur(4px)',
                  color: '#ffffff',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  padding: '0.25rem 0.65rem',
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
                <span>Click to enlarge</span>
              </div>
            </div>

            {/* Pro Tip Callout */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.65rem 1rem',
                background: 'rgba(46, 125, 50, 0.06)',
                border: '1px solid rgba(46, 125, 50, 0.18)',
                borderRadius: '12px',
                flexShrink: 0
              }}
            >
              <div style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="16" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12.01" y2="8"></line>
                </svg>
              </div>
              <p style={{ margin: 0, fontSize: '0.84rem', color: '#163824', lineHeight: 1.45 }}>
                <strong>Tip:</strong> {step.tip}
              </p>
            </div>
          </div>

          {/* Footer Navigation - Spacious, Balanced 3-Zone Layout */}
          <div 
            style={{
              padding: '0.95rem 1.6rem',
              borderTop: '1px solid rgba(0, 0, 0, 0.08)',
              display: 'grid',
              gridTemplateColumns: '120px 1fr 120px',
              alignItems: 'center',
              background: 'rgba(248, 250, 252, 0.95)',
              flexShrink: 0
            }}
          >
            {/* Left: Previous Button */}
            <div style={{ justifySelf: 'start' }}>
              <button
                type="button"
                onClick={handlePrev}
                disabled={isFirstStep}
                style={{
                  width: '105px',
                  padding: '0.55rem 0.9rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  background: '#ffffff',
                  color: isFirstStep ? '#94a3b8' : '#334155',
                  border: '1.5px solid rgba(0, 0, 0, 0.1)',
                  cursor: isFirstStep ? 'not-allowed' : 'pointer',
                  opacity: isFirstStep ? 0.5 : 1,
                  boxShadow: isFirstStep ? 'none' : '0 2px 6px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
                onMouseEnter={(e) => {
                  if (!isFirstStep) e.currentTarget.style.background = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  if (!isFirstStep) e.currentTarget.style.background = '#ffffff';
                }}
              >
                ← Previous
              </button>
            </div>

            {/* Center: Step Progress Indicators */}
            <div 
              style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {activeTopic.steps.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentStepIndex(idx)}
                    title={`Go to Step ${idx + 1}`}
                    style={{
                      width: currentStepIndex === idx ? '26px' : '9px',
                      height: '8px',
                      borderRadius: '9999px',
                      background: currentStepIndex === idx ? '#2e7d32' : 'rgba(0, 0, 0, 0.2)',
                      cursor: 'pointer',
                      border: 'none',
                      padding: 0,
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                {currentStepIndex + 1} / {activeTopic.steps.length}
              </span>
            </div>

            {/* Right: Next / Got It Button */}
            <div style={{ justifySelf: 'end' }}>
              <button
                type="button"
                onClick={handleNext}
                style={{
                  width: '115px',
                  padding: '0.55rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  borderRadius: '9999px',
                  background: '#27522d',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(39, 82, 45, 0.3)',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#1e3f23';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#27522d';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {isLastStep ? 'Got it!' : 'Next Step →'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Lightbox Zoom Mode */}
      {isZoomed && (
        <div 
          onClick={() => setIsZoomed(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100000,
            background: 'rgba(0, 0, 0, 0.88)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            animation: 'fadeIn 0.15s ease-out',
            cursor: 'zoom-out'
          }}
        >
          <div 
            style={{
              position: 'relative',
              maxWidth: '92vw',
              maxHeight: '88vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img 
              src={step.image} 
              alt={step.title}
              style={{
                maxWidth: '92vw',
                maxHeight: '84vh',
                objectFit: 'contain',
                borderRadius: '16px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
                border: '2px solid rgba(255, 255, 255, 0.15)'
              }}
            />
            <div style={{ marginTop: '0.75rem', color: '#ffffff', fontSize: '0.85rem', opacity: 0.85 }}>
              Click anywhere or press Esc to exit zoom
            </div>
          </div>
        </div>
      )}
    </>
  );
}

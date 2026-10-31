"use client";

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './FeatureGuideModal.module.css';

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
        description: 'Choose a focus and break preset, or open Custom to set the duration and number of cycles. Use Start to run the timer and Stop to pause it.',
        tip: 'Use Custom mode to set precise sprint durations for fast review or exam cramming.',
        image: '/images/tutorials/current/timer.webp'
      },
      {
        title: 'Ambient Audio & Soundscapes',
        description: 'Tap the soundscape control above the timer to choose music or ambient sounds. Adjust the volume and use the playback button to pause or resume audio.',
        tip: 'Start playback with a tap. Browser and phone background policies can affect audio.',
        image: '/images/tutorials/current/audio.webp'
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
        description: 'When a focus block ends with a deck active, BreakGate opens a short multiple-choice review. Answer the questions to continue to your break, or use Skip to Break if you need to skip the review.',
        tip: 'Choose a deck before starting so the challenge uses your study material.',
        image: '/images/tutorials/current/breakgate.webp'
      },
      {
        title: 'Arming a Deck & Session Prompts',
        description: 'Open a saved deck in Flashcards and enable BreakGate Active. The Dashboard shows the active deck. Starting without a deck lets you choose one or proceed without BreakGate.',
        tip: 'Open the timer’s Custom settings to choose the BreakGate question count.',
        image: '/images/tutorials/current/deck.webp'
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
        image: '/images/tutorials/current/review.webp'
      },
      {
        title: 'Smart Hints, Controls & Practice Exams',
        description: 'Use Show Hints to reveal a keyword clue. Enable BreakGate Active to use this deck during breaks, or choose Take Exam for multiple-choice practice.',
        tip: 'After completing an exam, you can immediately arm that deck for BreakGate with one click.',
        image: '/images/tutorials/current/controls.webp'
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
        title: 'Periodic Presence Check',
        description: 'During a focus session, the timer pauses at your configured presence interval. Choose Continue Session when you are ready, or leave it paused until you return.',
        tip: 'Click "Continue Session" to resume immediately. The timer will not waste time while you are away.',
        image: '/images/tutorials/current/presence.webp'
      },
      {
        title: 'Customizing Intervals & Safe Testing',
        description: 'Open Settings > Focus Preferences to choose the Active Presence interval and preview the presence popup. Presence and burnout intervals are locked while a timer session is ongoing.',
        tip: 'The test popup has a blue Test badge and will never interrupt your running timer.',
        image: '/images/tutorials/current/presence-settings.webp'
      }
    ]
  },
  {
    id: 'reflection',
    label: 'AI Coach',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
    ),
    steps: [
      {
        title: 'Quick Reflection & Keystroke Telemetry',
        description: 'Write a short reflection about how you feel or what you want to study. Submit & Analyze uses that context to suggest a study rhythm and task plan.',
        tip: 'Click "Submit & Analyze" to receive immediate coach recommendations and task reprioritization.',
        image: '/images/tutorials/current/reflection.webp'
      },
      {
        title: 'Personalized AI Coach Mentorship',
        description: 'Open AI Coach to review your cognitive-state summary, recommended rhythm, and action plan. Apply a strategy to update the Dashboard, and revisit earlier reflections in the journal.',
        tip: 'The AI Coach adapts your daily plan when you are stressed or struggling with high-friction tasks.',
        image: '/images/tutorials/current/coach.webp'
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
        description: 'Analytics shows recorded focus time, your study streak, mastered-card counts, and recent saved sessions. Daily focus uses hours and minutes.',
        tip: 'Mastery reflects your marked cards and practice activity; it is not a measured exam outcome.',
        image: '/images/tutorials/current/analytics.webp'
      },
      {
        title: 'Weekly Pacing & Focus Chart',
        description: 'Compare recorded focus time across the week and switch the chart scale between minutes and hours. The adjacent panel summarizes BreakGate pacing and rest information.',
        tip: 'Chart totals can use rounded decimal hours; daily totals show hours and minutes.',
        image: '/images/tutorials/current/chart.webp'
      }
    ]
  }
];

export default function FeatureGuideModal({ isOpen, onClose, initialTopic = 'pomodoro' }) {
  const [activeTopicId, setActiveTopicId] = useState(initialTopic);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const dialogRef = useRef(null);
  const navRef = useRef(null);
  const imageButtonRef = useRef(null);
  const zoomCloseRef = useRef(null);
  useEffect(() => {
    if (isOpen) { setActiveTopicId(initialTopic); setCurrentStepIndex(0); setIsZoomed(false); }
  }, [isOpen, initialTopic]);
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog.close(); document.body.style.overflow = overflow; };
  }, [isOpen]);
  useEffect(() => {
    navRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTopicId, isOpen]);
  useEffect(() => { if (isZoomed) zoomCloseRef.current?.focus(); }, [isZoomed]);
  if (!isOpen) return null;
  const topicIndex = Math.max(0, TUTORIAL_TOPICS.findIndex(t => t.id === activeTopicId));
  const topic = TUTORIAL_TOPICS[topicIndex];
  const step = topic.steps[currentStepIndex] || topic.steps[0];
  const first = currentStepIndex === 0 && topicIndex === 0;
  const last = currentStepIndex === topic.steps.length - 1 && topicIndex === TUTORIAL_TOPICS.length - 1;
  const selectTopic = id => { setActiveTopicId(id); setCurrentStepIndex(0); };
  const next = () => {
    if (currentStepIndex < topic.steps.length - 1) setCurrentStepIndex(i => i + 1);
    else if (!last) selectTopic(TUTORIAL_TOPICS[topicIndex + 1].id);
    else onClose();
  };
  const previous = () => {
    if (currentStepIndex > 0) setCurrentStepIndex(i => i - 1);
    else if (!first) { setActiveTopicId(TUTORIAL_TOPICS[topicIndex - 1].id); setCurrentStepIndex(TUTORIAL_TOPICS[topicIndex - 1].steps.length - 1); }
  };
  const closeZoom = () => { setIsZoomed(false); requestAnimationFrame(() => imageButtonRef.current?.focus()); };
  const picture = className => <picture className={className}>
    <source media="(max-width: 600px)" srcSet={step.image.replace('.webp', '-mobile.webp')} />
    {/* Actual captures of the application; keep their original proportions. */}
    <img src={step.image} alt={step.title + ' in iFocus'} />
  </picture>;
  return createPortal(
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="feature-guide-title"
      onCancel={e => { e.preventDefault(); if (isZoomed) closeZoom(); else onClose(); }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => {
        if (isZoomed) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); previous(); }
      }}>
      <div className={styles.frame} inert={isZoomed ? true : undefined}>
        <header className={styles.header}>
          <div><h2 id="feature-guide-title">iFocus Feature Guide</h2><p>Explore the tools, one step at a time.</p></div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close guide">×</button>
        </header>
        <nav ref={navRef} className={styles.topics} aria-label="Guide topics">
          {TUTORIAL_TOPICS.map(t => <button type="button" key={t.id} aria-pressed={t.id === topic.id} onClick={() => selectTopic(t.id)}>{t.icon}<span>{t.label}</span></button>)}
        </nav>
        <div className={styles.body} key={step.title}>
          <div className={styles.stepLine}><span>{topic.label} · Step {currentStepIndex + 1} of {topic.steps.length}</span><span className={styles.keyboardHint}>← → to navigate</span></div>
          <h3>{step.title}</h3><p className={styles.description}>{step.description}</p>
          <button ref={imageButtonRef} type="button" className={styles.screenshot} onClick={() => setIsZoomed(true)} aria-label={'Enlarge screenshot for ' + step.title}>
            {picture(styles.picture)}<span className={styles.enlarge}>Tap to enlarge</span>
          </button>
          <p className={styles.tip}><strong>Tip</strong> {step.tip}</p>
        </div>
        <footer className={styles.footer}>
          <button type="button" onClick={previous} disabled={first}>← Previous</button>
          <span className={styles.progress} aria-label={'Topic ' + (topicIndex + 1) + ' of ' + TUTORIAL_TOPICS.length}>{topicIndex + 1} / {TUTORIAL_TOPICS.length}</span>
          <button type="button" className={styles.next} onClick={next}>{last ? 'Done' : 'Next →'}</button>
        </footer>
      </div>
      {isZoomed && <div className={styles.zoom}>
        <div className={styles.zoomHeader}><span>{step.title}</span><button ref={zoomCloseRef} type="button" className={styles.close} onClick={closeZoom} aria-label="Close enlarged screenshot">×</button></div>
        <div className={styles.zoomImage}>{picture(styles.picture)}</div><p>Scroll to see details. Close to return to the guide.</p>
      </div>}
    </dialog>, document.body
  );
}

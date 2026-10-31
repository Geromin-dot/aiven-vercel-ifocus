"use client";

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

// Crystal-clear Web Audio Synthesis for BreakGate Unlock Chime
const playBreakGateUnlockChime = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = window.__ifocusSharedAudioCtx || window.__ifocusAudioCtx || new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;

    let volFactor = 0.7;
    try {
      const soundPrefs = localStorage.getItem('ifocus_sound_preferences');
      if (soundPrefs) {
        const parsed = JSON.parse(soundPrefs);
        if (parsed.ambientVolume !== undefined) {
          volFactor = Math.max(0, Math.min(1, parsed.ambientVolume / 100));
        }
      }
    } catch (e) {}

    if (volFactor <= 0) return;

    // Triumphant 4-tone ascending arpeggio (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const startAt = now + idx * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = idx === notes.length - 1 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, startAt);

      const noteVol = (idx === notes.length - 1 ? 0.32 : 0.22) * volFactor;
      gain.gain.setValueAtTime(noteVol, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + (idx === notes.length - 1 ? 0.8 : 0.45));

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + (idx === notes.length - 1 ? 0.8 : 0.45));
    });
  } catch (e) {
    console.warn("Could not play BreakGate unlock chime:", e);
  }
};

/**
 * BreakGateModal - Interactive Multiple Choice Retrieval Challenge
 * Intercepts Pomodoro timer break and tests active deck flashcards with multiple choices.
 * Zero emojis - 100% clean modern aesthetic.
 */
export default function BreakGateModal({ isOpen, deck: propDeck, onClose, onComplete, onSkip }) {
  const { data: session } = useSession();
  const [deck, setDeck] = useState(null);
  const [challengeCards, setChallengeCards] = useState([]);
  const [optionsPerCard, setOptionsPerCard] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isOptionChecked, setIsOptionChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const unlockPlayedRef = useRef(false);

  useEffect(() => {
    if (isFinished && !unlockPlayedRef.current) {
      unlockPlayedRef.current = true;
      playBreakGateUnlockChime();
    } else if (!isFinished) {
      unlockPlayedRef.current = false;
    }
  }, [isFinished]);

  // Generate 4 randomized multiple-choice options for a card
  const generateOptionsForCard = (targetCard, allCards) => {
    const correct = targetCard.back;
    const otherCards = allCards.filter(c => c.front !== targetCard.front && c.back !== targetCard.back);
    const distractors = otherCards
      .map(c => c.back)
      .filter(b => Boolean(b) && b !== correct)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const fallbackDistractors = [
      'A cognitive mechanism focused on selective attention filtering.',
      'A temporary working memory buffer before long-term consolidation.',
      'An environmental cue strategy designed to reduce friction during task initiation.',
      'A baseline retrieval method relying on passive repetition rather than active recall.'
    ];

    let fallbackIdx = 0;
    while (distractors.length < 3) {
      const candidate = fallbackDistractors[fallbackIdx % fallbackDistractors.length];
      if (candidate !== correct && !distractors.includes(candidate)) {
        distractors.push(candidate);
      }
      fallbackIdx++;
    }

    return [correct, ...distractors].sort(() => 0.5 - Math.random());
  };

  useEffect(() => {
    if (!isOpen) return;

    // Load active BreakGate deck from prop or localStorage
    try {
      let targetDeck = propDeck;
      if (!targetDeck) {
        const stored = localStorage.getItem('ifocus_active_breakgate_deck');
        if (stored) targetDeck = JSON.parse(stored);
      }

      // Security check: if deck belongs to another student, purge it!
      if (targetDeck && targetDeck.userId && session?.user?.id && targetDeck.userId !== session.user.id) {
        targetDeck = null;
        try {
          localStorage.removeItem('ifocus_active_breakgate_deck');
          window.dispatchEvent(new CustomEvent('ifocus_breakgate_deck_changed', { detail: { active: false, deck: null } }));
        } catch(e) {}
      }

      let allCards = (targetDeck && targetDeck.cards && targetDeck.cards.length > 0)
        ? targetDeck.cards
        : null;

      if (!allCards || allCards.length === 0) {
        targetDeck = { title: 'Focus Fundamentals' };
        allCards = [
          {
            front: 'What is the primary cognitive benefit of the BreakGate protocol?',
            back: 'Active recall reinforcement before context-switching into rest.',
            keyword: 'Active Recall',
            tag: 'Cognitive Science'
          },
          {
            front: 'How long should a standard Pomodoro restorative break last?',
            back: '5 minutes of low-stimulus cognitive rest away from work screens.',
            keyword: '5-Minute Rest',
            tag: 'Productivity'
          },
          {
            front: 'Why does spacing retrieval challenges improve long-term retention?',
            back: 'It leverages the testing effect and prevents memory decay curve drops.',
            keyword: 'Spacing Effect',
            tag: 'Memory Science'
          }
        ];
      }

      setDeck(targetDeck);

      // Read custom BreakGate questions count from settings or localStorage
      let questionCount = 3;
      try {
        const savedCount = localStorage.getItem('ifocus_breakgate_question_count');
        if (savedCount) {
          questionCount = parseInt(savedCount) || 3;
        } else {
          const timerPrefs = localStorage.getItem('ifocus_timer_preferences');
          if (timerPrefs) {
            const parsed = JSON.parse(timerPrefs);
            if (parsed.breakGateQuestionCount) questionCount = parseInt(parsed.breakGateQuestionCount) || 3;
          }
        }
      } catch (e) {}
      questionCount = Math.max(1, Math.min(questionCount, 20));

      // Select cards based on user's configured question count
      const picked = [...allCards]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(questionCount, allCards.length));

      setChallengeCards(picked);

      // Generate 4 options for each challenge card
      const generatedOptions = picked.map(card => generateOptionsForCard(card, allCards));
      setOptionsPerCard(generatedOptions);

    } catch (e) {
      console.error('Error loading BreakGate deck', e);
    }

    setCurrentIndex(0);
    setSelectedOption(null);
    setIsOptionChecked(false);
    setScore(0);
    setIsFinished(false);
  }, [isOpen, propDeck]);

  if (!isOpen) return null;

  const total = challengeCards.length;
  const currentCard = challengeCards[currentIndex];
  const currentOptions = optionsPerCard[currentIndex] || [];

  const handleSelectOption = (opt) => {
    if (isOptionChecked) return;
    setSelectedOption(opt);
    setIsOptionChecked(true);

    if (opt === currentCard?.back) {
      setScore(prev => prev + 1);
      try {
        const stored = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
        if (currentCard?.front && !stored.includes(currentCard.front)) {
          stored.push(currentCard.front);
          localStorage.setItem('ifocus_mastered_cards', JSON.stringify(stored));
          window.dispatchEvent(new CustomEvent('ifocus_mastery_updated', { detail: stored }));
          fetch('/api/user/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              telemetryState: {
                masteredCards: stored,
                updatedAt: new Date().toISOString()
              }
            })
          }).catch(() => {});
        }
      } catch(e) {}
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < total) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsOptionChecked(false);
    } else {
      setIsFinished(true);
      try {
        const events = JSON.parse(localStorage.getItem('ifocus_breakgate_events') || '[]');
        const iso = new Date().toISOString();
        events.push({
          status: 'completed',
          score: score,
          total: total,
          date: iso,
          timestamp: iso
        });
        const trimmed = events.slice(-50);
        localStorage.setItem('ifocus_breakgate_events', JSON.stringify(trimmed));
        window.dispatchEvent(new CustomEvent('ifocus_breakgate_updated'));
        fetch('/api/user/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            telemetryState: {
              breakGateEvents: trimmed,
              masteredCards: JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]'),
              updatedAt: iso
            }
          })
        }).catch(() => {});
      } catch (e) {}
    }
  };

  const handleSkip = () => {
    try {
      const events = JSON.parse(localStorage.getItem('ifocus_breakgate_events') || '[]');
      const iso = new Date().toISOString();
      events.push({
        status: 'skipped',
        score: 0,
        total: total,
        date: iso,
        timestamp: iso
      });
      const trimmed = events.slice(-50);
      localStorage.setItem('ifocus_breakgate_events', JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent('ifocus_breakgate_updated'));
      fetch('/api/user/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryState: {
            breakGateEvents: trimmed,
            updatedAt: iso
          }
        })
      }).catch(() => {});
    } catch (e) {}
    if (onSkip) onSkip();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '20px',
        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '740px',
        padding: '1.25rem 1.6rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        animation: 'flashcardFadeIn 0.25s ease',
        maxHeight: '94vh',
        overflowY: 'auto'
      }}>

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                background: 'rgba(46, 125, 50, 0.12)',
                color: '#2e7d32',
                padding: '0.2rem 0.65rem',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                BREAKGATE MULTIPLE CHOICE TEST
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {deck?.title || 'Active Deck'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isFinished ? 'BreakGate Unlocked' : 'Break Retrieval Challenge'}
            </h2>
          </div>

          <button 
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.85rem',
              cursor: 'pointer',
              fontWeight: 500,
              textDecoration: 'underline'
            }}
          >
            Skip to Break
          </button>
        </div>

        {/* Finished / Unlocked State */}
        {isFinished ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: 'rgba(46, 125, 50, 0.12)',
              color: '#2e7d32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="7"/>
                <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
              </svg>
            </div>

            <div>
              <h3 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                Memory Reinforced!
              </h3>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                background: 'rgba(46, 125, 50, 0.1)',
                border: '1px solid rgba(46, 125, 50, 0.25)',
                color: '#2e7d32',
                fontWeight: 700,
                fontSize: '0.85rem',
                padding: '0.25rem 0.85rem',
                borderRadius: '999px',
                marginBottom: '0.5rem'
              }}>
                Score: {score} of {total} Correct ({total > 0 ? Math.round((score / total) * 100) : 100}%)
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, maxWidth: '440px', lineHeight: 1.5 }}>
                You successfully completed your BreakGate micro-test. Your restorative Pomodoro break is now unlocked.
              </p>
            </div>

            <button 
              onClick={onComplete}
              style={{
                background: '#2e7d32',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.85rem 2.2rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(46, 125, 50, 0.3)',
                marginTop: '0.5rem',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Start Break Now
            </button>
          </div>
        ) : (
          /* Active Multiple Choice Challenge */
          <>
            {/* Question Progress Tracker */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>Question {currentIndex + 1} of {total}</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {challengeCards.map((_, i) => (
                  <div key={i} style={{
                    width: '32px',
                    height: '6px',
                    borderRadius: '3px',
                    background: i < currentIndex ? '#2e7d32' : i === currentIndex ? 'var(--primary-accent)' : 'rgba(0,0,0,0.1)',
                    transition: 'background 0.3s ease'
                  }} />
                ))}
              </div>
            </div>

            {/* Question Prompt Card */}
            <div style={{
              background: '#fafbfa',
              border: '1.5px solid rgba(0,0,0,0.08)',
              borderRadius: '14px',
              padding: '0.85rem 1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem'
            }}>
              <span style={{
                alignSelf: 'flex-start',
                background: 'rgba(95, 143, 94, 0.12)',
                color: 'var(--primary-accent)',
                padding: '0.15rem 0.6rem',
                borderRadius: '6px',
                fontSize: '0.7rem',
                fontWeight: 700
              }}>
                {currentCard?.tag || 'Question'}
              </span>

              <h3 style={{
                fontSize: '1.08rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                margin: 0
              }}>
                {currentCard?.front}
              </h3>

              {isOptionChecked && currentCard?.keyword && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  background: 'rgba(95, 143, 94, 0.1)',
                  border: '1px solid rgba(95, 143, 94, 0.25)',
                  borderRadius: '999px',
                  padding: '0.2rem 0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#2e7d32',
                  alignSelf: 'flex-start',
                  marginTop: '0.15rem',
                  animation: 'flashcardFadeIn 0.2s ease'
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="16" x2="12" y2="12"/>
                    <line x1="12" y1="8" x2="12.01" y2="8"/>
                  </svg>
                  KEY CONCEPT: {currentCard.keyword}
                </div>
              )}
            </div>

            {/* 4 Multiple Choice Options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.55rem' }}>
              {currentOptions.map((opt, i) => {
                const isCorrect = opt === currentCard?.back;
                const isSelected = selectedOption === opt;

                let btnBg = '#ffffff';
                let btnBorder = '1.5px solid rgba(0,0,0,0.1)';
                let btnColor = 'var(--text-primary)';
                let btnShadow = '0 2px 5px rgba(0,0,0,0.02)';
                let btnTransform = 'scale(1)';
                let btnOpacity = 1;

                if (isOptionChecked) {
                  if (isCorrect) {
                    btnBg = 'rgba(16, 185, 129, 0.16)';
                    btnBorder = '2px solid #10b981';
                    btnColor = '#065f46';
                    btnShadow = '0 4px 14px rgba(16, 185, 129, 0.22)';
                    btnTransform = 'scale(1.015)';
                    btnOpacity = 1;
                  } else if (isSelected) {
                    btnBg = 'rgba(239, 68, 68, 0.14)';
                    btnBorder = '2px solid #ef4444';
                    btnColor = '#991b1b';
                    btnShadow = '0 4px 14px rgba(239, 68, 68, 0.18)';
                    btnTransform = 'scale(0.99)';
                    btnOpacity = 1;
                  } else {
                    btnBg = 'rgba(0,0,0,0.02)';
                    btnBorder = '1px solid rgba(0,0,0,0.06)';
                    btnColor = 'var(--text-secondary)';
                    btnShadow = 'none';
                    btnTransform = 'scale(0.985)';
                    btnOpacity = 0.45;
                  }
                }

                return (
                  <button
                    key={i}
                    onClick={() => handleSelectOption(opt)}
                    disabled={isOptionChecked}
                    style={{
                      background: btnBg,
                      border: btnBorder,
                      borderRadius: '12px',
                      padding: '0.65rem 1rem',
                      fontSize: '0.88rem',
                      color: btnColor,
                      fontWeight: isOptionChecked && (isCorrect || isSelected) ? 600 : 500,
                      textAlign: 'left',
                      cursor: isOptionChecked ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), color 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease, box-shadow 0.4s ease',
                      boxShadow: btnShadow,
                      transform: btnTransform,
                      opacity: btnOpacity
                    }}
                  >
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: isOptionChecked && isCorrect ? '#2e7d32' : 'rgba(0,0,0,0.06)',
                      color: isOptionChecked && isCorrect ? '#ffffff' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.38 }}>{opt}</span>
                    {isOptionChecked && isCorrect && (
                      <span style={{ color: '#2e7d32', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Correct
                      </span>
                    )}
                    {isOptionChecked && isSelected && !isCorrect && (
                      <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Incorrect
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: '38px', marginTop: '0.15rem' }}>
              {isOptionChecked && (
                <button
                  onClick={handleNextQuestion}
                  style={{
                    background: '#2e7d32',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.6rem 1.4rem',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(46, 125, 50, 0.25)',
                    animation: 'flashcardFadeIn 0.2s ease'
                  }}
                >
                  {currentIndex < total - 1 ? 'Next Question' : 'Complete & Unlock Break'}
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

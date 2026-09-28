"use client";

import React, { useState, useEffect } from 'react';

/**
 * BreakGateModal - Interactive Multiple Choice Retrieval Challenge
 * Intercepts Pomodoro timer break and tests active deck flashcards with multiple choices.
 * Zero emojis - 100% clean modern aesthetic.
 */
export default function BreakGateModal({ isOpen, deck: propDeck, onClose, onComplete, onSkip }) {
  const [deck, setDeck] = useState(null);
  const [challengeCards, setChallengeCards] = useState([]);
  const [optionsPerCard, setOptionsPerCard] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isOptionChecked, setIsOptionChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

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

      // Select up to 3 cards for a quick, focused micro-test
      const picked = [...allCards]
        .sort(() => 0.5 - Math.random())
        .slice(0, Math.min(3, allCards.length));

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
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex + 1 < total) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsOptionChecked(false);
    } else {
      setIsFinished(true);
    }
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
      padding: '1.25rem'
    }}>
      <div style={{
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        borderRadius: '20px',
        boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
        width: '100%',
        maxWidth: '620px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        animation: 'flashcardFadeIn 0.25s ease',
        maxHeight: '90vh',
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
            onClick={onSkip}
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
                You successfully completed your BreakGate micro-test. Your 5-minute restorative Pomodoro break is now unlocked.
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
              borderRadius: '16px',
              padding: '1.5rem 1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <span style={{
                alignSelf: 'flex-start',
                background: 'rgba(95, 143, 94, 0.12)',
                color: 'var(--primary-accent)',
                padding: '0.2rem 0.65rem',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                {currentCard?.tag || 'Question'}
              </span>

              <h3 style={{
                fontSize: '1.18rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.45,
                margin: 0
              }}>
                {currentCard?.front}
              </h3>

              {isOptionChecked && currentCard?.keyword && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  background: 'rgba(95, 143, 94, 0.1)',
                  border: '1px solid rgba(95, 143, 94, 0.25)',
                  borderRadius: '999px',
                  padding: '0.25rem 0.8rem',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#2e7d32',
                  alignSelf: 'flex-start',
                  marginTop: '0.25rem',
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.65rem' }}>
              {currentOptions.map((opt, i) => {
                const isCorrect = opt === currentCard?.back;
                const isSelected = selectedOption === opt;

                let btnBg = '#ffffff';
                let btnBorder = '1.5px solid rgba(0,0,0,0.1)';
                let btnColor = 'var(--text-primary)';

                if (isOptionChecked) {
                  if (isCorrect) {
                    btnBg = 'rgba(46, 125, 50, 0.12)';
                    btnBorder = '2px solid #2e7d32';
                    btnColor = '#1b5e20';
                  } else if (isSelected) {
                    btnBg = 'rgba(224, 62, 62, 0.1)';
                    btnBorder = '2px solid #dc2626';
                    btnColor = '#dc2626';
                  } else {
                    btnBg = 'rgba(0,0,0,0.02)';
                    btnBorder = '1px solid rgba(0,0,0,0.06)';
                    btnColor = 'var(--text-secondary)';
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
                      padding: '0.85rem 1.15rem',
                      fontSize: '0.92rem',
                      color: btnColor,
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: isOptionChecked ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                    }}
                  >
                    <span style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: isOptionChecked && isCorrect ? '#2e7d32' : 'rgba(0,0,0,0.06)',
                      color: isOptionChecked && isCorrect ? '#ffffff' : 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{opt}</span>
                    {isOptionChecked && isCorrect && (
                      <span style={{ color: '#2e7d32', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Correct
                      </span>
                    )}
                    {isOptionChecked && isSelected && !isCorrect && (
                      <span style={{ color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: '42px', marginTop: '0.25rem' }}>
              {isOptionChecked && (
                <button
                  onClick={handleNextQuestion}
                  style={{
                    background: '#2e7d32',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '0.75rem 1.6rem',
                    fontSize: '0.92rem',
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

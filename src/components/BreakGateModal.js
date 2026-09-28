"use client";

import React, { useState, useEffect } from 'react';

/**
 * BreakGateModal - Micro-recall challenge before unlocking a Pomodoro break.
 * Intercepts timer expiration and tests active deck flashcards.
 * Zero emojis - 100% clean modern aesthetic.
 */
export default function BreakGateModal({ isOpen, onClose, onComplete, onSkip }) {
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [masteredCount, setMasteredCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // Load active BreakGate deck from localStorage
    try {
      const stored = localStorage.getItem('ifocus_active_breakgate_deck');
      if (stored) {
        const parsed = JSON.parse(stored);
        setDeck(parsed);
        // Shuffle or pick up to 3 cards for a quick retrieval challenge
        const allCards = parsed.cards || [];
        const challengeCards = [...allCards]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.min(3, allCards.length));
        setCards(challengeCards);
      } else {
        // Fallback default sample cards if no deck activated yet
        setDeck({ title: 'Focus Fundamentals' });
        setCards([
          {
            front: 'What is the primary benefit of the BreakGate protocol?',
            back: 'Active recall reinforcement before context switching into rest.',
            keyword: 'Active Recall',
            tag: 'Cognitive Science'
          },
          {
            front: 'How long should a standard Pomodoro short break last?',
            back: '5 minutes of restorative cognitive rest away from high-stimulus screens.',
            keyword: '5 Minutes Rest',
            tag: 'Productivity'
          }
        ]);
      }
    } catch (e) {
      console.error('Error loading BreakGate deck', e);
    }

    setCurrentIndex(0);
    setIsRevealed(false);
    setMasteredCount(0);
    setIsFinished(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const total = cards.length;

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleAnswer = (result) => {
    if (result === 'mastered') {
      setMasteredCount(prev => prev + 1);
    }

    if (currentIndex + 1 < total) {
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
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
        maxWidth: '560px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        animation: 'flashcardFadeIn 0.3s ease'
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
                BREAKGATE CHECKPOINT
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {deck?.title || 'Active Deck'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isFinished ? 'BreakGate Unlocked' : 'Quick Retrieval Challenge'}
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

        {/* Finished State */}
        {isFinished ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(46, 125, 50, 0.12)',
              color: '#2e7d32',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                Memory Reinforced
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, maxWidth: '420px' }}>
                You completed your BreakGate micro-test. Your 5-minute restorative break is now unlocked.
              </p>
            </div>
            <button 
              onClick={onComplete}
              style={{
                background: '#2e7d32',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.85rem 2rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(46, 125, 50, 0.3)',
                marginTop: '0.5rem',
                transition: 'transform 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              Start Break Now
            </button>
          </div>
        ) : (
          /* Active Card Challenge */
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              <span>Card {currentIndex + 1} of {total}</span>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                {cards.map((_, i) => (
                  <div key={i} style={{
                    width: '24px',
                    height: '6px',
                    borderRadius: '3px',
                    background: i < currentIndex ? '#2e7d32' : i === currentIndex ? 'var(--primary-accent)' : 'rgba(0,0,0,0.1)'
                  }} />
                ))}
              </div>
            </div>

            {/* Question Card Surface */}
            <div style={{
              background: '#fafbfa',
              border: '1.5px solid rgba(0,0,0,0.08)',
              borderRadius: '16px',
              padding: '2rem 1.75rem',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              textAlign: 'center',
              gap: '1rem'
            }}>
              <span style={{
                background: 'rgba(95, 143, 94, 0.12)',
                color: 'var(--primary-accent)',
                padding: '0.2rem 0.65rem',
                borderRadius: '12px',
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                {currentCard?.tag || 'Concept'}
              </span>

              {/* Front Text */}
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                lineHeight: 1.4,
                maxWidth: '90%'
              }}>
                {currentCard?.front}
              </div>

              {/* Revealed Back */}
              {isRevealed && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '0.75rem',
                  paddingTop: '1rem',
                  borderTop: '1px dashed rgba(0,0,0,0.12)',
                  width: '100%',
                  animation: 'flashcardFadeIn 0.25s ease'
                }}>
                  {currentCard?.keyword && (
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'rgba(95, 143, 94, 0.12)',
                      border: '1px solid rgba(95, 143, 94, 0.3)',
                      borderRadius: '999px',
                      padding: '0.3rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#2e7d32'
                    }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="16" x2="12" y2="12"/>
                        <line x1="12" y1="8" x2="12.01" y2="8"/>
                      </svg>
                      KEY CONCEPT: {currentCard.keyword}
                    </div>
                  )}

                  <div style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    textAlign: 'center'
                  }}>
                    {currentCard?.back}
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {!isRevealed ? (
                <button
                  onClick={handleReveal}
                  style={{
                    width: '100%',
                    background: 'var(--primary-accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.85rem',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Reveal Answer
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleAnswer('review')}
                    style={{
                      flex: 1,
                      background: 'transparent',
                      color: 'var(--text-secondary)',
                      border: '1px solid rgba(0,0,0,0.15)',
                      borderRadius: '12px',
                      padding: '0.8rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Still Reviewing
                  </button>

                  <button
                    onClick={() => handleAnswer('mastered')}
                    style={{
                      flex: 1,
                      background: '#2e7d32',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '0.8rem',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.4rem'
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Mastered
                  </button>
                </>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

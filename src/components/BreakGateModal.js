'use client';
import React, { useState, useEffect } from 'react';

export default function BreakGateModal({ isOpen, deck, onComplete, onSkip }) {
  const [cards, setCards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [results, setResults] = useState({}); // { [id]: 'mastered' | 'review' }
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    if (isOpen && deck && deck.cards && deck.cards.length > 0) {
      // Pick up to 3 cards, shuffling
      const shuffled = [...deck.cards].sort(() => 0.5 - Math.random());
      setCards(shuffled.slice(0, Math.min(3, shuffled.length)));
      setCurrentIndex(0);
      setIsRevealed(false);
      setResults({});
      setIsFinished(false);
    }
  }, [isOpen, deck]);

  if (!isOpen) return null;

  const currentCard = cards[currentIndex];
  const total = cards.length;

  const handleReveal = () => {
    setIsRevealed(true);
  };

  const handleAnswer = (status) => {
    if (!currentCard) return;
    const cardId = currentCard.id || `card-${currentIndex}`;
    const nextResults = { ...results, [cardId]: status };
    setResults(nextResults);

    // If marked mastered, update deck mastery in localStorage
    if (status === 'mastered') {
      try {
        const storedDeck = localStorage.getItem('ifocus_active_breakgate_deck');
        if (storedDeck) {
          const parsed = JSON.parse(storedDeck);
          if (!parsed.masteredCardIds) parsed.masteredCardIds = [];
          if (!parsed.masteredCardIds.includes(cardId)) {
            parsed.masteredCardIds.push(cardId);
            localStorage.setItem('ifocus_active_breakgate_deck', JSON.stringify(parsed));
          }
        }
      } catch (e) {}
    }

    if (currentIndex < total - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsRevealed(false);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(23, 37, 24, 0.65)',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        maxWidth: '680px',
        width: '100%',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.06)',
        padding: '2rem 2.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>

        {/* Modal Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span style={{ background: 'rgba(95, 143, 94, 0.15)', color: '#2e7d32', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                🎯 BREAKGATE
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                {deck?.title || 'Active Deck'}
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {isFinished ? 'BreakGate Unlocked! 🎉' : 'Quick Retrieval Challenge'}
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
            Skip to Break →
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
              justifyContent: 'center',
              fontSize: '2rem'
            }}>
              ✓
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 700, margin: '0 0 0.35rem 0' }}>
                Memory Reinforced!
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
                transition: 'transform 0.2s ease'
              }}
            >
              Start Break Now ☕
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
                      background: 'rgba(95, 143, 94, 0.12)',
                      border: '1px solid rgba(95, 143, 94, 0.3)',
                      borderRadius: '999px',
                      padding: '0.3rem 0.85rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#2e7d32'
                    }}>
                      💡 Key: {currentCard.keyword}
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
                      cursor: 'pointer'
                    }}
                  >
                    Got It! (Mastered)
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

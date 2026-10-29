"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import HelpButton from '@/components/HelpButton';
import emptyStateImg from '../../img/empty_flashcard_state.png';

// Helper: Ensure every card has a smart, active-recall mnemonic hint
const getCardHint = (card, isDefFirst) => {
  if (!card) return null;
  if (card.keyword && String(card.keyword).trim()) return String(card.keyword).trim();
  if (card.hint && String(card.hint).trim()) return String(card.hint).trim();

  const f = (card.front || '').trim();
  const b = (card.back || '').trim();

  // 1. Quoted phrase in definition (e.g. "phonebook ng internet")
  const quoted = b.match(/["“]([^"”]{3,35})["”]/);
  if (quoted) return quoted[1].trim();

  // 2. Acronym or parentheses
  const acronymMatch = f.match(/^([A-Z0-9]{2,6})\s*\((.+)\)$/);
  if (acronymMatch) return acronymMatch[1];
  const parenMatch = f.match(/\((.+)\)/);
  if (parenMatch) return parenMatch[1].trim();

  // 3. Parenthetical list in back
  const parenBack = b.match(/\(([^)]{3,30})\)/);
  if (parenBack) return parenBack[1].trim();

  // 4. Clean summary phrase
  let clean = b
    .replace(/^(Ang\s+(?:proseso|paraan|tawag|konsepto)\s+ng\s+)/i, '')
    .replace(/^(A\s+(?:security model|set of|framework|method|concept|process)\s+(?:requiring|that|to|of)\s+)/i, '');
  const firstClause = clean.split(/[,.;:]/)[0].trim();
  return firstClause.split(/\s+/).slice(0, 3).join(' ') || 'Memory Anchor';
};

// Tactile, crisp audio synthesis for notification toasts (Modern bubble-pop + crystal ping)
const playToastSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!window.__ifocusAudioCtx || window.__ifocusAudioCtx.state === 'closed') {
      window.__ifocusAudioCtx = new AudioCtx();
    }
    const ctx = window.__ifocusAudioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    let volFactor = 0.7;
    try {
      const savedVol = localStorage.getItem('ifocus_sound_volume');
      if (savedVol !== null) {
        const parsed = parseInt(savedVol, 10);
        if (!isNaN(parsed)) volFactor = Math.max(0, Math.min(100, parsed)) / 100;
      }
    } catch (e) {}
    if (volFactor <= 0) return;

    const now = ctx.currentTime;

    // 1. Organic tactile bubble pop (fast upward pitch snap + snappy decay)
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(820, now);
    popOsc.frequency.exponentialRampToValueAtTime(1420, now + 0.045);
    popGain.gain.setValueAtTime(0.18 * volFactor, now);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.09);

    // 2. High-end gentle acoustic shimmer overtone (distinct from presence chime and alarm)
    const shimmerOsc = ctx.createOscillator();
    const shimmerGain = ctx.createGain();
    shimmerOsc.type = 'sine';
    shimmerOsc.frequency.setValueAtTime(1760, now + 0.02);
    shimmerGain.gain.setValueAtTime(0.001, now);
    shimmerGain.gain.setValueAtTime(0.09 * volFactor, now + 0.025);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    shimmerOsc.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmerOsc.start(now + 0.02);
    shimmerOsc.stop(now + 0.17);
  } catch (e) {
    // Autoplay policy or unsupported audio
  }
};

export default function FlashcardsPage() {
  const [view, setView] = useState('collections'); // 'collections' | 'create' | 'loading' | 'study'

  // Collections State
  const [decks, setDecks] = useState([]);
  const [loadingDecks, setLoadingDecks] = useState(true);

  // Deck Creation State
  const [deckName, setDeckName] = useState('');
  const [activeTab, setActiveTab] = useState('text'); // 'text' | 'pdf'
  const [notesText, setNotesText] = useState('');
  const [cardCount, setCardCount] = useState(8);
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileSize, setPdfFileSize] = useState('');
  const [pdfBase64, setPdfBase64] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // Loading Progress Animation
  const [loadingStatus, setLoadingStatus] = useState('Analyzing study material...');
  const [loadingProgress, setLoadingProgress] = useState(20);

  // Study Deck State
  const [activeDeck, setActiveDeck] = useState(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [definitionFirst, setDefinitionFirst] = useState(false);
  const [masteredCards, setMasteredCards] = useState(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [isSavingDeck, setIsSavingDeck] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Show/Hide Hints State (Single Toggle)
  const [showHints, setShowHints] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ifocus_show_hints');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });

  const handleToggleHints = () => {
    setShowHints(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ifocus_show_hints', String(next));
      } catch (e) {}
      return next;
    });
  };

  // BreakGate Pop-up Modal State
  const [activeBreakGateId, setActiveBreakGateId] = useState(null);
  const [breakGateModalDeck, setBreakGateModalDeck] = useState(null);
  const [activatingId, setActivatingId] = useState(null);

  // Delete Deck Confirmation Modal State
  const [deckToDelete, setDeckToDelete] = useState(null);
  const [isDeletingDeck, setIsDeletingDeck] = useState(false);

  // Mastered Cards Tracking State for Collections and Study
  const [storedMasteredKeys, setStoredMasteredKeys] = useState([]);

  useEffect(() => {
    const loadMastered = () => {
      try {
        const raw = localStorage.getItem('ifocus_mastered_cards');
        if (raw) setStoredMasteredKeys(JSON.parse(raw));
        else setStoredMasteredKeys([]);
      } catch (e) {}
    };
    loadMastered();
    window.addEventListener('ifocus_mastery_updated', loadMastered);
    window.addEventListener('storage', loadMastered);
    return () => {
      window.removeEventListener('ifocus_mastery_updated', loadMastered);
      window.removeEventListener('storage', loadMastered);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ifocus_active_breakgate_deck');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.id || parsed.title)) {
          setActiveBreakGateId(parsed.id || parsed.title);
        }
      }
    } catch(e) {}
  }, []);

  const handleToggleActivateBreakGate = (deck, e) => {
    if (e) e.stopPropagation();
    const currentId = deck.id || deck.title;
    
    // Trigger tactile burst animation on the card
    setActivatingId(currentId);
    setTimeout(() => setActivatingId(null), 650);

    if (activeBreakGateId === currentId) {
      localStorage.removeItem('ifocus_active_breakgate_deck');
      setActiveBreakGateId(null);
      showToast('BreakGate deactivated for this deck.');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ifocus_breakgate_deck_changed', { detail: { active: false, deck: null } }));
      }
    } else {
      localStorage.setItem('ifocus_active_breakgate_deck', JSON.stringify(deck));
      setActiveBreakGateId(currentId);
      // Open clean on-screen pop-up modal
      setBreakGateModalDeck(deck);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ifocus_breakgate_deck_changed', { detail: { active: true, deck } }));
      }
    }
  };

  // Practice Exam State
  const [examIndex, setExamIndex] = useState(0);
  const [examScore, setExamScore] = useState(0);
  const [examOptions, setExamOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isOptionChecked, setIsOptionChecked] = useState(false);
  const [examFinished, setExamFinished] = useState(false);

  const generateExamOptions = (cardIndex, cardsList) => {
    if (!cardsList || cardsList.length === 0) return [];
    const correct = cardsList[cardIndex]?.back || '';
    const distractors = cardsList
      .filter((_, i) => i !== cardIndex)
      .map(c => c.back)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    while (distractors.length < 3) {
      distractors.push(`Alternative concept definition #${distractors.length + 1}`);
    }

    return [correct, ...distractors].sort(() => 0.5 - Math.random());
  };

  const handleStartExam = (deck) => {
    setActiveDeck(deck);
    setExamIndex(0);
    setExamScore(0);
    setSelectedOption(null);
    setIsOptionChecked(false);
    setExamFinished(false);
    setExamOptions(generateExamOptions(0, deck.cards));
    setView('exam');
  };

  const handleSelectOption = (option) => {
    if (isOptionChecked) return;
    setSelectedOption(option);
    setIsOptionChecked(true);

    const currentQ = activeDeck?.cards?.[examIndex];
    if (option === currentQ?.back) {
      setExamScore(s => s + 1);
      setMasteredCards(prev => new Set([...prev, examIndex]));
      try {
        const storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
        if (currentQ?.front && !storedMastered.includes(currentQ.front)) {
          storedMastered.push(currentQ.front);
          localStorage.setItem('ifocus_mastered_cards', JSON.stringify(storedMastered));
          setStoredMasteredKeys(storedMastered);
          window.dispatchEvent(new CustomEvent('ifocus_mastery_updated'));
        }
      } catch(e) {}
    }
  };

  const handleNextExamQuestion = () => {
    const nextIdx = examIndex + 1;
    if (nextIdx < (activeDeck?.cards?.length || 0)) {
      setExamIndex(nextIdx);
      setSelectedOption(null);
      setIsOptionChecked(false);
      setExamOptions(generateExamOptions(nextIdx, activeDeck.cards));
    } else {
      setExamFinished(true);
    }
  };

  const toastTimeoutRef = useRef(null);

  const showToast = (message) => {
    try {
      playToastSound();
    } catch (e) {}
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // 1. Fetch User's Decks from Database
  const fetchDecks = async () => {
    try {
      const res = await fetch('/api/decks');
      if (res.ok) {
        const data = await res.json();
        setDecks(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load decks:", err);
    } finally {
      setLoadingDecks(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, []);

  // 2. Handle PDF File Selection & Base64 Conversion
  const handlePdfUpload = (file) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      showToast("Please upload a valid PDF document.");
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024 
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
      : `${Math.round(file.size / 1024)} KB`;

    setPdfFileName(file.name);
    setPdfFileSize(sizeFormatted);

    // Auto-fill deck name from filename if empty
    if (!deckName.trim()) {
      setDeckName(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result;
      setPdfBase64(base64String);
    };
    reader.readAsDataURL(file);
  };

  const handleClearPdf = () => {
    setPdfFileName('');
    setPdfFileSize('');
    setPdfBase64('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 3. Handle Flashcards Generation via Gemini AI
  const handleGenerate = async () => {
    const isPdf = activeTab === 'pdf';
    
    if (isPdf && !pdfBase64) {
      showToast("Please select or drop a PDF file first.");
      return;
    }

    if (!isPdf && !notesText.trim()) {
      showToast("Please paste your lecture notes or study material first.");
      return;
    }

    const finalDeckTitle = deckName.trim() || (isPdf ? pdfFileName.replace(/\.pdf$/i, '') : 'Study Deck');

    // Switch to loading view
    setView('loading');
    setLoadingProgress(25);
    setLoadingStatus(isPdf ? 'Reading PDF syllabus and document pages...' : 'Reading study notes...');

    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 88) return prev;
        if (prev === 40) setLoadingStatus('Extracting core concepts, definitions, and formulas...');
        if (prev === 70) setLoadingStatus('Formatting flashcards for active recall...');
        return prev + 12;
      });
    }, 600);

    try {
      const payload = {
        type: isPdf ? 'pdf' : 'text',
        text: isPdf ? undefined : notesText.trim(),
        pdfBase64: isPdf ? pdfBase64 : undefined,
        cardCount: cardCount
      };

      const res = await fetch('/api/ai/flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to generate flashcards');
      }

      const data = await res.json();
      setLoadingProgress(100);

      // Setup study view with newly generated cards
      setActiveDeck({
        id: null,
        title: finalDeckTitle,
        cards: data.cards || []
      });
      setCurrentCardIndex(0);
      setIsFlipped(false);
      setMasteredCards(new Set());
      setIsSaved(false);

      setTimeout(() => {
        setView('study');
      }, 400);

    } catch (err) {
      clearInterval(interval);
      showToast(err.message || "Failed to generate flashcards. Please try again.");
      setView('create');
    }
  };

  // 4. Save Deck to Database
  const handleSaveDeck = async () => {
    if (!activeDeck || !activeDeck.cards || activeDeck.cards.length === 0) return;
    setIsSavingDeck(true);
    try {
      const res = await fetch('/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeDeck.title,
          cards: activeDeck.cards
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save deck');
      }

      const savedData = await res.json();
      setActiveDeck(prev => ({ ...prev, id: savedData.id }));
      setIsSaved(true);
      showToast('Deck saved to your collections.');
      fetchDecks(); // Refresh collections
    } catch (err) {
      showToast("Error saving deck: " + err.message);
    } finally {
      setIsSavingDeck(false);
    }
  };

  // 5. Delete Deck Confirmation Handler
  const handleConfirmDeleteDeck = async () => {
    if (!deckToDelete) return;
    setIsDeletingDeck(true);

    try {
      const res = await fetch(`/api/decks/${deckToDelete.id}`, { method: 'DELETE' });
      if (res.ok) {
        setDecks(prev => prev.filter(d => d.id !== deckToDelete.id));
        if (activeBreakGateId === deckToDelete.id || activeBreakGateId === deckToDelete.title) {
          localStorage.removeItem('ifocus_active_breakgate_deck');
          setActiveBreakGateId(null);
        }
        showToast('Deck deleted successfully.');
        setDeckToDelete(null);
      } else {
        showToast('Failed to delete deck. Please try again.');
      }
    } catch (err) {
      showToast('Error deleting deck: ' + err.message);
    } finally {
      setIsDeletingDeck(false);
    }
  };

  // 6. Launch Study Mode for Existing Deck
  const handleStartStudy = (deck) => {
    setActiveDeck(deck);
    setCurrentCardIndex(0);
    setIsFlipped(false);

    // Pre-populate mastered cards from localStorage
    let storedMastered = [];
    try {
      storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
    } catch(e) {}

    const preMastered = new Set();
    (deck.cards || []).forEach((c, idx) => {
      if (storedMastered.includes(c.front)) {
        preMastered.add(idx);
      }
    });

    setMasteredCards(preMastered);
    setIsSaved(true); // Already in database
    setView('study');
  };

  // Study Navigation Helpers
  const currentCard = activeDeck?.cards?.[currentCardIndex] || null;
  const totalCards = activeDeck?.cards?.length || 0;
  const cardHint = getCardHint(currentCard, definitionFirst);

  const handleNextCard = () => {
    if (currentCardIndex < totalCards - 1) {
      setIsFlipped(false);
      setCurrentCardIndex(prev => prev + 1);
    }
  };

  const handlePrevCard = () => {
    if (currentCardIndex > 0) {
      setIsFlipped(false);
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  const handleShuffle = () => {
    if (!activeDeck?.cards) return;
    const shuffled = [...activeDeck.cards].sort(() => Math.random() - 0.5);
    setActiveDeck(prev => ({ ...prev, cards: shuffled }));
    setCurrentCardIndex(0);
    setIsFlipped(false);
    showToast('Deck shuffled.');
  };

  const toggleMastery = () => {
    if (!currentCard) return;
    const cardKey = currentCard.front;
    let storedMastered = [];
    try {
      storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
    } catch(e) {}

    setMasteredCards(prev => {
      const next = new Set(prev);
      if (next.has(currentCardIndex)) {
        next.delete(currentCardIndex);
        storedMastered = storedMastered.filter(k => k !== cardKey);
      } else {
        next.add(currentCardIndex);
        if (!storedMastered.includes(cardKey)) {
          storedMastered.push(cardKey);
        }
      }
      try {
        localStorage.setItem('ifocus_mastered_cards', JSON.stringify(storedMastered));
        window.dispatchEvent(new CustomEvent('ifocus_mastery_updated'));
      } catch(e) {}
      setStoredMasteredKeys(storedMastered);
      return next;
    });
  };

  const handleToggleFullyMastered = () => {
    if (!activeDeck?.cards || activeDeck.cards.length === 0) return;
    let storedMastered = [];
    try {
      storedMastered = JSON.parse(localStorage.getItem('ifocus_mastered_cards') || '[]');
    } catch (e) {}

    const isFully = activeDeck.cards.length > 0 && masteredCards.size === activeDeck.cards.length;

    if (isFully) {
      // Unmark all cards in this deck
      const deckCardFronts = new Set(activeDeck.cards.map(c => c.front));
      storedMastered = storedMastered.filter(k => !deckCardFronts.has(k));
      setMasteredCards(new Set());
      showToast('Mastery reset for this deck.');
    } else {
      // Mark ALL cards in this deck as mastered
      const allIndices = new Set(activeDeck.cards.map((_, idx) => idx));
      activeDeck.cards.forEach(c => {
        if (c.front && !storedMastered.includes(c.front)) {
          storedMastered.push(c.front);
        }
      });
      setMasteredCards(allIndices);
      showToast(`All ${activeDeck.cards.length} cards marked as fully mastered!`);
    }

    try {
      localStorage.setItem('ifocus_mastered_cards', JSON.stringify(storedMastered));
      window.dispatchEvent(new CustomEvent('ifocus_mastery_updated'));
    } catch (e) {}
    setStoredMasteredKeys(storedMastered);
  };

  // Keyboard navigation inside study mode
  useEffect(() => {
    if (view !== 'study') return;
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(f => !f);
      } else if (e.code === 'ArrowRight') {
        handleNextCard();
      } else if (e.code === 'ArrowLeft') {
        handlePrevCard();
      } else if (e.key === 'h' || e.key === 'H') {
        handleToggleHints();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMastery();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, currentCardIndex, totalCards, currentCard]);

  return (
    <>
      {/* 1. BreakGate Activation Pop-Up Modal */}
      {breakGateModalDeck && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
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
            borderRadius: '20px',
            boxShadow: '0 28px 56px -12px rgba(0, 0, 0, 0.28)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            width: '100%',
            maxWidth: '480px',
            padding: '2.2rem 2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '1.25rem',
            animation: 'flashcardFadeIn 0.24s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Top Shield Icon */}
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
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>

            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(46, 125, 50, 0.1)', color: '#2e7d32', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '0.65rem' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2e7d32' }} />
                BreakGate Activated
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.45rem 0' }}>
                Linked to Pomodoro Breaks
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
                <strong style={{ color: 'var(--text-primary)' }}>"{breakGateModalDeck.title}"</strong> is now set as your active study guard. When your Pomodoro timer finishes, you will be challenged with flashcards before your break unlocks.
              </p>
            </div>

            {/* Info Card Surface */}
            <div style={{
              width: '100%',
              background: '#f8faf9',
              border: '1px solid rgba(46, 125, 50, 0.2)',
              borderRadius: '12px',
              padding: '0.9rem 1.1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'left'
            }}>
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {breakGateModalDeck.title}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {breakGateModalDeck.cards ? breakGateModalDeck.cards.length : 0} retrieval cards ready
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#2e7d32', background: 'rgba(46, 125, 50, 0.1)', padding: '0.25rem 0.6rem', borderRadius: '6px' }}>
                Armed
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.25rem' }}>
              <button
                type="button"
                onClick={() => setBreakGateModalDeck(null)}
                style={{
                  flex: 1,
                  background: '#2e7d32',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '0.8rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(46, 125, 50, 0.3)'
                }}
              >
                Got It
              </button>
              <button
                type="button"
                onClick={() => {
                  setBreakGateModalDeck(null);
                  window.location.href = '/dashboard';
                }}
                className="btn-secondary"
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  borderColor: 'var(--glass-border)',
                  color: 'var(--text-primary)',
                  textAlign: 'center'
                }}
              >
                Open Pomodoro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Delete Collection Confirmation Modal */}
      {deckToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.25rem'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '18px',
            boxShadow: '0 24px 48px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            width: '100%',
            maxWidth: '440px',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '1.2rem',
            animation: 'flashcardFadeIn 0.22s ease'
          }}>
            {/* Warning Icon */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </div>

            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                Delete Collection?
              </h3>
              <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                Are you sure you want to delete <strong style={{ color: 'var(--text-primary)' }}>"{deckToDelete.title}"</strong>? All cards in this deck will be permanently removed.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setDeckToDelete(null)}
                disabled={isDeletingDeck}
                className="btn-secondary"
                style={{ flex: 1, padding: '0.75rem', margin: 0, fontSize: '0.92rem', cursor: 'pointer', textAlign: 'center' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteDeck}
                disabled={isDeletingDeck}
                style={{
                  flex: 1,
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.75rem',
                  fontSize: '0.92rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.25)',
                  textAlign: 'center'
                }}
              >
                {isDeletingDeck ? 'Deleting...' : 'Delete Deck'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* General Notification Toast (Clean, Zero Emojis) */}
      {toastMessage && (
        <div
          className={`flashcard-toast-pill ${
            typeof toastMessage === 'string' && (toastMessage.toLowerCase().includes('fail') || toastMessage.toLowerCase().includes('error'))
              ? 'is-error'
              : ''
          }`}
          role="status"
          aria-live="polite"
        >
          <div className="toast-icon-badge">
            {typeof toastMessage === 'string' && (toastMessage.toLowerCase().includes('fail') || toastMessage.toLowerCase().includes('error')) ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}

      {/* ================= 1. COLLECTIONS VIEW ================= */}
      {view === 'collections' && (
        <div className="glass-panel" style={{ minHeight: 'calc(100vh - 3.5rem)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', margin: 0 }}>My Flashcard Collections</h2>
                <HelpButton topic="flashcards" title="Flashcards & Practice Exams Tutorial" />
              </div>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>Review your generated study decks or create a new one from notes or PDF.</p>
            </div>
            <button 
              className="btn-primary" 
              style={{ padding: '0.6rem 1.25rem', marginTop: 0, width: 'auto', fontSize: '0.92rem' }} 
              onClick={() => {
                setDeckName('');
                setNotesText('');
                handleClearPdf();
                setView('create');
              }}
            >
              + Create New Deck
            </button>
          </div>

          <div style={{ marginTop: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {loadingDecks ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto', width: '40px', height: '40px' }}></div>
                <p>Loading your collections...</p>
              </div>
            ) : decks.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                flex: 1, 
                width: '100%', 
                gap: '1.25rem',
                padding: '2rem 1rem'
              }}>
                <Image 
                  src={emptyStateImg} 
                  alt="No collections yet" 
                  width={85} 
                  height={85} 
                  style={{ objectFit: 'contain', width: 'auto', height: 'auto', maxHeight: '85px' }} 
                  priority 
                />
                <div>
                  <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginBottom: '0.35rem', fontWeight: 600 }}>No flashcard decks yet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0, maxWidth: '420px' }}>Create your first deck by uploading a PDF syllabus or pasting notes.</p>
                </div>
                <button 
                  className="btn-secondary"
                  onClick={() => setView('create')}
                  style={{ padding: '0.65rem 1.5rem', fontSize: '0.9rem', cursor: 'pointer' }}
                >
                  Create Deck
                </button>
              </div>
            ) : (
              <div className="collections-grid">
                {decks.map((deck) => {
                  const cardTotal = deck.cards ? deck.cards.length : 0;
                  const createdDate = new Date(deck.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const masteredInDeck = (deck.cards || []).filter(c => storedMasteredKeys.includes(c.front) || c.mastered).length;
                  const deckMasteryPct = cardTotal > 0 ? Math.round((masteredInDeck / cardTotal) * 100) : 0;
                  
                  return (
                    <div 
                      key={deck.id} 
                      className={`collection-card ${(activeBreakGateId === deck.id || activeBreakGateId === deck.title) ? 'breakgate-card-active' : ''} ${(activatingId === deck.id || activatingId === deck.title) ? 'breakgate-card-burst' : ''}`} 
                      style={{ position: 'relative', border: '1px solid var(--glass-border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#ffffff', borderRadius: 'var(--radius-md)', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease' }}
                    >
                      {/* Card Header & Delete Action */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ background: 'rgba(95, 143, 94, 0.12)', color: 'var(--primary-accent)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeckToDelete(deck);
                            }}
                            title="Delete Deck"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                          </button>
                        </div>
                      </div>

                      {/* Title and Card Count */}
                      <div>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', wordBreak: 'break-word', fontWeight: 600 }}>{deck.title}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{cardTotal} {cardTotal === 1 ? 'Card' : 'Cards'} • {createdDate}</p>
                      </div>

                      {/* Mastery Progress Indicator Bar & Percentage */}
                      <div style={{ padding: '0.45rem 0.65rem', background: '#f8faf8', borderRadius: '8px', border: '1px solid rgba(95, 143, 94, 0.12)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', fontSize: '0.74rem' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                            Mastery: <strong style={{ color: deckMasteryPct === 100 ? '#2e7d32' : 'var(--text-primary)' }}>{masteredInDeck}/{cardTotal}</strong>
                          </span>
                          <span style={{ 
                            fontWeight: 700, 
                            color: deckMasteryPct === 100 ? '#2e7d32' : deckMasteryPct > 0 ? '#16a34a' : 'var(--text-secondary)', 
                            fontSize: '0.76rem' 
                          }}>
                            {deckMasteryPct}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '5px', background: 'rgba(0, 0, 0, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${deckMasteryPct}%`, 
                            height: '100%', 
                            background: deckMasteryPct === 100 
                              ? 'linear-gradient(90deg, #16a34a, #2e7d32)' 
                              : 'linear-gradient(90deg, #10b981, #059669)', 
                            borderRadius: '999px',
                            transition: 'width 0.4s ease'
                          }} />
                        </div>
                      </div>

                      {/* Action Buttons: Study, Exam, and Activate */}
                      <div style={{ marginTop: 'auto', paddingTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                          <button 
                            className="btn-primary" 
                            onClick={() => handleStartStudy(deck)}
                            style={{ padding: '0.5rem 0.5rem', fontSize: '0.82rem', margin: 0, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                            Study
                          </button>
                          <button 
                            className="btn-secondary" 
                            onClick={() => handleStartExam(deck)}
                            style={{ padding: '0.5rem 0.5rem', fontSize: '0.82rem', margin: 0, textAlign: 'center', borderColor: '#2e7d32', color: '#2e7d32', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                            Exam
                          </button>
                        </div>

                        <button 
                          onClick={(e) => handleToggleActivateBreakGate(deck, e)}
                          style={{
                            width: '100%',
                            padding: '0.45rem 0.5rem',
                            fontSize: '0.78rem',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            background: (activeBreakGateId === deck.id || activeBreakGateId === deck.title) ? 'rgba(46, 125, 50, 0.12)' : 'transparent',
                            border: (activeBreakGateId === deck.id || activeBreakGateId === deck.title) ? '1.5px solid #2e7d32' : '1px dashed var(--glass-border)',
                            color: (activeBreakGateId === deck.id || activeBreakGateId === deck.title) ? '#2e7d32' : 'var(--text-secondary)',
                            transition: 'all 0.25s ease'
                          }}
                        >
                          {(activeBreakGateId === deck.id || activeBreakGateId === deck.title) ? (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              Active for BreakGate
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                              </svg>
                              Activate for BreakGate
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= 2. CREATE DECK VIEW ================= */}
      {view === 'create' && (
        <div className="glass-panel" style={{ minHeight: 'calc(100vh - 3.5rem)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}>
                <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', margin: 0 }}>Create Auto-Deck</h2>
                <HelpButton topic="flashcards" title="AI Auto-Deck & PDF Extraction Tutorial" />
              </div>
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.92rem' }}>
                Paste lecture notes or upload a PDF syllabus to automatically extract flashcards using AI.
              </p>
            </div>
            <button className="btn-secondary small" onClick={() => setView('collections')} style={{ cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ← Collections
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1 }}>
            
            {/* Deck Name and Target Cards Count */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Deck Name</label>
                <input 
                  type="text" 
                  value={deckName} 
                  onChange={(e) => setDeckName(e.target.value)}
                  placeholder="e.g. Cellular Biology & Respiration" 
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text-primary)', fontSize: '0.95rem' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>Cards</label>
                <select 
                  value={cardCount}
                  onChange={(e) => setCardCount(parseInt(e.target.value))}
                  style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.65rem 0.9rem', color: 'var(--text-primary)', fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  <option value={5}>5 Cards</option>
                  <option value={8}>8 Cards</option>
                  <option value={10}>10 Cards</option>
                  <option value={15}>15 Cards</option>
                  <option value={20}>20 Cards</option>
                  <option value={25}>25 Cards</option>
                  <option value={30}>30 Cards</option>
                  <option value={0}>Auto (All Key Concepts)</option>
                </select>
              </div>
            </div>

            {/* Input Mode Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
              <button 
                className={`btn-secondary small ${activeTab === 'text' ? 'active' : ''}`}
                onClick={() => setActiveTab('text')}
                style={{ background: activeTab === 'text' ? 'var(--primary-accent)' : 'transparent', color: activeTab === 'text' ? '#ffffff' : 'var(--text-primary)', fontWeight: 600 }}
              >
                Text / Notes
              </button>
              <button 
                className={`btn-secondary small ${activeTab === 'pdf' ? 'active' : ''}`}
                onClick={() => setActiveTab('pdf')}
                style={{ background: activeTab === 'pdf' ? 'var(--primary-accent)' : 'transparent', color: activeTab === 'pdf' ? '#ffffff' : 'var(--text-primary)', fontWeight: 600 }}
              >
                PDF Document
              </button>
            </div>

            {/* Tab 1: Text Notes Input */}
            {activeTab === 'text' && (
              <div>
                <textarea 
                  rows={10}
                  placeholder="Paste lecture notes, textbook definitions, or summaries here..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  style={{ width: '100%', minHeight: '240px', background: '#ffffff', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem', color: 'var(--text-primary)', fontSize: '0.95rem', resize: 'vertical' }}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Tip: Include terms and definitions for optimal flashcard generation.
                </span>
              </div>
            )}

            {/* Tab 2: Working PDF Upload & Drag-and-Drop */}
            {activeTab === 'pdf' && (
              <div>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="application/pdf,.pdf" 
                  style={{ display: 'none' }}
                  onChange={(e) => handlePdfUpload(e.target.files?.[0])}
                />

                <div 
                  className={`file-drop-zone ${isDragOver ? 'dragover' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    if (e.dataTransfer.files?.[0]) {
                      handlePdfUpload(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ cursor: 'pointer', minHeight: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: isDragOver ? '2px dashed var(--primary-accent)' : '2px dashed var(--glass-border)', borderRadius: '12px', background: isDragOver ? 'rgba(95, 143, 94, 0.08)' : '#fafbfa', transition: 'all 0.2s ease' }}
                >
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--primary-accent)" strokeWidth="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                  
                  {pdfFileName ? (
                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.2rem 0' }}>{pdfFileName}</p>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{pdfFileSize} • Click or drop to replace</span>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.2rem 0' }}>Drag & drop your PDF syllabus here</p>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>or click to browse files from your computer</span>
                    </div>
                  )}
                </div>

                {pdfFileName && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={handleClearPdf}
                      style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Remove Selected PDF
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Submit Action */}
            <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
              <button 
                className="btn-primary" 
                onClick={handleGenerate}
                style={{ width: '100%', padding: '0.85rem', fontSize: '1rem', marginTop: 0 }}
              >
                Generate Flashcards with AI
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ================= 3. LOADING VIEW ================= */}
      {view === 'loading' && (
        <div className="glass-panel" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '3.5rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
          <div className="spinner" style={{ width: '56px', height: '56px' }}></div>
          <div>
            <h3 style={{ fontSize: '1.35rem', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>Analyzing Study Material</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', margin: 0 }}>{loadingStatus}</p>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${loadingProgress}%`, height: '100%', background: 'var(--primary-accent)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>
      )}

      {/* ================= 4. STUDY / REVIEW VIEW (Interactive 3D Card) ================= */}
      {view === 'study' && activeDeck && (
        <div style={{ width: '100%', height: 'calc(100vh - 2.8rem)', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
          
          {/* Deck Header & Animated Mastery Progress Bar */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                  <h2 style={{ fontSize: '1.3rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>{activeDeck.title}</h2>
                  <HelpButton topic="flashcards" title="Interactive Study Controls Tutorial" size={13} style={{ width: '22px', height: '22px' }} />
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  Card {currentCardIndex + 1} of {totalCards}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary small"
                  onClick={() => handleStartExam(activeDeck)}
                  style={{ borderColor: '#2e7d32', color: '#2e7d32', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  Take Exam
                </button>

                {/* 1. Definition First Custom Theme Checkbox */}
                <label 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    fontSize: '0.84rem', 
                    color: definitionFirst ? '#2e7d32' : 'var(--text-secondary)', 
                    fontWeight: definitionFirst ? 600 : 500, 
                    cursor: 'pointer', 
                    userSelect: 'none' 
                  }}
                >
                  <span 
                    style={{
                      width: '17px',
                      height: '17px',
                      borderRadius: '4.5px',
                      border: definitionFirst ? '1.5px solid #2e7d32' : '1.5px solid rgba(0, 0, 0, 0.22)',
                      background: definitionFirst ? '#2e7d32' : '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: definitionFirst ? '0 1px 4px rgba(46, 125, 50, 0.25)' : 'none',
                      flexShrink: 0
                    }}
                  >
                    {definitionFirst && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2.5 6.2 5 8.7 9.5 3.8" />
                      </svg>
                    )}
                  </span>
                  <input 
                    type="checkbox" 
                    checked={definitionFirst} 
                    onChange={(e) => setDefinitionFirst(e.target.checked)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                  <span>Definition First</span>
                </label>

                {/* 2. Show Hints Custom Theme Checkbox */}
                <label 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    fontSize: '0.84rem', 
                    color: showHints ? '#2e7d32' : 'var(--text-secondary)', 
                    fontWeight: showHints ? 600 : 500, 
                    cursor: 'pointer', 
                    userSelect: 'none' 
                  }}
                >
                  <span 
                    style={{
                      width: '17px',
                      height: '17px',
                      borderRadius: '4.5px',
                      border: showHints ? '1.5px solid #2e7d32' : '1.5px solid rgba(0, 0, 0, 0.22)',
                      background: showHints ? '#2e7d32' : '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: showHints ? '0 1px 4px rgba(46, 125, 50, 0.25)' : 'none',
                      flexShrink: 0
                    }}
                  >
                    {showHints && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2.5 6.2 5 8.7 9.5 3.8" />
                      </svg>
                    )}
                  </span>
                  <input 
                    type="checkbox" 
                    checked={showHints} 
                    onChange={(e) => {
                      const next = e.target.checked;
                      setShowHints(next);
                      try {
                        localStorage.setItem('ifocus_show_hints', String(next));
                      } catch(err) {}
                    }}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                  <span>Show Hints</span>
                </label>

                {/* Fully Mastered Custom Theme Checkbox */}
                {(() => {
                  const isFully = totalCards > 0 && masteredCards.size === totalCards;
                  return (
                    <label 
                      style={{ 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '0.45rem', 
                        fontSize: '0.84rem', 
                        color: isFully ? '#2e7d32' : 'var(--text-secondary)', 
                        fontWeight: isFully ? 600 : 500, 
                        cursor: 'pointer', 
                        userSelect: 'none' 
                      }}
                      title="Toggle all cards in this deck as mastered"
                    >
                      <span 
                        style={{
                          width: '17px',
                          height: '17px',
                          borderRadius: '4.5px',
                          border: isFully ? '1.5px solid #2e7d32' : '1.5px solid rgba(0, 0, 0, 0.22)',
                          background: isFully ? '#2e7d32' : '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: isFully ? '0 1px 4px rgba(46, 125, 50, 0.25)' : 'none',
                          flexShrink: 0
                        }}
                      >
                        {isFully && (
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2.5 6.2 5 8.7 9.5 3.8" />
                          </svg>
                        )}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={isFully} 
                        onChange={handleToggleFullyMastered}
                        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                      />
                      <span>Fully Mastered</span>
                    </label>
                  );
                })()}

                <HelpButton topic="flashcards" title="Flashcards & Study Mode Guide" style={{ marginLeft: '0.2rem' }} />

                {/* 3. BreakGate Active Custom Theme Checkbox with Confirmation */}
                <label 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    fontSize: '0.84rem', 
                    color: (activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? '#2e7d32' : 'var(--text-secondary)', 
                    fontWeight: (activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? 600 : 500, 
                    cursor: 'pointer', 
                    userSelect: 'none' 
                  }}
                >
                  <span 
                    style={{
                      width: '17px',
                      height: '17px',
                      borderRadius: '4.5px',
                      border: (activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? '1.5px solid #2e7d32' : '1.5px solid rgba(0, 0, 0, 0.22)',
                      background: (activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? '#2e7d32' : '#ffffff',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: (activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? '0 1px 4px rgba(46, 125, 50, 0.25)' : 'none',
                      flexShrink: 0
                    }}
                  >
                    {(activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2.5 6.2 5 8.7 9.5 3.8" />
                      </svg>
                    )}
                  </span>
                  <input 
                    type="checkbox" 
                    checked={activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title} 
                    onChange={(e) => handleToggleActivateBreakGate(activeDeck, e)}
                    style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                  />
                  <span>BreakGate Active</span>
                </label>
                <HelpButton topic="breakgate" title="BreakGate Challenge Integration" size={12} style={{ width: '20px', height: '20px' }} />

                {!isSaved && (
                  <button 
                    className="btn-secondary small" 
                    onClick={handleSaveDeck}
                    disabled={isSavingDeck}
                    style={{ borderColor: 'var(--primary-accent)', color: 'var(--primary-accent)', fontWeight: 600 }}
                  >
                    {isSavingDeck ? 'Saving...' : 'Save to Collections'}
                  </button>
                )}

                <button 
                  className="btn-secondary small" 
                  onClick={() => setView('collections')}
                >
                  ← Back
                </button>
              </div>
            </div>

            {/* Smooth Animated Progress Bar */}
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>
                  Mastered: <strong style={{ color: 'var(--text-primary)' }}>{masteredCards.size}</strong> of {totalCards} cards
                </span>
                <span style={{ 
                  fontWeight: 700, 
                  color: totalCards > 0 && masteredCards.size === totalCards ? '#2e7d32' : 'var(--primary-accent)',
                  fontSize: '0.88rem' 
                }}>
                  {totalCards > 0 ? Math.round((masteredCards.size / totalCards) * 100) : 0}% Mastered
                </span>
              </div>
              <div style={{ 
                width: '100%', 
                height: '8px', 
                background: 'rgba(0, 0, 0, 0.06)', 
                borderRadius: '999px', 
                overflow: 'hidden'
              }}>
                <div style={{ 
                  width: `${totalCards > 0 ? (masteredCards.size / totalCards) * 100 : 0}%`, 
                  height: '100%', 
                  background: totalCards > 0 && masteredCards.size === totalCards 
                    ? 'linear-gradient(90deg, #5f8f5e, #2e7d32)' 
                    : 'linear-gradient(90deg, #5f8f5e, #7cb342)', 
                  borderRadius: '999px', 
                  transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s ease',
                  boxShadow: '0 0 8px rgba(95, 143, 94, 0.3)'
                }} />
              </div>
            </div>
          </div>

          {/* Interactive Modern Flashcard (Smooth Fade) */}
          <div 
            className={`flashcard-card ${isFlipped ? 'flipped' : ''}`}
            onClick={() => setIsFlipped(f => !f)}
            style={{ flex: 1, minHeight: '380px', width: '100%' }}
          >
            {/* Top Left Tag */}
            <span 
              className="tag" 
              style={{ 
                position: 'absolute', 
                top: '1.4rem', 
                left: '1.75rem', 
                background: isFlipped ? 'rgba(95, 143, 94, 0.18)' : 'rgba(95, 143, 94, 0.12)', 
                color: 'var(--primary-accent)', 
                padding: '0.35rem 0.85rem', 
                borderRadius: '999px', 
                fontSize: '0.78rem', 
                fontWeight: 700, 
                letterSpacing: '0.5px', 
                transition: 'all 0.25s ease'
              }}
            >
              {isFlipped 
                ? (definitionFirst ? 'Term / Answer' : 'Answer / Definition') 
                : (definitionFirst ? 'Definition Review' : (currentCard?.tag || 'Concept'))}
            </span>

            {/* Front View (Smooth Fade) */}
            {!isFlipped && (
              <div key={`front-${currentCardIndex}`} className="flashcard-content-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', textAlign: 'center', maxWidth: '88%' }}>
                {/* Show Hint only when showHints is true */}
                {showHints && cardHint && (
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    background: 'rgba(95, 143, 94, 0.12)', 
                    border: '1px solid rgba(95, 143, 94, 0.28)', 
                    borderRadius: '999px', 
                    padding: '0.35rem 1.05rem', 
                    fontSize: '0.86rem', 
                    fontWeight: 700, 
                    color: '#2e7d32',
                    boxShadow: '0 2px 6px rgba(46, 125, 50, 0.08)'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6"></path>
                      <path d="M10 22h4"></path>
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"></path>
                    </svg>
                    <span>Hint:</span>
                    <span style={{ textDecoration: 'underline' }}>{cardHint}</span>
                  </div>
                )}

                <div style={{ 
                  fontSize: definitionFirst ? 'clamp(1.2rem, 1.8vw, 1.6rem)' : 'clamp(1.6rem, 2.6vw, 2.4rem)', 
                  fontWeight: definitionFirst ? 500 : 700, 
                  color: 'var(--text-primary)', 
                  lineHeight: definitionFirst ? 1.6 : 1.35, 
                  letterSpacing: '-0.02em',
                  padding: '0.75rem',
                  whiteSpace: definitionFirst ? 'pre-wrap' : 'normal'
                }}>
                  {definitionFirst ? currentCard?.back : currentCard?.front}
                </div>
              </div>
            )}

            {/* Back View (Smooth Fade) */}
            {isFlipped && (
              <div key={`back-${currentCardIndex}`} className="flashcard-content-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', textAlign: 'center', maxWidth: '88%' }}>
                {showHints && cardHint && (
                  <div style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '0.45rem', 
                    background: 'rgba(95, 143, 94, 0.12)', 
                    border: '1px solid rgba(95, 143, 94, 0.28)', 
                    borderRadius: '999px', 
                    padding: '0.4rem 1.1rem', 
                    fontSize: '0.88rem', 
                    fontWeight: 700, 
                    color: '#2e7d32',
                    boxShadow: '0 2px 6px rgba(46, 125, 50, 0.08)'
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18h6"></path>
                      <path d="M10 22h4"></path>
                      <path d="M12 2a7 7 0 0 0-7 7c0 2.4 1.2 4.5 3 5.7V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3c1.8-1.2 3-3.3 3-5.7a7 7 0 0 0-7-7z"></path>
                    </svg>
                    <span>Key Concept:</span>
                    <span style={{ textDecoration: 'underline' }}>{cardHint}</span>
                  </div>
                )}

                <div style={{ 
                  fontSize: !definitionFirst ? 'clamp(1.2rem, 1.8vw, 1.55rem)' : 'clamp(1.6rem, 2.6vw, 2.4rem)', 
                  fontWeight: !definitionFirst ? 500 : 700, 
                  color: 'var(--text-primary)', 
                  lineHeight: !definitionFirst ? 1.6 : 1.35, 
                  padding: '0.5rem', 
                  whiteSpace: !definitionFirst ? 'pre-wrap' : 'normal'
                }}>
                  {definitionFirst ? currentCard?.front : currentCard?.back}
                </div>
              </div>
            )}

            {/* Bottom Flip Hint */}
            <div style={{ position: 'absolute', bottom: '1.4rem', color: 'var(--text-secondary)', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
              {isFlipped 
                ? (definitionFirst ? 'Click or press Space to view definition' : 'Click or press Space to view question') 
                : (definitionFirst ? 'Click or press Space to reveal term' : 'Click or press Space to reveal answer')}
            </div>
          </div>

          {/* Controls Bar */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            
            {/* Previous Card */}
            <button 
              className="btn-secondary small" 
              onClick={handlePrevCard}
              disabled={currentCardIndex === 0}
              style={{ opacity: currentCardIndex === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              ← Previous
            </button>

            {/* Card Counter & Shuffle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {currentCardIndex + 1} / {totalCards}
              </span>

              <button 
                type="button" 
                onClick={handleShuffle}
                className="btn-secondary small"
                title="Shuffle Deck"
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem' }}
              >
                Shuffle
              </button>

              <button 
                type="button" 
                onClick={toggleMastery}
                className="btn-secondary small"
                style={{ 
                  padding: '0.45rem 1rem', 
                  fontSize: '0.85rem',
                  background: masteredCards.has(currentCardIndex) ? '#2e7d32' : 'transparent',
                  borderColor: masteredCards.has(currentCardIndex) ? '#2e7d32' : 'var(--glass-border)',
                  color: masteredCards.has(currentCardIndex) ? '#ffffff' : 'var(--text-secondary)',
                  fontWeight: 600,
                  transition: 'all 0.25s ease'
                }}
              >
                {masteredCards.has(currentCardIndex) ? 'Mastered' : 'Mark as Mastered'}
              </button>
            </div>

            {/* Next Card */}
            <button 
              className="btn-secondary small" 
              onClick={handleNextCard}
              disabled={currentCardIndex === totalCards - 1}
              style={{ opacity: currentCardIndex === totalCards - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              Next →
            </button>

          </div>
        </div>
      )}



      {/* ================= 5. PRACTICE EXAM / QUIZ MODE ================= */}
      {view === 'exam' && activeDeck && (
        <div style={{ width: '100%', height: 'calc(100vh - 2.8rem)', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'space-between' }}>
          {/* Exam Header */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span style={{ background: 'rgba(95, 143, 94, 0.15)', color: '#2e7d32', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700 }}>
                    PRACTICE EXAM
                  </span>
                  <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
                    {activeDeck.title}
                  </h2>
                </div>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {!examFinished ? `Question ${examIndex + 1} of ${activeDeck.cards.length} • Score: ${examScore}` : 'Exam Complete'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  className="btn-secondary small" 
                  onClick={() => handleStartStudy(activeDeck)}
                >
                  Switch to Flashcards
                </button>
                <button 
                  className="btn-secondary small" 
                  onClick={() => setView('collections')}
                >
                  ← Collections
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(0, 0, 0, 0.06)', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${examFinished ? 100 : ((examIndex + 1) / (activeDeck.cards.length || 1)) * 100}%`, 
                height: '100%', 
                background: 'linear-gradient(90deg, #5f8f5e, #2e7d32)', 
                borderRadius: '999px', 
                transition: 'width 0.4s ease' 
              }} />
            </div>
          </div>

          {/* Exam Question or Results */}
          {examFinished ? (
            /* Results Screen */
            <div className="glass-panel" style={{ flex: 1, minHeight: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '2.5rem', gap: '1.5rem' }}>
              <div style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: (examScore / (activeDeck.cards.length || 1)) >= 0.75 ? 'rgba(46, 125, 50, 0.12)' : 'rgba(217, 119, 6, 0.12)',
                color: (examScore / (activeDeck.cards.length || 1)) >= 0.75 ? '#2e7d32' : '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(0,0,0,0.06)'
              }}>
                {(examScore / (activeDeck.cards.length || 1)) >= 0.75 ? (
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="7"/>
                    <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
                  </svg>
                ) : (
                  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                  </svg>
                )}
              </div>

              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                  {examScore} / {activeDeck.cards.length} Correct ({Math.round((examScore / (activeDeck.cards.length || 1)) * 100)}%)
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0, maxWidth: '520px' }}>
                  {(examScore / (activeDeck.cards.length || 1)) >= 0.75 
                    ? 'Outstanding performance! You have mastered the core concepts of this deck.'
                    : 'Good effort! Review the flashcards to strengthen your retention on missed concepts.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
                <button
                  onClick={() => handleToggleActivateBreakGate(activeDeck)}
                  style={{
                    background: (activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? '#059669' : 'var(--primary-accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '0.8rem 1.6rem',
                    fontSize: '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {(activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  )}
                  {(activeBreakGateId === activeDeck.id || activeBreakGateId === activeDeck.title) ? 'Active in Pomodoro BreakGate' : 'Activate for Pomodoro BreakGate'}
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => handleStartExam(activeDeck)}
                  style={{ padding: '0.8rem 1.4rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Retake Exam
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => handleStartStudy(activeDeck)}
                  style={{ padding: '0.8rem 1.4rem', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Study Flashcards
                </button>
              </div>
            </div>
          ) : (
            /* Active Question Card */
            <div className="glass-panel" style={{ flex: 1, minHeight: '380px', display: 'flex', flexDirection: 'column', padding: '2rem 2.5rem', gap: '1.25rem', justifyContent: 'space-between' }}>
              <div>
                <span style={{
                  background: 'rgba(95, 143, 94, 0.12)',
                  color: 'var(--primary-accent)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: '999px',
                  fontSize: '0.78rem',
                  fontWeight: 700
                }}>
                  {activeDeck.cards[examIndex]?.tag || 'Question'}
                </span>

                <h3 style={{ fontSize: 'clamp(1.3rem, 2.2vw, 1.75rem)', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.65rem', lineHeight: 1.35 }}>
                  {activeDeck.cards[examIndex]?.front}
                </h3>

                {isOptionChecked && activeDeck.cards[examIndex]?.keyword && (
                  <div style={{ marginTop: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(95, 143, 94, 0.1)', border: '1px solid rgba(95, 143, 94, 0.25)', borderRadius: '20px', padding: '0.3rem 0.85rem', fontSize: '0.85rem', color: '#2e7d32', fontWeight: 700 }}>
                    KEY CONCEPT: {activeDeck.cards[examIndex].keyword}
                  </div>
                )}
              </div>

              {/* 4 Choices */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.65rem' }}>
                {examOptions.map((opt, i) => {
                  const isCorrect = opt === activeDeck.cards[examIndex]?.back;
                  const isSelected = selectedOption === opt;
                  
                  let btnBg = '#ffffff';
                  let btnBorder = '1.5px solid rgba(0,0,0,0.1)';
                  let btnColor = 'var(--text-primary)';
                  let btnShadow = '0 2px 6px rgba(0,0,0,0.02)';
                  let btnTransform = 'scale(1)';
                  let btnOpacity = 1;

                  if (isOptionChecked) {
                    if (isCorrect) {
                      btnBg = 'rgba(16, 185, 129, 0.16)';
                      btnBorder = '2px solid #10b981';
                      btnColor = '#065f46';
                      btnShadow = '0 4px 16px rgba(16, 185, 129, 0.22)';
                      btnTransform = 'scale(1.015)';
                      btnOpacity = 1;
                    } else if (isSelected) {
                      btnBg = 'rgba(239, 68, 68, 0.14)';
                      btnBorder = '2px solid #ef4444';
                      btnColor = '#991b1b';
                      btnShadow = '0 4px 14px rgba(239, 68, 68, 0.2)';
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
                        borderRadius: '14px',
                        padding: '0.95rem 1.25rem',
                        fontSize: '0.96rem',
                        color: btnColor,
                        fontWeight: isOptionChecked && (isCorrect || isSelected) ? 600 : 500,
                        textAlign: 'left',
                        cursor: isOptionChecked ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.85rem',
                        transition: 'background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), color 0.35s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease, box-shadow 0.4s ease',
                        boxShadow: btnShadow,
                        transform: btnTransform,
                        opacity: btnOpacity
                      }}
                    >
                      <span style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: isOptionChecked && isCorrect ? '#2e7d32' : 'rgba(0,0,0,0.06)',
                        color: isOptionChecked && isCorrect ? '#ffffff' : 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        flexShrink: 0
                      }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span style={{ flex: 1, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{opt}</span>
                      {isOptionChecked && isCorrect && <span style={{ color: '#2e7d32', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Correct</span>}
                      {isOptionChecked && isSelected && !isCorrect && <span style={{ color: 'var(--error)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Incorrect</span>}
                    </button>
                  );
                })}
              </div>

              {/* Footer / Next Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                {isOptionChecked && (
                  <button
                    className="btn-primary"
                    onClick={handleNextExamQuestion}
                    style={{ padding: '0.75rem 2rem', fontSize: '0.98rem', margin: 0 }}
                  >
                    {examIndex < (activeDeck.cards.length - 1) ? 'Next Question →' : 'Finish Exam & View Score'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

    </>
  );
}

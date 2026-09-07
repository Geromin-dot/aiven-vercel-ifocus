"use client";

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import emptyStateImg from '../../img/empty_flashcard_state.png';

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

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3500);
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
      alert("Please upload a valid PDF document.");
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
      alert("Please select or drop a PDF file first.");
      return;
    }

    if (!isPdf && !notesText.trim()) {
      alert("Please paste your lecture notes or study material first.");
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
      alert("Flashcard Generation Error: " + err.message);
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
      alert("Error saving deck: " + err.message);
    } finally {
      setIsSavingDeck(false);
    }
  };

  // 5. Delete Deck from Database
  const handleDeleteDeck = async (id, e) => {
    if (e) e.stopPropagation();
    if (!confirm("Are you sure you want to delete this deck?")) return;

    try {
      const res = await fetch(`/api/decks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDecks(prev => prev.filter(d => d.id !== id));
        showToast('Deck deleted.');
      } else {
        alert("Failed to delete deck.");
      }
    } catch (err) {
      alert("Error deleting deck: " + err.message);
    }
  };

  // 6. Launch Study Mode for Existing Deck
  const handleStartStudy = (deck) => {
    setActiveDeck(deck);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setMasteredCards(new Set());
    setIsSaved(true); // Already in database
    setView('study');
  };

  // Study Navigation Helpers
  const currentCard = activeDeck?.cards?.[currentCardIndex] || null;
  const totalCards = activeDeck?.cards?.length || 0;

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
    setMasteredCards(prev => {
      const next = new Set(prev);
      if (next.has(currentCardIndex)) {
        next.delete(currentCardIndex);
      } else {
        next.add(currentCardIndex);
      }
      return next;
    });
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, currentCardIndex, totalCards]);

  return (
    <>
      {/* Dynamic Toast */}
      {toastMessage && (
        <div style={{ position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 1200, background: '#ffffff', border: '1px solid var(--primary-accent)', borderRadius: '8px', padding: '0.65rem 1.25rem', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', color: 'var(--text-primary)', fontSize: '0.88rem', fontWeight: 600 }}>
          {toastMessage}
        </div>
      )}

      {/* ================= 1. COLLECTIONS VIEW ================= */}
      {view === 'collections' && (
        <div className="glass-panel" style={{ minHeight: 'calc(100vh - 3.5rem)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', flexShrink: 0 }}>
            <div>
              <h2 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>My Flashcard Collections</h2>
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

          <div style={{ marginTop: '1.5rem', flex: 1 }}>
            {loadingDecks ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-secondary)' }}>
                <div className="spinner" style={{ margin: '0 auto 1rem auto', width: '40px', height: '40px' }}></div>
                <p>Loading your collections...</p>
              </div>
            ) : decks.length === 0 ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '340px', gap: '1rem' }}>
                <Image src={emptyStateImg} alt="No collections yet" width={110} height={110} style={{ objectFit: 'contain' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No flashcard decks yet</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Create your first deck by uploading a PDF syllabus or pasting notes.</p>
                </div>
                <button 
                  className="btn-secondary"
                  onClick={() => setView('create')}
                  style={{ marginTop: '0.5rem', fontSize: '0.88rem' }}
                >
                  Create Deck
                </button>
              </div>
            ) : (
              <div className="collections-grid">
                {decks.map((deck) => {
                  const cardTotal = deck.cards ? deck.cards.length : 0;
                  const createdDate = new Date(deck.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  
                  return (
                    <div 
                      key={deck.id} 
                      className="collection-card" 
                      style={{ position: 'relative', border: '1px solid var(--glass-border)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', background: '#ffffff', borderRadius: 'var(--radius-md)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                    >
                      {/* Card Header & Delete Action */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ background: 'rgba(95, 143, 94, 0.12)', color: 'var(--primary-accent)', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteDeck(deck.id, e)}
                          title="Delete Deck"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>

                      {/* Title and Card Count */}
                      <div>
                        <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1.05rem', color: 'var(--text-primary)', wordBreak: 'break-word', fontWeight: 600 }}>{deck.title}</h3>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>{cardTotal} {cardTotal === 1 ? 'Card' : 'Cards'} • {createdDate}</p>
                      </div>

                      {/* Action Button */}
                      <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                        <button 
                          className="btn-primary" 
                          onClick={() => handleStartStudy(deck)}
                          style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.85rem', margin: 0 }}
                        >
                          Study Deck
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
        <div className="glass-panel" style={{ maxWidth: '840px', margin: '0 auto', minHeight: 'calc(100vh - 4.5rem)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0 }}>Create Auto-Deck</h2>
            <button className="btn-secondary small" onClick={() => setView('collections')}>
              ← Collections
            </button>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', fontSize: '0.92rem' }}>
            Paste lecture notes or upload a PDF syllabus to automatically extract flashcards using AI.
          </p>
          
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
                  rows={8}
                  placeholder="Paste lecture notes, textbook definitions, or summaries here..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  style={{ width: '100%', background: '#ffffff', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '1rem', color: 'var(--text-primary)', fontSize: '0.95rem', resize: 'vertical' }}
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
                  style={{ cursor: 'pointer', height: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: isDragOver ? '2px dashed var(--primary-accent)' : '2px dashed var(--glass-border)', borderRadius: '12px', background: isDragOver ? 'rgba(95, 143, 94, 0.08)' : '#fafbfa', transition: 'all 0.2s ease' }}
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
        <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Deck Header */}
          <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.15rem 0', fontWeight: 700 }}>{activeDeck.title}</h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Card {currentCardIndex + 1} of {totalCards} • {masteredCards.size} Mastered
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={definitionFirst} 
                  onChange={(e) => setDefinitionFirst(e.target.checked)}
                  style={{ accentColor: 'var(--primary-accent)' }}
                />
                Definition First
              </label>

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

          {/* Interactive 3D Flip Flashcard */}
          <div 
            className="flashcard-container" 
            onClick={() => setIsFlipped(f => !f)}
            style={{ height: '360px', cursor: 'pointer', userSelect: 'none' }}
          >
            <div className={`flashcard ${isFlipped ? 'flipped' : ''}`}>
              
              {/* Card Front Face */}
              <div className="card-face card-front" style={{ background: '#ffffff', border: '1.5px solid var(--glass-border)', borderRadius: '20px', position: 'relative' }}>
                <span className="tag" style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', background: 'rgba(95, 143, 94, 0.12)', color: 'var(--primary-accent)', padding: '0.25rem 0.75rem', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 600 }}>
                  {currentCard?.tag || 'Concept'}
                </span>

                <div className="card-content" style={{ fontSize: '1.45rem', fontWeight: 600, color: 'var(--text-primary)', padding: '1rem' }}>
                  {definitionFirst ? currentCard?.back : currentCard?.front}
                </div>

                <div style={{ position: 'absolute', bottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path></svg>
                  Click or press Space to flip
                </div>
              </div>

              {/* Card Back Face */}
              <div className="card-face card-back" style={{ background: '#fbfdfa', border: '1.5px solid var(--primary-accent)', borderRadius: '20px', position: 'relative' }}>
                <span className="tag" style={{ position: 'absolute', top: '1.25rem', left: '1.5rem', background: 'rgba(95, 143, 94, 0.18)', color: 'var(--primary-accent)', padding: '0.25rem 0.75rem', borderRadius: '14px', fontSize: '0.75rem', fontWeight: 600 }}>
                  Answer / Definition
                </span>

                <div className="card-content" style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--text-primary)', padding: '1rem', whiteSpace: 'pre-wrap' }}>
                  {definitionFirst ? currentCard?.front : currentCard?.back}
                </div>

                <div style={{ position: 'absolute', bottom: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                  Click to flip back
                </div>
              </div>

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
                  padding: '0.4rem 0.85rem', 
                  fontSize: '0.82rem',
                  background: masteredCards.has(currentCardIndex) ? 'rgba(15, 123, 108, 0.15)' : 'transparent',
                  borderColor: masteredCards.has(currentCardIndex) ? 'var(--success)' : 'var(--glass-border)',
                  color: masteredCards.has(currentCardIndex) ? 'var(--success)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}
              >
                {masteredCards.has(currentCardIndex) ? '✓ Mastered' : 'Mark as Mastered'}
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

    </>
  );
}

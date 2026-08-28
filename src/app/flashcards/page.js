"use client";

import { useState } from 'react';

export default function FlashcardsPage() {
  const [view, setView] = useState('collections'); // 'collections', 'create', 'loading', 'study'

  return (
    <>
      {/* Collections View */}
      {view === 'collections' && (
        <div id="collectionsSection" className="glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
            <div>
              <h2 style={{ marginBottom: '0.5rem' }}>My Flashcard Collections</h2>
              <p className="subtitle" style={{ marginBottom: 0 }}>Select a deck to review, or create a new one.</p>
            </div>
            <button className="btn-primary" style={{ width: 'auto', padding: '0.75rem 1.5rem', margin: 0 }} onClick={() => setView('create')}>
              + Create New Deck
            </button>
          </div>
          <div className="collections-grid" id="collectionsGrid">
            {/* Cards will be fetched from database */}
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--glass-border)' }}>
              <p style={{ color: 'var(--text-secondary)' }}>No collections yet. Create your first deck!</p>
            </div>
          </div>
        </div>
      )}

      {/* Create Deck View */}
      {view === 'create' && (
        <div className="input-section glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h2>Create Auto-Deck</h2>
            <button className="btn-secondary small" onClick={() => setView('collections')}>← Collections</button>
          </div>
          <p className="subtitle">Paste your notes or upload a syllabus to generate flashcards instantly.</p>
          
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, color: 'var(--text-primary)' }}>Deck Name</label>
            <input type="text" placeholder="e.g. Biology Chapter 4" style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '0.75rem 1rem', color: 'var(--text-primary)', fontSize: '1rem' }} />
          </div>

          <div className="tabs">
            <button className="tab active">Text / Notes</button>
            <button className="tab">PDF Document</button>
          </div>

          <div className="tab-content active">
            <textarea placeholder="Paste lecture notes, definitions, or task lists here..."></textarea>
          </div>

          <button className="btn-primary" onClick={() => setView('loading')}>
            <span className="btn-text">Generate Flashcards</span>
            <svg className="sparkle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>
          </button>
        </div>
      )}

      {/* Loading View */}
      {view === 'loading' && (
        <div className="loading-section glass-panel">
          <div className="spinner"></div>
          <h3>AI is analyzing your material...</h3>
          <p>Extracting key definitions, formulas, and dates.</p>
          <div className="progress-bar"><div className="progress-fill" style={{ width: '50%' }}></div></div>
        </div>
      )}

      {/* Study View */}
      {view === 'study' && (
        <div className="deck-section">
          <div className="deck-header">
            <h2>Your Custom Deck</h2>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button className="btn-secondary small" onClick={() => setView('collections')}>Back</button>
            </div>
          </div>
          <div className="flashcard-container">
            <div className="flashcard-card glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <h3>Example Flashcard Front</h3>
              <p>Click to flip</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

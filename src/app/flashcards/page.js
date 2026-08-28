"use client";

import { useState } from 'react';
import Image from 'next/image';
import emptyStateImg from '../../img/empty_flashcard_state.png';

export default function FlashcardsPage() {
  const [view, setView] = useState('collections'); // 'collections', 'create', 'loading', 'study'

  const [collections, setCollections] = useState([]);

  return (
    <>
      {/* Collections View */}
      {view === 'collections' && (
        <div id="collectionsSection" className="glass-panel" style={{ minHeight: 'calc(100vh - 4rem)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', flexShrink: 0 }}>
            <div>
              <h2>My Flashcard Collections</h2>
              <p className="subtitle" style={{ marginBottom: 0 }}>Select a deck to review, or create a new one.</p>
            </div>
            <button className="btn-primary" style={{ padding: '0.6rem 1.25rem', marginTop: 0 }} onClick={() => setView('create')}>
              + Create New Deck
            </button>
          </div>
          <div className="collections-grid" id="collectionsGrid" style={{ display: collections.length === 0 ? 'flex' : 'grid', flex: 1, gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1.5rem', marginTop: '1.5rem', alignItems: collections.length === 0 ? 'center' : 'stretch', justifyContent: collections.length === 0 ? 'center' : 'start' }}>
            {collections.length === 0 ? (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', width: '100%' }}>
                <Image src={emptyStateImg} alt="No collections yet" width={320} height={320} style={{ objectFit: 'contain' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>No collections yet. Create your first deck!</p>
              </div>
            ) : (
              collections.map((col, idx) => {
                const total = col.cards.length;
                const mastered = col.cards.filter(c => c.needsReview === false).length;
                const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;
                const createdDate = new Date(col.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                
                return (
                  <div key={col.id} className="collection-card" style={{ position: 'relative', border: col.activated ? '2px solid var(--primary-accent)' : '1px solid var(--glass-border)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: col.activated ? '#f4f8f4' : 'var(--glass-bg)', borderRadius: 'var(--radius-md)' }}>
                    
                    {/* Header (Icon + Kebab) */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div style={{ background: '#e8e2c8', color: '#5a4b1c', width: '40px', height: '40px', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                        </div>
                        
                        <div className="kebab-menu" style={{ position: 'relative', cursor: 'pointer', color: 'var(--text-secondary)', padding: '0.25rem' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                        </div>
                    </div>

                    {/* Title and Stats */}
                    <div>
                        <h3 style={{ marginBottom: '0.25rem', fontSize: '1.1rem', color: 'var(--text-primary)', wordBreak: 'break-word' }}>{col.name}</h3>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>{total} Cards • Created {createdDate}</p>
                    </div>

                    {/* Mastery Progress */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            <span>Mastery</span>
                            <span>{percentage}%</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary-accent)', borderRadius: '3px' }}></div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn-primary" style={{ width: '100%', padding: '0.5rem 1rem', fontSize: '0.9rem', margin: 0 }}>
                            Study Deck
                        </button>
                        <button className="btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', background: col.activated ? 'rgba(0,0,0,0.05)' : 'transparent', textAlign: 'center', width: '100%', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)' }}>
                            {col.activated ? 'Activated' : 'Activate for Vault'}
                        </button>
                    </div>
                  </div>
                );
              })
            )}
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

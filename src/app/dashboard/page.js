"use client";

import { useState } from 'react';

export default function CommandCenterPage() {
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState('');

  const addTodo = () => {
    if (todoInput.trim()) {
      setTodos([...todos, { id: Date.now(), text: todoInput, completed: false, priority: 'medium' }]);
      setTodoInput('');
    }
  };

  return (
    <div className="command-center-layout" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', height: '100%' }}>
      {/* Column 1: Task Command Center */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2>To-Do List</h2>
          <div className="sync-badge">
            <span className="dot"></span>
            Cloud Synced
          </div>
        </div>
        <p className="subtitle" style={{ marginBottom: '1.5rem' }}>Organize complex to-do lists. Drag to reorder. Everything syncs across devices.</p>
        
        <div className="todo-input-row" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <input 
            type="text" 
            placeholder="What needs to be done?" 
            style={{ flex: 1, minWidth: '200px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          />
          <button className="btn-primary" onClick={addTodo} style={{ padding: '0 1.5rem', borderRadius: '8px' }}>+ Add</button>
        </div>

        <div className="todo-list" style={{ flex: 1, minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {todos.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>No tasks yet.</p>
          ) : (
            todos.map(todo => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <input type="checkbox" checked={todo.completed} onChange={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, completed: !t.completed } : t))} style={{ accentColor: 'var(--primary-accent)', width: '1.2rem', height: '1.2rem' }} />
                <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', color: todo.completed ? 'var(--text-secondary)' : 'var(--text-primary)', flex: 1 }}>{todo.text}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 2: Timer & Audio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Pomodoro Timer</h2>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>Leave your phone. Focus here.</p>

          <div className="timer-circle" style={{ margin: '0 auto 1.5rem auto' }}>
            <div className="timer-inner">
              <div className="timer-display" style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--text-primary)' }}>25:00</div>
              <div className="timer-label" style={{ color: 'var(--text-secondary)' }}>Focus Time</div>
            </div>
          </div>

          <div className="timer-controls" style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button className="btn-primary">Start</button>
            <button className="btn-secondary">Reset</button>
          </div>
        </div>

        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Ambient Audio</h2>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>Local music tracks.</p>
          <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-secondary)' }}>
            <p>Music Player Coming Soon...</p>
          </div>
        </div>
      </div>

      {/* Column 3: Journal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>Quick Reflection</h2>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>Clear your mind. AI will analyze your entry.</p>
          
          <textarea 
            className="journal-textarea" 
            style={{ minHeight: '120px', marginBottom: '1rem', width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', resize: 'vertical' }} 
            placeholder="E.g., I have so much to read for biology and I keep getting distracted..."
          ></textarea>
          
          <button className="btn-primary">
            <span className="btn-text">Submit & Analyze</span>
          </button>
        </div>
      </div>
    </div>
  );
}

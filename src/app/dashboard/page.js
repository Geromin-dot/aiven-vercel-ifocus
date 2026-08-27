"use client";

import { useState, useEffect } from 'react';

export default function CommandCenterPage() {
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [loadingTodos, setLoadingTodos] = useState(true);

  // AI Coach State
  const [reflectionInput, setReflectionInput] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);

  // Fetch initial todos
  useEffect(() => {
    fetch('/api/todos')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setTodos(data);
        setLoadingTodos(false);
      })
      .catch(err => {
        console.error("Failed to fetch todos", err);
        setLoadingTodos(false);
      });
  }, []);

  // Pomodoro State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFocus, setIsFocus] = useState(true);

  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      setIsActive(false);
      
      // Try playing a sound if possible
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log("Audio play prevented", e));
      } catch (e) {}
      
      // Auto-switch mode
      if (isFocus) {
        setIsFocus(false);
        setTimeLeft(5 * 60);
      } else {
        setIsFocus(true);
        setTimeLeft(25 * 60);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isFocus]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(isFocus ? 25 * 60 : 5 * 60);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addTodo = async () => {
    if (todoInput.trim()) {
      const text = todoInput;
      setTodoInput('');
      
      // Optimistic update
      const tempId = Date.now().toString();
      setTodos([{ id: tempId, text, completed: false }, ...todos]);

      try {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        const newTodo = await res.json();
        setTodos(current => current.map(t => t.id === tempId ? newTodo : t));
      } catch (err) {
        console.error("Failed to add todo", err);
        setTodos(current => current.filter(t => t.id !== tempId));
      }
    }
  };

  const toggleTodo = async (id, currentStatus) => {
    setTodos(todos.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    try {
      await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !currentStatus })
      });
    } catch (err) {
      setTodos(todos.map(t => t.id === id ? { ...t, completed: currentStatus } : t));
    }
  };

  const deleteTodo = async (id) => {
    const previous = [...todos];
    setTodos(todos.filter(t => t.id !== id));
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    } catch (err) {
      setTodos(previous);
    }
  };

  const submitReflection = async () => {
    if (!reflectionInput.trim()) return;
    setIsSubmittingReflection(true);
    setAiFeedback('');
    try {
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reflectionInput })
      });
      const data = await res.json();
      if (res.ok) {
        setAiFeedback(data.feedback);
        setReflectionInput('');
      } else {
        setAiFeedback(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error(err);
      setAiFeedback("Failed to reach AI Coach.");
    } finally {
      setIsSubmittingReflection(false);
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
          {loadingTodos ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>Loading tasks...</p>
          ) : todos.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '2rem' }}>No tasks yet.</p>
          ) : (
            todos.map(todo => (
              <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <input 
                  type="checkbox" 
                  checked={todo.completed} 
                  onChange={() => toggleTodo(todo.id, todo.completed)} 
                  style={{ accentColor: 'var(--primary-accent)', width: '1.2rem', height: '1.2rem' }} 
                />
                <span style={{ textDecoration: todo.completed ? 'line-through' : 'none', color: todo.completed ? 'var(--text-secondary)' : 'var(--text-primary)', flex: 1 }}>{todo.text}</span>
                <button 
                  onClick={() => deleteTodo(todo.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.25rem', opacity: 0.7 }}
                  title="Delete task"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Column 2: Timer & Audio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Pomodoro Timer</h2>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
            <span 
              onClick={() => { setIsFocus(true); setIsActive(false); setTimeLeft(25 * 60); }} 
              style={{ cursor: 'pointer', fontWeight: isFocus ? 600 : 400, color: isFocus ? 'var(--primary-accent)' : 'var(--text-secondary)', marginRight: '1rem' }}
            >
              Focus
            </span>
            |
            <span 
              onClick={() => { setIsFocus(false); setIsActive(false); setTimeLeft(5 * 60); }} 
              style={{ cursor: 'pointer', fontWeight: !isFocus ? 600 : 400, color: !isFocus ? 'var(--primary-accent)' : 'var(--text-secondary)', marginLeft: '1rem' }}
            >
              Break
            </span>
          </p>

          <div className="timer-circle" style={{ margin: '0 auto 1.5rem auto' }}>
            <div className="timer-inner" style={{ 
              width: '200px', 
              height: '200px', 
              borderRadius: '50%', 
              border: `8px solid ${isFocus ? 'var(--primary-accent)' : 'var(--secondary-accent)'}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '0 auto'
            }}>
              <div className="timer-display" style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {formatTime(timeLeft)}
              </div>
              <div className="timer-label" style={{ color: 'var(--text-secondary)' }}>
                {isFocus ? 'Focus Time' : 'Break Time'}
              </div>
            </div>
          </div>

          <div className="timer-controls" style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
            <button 
              className="btn-primary" 
              onClick={toggleTimer}
              style={{ margin: 0, padding: '0.75rem 2rem', background: isActive ? 'var(--warning)' : 'linear-gradient(135deg, var(--primary-accent), var(--secondary-accent))' }}
            >
              {isActive ? 'Pause' : 'Start'}
            </button>
            <button className="btn-secondary" onClick={resetTimer}>Reset</button>
          </div>
        </div>

        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Ambient Audio</h2>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>Lofi Radio - Beats to relax/study to.</p>
          <div style={{ textAlign: 'center', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
            <iframe 
              width="100%" 
              height="100%" 
              src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=0&controls=1&showinfo=0&rel=0&modestbranding=1" 
              title="Lofi Girl" 
              frameBorder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowFullScreen
              style={{ minHeight: '150px' }}
            ></iframe>
          </div>
        </div>
      </div>

      {/* Column 3: Journal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h2>Quick Reflection</h2>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>Clear your mind. AI will analyze your entry.</p>
          
          <textarea 
            className="journal-textarea" 
            value={reflectionInput}
            onChange={(e) => setReflectionInput(e.target.value)}
            style={{ minHeight: '120px', flex: aiFeedback ? 'none' : 1, marginBottom: '1rem', width: '100%', padding: '1rem', borderRadius: '12px', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', resize: 'vertical', fontFamily: 'inherit' }} 
            placeholder="E.g., I have so much to read for biology and I keep getting distracted..."
            disabled={isSubmittingReflection}
          ></textarea>
          
          <button 
            className="btn-primary" 
            onClick={submitReflection}
            disabled={isSubmittingReflection || !reflectionInput.trim()}
            style={{ marginTop: 0 }}
          >
            <span className="btn-text">
              {isSubmittingReflection ? "Analyzing..." : "Submit & Analyze"}
            </span>
          </button>

          {aiFeedback && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(95, 143, 94, 0.1)', borderRadius: '12px', border: '1px solid var(--primary-accent)' }}>
              <h4 style={{ color: 'var(--primary-accent)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Coach Feedback</h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {aiFeedback}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

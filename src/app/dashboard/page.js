"use client";

import { useState, useEffect } from 'react';

export default function CommandCenterPage() {
  // To-Do State
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [todoPriority, setTodoPriority] = useState('medium');
  const [todoFilter, setTodoFilter] = useState('All');
  const [loadingTodos, setLoadingTodos] = useState(true);

  // AI Coach State
  const [reflectionInput, setReflectionInput] = useState('');
  const [aiFeedback, setAiFeedback] = useState('');
  const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);

  // Pomodoro State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFocus, setIsFocus] = useState(true);
  const [timerPreset, setTimerPreset] = useState('25/5');
  const [sessionCount, setSessionCount] = useState(1);

  // Ambient Audio State
  const [currentTrack, setCurrentTrack] = useState('Chill Lofi');
  const [isPlaying, setIsPlaying] = useState(false);
  const tracks = ['Chill Lofi', 'Study Music', 'Rain Ambient'];

  // Past Entries Mock
  const pastEntries = [
    { id: 1, date: '7/27/26, 8:47 AM', text: 'I am feeling motivated right now!', state: 'Motivated' },
    { id: 2, date: '7/25/26, 9:02 PM', text: 'I am very stressed and anxious about my upcoming exam.', state: 'Stressed' },
    { id: 3, date: '7/24/26, 2:55 PM', text: 'Im frustrated right now.', state: 'Stressed' },
    { id: 4, date: '7/23/26, 10:20 AM', text: 'I feel lazy I dont want to work', state: 'Distracted' },
  ];

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

  // Pomodoro Logic
  useEffect(() => {
    let interval = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(time => time - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      try {
        const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play().catch(e => console.log("Audio play prevented", e));
      } catch (e) {}
      
      if (isFocus) {
        setIsFocus(false);
        const breakTime = timerPreset === '50/10' ? 10 : timerPreset === '15/3' ? 3 : timerPreset === '90/20' ? 20 : 5;
        setTimeLeft(breakTime * 60);
      } else {
        setIsFocus(true);
        const focusTime = parseInt(timerPreset.split('/')[0]) || 25;
        setTimeLeft(focusTime * 60);
        setSessionCount(c => c + 1);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isFocus, timerPreset]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    const focusTime = parseInt(timerPreset.split('/')[0]) || 25;
    setTimeLeft(isFocus ? focusTime * 60 : 5 * 60);
  };

  const setPreset = (preset) => {
    setTimerPreset(preset);
    setIsActive(false);
    setIsFocus(true);
    if (preset === 'Custom') {
      setTimeLeft(25 * 60);
    } else {
      const focusTime = parseInt(preset.split('/')[0]);
      setTimeLeft(focusTime * 60);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // To-Do Logic
  const addTodo = async () => {
    if (todoInput.trim()) {
      const text = todoInput;
      const priority = todoPriority;
      setTodoInput('');
      
      const tempId = Date.now().toString();
      setTodos([{ id: tempId, text, completed: false, priority }, ...todos]);

      try {
        const res = await fetch('/api/todos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, priority })
        });
        const newTodo = await res.json();
        setTodos(current => current.map(t => t.id === tempId ? newTodo : t));
      } catch (err) {
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

  const clearCompleted = () => {
    const completedIds = todos.filter(t => t.completed).map(t => t.id);
    completedIds.forEach(id => deleteTodo(id));
  };

  const filteredTodos = todos.filter(t => {
    if (todoFilter === 'Active') return !t.completed;
    if (todoFilter === 'Done') return t.completed;
    return true;
  });

  // AI Coach Logic
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
      setAiFeedback("Failed to reach AI Coach.");
    } finally {
      setIsSubmittingReflection(false);
    }
  };

  return (
    <div className="command-center-layout">
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
        
        <div className="todo-input-row" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input 
            type="text" 
            placeholder="What needs to be done?" 
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            style={{ flex: 1 }}
          />
          <select value={todoPriority} onChange={(e) => setTodoPriority(e.target.value)} style={{ width: '80px', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>
            <option value="high">High</option>
            <option value="medium">Med</option>
            <option value="low">Low</option>
          </select>
          <button className="btn-primary" onClick={addTodo} style={{ width: 'auto', margin: 0, padding: '0 1.5rem' }}>+ Add</button>
        </div>

        <div className="todo-list" style={{ flex: 1 }}>
          {loadingTodos ? (
            <p style={{ textAlign: 'center', marginTop: '2rem' }}>Loading tasks...</p>
          ) : filteredTodos.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: '2rem' }}>No tasks yet.</p>
          ) : (
            filteredTodos.map(todo => (
              <div key={todo.id} className={`todo-item priority-${todo.priority || 'medium'} ${todo.completed ? 'completed' : ''}`}>
                <div 
                  className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id, todo.completed)}
                >
                  {todo.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                <span className="todo-text">{todo.text}</span>
                <span className={`todo-priority-badge ${todo.priority || 'medium'}`}>{todo.priority || 'medium'}</span>
                <button className="todo-delete" onClick={() => deleteTodo(todo.id)}>✕</button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
          <button onClick={clearCompleted} style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            Clear Completed
          </button>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {['All', 'Active', 'Done'].map(filter => (
              <button 
                key={filter}
                onClick={() => setTodoFilter(filter)}
                style={{ 
                  background: todoFilter === filter ? 'rgba(0,0,0,0.05)' : 'transparent',
                  border: 'none',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: todoFilter === filter ? 600 : 400
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Column 2: Timer & Audio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2>Pomodoro Timer</h2>
          <p className="subtitle">Leave your phone. Focus here.</p>

          <div className="timer-circle">
            <div className="timer-inner">
              <div className="timer-display">{formatTime(timeLeft)}</div>
              <div className="timer-label">{isFocus ? 'Focus Time' : 'Break Time'}</div>
            </div>
          </div>

          <div className="timer-controls">
            <button className="btn-primary" onClick={toggleTimer} style={{ background: isActive ? 'var(--warning)' : '' }}>
              {isActive ? 'Pause' : 'Start'}
            </button>
            <button className="btn-secondary" onClick={resetTimer}>Reset</button>
          </div>

          <div className="pomodoro-settings">
            {['25/5', '50/10', '15/3', '90/20', 'Custom'].map(preset => (
              <button 
                key={preset}
                className={`pomodoro-preset ${timerPreset === preset ? 'active' : ''}`}
                onClick={() => setPreset(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          
          <div className="session-counter">
            Session {sessionCount} of 1
            <div className="session-dots">
              <div className="session-dot current"></div>
            </div>
          </div>
        </div>

        <div className="glass-panel" style={{ flex: 1 }}>
          <h2>Ambient Audio</h2>
          <p className="subtitle">Local music tracks.</p>
          
          <div className="audio-player">
            <div className="audio-tracks">
              {tracks.map(track => (
                <div 
                  key={track} 
                  className={`audio-track ${currentTrack === track && isPlaying ? 'playing' : ''}`}
                  onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                >
                  <span className="track-name">{track}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{currentTrack === track && isPlaying ? 'Playing' : 'Play'}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>⏮</button>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                style={{ background: 'var(--primary-accent)', color: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem' }}
              >
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6 }}>⏭</button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              <span>0:00</span>
              <input type="range" style={{ flex: 1, accentColor: 'var(--primary-accent)' }} defaultValue="0" />
              <span>3:15</span>
            </div>

            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
              {isPlaying ? `Now Playing: ${currentTrack}` : 'Paused'}
            </p>
          </div>
        </div>
      </div>

      {/* Column 3: Journal */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2>Quick Reflection</h2>
          <p className="subtitle">Clear your mind. AI will analyze your entry.</p>
          
          <textarea 
            className="journal-textarea" 
            value={reflectionInput}
            onChange={(e) => setReflectionInput(e.target.value)}
            placeholder="E.g., I have so much to read for biology and I keep getting distracted..."
            disabled={isSubmittingReflection}
            style={{ minHeight: '150px', marginBottom: '1rem' }}
          ></textarea>
          
          <button 
            className="btn-primary" 
            onClick={submitReflection}
            disabled={isSubmittingReflection || !reflectionInput.trim()}
            style={{ margin: 0 }}
          >
            {isSubmittingReflection ? "Analyzing..." : "Submit & Analyze"}
          </button>

          {aiFeedback && (
            <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(95, 143, 94, 0.1)', borderRadius: '12px', border: '1px solid var(--primary-accent)' }}>
              <h4 style={{ color: 'var(--primary-accent)', marginBottom: '0.5rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>AI Coach Feedback</h4>
              <p style={{ color: 'var(--text-primary)', fontSize: '0.95rem', lineHeight: 1.5, margin: 0 }}>
                {aiFeedback}
              </p>
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <h2>Past Entries</h2>
          <div className="journal-history" style={{ flex: 1 }}>
            {pastEntries.map(entry => (
              <div key={entry.id} className="journal-entry" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="entry-date">{entry.date}</div>
                  <div className="entry-preview">{entry.text}</div>
                </div>
                <span className={`state-badge state-${entry.state}`} style={{ marginBottom: 0, padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                  {entry.state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

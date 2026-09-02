"use client";

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

const playAlertSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.1); // C6
    
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.1);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1);
  } catch (e) {
    console.log("Audio play prevented", e);
  }
};

export default function CommandCenterPage() {
  const { data: session, status } = useSession();
  const userName = session?.user?.name || 'anonymous';

  // To-Do State
  const [todos, setTodos] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [todoPriority, setTodoPriority] = useState('medium');
  const [todoFilter, setTodoFilter] = useState('All');
  const [loadingTodos, setLoadingTodos] = useState(true);

  // AI Coach State
  const [reflectionInput, setReflectionInput] = useState('');
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isSubmittingReflection, setIsSubmittingReflection] = useState(false);

  // Past Entries State (LocalStorage)
  const [pastEntries, setPastEntries] = useState([]);

  // Pomodoro State
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFocus, setIsFocus] = useState(true);
  const [timerPreset, setTimerPreset] = useState('25/5');
  const [sessionCount, setSessionCount] = useState(1);
  
  // Custom Timer State
  const [isCustomTimerModalOpen, setIsCustomTimerModalOpen] = useState(false);
  const [customWorkTime, setCustomWorkTime] = useState({ min: 0, sec: 0 });
  const [customBreakTime, setCustomBreakTime] = useState({ min: 0, sec: 0 });
  const [customSessions, setCustomSessions] = useState(0);

  // Ambient Audio State
  const [currentTrack, setCurrentTrack] = useState('Chill Lofi');
  const [isPlaying, setIsPlaying] = useState(false);
  const tracks = ['Chill Lofi', 'Study Music', 'Rain Ambient'];

  // Load To-Dos from API and History from LocalStorage
  useEffect(() => {
    if (status === 'loading') return;
    
    // Fetch Todos from Database
    if (status === 'authenticated') {
      fetch('/api/todos')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setTodos(data);
          setLoadingTodos(false);
        })
        .catch(err => {
          console.error("Failed to load todos:", err);
          setLoadingTodos(false);
        });
    } else {
      setLoadingTodos(false);
    }
    
    // Fetch Journal History from LocalStorage
    const historyKey = `ifocus_journal_history_${userName}`;
    let storedHistory = localStorage.getItem(historyKey);
    if (!storedHistory && userName === 'richardx') {
      storedHistory = localStorage.getItem('ifocus_journal_history');
      if (storedHistory) localStorage.setItem(historyKey, storedHistory); // migrate
    }
    
    if (storedHistory) {
      setPastEntries(JSON.parse(storedHistory));
    } else {
      setPastEntries([]);
    }
  }, [userName, status]);

  const saveHistory = (newHistory) => {
    setPastEntries(newHistory);
    try {
      localStorage.setItem(`ifocus_journal_history_${userName}`, JSON.stringify(newHistory));
    } catch (e) {
      console.warn("LocalStorage failed:", e);
    }
  };

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
        const breakTime = timerPreset === 'Custom' 
          ? customBreakTime.min * 60 + customBreakTime.sec 
          : timerPreset === '50/10' ? 10 * 60 : timerPreset === '15/3' ? 3 * 60 : timerPreset === '90/20' ? 20 * 60 : 5 * 60;
        setTimeLeft(breakTime);
      } else {
        setIsFocus(true);
        const focusTime = timerPreset === 'Custom'
          ? customWorkTime.min * 60 + customWorkTime.sec
          : (parseInt(timerPreset.split('/')[0]) || 25) * 60;
        setTimeLeft(focusTime);
        setSessionCount(c => c + 1);
      }
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isFocus, timerPreset, customWorkTime, customBreakTime]);

  const toggleTimer = () => setIsActive(!isActive);

  const resetTimer = () => {
    setIsActive(false);
    if (timerPreset === 'Custom') {
      setTimeLeft(isFocus ? customWorkTime.min * 60 + customWorkTime.sec : customBreakTime.min * 60 + customBreakTime.sec);
    } else {
      const focusTime = parseInt(timerPreset.split('/')[0]) || 25;
      setTimeLeft(isFocus ? focusTime * 60 : 5 * 60);
    }
  };

  const setPreset = (preset) => {
    if (preset === 'Custom') {
      setIsCustomTimerModalOpen(true);
    } else {
      setTimerPreset(preset);
      setIsActive(false);
      setIsFocus(true);
      const focusTime = parseInt(preset.split('/')[0]);
      setTimeLeft(focusTime * 60);
    }
  };

  const saveCustomSettings = () => {
    setIsCustomTimerModalOpen(false);
    setTimerPreset('Custom');
    setIsActive(false);
    setIsFocus(true);
    setTimeLeft(customWorkTime.min * 60 + customWorkTime.sec);
    setSessionCount(1);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // To-Do Logic (Cloud Synced)
  const addTodo = async (e) => {
    if (e) e.preventDefault();
    if (!todoInput || !todoInput.trim()) {
      alert("Oops! The task input is empty.");
      return;
    }
    
    const text = todoInput;
    setTodoInput(''); // Optimistic clear
    
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, priority: todoPriority })
      });
      
      if (!res.ok) throw new Error("Failed to add task");
      
      const newTodo = await res.json();
      setTodos(current => [newTodo, ...current]);
    } catch (err) {
      alert("Error adding task: " + err.message);
    }
  };

  const toggleTodo = async (id) => {
    // Optimistic UI update
    const todoToToggle = todos.find(t => t.id === id);
    if (!todoToToggle) return;
    
    const newStatus = !todoToToggle.completed;
    setTodos(todos.map(t => t.id === id ? { ...t, completed: newStatus } : t));
    
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newStatus })
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to toggle todo:", err);
      alert("Failed to update task.");
      // Revert on failure
      setTodos(todos.map(t => t.id === id ? { ...t, completed: !newStatus } : t));
    }
  };

  const deleteTodo = async (id) => {
    // Optimistic UI update
    const previousTodos = [...todos];
    setTodos(todos.filter(t => t.id !== id));
    
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to delete todo:", err);
      alert("Failed to delete task.");
      setTodos(previousTodos); // Revert on failure
    }
  };

  const clearCompleted = async () => {
    const completedTodos = todos.filter(t => t.completed);
    if (completedTodos.length === 0) return;
    
    // Optimistic UI update
    const previousTodos = [...todos];
    setTodos(todos.filter(t => !t.completed));
    
    try {
      // The API doesn't have a bulk delete, so we fire them individually
      const responses = await Promise.all(completedTodos.map(t => 
        fetch(`/api/todos/${t.id}`, { method: 'DELETE' })
      ));
      
      const failed = responses.filter(r => !r.ok);
      if (failed.length > 0) throw new Error("Some deletions failed");
    } catch (err) {
      console.error("Failed to clear completed todos:", err);
      alert("Failed to clear some tasks.");
      setTodos(previousTodos); // Revert on failure
    }
  };

  const filteredTodos = todos.filter(t => {
    if (todoFilter === 'Active') return !t.completed;
    if (todoFilter === 'Done') return t.completed;
    return true;
  });

  // AI Coach Logic
  const submitReflection = async () => {
    const text = reflectionInput.trim();
    if (!text) return;
    setIsSubmittingReflection(true);
    setAiFeedback(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout
      
      const activeTasks = todos.filter(t => !t.completed).map(t => ({ id: t.id, text: t.text, priority: t.priority }));
      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, tasks: activeTasks }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      const data = await res.json();
      
      let feedback = "Keep up the great work!";
      let state = "Engaged";
      
      if (res.ok) {
        feedback = data.actionPlan;
        state = data.state;
        
        playAlertSound();
        
        // Task Reordering
        if (data.orderedIds && data.orderedIds.length > 0) {
            const activeTodos = todos.filter(t => !t.completed);
            const completedTodos = todos.filter(t => t.completed);
            const reorderedActive = [];
            
            data.orderedIds.forEach(id => {
                const todo = activeTodos.find(t => String(t.id) === String(id));
                if (todo) reorderedActive.push(todo);
            });
            activeTodos.forEach(todo => {
                if (!reorderedActive.find(t => String(t.id) === String(todo.id))) reorderedActive.push(todo);
            });
            setTodos([...reorderedActive, ...completedTodos]);
        }
        
        // Adjust Timer based on state
        setIsActive(false);
        setIsFocus(true);
        let timerLabel = "Focus Time";
        if (state === "Stressed") {
            setTimerPreset('Custom');
            setCustomWorkTime({ min: 15, sec: 0 });
            setCustomBreakTime({ min: 3, sec: 0 });
            setTimeLeft(15 * 60);
            timerLabel = "Gentle Focus (Stressed)";
        } else if (state === "Distracted") {
            setTimerPreset('Custom');
            setCustomWorkTime({ min: 20, sec: 0 });
            setCustomBreakTime({ min: 5, sec: 0 });
            setTimeLeft(20 * 60);
            timerLabel = "Strict Pomodoro (Distracted)";
        } else if (state === "Engaged" || state === "Motivated") {
            setTimerPreset('Custom');
            setCustomWorkTime({ min: 60, sec: 0 });
            setCustomBreakTime({ min: 10, sec: 0 });
            setTimeLeft(60 * 60);
            timerLabel = "Flow State (Engaged)";
        }
        
        setAiFeedback({
            title: `AI Adjusted Timer:\n${timerLabel}`,
            message: feedback
        });

        // Trigger AI Coach Intervention in Local Storage if not Engaged/Motivated
        if (state === "Stressed" || state === "Distracted") {
          const telemetryKey = `ifocus_telemetry_insight_${userName}`;
          localStorage.setItem(telemetryKey, JSON.stringify({
            reason: `Coach noticed you are feeling ${state.toLowerCase()} based on your journal entry.`,
            actionPlan: feedback,
            timestamp: new Date().toISOString()
          }));
        }
      } else {
        setAiFeedback({ title: "Error", message: `Failed to generate AI response. ${data.error || ''}` });
      }
      
      setReflectionInput('');
      
      // Save to journal history
      const newEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        text: text,
        state: state
      };
      saveHistory([newEntry, ...pastEntries]);

    } catch (err) {
      setAiFeedback({ title: "Error", message: "Failed to reach AI Coach." });
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
        
        <div className="todo-input-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <input 
            type="text" 
            placeholder="What needs to be done?" 
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            style={{ flex: 1, minWidth: '200px', height: '48px', boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', flex: 1 }}>
            <select value={todoPriority} onChange={(e) => setTodoPriority(e.target.value)} style={{ minWidth: 'max-content', height: '48px', boxSizing: 'border-box', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)' }}>
              <option value="low">Low</option>
              <option value="medium">Med</option>
              <option value="high">High</option>
            </select>
            <button type="button" className="btn-primary" onClick={addTodo} style={{ flex: 1, padding: '0 1rem', marginTop: 0, height: '48px', boxSizing: 'border-box', borderRadius: 'var(--radius-sm)' }}>+ Add</button>
          </div>
        </div>

        <div className="todo-list" style={{ flex: 1 }}>
          {loadingTodos ? (
            <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)' }}>Loading tasks...</p>
          ) : filteredTodos.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)' }}>No tasks yet.</p>
          ) : (
            filteredTodos.map(todo => (
              <div key={todo.id} className={`todo-item priority-${todo.priority || 'medium'} ${todo.completed ? 'completed' : ''}`}>
                <div 
                  className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id)}
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
            Session {sessionCount} of {timerPreset === 'Custom' ? (customSessions || 1) : 1}
            <div className="session-dots">
              {Array.from({ length: timerPreset === 'Custom' ? (customSessions || 1) : 1 }).map((_, i) => (
                <div key={i} className={`session-dot ${i < sessionCount ? 'current' : ''}`}></div>
              ))}
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


        </div>

        {pastEntries.length > 0 && (
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <h2>Past Entries</h2>
            <div className="journal-history" style={{ flex: 1 }}>
              {pastEntries.map(entry => (
                <div key={entry.id} className="journal-entry" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="entry-date">{new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                    <div className="entry-preview">{entry.text}</div>
                  </div>
                  <span className={`state-badge state-${entry.state}`} style={{ marginBottom: 0, padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
                    {entry.state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Coach Modal */}
      {aiFeedback && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', lineHeight: '1.3', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{aiFeedback.title}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>{aiFeedback.message}</p>
            <button onClick={() => setAiFeedback(null)} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>Continue</button>
          </div>
        </div>
      )}

      {/* Custom Timer Modal */}
      {isCustomTimerModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '500px', width: '90%' }}>
            <h2>Custom Timer Settings</h2>
            <p className="subtitle" style={{ marginBottom: '1rem' }}>Set custom durations and number of sessions.</p>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Work Time</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" min="0" max="120" value={customWorkTime.min} onChange={e => setCustomWorkTime({ ...customWorkTime, min: parseInt(e.target.value) || 0 })} placeholder="Min" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                        <input type="number" min="0" max="59" value={customWorkTime.sec} onChange={e => setCustomWorkTime({ ...customWorkTime, sec: parseInt(e.target.value) || 0 })} placeholder="Sec" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                    </div>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Break Time</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" min="0" max="60" value={customBreakTime.min} onChange={e => setCustomBreakTime({ ...customBreakTime, min: parseInt(e.target.value) || 0 })} placeholder="Min" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                        <input type="number" min="0" max="59" value={customBreakTime.sec} onChange={e => setCustomBreakTime({ ...customBreakTime, sec: parseInt(e.target.value) || 0 })} placeholder="Sec" style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
                    </div>
                </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Sessions</label>
                <input type="number" min="0" max="10" value={customSessions} onChange={e => setCustomSessions(parseInt(e.target.value) || 0)} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--glass-border)', background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button onClick={() => setIsCustomTimerModalOpen(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                <button onClick={saveCustomSettings} className="btn-primary" style={{ padding: '0.5rem 1.25rem', margin: 0 }}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

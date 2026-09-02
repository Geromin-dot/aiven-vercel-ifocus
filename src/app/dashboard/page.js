"use client";

import { useState, useEffect, useRef } from 'react';
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
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [customWorkTime, setCustomWorkTime] = useState({ min: 0, sec: 0 });
  const [customBreakTime, setCustomBreakTime] = useState({ min: 0, sec: 0 });
  const [customSessions, setCustomSessions] = useState(0);

  // Ambient Audio State
  const [currentTrack, setCurrentTrack] = useState('Chill Lofi');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(70);
  const audioRef = useRef(null);
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

  // Audio Track Source Map
  const getTrackSrc = (name) => {
    if (name === 'Chill Lofi') return '/music/Lofi Chill.mp3';
    if (name === 'Study Music') return '/music/Study Music.mp3';
    if (name === 'Rain Ambient') return '/music/rain.mp3';
    return '/music/Lofi Chill.mp3';
  };

  // Audio Playback Sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
      if (isPlaying) {
        audioRef.current.play().catch(e => console.warn("Audio autoplay blocked:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack, volume]);

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
                const cleanId = String(id).trim();
                const todo = activeTodos.find(t => String(t.id).trim() === cleanId);
                if (todo) reorderedActive.push(todo);
            });
            activeTodos.forEach(todo => {
                if (!reorderedActive.find(t => String(t.id) === String(todo.id))) reorderedActive.push(todo);
            });
            const newOrder = [...reorderedActive, ...completedTodos];
            setTodos(newOrder);
            
            // Persist order
            fetch('/api/todos/reorder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderedIds: newOrder.map(t => t.id) })
            }).catch(e => console.error("Failed to sync order:", e));
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

  // Calculate Progress Percent for Pomodoro Progress Bar
  const getTotalTime = () => {
    if (isFocus) {
      if (timerPreset === 'Custom') return (customWorkTime.min * 60 + customWorkTime.sec) || 25 * 60;
      return (parseInt(timerPreset.split('/')[0]) || 25) * 60;
    } else {
      if (timerPreset === 'Custom') return (customBreakTime.min * 60 + customBreakTime.sec) || 5 * 60;
      return (parseInt(timerPreset.split('/')[1]) || 5) * 60;
    }
  };
  const totalTime = getTotalTime();
  const progressPercent = Math.min(100, Math.max(0, ((totalTime - timeLeft) / (totalTime || 1)) * 100));
  const activeTask = todos.find(t => !t.completed);

  return (
    <div className="command-center-layout">
      {/* Background Audio Element */}
      <audio ref={audioRef} loop src={getTrackSrc(currentTrack)} />

      {/* Column 1: Task Command Center (Apple Reminders Style) */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Tasks List</h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {todos.filter(t => t.completed).length}/{todos.length} Done
            </span>
          </div>
          <div className="sync-badge" style={{ padding: '0.2rem 0.6rem', fontSize: '0.75rem' }}>
            <span className="dot"></span>
            Cloud Synced
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', margin: '0.5rem 0' }}>
          {['All', 'Active', 'Done'].map(filter => (
            <button 
              key={filter}
              onClick={() => setTodoFilter(filter)}
              style={{ 
                background: todoFilter === filter ? '#ffffff' : 'rgba(0,0,0,0.04)',
                border: todoFilter === filter ? '1px solid rgba(0,0,0,0.08)' : '1px solid transparent',
                boxShadow: todoFilter === filter ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.78rem',
                cursor: 'pointer',
                fontWeight: todoFilter === filter ? 600 : 400,
                color: todoFilter === filter ? 'var(--text-primary)' : 'var(--text-secondary)',
                transition: 'all 0.2s ease'
              }}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="todo-list" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {loadingTodos ? (
            <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading tasks...</p>
          ) : filteredTodos.length === 0 ? (
            <p style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No tasks found.</p>
          ) : (
            filteredTodos.map((todo, idx) => (
              <div 
                key={todo.id} 
                className={`todo-item priority-${todo.priority || 'medium'} ${todo.completed ? 'completed' : ''}`}
                style={{ 
                  borderRadius: 'var(--radius-md)', 
                  padding: '0.6rem 0.85rem',
                  background: todo.completed ? 'rgba(0,0,0,0.02)' : '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}
              >
                <div 
                  className={`todo-checkbox ${todo.completed ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id)}
                  style={{ width: '20px', height: '20px' }}
                >
                  {todo.completed && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                <span className="todo-text" style={{ fontSize: '0.88rem' }}>{todo.text}</span>
                <span className={`todo-priority-badge ${todo.priority || 'medium'}`}>{todo.priority || 'medium'}</span>
                <button className="todo-delete" onClick={() => deleteTodo(todo.id)}>✕</button>
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <div className="todo-input-row" style={{ marginTop: '0.75rem', gap: '0.4rem' }}>
          <input 
            type="text" 
            placeholder="What needs to be done?" 
            value={todoInput}
            onChange={(e) => setTodoInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            style={{ flex: 1, minWidth: '120px', height: '38px', fontSize: '0.85rem', padding: '0 0.75rem', borderRadius: 'var(--radius-sm)' }}
          />
          <select value={todoPriority} onChange={(e) => setTodoPriority(e.target.value)} style={{ height: '38px', fontSize: '0.8rem', padding: '0 0.5rem', borderRadius: 'var(--radius-sm)' }}>
            <option value="low">Low</option>
            <option value="medium">Med</option>
            <option value="high">High</option>
          </select>
          <button type="button" className="btn-primary" onClick={addTodo} style={{ padding: '0 0.9rem', marginTop: 0, height: '38px', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' }}>+ Add</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '0.5rem' }}>
          <button onClick={clearCompleted} style={{ background: 'transparent', border: 'none', fontSize: '0.75rem', color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline' }}>
            Clear Completed
          </button>
        </div>
      </div>

      {/* Column 2: Daily Progress + Pomodoro Timer & Audio */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.35rem', height: '100%', minHeight: 0 }}>
        
        {/* Top Card: Daily Progress */}
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.15rem 1.4rem' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 700 }}>Daily Progress</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
              <span style={{ fontWeight: 600, color: 'var(--primary-accent)' }}>{todos.filter(t => t.completed).length}/{todos.length || 0}</span> Tasks was done
            </div>
          </div>

          {/* Circular Progress Badge */}
          <div 
            className="daily-progress-badge" 
            style={{ '--daily-progress': `${Math.round((todos.filter(t => t.completed).length / (todos.length || 1)) * 100)}%` }}
          >
            <div className="daily-progress-text">
              {Math.round((todos.filter(t => t.completed).length / (todos.length || 1)) * 100)}%
            </div>
          </div>
        </div>

        {/* Main Pomodoro Timer Card with Audio Widget */}
        <div className="glass-panel" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '1.35rem 1.4rem' }}>
          
          {/* Dynamic Ambient Audio Island Widget inside Pomodoro Card */}
          <div 
            className="ambient-island-widget"
            onClick={() => setIsAudioModalOpen(true)}
            title="Click to open Soundscape Player"
            style={{ marginBottom: '0.25rem' }}
          >
            <div className={`ambient-wave ${isPlaying ? 'playing' : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.1 }}>
                {currentTrack}
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {isPlaying ? 'Playing • Click for tracks' : 'Audio • Soundscapes'}
              </span>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPlaying(!isPlaying); }}
              style={{ 
                background: isPlaying ? 'var(--primary-accent)' : 'rgba(0,0,0,0.06)', 
                color: isPlaying ? 'white' : 'var(--text-primary)',
                border: 'none', 
                borderRadius: '50%', 
                width: '28px', 
                height: '28px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.8rem',
                marginLeft: '4px'
              }}
            >
              {isPlaying ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              )}
            </button>
          </div>

          {/* Ongoing / Break Pill Switcher */}
          <div className="ios-segmented-control" style={{ margin: '0.2rem 0' }}>
            <button 
              className={`ios-segment-btn ${isFocus ? 'active' : ''}`}
              onClick={() => {
                setIsFocus(true);
                setIsActive(false);
                const focusTime = timerPreset === 'Custom'
                  ? customWorkTime.min * 60 + customWorkTime.sec
                  : (parseInt(timerPreset.split('/')[0]) || 25) * 60;
                setTimeLeft(focusTime);
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              Ongoing
            </button>
            <button 
              className={`ios-segment-btn ${!isFocus ? 'active' : ''}`}
              onClick={() => {
                setIsFocus(false);
                setIsActive(false);
                const breakTime = timerPreset === 'Custom'
                  ? customBreakTime.min * 60 + customBreakTime.sec
                  : timerPreset === '50/10' ? 10 * 60 : timerPreset === '15/3' ? 3 * 60 : timerPreset === '90/20' ? 20 * 60 : 5 * 60;
                setTimeLeft(breakTime);
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
              Break
            </button>
          </div>

          {/* Circular Pomodoro Timer Ring */}
          <div 
            className="timer-circle" 
            style={{ 
              '--progress': `${progressPercent}%`,
              width: '215px',
              height: '215px'
            }}
          >
            <div className="timer-inner">
              <div className="timer-display">
                {formatTime(timeLeft)}
              </div>
              <div className="timer-label">
                {isFocus ? 'Focus Time' : 'Break Time'}
              </div>
            </div>
          </div>

          {/* Controls (Reset, Start/Stop Pill, Settings) */}
          <div className="ios-timer-actions" style={{ margin: '0.25rem 0 0.5rem 0' }}>
            <button 
              className="ios-circle-action-btn"
              onClick={resetTimer}
              title="Reset Timer"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
            </button>

            <button 
              className={`ios-pill-action-btn ${isActive ? 'paused' : ''}`}
              onClick={toggleTimer}
              style={{
                background: isActive ? '#d97706' : '#4e8253',
                padding: '0.65rem 2.2rem',
                borderRadius: '9999px',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 8px 20px -4px rgba(78, 130, 83, 0.4)'
              }}
            >
              {isActive ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                  <span>Stop</span>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  <span>Start</span>
                </>
              )}
            </button>

            <button 
              className="ios-circle-action-btn"
              onClick={() => setIsCustomTimerModalOpen(true)}
              title="Custom Timer Settings"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </div>

          {/* Presets Row */}
          <div className="pomodoro-settings" style={{ margin: 0 }}>
            {['25/5', '50/10', '15/3', '90/20', 'Custom'].map(preset => (
              <button 
                key={preset}
                className={`pomodoro-preset ${timerPreset === preset ? 'active' : ''}`}
                onClick={() => setPreset(preset)}
                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Session Indicator Dots */}
          <div className="session-counter" style={{ margin: 0, fontSize: '0.78rem' }}>
            Session {sessionCount} of {timerPreset === 'Custom' ? (customSessions || 1) : 4}
            <div className="session-dots" style={{ marginTop: '0.35rem' }}>
              {Array.from({ length: timerPreset === 'Custom' ? (customSessions || 1) : 4 }).map((_, i) => (
                <div key={i} className={`session-dot ${i < sessionCount ? 'current' : ''}`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Column 3: Quick Reflection (Apple Notes / Journal Style) */}
      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, padding: '1.5rem 1.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Quick Reflection</h2>
          <button 
            onClick={() => setIsHistoryModalOpen(true)}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.08)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
              padding: '0.35rem 0.8rem',
              borderRadius: '9999px',
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            History {pastEntries.length > 0 && `(${pastEntries.length})`}
          </button>
        </div>
        <p className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '0.85rem', lineHeight: '1.3' }}>Clear your mind. AI will analyze your entry.</p>
        
        <textarea 
          className="journal-textarea" 
          value={reflectionInput}
          onChange={(e) => setReflectionInput(e.target.value)}
          placeholder="E.g., I have so much to read for biology and I keep getting distracted..."
          disabled={isSubmittingReflection}
          style={{ 
            flex: 1, 
            minHeight: '140px', 
            fontSize: '0.88rem', 
            padding: '0.85rem', 
            marginBottom: '0.75rem', 
            resize: 'none', 
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(0,0,0,0.08)'
          }}
        ></textarea>
        
        <button 
          className="btn-primary" 
          onClick={submitReflection}
          disabled={isSubmittingReflection || !reflectionInput.trim()}
          style={{ margin: 0, height: '42px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '9999px' }}
        >
          {isSubmittingReflection ? (
            "Analyzing with AI Coach..."
          ) : (
            <>
              <span>Submit & Analyze</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>
            </>
          )}
        </button>

        {/* AI Coaching Strategy Tip Box */}
        <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.18)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#16a34a', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path></svg>
            Adaptive AI Coach
          </div>
          <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', lineHeight: '1.45', margin: 0 }}>
            Share how you feel or what task you want to start with. AI analyzes emotional friction, reorders your to-dos, and sets your focus timer.
          </p>
        </div>
      </div>

      {/* Ambient Soundscapes Modal */}
      {isAudioModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '460px', width: '92%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.3rem', margin: 0 }}>Ambient Soundscapes</h2>
              <button onClick={() => setIsAudioModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <p className="subtitle" style={{ fontSize: '0.82rem', marginBottom: '1.25rem' }}>Background audio streams to help you focus.</p>

            {/* Track Selection Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {tracks.map(track => {
                const isCurrent = currentTrack === track;
                const desc = track === 'Chill Lofi' ? 'Calming Lo-Fi beats & ambient vibes' : track === 'Study Music' ? 'Alpha wave melodies for concentration' : 'Gentle rain shower & soothing drops';
                return (
                  <div 
                    key={track}
                    className={`soundscape-card ${isCurrent ? 'active' : ''}`}
                    onClick={() => {
                      setCurrentTrack(track);
                      setIsPlaying(true);
                    }}
                  >
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(78, 130, 83, 0.12)', color: 'var(--primary-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {track === 'Chill Lofi' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
                      ) : track === 'Study Music' ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"></path><line x1="8" y1="19" x2="8" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><line x1="16" y1="19" x2="16" y2="21"></line></svg>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{track}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{desc}</div>
                    </div>
                    {isCurrent && isPlaying ? (
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-accent)', background: 'rgba(34,197,94,0.1)', padding: '0.2rem 0.6rem', borderRadius: '9999px' }}>
                        Playing
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Select</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Volume Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={volume}
                onChange={(e) => setVolume(parseInt(e.target.value))}
                style={{ flex: 1, accentColor: 'var(--primary-accent)' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', minWidth: '35px' }}>{volume}%</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="btn-primary" 
                style={{ margin: 0, padding: '0.5rem 1.5rem', borderRadius: '9999px', fontSize: '0.88rem' }}
              >
                {isPlaying ? 'Pause Audio' : 'Play Soundscape'}
              </button>
              <button onClick={() => setIsAudioModalOpen(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem 1.25rem', borderRadius: '9999px', cursor: 'pointer', fontSize: '0.85rem' }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Coach Modal */}
      {aiFeedback && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', lineHeight: '1.3', whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>{aiFeedback.title}</h2>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.95rem' }}>{aiFeedback.message}</p>
            <button onClick={() => setAiFeedback(null)} className="btn-primary" style={{ width: '100%', marginTop: '0.5rem', borderRadius: '9999px' }}>Continue</button>
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
                <button onClick={() => setIsCustomTimerModalOpen(false)} style={{ background: 'transparent', border: '1px solid var(--glass-border)', padding: '0.5rem 1rem', borderRadius: '9999px', cursor: 'pointer', color: 'var(--text-primary)' }}>Cancel</button>
                <button onClick={saveCustomSettings} className="btn-primary" style={{ padding: '0.5rem 1.25rem', margin: 0, borderRadius: '9999px' }}>Save Settings</button>
            </div>
          </div>
        </div>
      )}

      {/* Reflection History Modal */}
      {isHistoryModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel modal-content" style={{ maxWidth: '540px', width: '92%', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Reflection History</h2>
              <button onClick={() => setIsHistoryModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            </div>
            <p className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>Past reflection journal entries and detected emotional states.</p>
            
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.6rem', paddingRight: '4px', maxHeight: '420px' }}>
              {pastEntries.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                  <p>No reflection entries recorded yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>Submit a quick reflection to start building your mental clarity history.</p>
                </div>
              ) : (
                pastEntries.map(entry => (
                  <div key={entry.id} className="journal-entry" style={{ padding: '0.75rem 1rem', background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                        {new Date(entry.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className={`state-badge state-${entry.state}`} style={{ margin: 0, padding: '0.15rem 0.55rem', fontSize: '0.7rem' }}>
                        {entry.state}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0, lineHeight: '1.4', fontStyle: 'italic' }}>
                      "{entry.text}"
                    </p>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setIsHistoryModalOpen(false)} className="btn-primary" style={{ padding: '0.5rem 1.25rem', margin: 0, fontSize: '0.85rem', borderRadius: '9999px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

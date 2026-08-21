document.addEventListener('DOMContentLoaded', () => {
    // ===== DOM Elements =====
    const timerDisplay = document.getElementById('timerDisplay');
    const timerLabel = document.getElementById('timerLabel');
    const timerCircle = document.getElementById('timerCircle');
    const startTimerBtn = document.getElementById('startTimerBtn');
    const resetTimerBtn = document.getElementById('resetTimerBtn');
    const presets = document.querySelectorAll('.pomodoro-preset');
    const sessionDotsContainer = document.getElementById('sessionDots');
    const sessionLabel = document.getElementById('sessionLabel');

    // Stats
    const statSessions = document.getElementById('statSessions');
    const statMinutes = document.getElementById('statMinutes');
    const statStreak = document.getElementById('statStreak');

    // ===== Timer State =====
    let workDuration = 25 * 60;
    let breakDuration = 5 * 60;
    let timeLeft = workDuration;
    let totalTime = workDuration;
    let timerInterval = null;
    let timerRunning = false;
    let isBreak = false;
    let totalSessions = 4;
    let completedSessions = 0;
    let currentSession = 1;
    let currentSessionStartTime = Date.now();

    // ===== Focus Stats =====
    function loadFocusStats() {
        const today = new Date().toDateString();
        const stored = localStorage.getItem('ifocus_focus_stats');
        if (stored) {
            const stats = JSON.parse(stored);
            if (stats.date === today) return stats;
        }
        return { date: today, sessions: 0, minutes: 0, streak: 0 };
    }

    function saveFocusStats(stats) {
        localStorage.setItem('ifocus_focus_stats', JSON.stringify(stats));
    }

    function updateStatsDisplay() {
        const stats = loadFocusStats();
        if (statSessions) statSessions.textContent = stats.sessions;
        if (statMinutes) statMinutes.textContent = stats.minutes;
        if (statStreak) statStreak.textContent = stats.streak;
    }

    updateStatsDisplay();

    // ===== Timer Logic =====
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Update circular progress
        const progress = ((totalTime - timeLeft) / totalTime) * 100;
        timerCircle.style.setProperty('--progress', `${progress}%`);
    }

    function saveTimerState() {
        const state = {
            isRunning: timerRunning,
            targetEndTime: timerRunning ? Date.now() + (timeLeft * 1000) : null,
            timeLeft: timeLeft,
            isBreak: isBreak,
            totalTime: totalTime,
            workDuration: workDuration,
            breakDuration: breakDuration,
            completedSessions: completedSessions,
            currentSession: currentSession,
            currentSessionStartTime: currentSessionStartTime,
            totalSessions: totalSessions
        };
        localStorage.setItem('ifocus_timer_state', JSON.stringify(state));
    }

    function loadTimerState() {
        const saved = localStorage.getItem('ifocus_timer_state');
        if (saved) {
            const state = JSON.parse(saved);
            isBreak = state.isBreak;
            totalTime = state.totalTime;
            workDuration = state.workDuration;
            breakDuration = state.breakDuration || breakDuration;
            completedSessions = state.completedSessions;
            currentSession = state.currentSession;
            currentSessionStartTime = state.currentSessionStartTime;
            totalSessions = state.totalSessions || 4;
            
            if (state.isRunning && state.targetEndTime) {
                timeLeft = Math.max(0, Math.floor((state.targetEndTime - Date.now()) / 1000));
                updateTimerDisplay();
                updateSessionDots();
                startTimer(true);
            } else {
                timeLeft = state.timeLeft;
                updateTimerDisplay();
                updateSessionDots();
            }
        }
    }

    function startTimer(resumeSync = false) {
        if (timerRunning && !resumeSync) {
            // Pause
            clearInterval(timerInterval);
            timerRunning = false;
            startTimerBtn.textContent = 'Resume';
            saveTimerState();
            return;
        }

        if (!resumeSync && timeLeft === totalTime && !isBreak) {
            currentSessionStartTime = Date.now();
        }

        timerRunning = true;
        startTimerBtn.textContent = 'Pause';
        saveTimerState();

        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
                saveTimerState(); // save every second

                // 5-minute Active Presence Checker
                if (!isBreak && timeLeft > 0 && timeLeft < totalTime && timeLeft % 300 === 0) {
                    clearInterval(timerInterval);
                    timerRunning = false;
                    startTimerBtn.textContent = 'Resume';
                    saveTimerState();
                    playAlertSound();
                    showAlertModal(
                        "Are you still there?", 
                        "The timer won't run if you aren't there! Please click Continue to resume your session."
                    );
                }
            } else {
                clearInterval(timerInterval);
                timerRunning = false;
                startTimerBtn.textContent = 'Start';
                saveTimerState();

                if (!isBreak) {
                    // Work session completed
                    completedSessions++;
                    const stats = loadFocusStats();
                    stats.sessions++;
                    stats.minutes += Math.round(workDuration / 60);
                    stats.streak++;
                    saveFocusStats(stats);
                    updateStatsDisplay();
                    updateSessionDots();

                    // Save to analytics history
                    saveSessionToHistory(workDuration / 60);

                    // --- NEW BURNOUT CHECK ---
                    let recentCompletedTasks = 0;
                    if (window.getTasks) {
                        recentCompletedTasks = window.getTasks().filter(t => t.completed && t.completedAt && t.completedAt >= currentSessionStartTime).length;
                    }

                    // The proactive burnout will just show during 50 mins timer and above
                    // (workDuration >= 3000 means >= 50 mins. workDuration === 3 is for testing 3 seconds)
                    const isLongSession = workDuration >= (50 * 60) || workDuration === 3;
                    const isBurnout = isLongSession && recentCompletedTasks === 0;

                    if (isBurnout) {
                        setTimeout(() => {
                            showAlertModal(
                                "Proactive Burnout Intervention", 
                                "You just spent a long time focusing but haven't checked off any tasks yet. Are you feeling stuck? Take a deep breath, step away from the screen for a full 10 minutes, and let's break your tasks down into smaller steps when you return."
                            );
                        }, 200);
                        breakDuration = 10 * 60; // Force 10 minute recovery break
                    }
                    // ------------------------

                    if (completedSessions >= totalSessions) {
                        if (!isBurnout) {
                            showAlertModal("Great Work!", "All sessions completed!");
                        }
                        completedSessions = 0;
                        currentSession = 1;
                        updateSessionDots();
                    } else {
                        // Switch to break
                        if (isBurnout) {
                            startBreakSession();
                        } else {
                            initBreakGate();
                        }
                    }
                } else {
                    // Break completed
                    isBreak = false;
                    currentSession++;
                    timeLeft = workDuration;
                    totalTime = workDuration;
                    timerLabel.textContent = 'Focus Time';
                    timerCircle.style.setProperty('--progress', '0%');
                    updateTimerDisplay();
                    updateSessionDots();
                    showAlertModal("Break Over!", `Ready for session ${currentSession}?`);
                }
            }
        }, 1000);
    }

    // ===== Break-Gate System (Pomodoro Ice Breakers) =====
    const bgModal = document.getElementById('breakGateModal');
    const bgNoDeckState = document.getElementById('bgNoDeckState');
    const bgQuizState = document.getElementById('bgQuizState');
    const bgSkipBtn = document.getElementById('bgSkipBtn');
    
    const bgDeckSelect = document.getElementById('bgDeckSelect');
    const bgCardCounter = document.getElementById('bgCardCounter');
    const bgFlashcard = document.getElementById('bgFlashcard');
    const bgCardTag = document.getElementById('bgCardTag');
    const bgCardFront = document.getElementById('bgCardFront');
    const bgCardBack = document.getElementById('bgCardBack');
    
    const bgRevealControls = document.getElementById('bgRevealControls');
    const bgRevealBtn = document.getElementById('bgRevealBtn');
    const bgResultControls = document.getElementById('bgResultControls');
    const bgNeedReviewBtn = document.getElementById('bgNeedReviewBtn');
    const bgGotItBtn = document.getElementById('bgGotItBtn');
    
    let bgCurrentCards = [];
    let bgCurrentIndex = 0;
    
    function startBreakSession() {
        if (bgModal) bgModal.classList.add('hidden');
        isBreak = true;
        timeLeft = breakDuration;
        totalTime = breakDuration;
        timerLabel.textContent = 'Break Time';
        timerCircle.style.setProperty('--progress', '0%');
        updateTimerDisplay();
        startTimer(); // auto-start break
    }

    function initBreakGate() {
        if (!bgModal) {
            startBreakSession();
            return;
        }
        
        bgModal.classList.remove('hidden');
        
        // Load collections
        const stored = localStorage.getItem('ifocus_flashcard_collections');
        const allCollections = stored ? JSON.parse(stored) : [];
        const collections = allCollections.filter(c => c.activated);
        
        if (collections.length === 0 || !collections[0].cards || collections[0].cards.length === 0) {
            bgNoDeckState.classList.remove('hidden');
            bgQuizState.classList.add('hidden');
            return;
        }
        
        bgNoDeckState.classList.add('hidden');
        bgQuizState.classList.remove('hidden');
        
        // Populate select options
        if (bgDeckSelect) {
            bgDeckSelect.innerHTML = collections.map((col, idx) => 
                `<option value="${idx}">${col.name}</option>`
            ).join('');
            
            // Set up active deck
            let activeIdx = bgDeckSelect.value || 0;
            const activeDeck = collections[activeIdx];
            
            bgDeckSelect.onchange = () => {
                const newIdx = bgDeckSelect.value;
                loadBreakGateQuiz(collections[newIdx]);
            };
            
            loadBreakGateQuiz(activeDeck);
        } else {
            loadBreakGateQuiz(collections[0]);
        }
    }
    
    function loadBreakGateQuiz(deck) {
        if (!deck || !deck.cards) return;
        
        // First, randomly shuffle all cards
        let cards = [...deck.cards];
        for (let i = cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [cards[i], cards[j]] = [cards[j], cards[i]];
        }
        
        // Then sort to prioritize ones with 'needsReview' flag
        cards.sort((a, b) => {
            if (a.needsReview && !b.needsReview) return -1;
            if (!a.needsReview && b.needsReview) return 1;
            return 0;
        });
        
        // Take up to 5 cards
        bgCurrentCards = cards.slice(0, 5);
        bgCurrentIndex = 0;
        
        renderBgCard();
    }
    
    function renderBgCard() {
        if (bgCurrentIndex >= bgCurrentCards.length) {
            // Finished the quiz!
            updateSpacedRepetition();
            startBreakSession();
            return;
        }
        
        const card = bgCurrentCards[bgCurrentIndex];
        bgCardCounter.textContent = `${bgCurrentIndex + 1} / ${bgCurrentCards.length}`;
        bgCardTag.textContent = card.tag || 'Flashcard';
        bgCardFront.textContent = card.front;
        bgCardBack.textContent = card.back;
        
        bgFlashcard.classList.remove('flipped');
        bgRevealControls.classList.remove('hidden');
        bgResultControls.classList.add('hidden');
    }
    
    function updateSpacedRepetition() {
        const stored = localStorage.getItem('ifocus_flashcard_collections');
        if (!stored) return;
        const collections = JSON.parse(stored);
        if (collections.length > 0) {
            let activeIdx = bgDeckSelect ? bgDeckSelect.value : 0;
            const activeDeck = collections[activeIdx];
            if (!activeDeck) return;
            bgCurrentCards.forEach(quizCard => {
                const match = activeDeck.cards.find(c => c.front === quizCard.front && c.back === quizCard.back);
                if (match) {
                    match.needsReview = quizCard.needsReview;
                }
            });
            localStorage.setItem('ifocus_flashcard_collections', JSON.stringify(collections));
        }
    }
    
    if (bgSkipBtn) bgSkipBtn.addEventListener('click', startBreakSession);
    if (bgRevealBtn) {
        bgRevealBtn.addEventListener('click', () => {
            bgFlashcard.classList.add('flipped');
            bgRevealControls.classList.add('hidden');
            bgResultControls.classList.remove('hidden');
        });
    }
    if (bgFlashcard) {
        bgFlashcard.addEventListener('click', () => {
            if (bgRevealControls && !bgRevealControls.classList.contains('hidden')) {
                bgRevealBtn.click();
            }
        });
    }
    if (bgNeedReviewBtn) {
        bgNeedReviewBtn.addEventListener('click', () => {
            bgCurrentCards[bgCurrentIndex].needsReview = true;
            bgCurrentIndex++;
            renderBgCard();
        });
    }
    if (bgGotItBtn) {
        bgGotItBtn.addEventListener('click', () => {
            bgCurrentCards[bgCurrentIndex].needsReview = false;
            bgCurrentIndex++;
            renderBgCard();
        });
    }
    // ===== End Break-Gate System =====

    let audioCtx = null;
    function getAudioContext() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        return audioCtx;
    }

    function playCuteWarningSound() {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        
        gainNode.gain.setValueAtTime(0, ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 2);
    }

    function playAlertSound() {
        const ctx = getAudioContext();
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
    }

    function showAlertModal(title, message) {
        const modal = document.getElementById('alertModal');
        const titleEl = document.getElementById('alertModalTitle');
        const msgEl = document.getElementById('alertModalMessage');
        const btn = document.getElementById('alertModalBtn');
        
        if (modal) {
            titleEl.textContent = title;
            msgEl.textContent = message;
            modal.classList.remove('hidden');
            playAlertSound();
            
            btn.onclick = () => {
                modal.classList.add('hidden');
            };
        }
    }

    function resetTimer() {
        clearInterval(timerInterval);
        timerRunning = false;
        isBreak = false;
        timeLeft = workDuration;
        totalTime = workDuration;
        completedSessions = 0;
        currentSession = 1;
        timerLabel.textContent = 'Focus Time';
        startTimerBtn.textContent = 'Start';
        updateTimerDisplay();
        updateSessionDots();
        timerCircle.style.setProperty('--progress', '0%');
        saveTimerState();
    }

    startTimerBtn.addEventListener('click', () => startTimer());
    resetTimerBtn.addEventListener('click', resetTimer);

    // ===== Presets =====
    presets.forEach(preset => {
        preset.addEventListener('click', () => {
            if (timerRunning) return;
            
            if (preset.id === 'customPresetBtn') {
                const modal = document.getElementById('customTimerModal');
                if (modal) modal.classList.remove('hidden');
                return; // Wait for modal action
            } else {
                workDuration = parseInt(preset.dataset.work) * 60;
                breakDuration = parseInt(preset.dataset.break) * 60;
                
                // Reset custom button text if another preset is clicked
                const customBtn = document.getElementById('customPresetBtn');
                if (customBtn) customBtn.textContent = 'Custom';
            }

            presets.forEach(p => p.classList.remove('active'));
            preset.classList.add('active');
            
            timeLeft = workDuration;
            totalTime = workDuration;
            isBreak = false;
            timerLabel.textContent = 'Focus Time';
            updateTimerDisplay();
            timerCircle.style.setProperty('--progress', '0%');
            saveTimerState();
        });
    });

    // ===== Custom Timer Modal Logic =====
    const customModal = document.getElementById('customTimerModal');
    const saveCustomBtn = document.getElementById('saveCustomBtn');
    const cancelCustomBtn = document.getElementById('cancelCustomBtn');
    const customWorkMin = document.getElementById('customWorkMin');
    const customWorkSec = document.getElementById('customWorkSec');
    const customBreakMin = document.getElementById('customBreakMin');
    const customBreakSec = document.getElementById('customBreakSec');
    const customSessionsInput = document.getElementById('customSessionsInput');
    const customPresetBtn = document.getElementById('customPresetBtn');

    if (customModal && saveCustomBtn && cancelCustomBtn) {
        cancelCustomBtn.addEventListener('click', () => {
            customModal.classList.add('hidden');
        });

        saveCustomBtn.addEventListener('click', () => {
            let wMin = parseInt(customWorkMin.value) || 0;
            let wSec = parseInt(customWorkSec.value) || 0;
            let bMin = parseInt(customBreakMin.value) || 0;
            let bSec = parseInt(customBreakSec.value) || 0;
            let sessions = parseInt(customSessionsInput.value);
            if (isNaN(sessions) || sessions <= 0) sessions = 1; // At least 1 session


            workDuration = (wMin * 60) + wSec;
            breakDuration = (bMin * 60) + bSec;
            totalSessions = sessions;
            completedSessions = 0;
            currentSession = 1;

            if (customPresetBtn) {
                presets.forEach(p => p.classList.remove('active'));
                customPresetBtn.classList.add('active');
                
                let formatStr = wSec > 0 ? `${wMin}m ${wSec}s` : `${wMin}m`;
                customPresetBtn.textContent = `Custom (${formatStr})`;
            }

            timeLeft = workDuration;
            totalTime = workDuration;
            isBreak = false;
            timerLabel.textContent = 'Focus Time';
            updateTimerDisplay();
            updateSessionDots();
            timerCircle.style.setProperty('--progress', '0%');
            saveTimerState();
            
            customModal.classList.add('hidden');
        });
    }

    // ===== Session Dots =====
    function updateSessionDots() {
        // Regenerate dots if totalSessions changed
        let currentDotCount = sessionDotsContainer.children.length;
        if (currentDotCount !== totalSessions) {
            sessionDotsContainer.innerHTML = '';
            for (let i = 0; i < totalSessions; i++) {
                const dot = document.createElement('div');
                dot.className = 'session-dot';
                sessionDotsContainer.appendChild(dot);
            }
        }
        
        const dots = sessionDotsContainer.querySelectorAll('.session-dot');
        dots.forEach((dot, i) => {
            dot.className = 'session-dot';
            if (i < completedSessions) {
                dot.classList.add('completed');
            } else if (i === completedSessions) {
                dot.classList.add('current');
            }
        });
        sessionLabel.textContent = `Session ${Math.min(currentSession, totalSessions)} of ${totalSessions}`;
    }

    // Exit Prompt logic removed to allow cross-page navigation

    // ===== Save Session to Analytics History =====
    function saveSessionToHistory(minutes) {
        const history = JSON.parse(localStorage.getItem('ifocus_session_history') || '[]');
        history.push({
            date: new Date().toISOString(),
            duration: minutes,
            type: 'pomodoro'
        });
        // Keep last 100 sessions
        if (history.length > 100) history.splice(0, history.length - 100);
        localStorage.setItem('ifocus_session_history', JSON.stringify(history));
    }

    // ===== Custom Audio Player =====
    const localAudioPlayer = document.getElementById('localAudioPlayer');
    const volumeSlider = document.getElementById('volumeSlider');
    const audioTracks = document.querySelectorAll('.audio-track');
    const playPauseBtn = document.getElementById('audioPlayPauseBtn');
    const playIcon = document.getElementById('audioPlayIcon');
    const pauseIcon = document.getElementById('audioPauseIcon');
    const prevBtn = document.getElementById('audioPrevBtn');
    const nextBtn = document.getElementById('audioNextBtn');
    const shuffleBtn = document.getElementById('audioShuffleBtn');
    const repeatBtn = document.getElementById('audioRepeatBtn');
    const progressBar = document.getElementById('audioProgressBar');
    const currentTimeEl = document.getElementById('audioCurrentTime');
    const totalTimeEl = document.getElementById('audioTotalTime');
    const nowPlayingText = document.getElementById('audioNowPlayingText');

    const playlist = [
        { title: "Chill Lofi", src: "music/Lofi Chill.mp3" },
        { title: "Study Music", src: "music/Study Music.mp3" },
        { title: "Rain Ambient", src: "music/rain.mp3" }
    ];

    let currentTrackIndex = 0;
    let isShuffle = false;
    let isRepeat = false;

    if (localAudioPlayer && playPauseBtn) {
        // Init volume
        if (volumeSlider) {
            localAudioPlayer.volume = volumeSlider.value / 100;
            volumeSlider.addEventListener('input', () => {
                localAudioPlayer.volume = volumeSlider.value / 100;
            });
        }

        function loadTrack(index) {
            currentTrackIndex = index;
            localAudioPlayer.src = playlist[index].src;
            nowPlayingText.textContent = `Now Playing: ${playlist[index].title}`;
            
            // Update list UI
            if (audioTracks) {
                audioTracks.forEach(t => {
                    t.classList.remove('playing');
                    t.querySelector('.track-status').textContent = 'Play';
                });
                if (audioTracks[index]) {
                    audioTracks[index].classList.add('playing');
                    audioTracks[index].querySelector('.track-status').textContent = 'Playing';
                }
            }
            
            localAudioPlayer.load();
        }

        function togglePlayPause() {
            if (localAudioPlayer.paused) {
                localAudioPlayer.play().catch(e => console.warn("Audio play blocked:", e));
            } else {
                localAudioPlayer.pause();
            }
        }

        function updatePlayPauseUI() {
            if (localAudioPlayer.paused) {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                if (audioTracks && audioTracks[currentTrackIndex]) {
                    audioTracks[currentTrackIndex].querySelector('.track-status').textContent = 'Paused';
                }
            } else {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
                if (audioTracks && audioTracks[currentTrackIndex]) {
                    audioTracks[currentTrackIndex].querySelector('.track-status').textContent = 'Playing';
                }
            }
        }

        function nextTrack() {
            if (isShuffle) {
                currentTrackIndex = Math.floor(Math.random() * playlist.length);
            } else {
                currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
            }
            loadTrack(currentTrackIndex);
            localAudioPlayer.play().catch(e => console.warn("Audio play blocked:", e));
        }

        function prevTrack() {
            currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
            loadTrack(currentTrackIndex);
            localAudioPlayer.play().catch(e => console.warn("Audio play blocked:", e));
        }

        function formatTime(seconds) {
            if (isNaN(seconds)) return "0:00";
            const min = Math.floor(seconds / 60);
            const sec = Math.floor(seconds % 60);
            return `${min}:${sec.toString().padStart(2, '0')}`;
        }

        // Event Listeners
        playPauseBtn.addEventListener('click', togglePlayPause);
        localAudioPlayer.addEventListener('play', updatePlayPauseUI);
        localAudioPlayer.addEventListener('pause', updatePlayPauseUI);
        nextBtn.addEventListener('click', nextTrack);
        prevBtn.addEventListener('click', prevTrack);

        shuffleBtn.addEventListener('click', () => {
            isShuffle = !isShuffle;
            shuffleBtn.style.color = isShuffle ? 'var(--primary-accent)' : 'var(--text-secondary)';
        });

        repeatBtn.addEventListener('click', () => {
            isRepeat = !isRepeat;
            repeatBtn.style.color = isRepeat ? 'var(--primary-accent)' : 'var(--text-secondary)';
            localAudioPlayer.loop = isRepeat;
        });

        localAudioPlayer.addEventListener('ended', () => {
            if (!isRepeat) {
                nextTrack();
            }
        });

        localAudioPlayer.addEventListener('timeupdate', () => {
            if (!isNaN(localAudioPlayer.duration)) {
                progressBar.value = (localAudioPlayer.currentTime / localAudioPlayer.duration) * 100;
                currentTimeEl.textContent = formatTime(localAudioPlayer.currentTime);
            }
        });

        localAudioPlayer.addEventListener('loadedmetadata', () => {
            totalTimeEl.textContent = formatTime(localAudioPlayer.duration);
        });

        progressBar.addEventListener('input', () => {
            if (!isNaN(localAudioPlayer.duration)) {
                localAudioPlayer.currentTime = (progressBar.value / 100) * localAudioPlayer.duration;
            }
        });
        
        // Track list clicks
        if (audioTracks) {
            audioTracks.forEach((track, index) => {
                track.addEventListener('click', () => {
                    if (currentTrackIndex === index) {
                        togglePlayPause();
                    } else {
                        loadTrack(index);
                        localAudioPlayer.play().catch(e => console.warn("Audio play blocked:", e));
                    }
                });
            });
        }

        // Initialize first track but don't play
        loadTrack(0);
    }

    // ===== Distraction Tracking Removed =====


    // ===== Initial Display =====
    updateTimerDisplay();
    updateSessionDots();
    
    // ===== React to Sentiment / Reflection =====
    window.addEventListener('ReflectionSubmitted', (e) => {
        const state = e.detail?.state || '';
        const actionPlan = e.detail?.actionPlan || '';
        
        clearInterval(timerInterval);
        timerRunning = false;
        startTimerBtn.textContent = 'Start';
        
        if (state === "Stressed") {
            timeLeft = 15 * 60;
            totalTime = 15 * 60;
            timerLabel.innerText = "Gentle Focus (Stressed)";
        } else if (state === "Distracted") {
            timeLeft = 20 * 60;
            totalTime = 20 * 60;
            timerLabel.innerText = "Strict Pomodoro (Distracted)";
        } else if (state === "Engaged" || state === "Motivated") {
            timeLeft = 60 * 60;
            totalTime = 60 * 60;
            timerLabel.innerText = "Flow State (Engaged)";
        } else {
            timeLeft = 25 * 60;
            totalTime = 25 * 60;
            timerLabel.innerText = "Focus Time";
        }
        
        updateTimerDisplay();
        setTimeout(() => showAlertModal(`AI Adjusted Timer: ${timerLabel.innerText}`, actionPlan || "Your timer and tasks have been adjusted."), 100);
    });

    // ===== Sync Cross-Page Timer State =====
    loadTimerState();
});

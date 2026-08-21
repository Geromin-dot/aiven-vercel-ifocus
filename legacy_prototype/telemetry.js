/**
 * Keystroke Telemetry Engine
 * Monitors typing dynamics to detect stress/frustration through erratic typing.
 */

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('reflectionInput');
    if (!inputField) return;

    let keydownTimes = {};
    let lastKeyupTime = null;
    
    // Metrics
    let dwellTimes = []; // Time a key is held down
    let flightTimes = []; // Time between keys
    let backspaceCount = 0;
    let totalKeystrokes = 0;

    let anomalyTriggered = false;

    // Real-Time Text Analysis for Profanity/Frustration
    const profanityList = ['fuck', 'shit', 'bitch', 'asshole', 'damn', 'stupid', 'hate'];
    const anxietyList = ['worry', 'worried', 'stress', 'stressed', 'anxious', 'scared', 'terrified', 'overwhelmed', 'nervous', 'fail', 'failing'];

    inputField.addEventListener('input', (e) => {
        if (anomalyTriggered) return;
        const text = e.target.value.toLowerCase();
        
        let triggerWord = null;
        let isProfanity = false;

        for (let word of profanityList) {
            if (text.includes(word)) {
                triggerWord = word;
                isProfanity = true;
                break;
            }
        }

        if (!triggerWord) {
            for (let word of anxietyList) {
                if (text.includes(word)) {
                    triggerWord = word;
                    isProfanity = false;
                    break;
                }
            }
        }

        if (triggerWord) {
            anomalyTriggered = true;
            let anomalyReason = isProfanity 
                ? `I'm sensing some strong frustration right now. It is completely okay to feel stuck or upset when studying.`
                : `You seem to be expressing worry or anxiety. Remember that learning is a process, and you are doing your best.`;
            
            let actionPlan = isProfanity
                ? "Frustration blocks learning. Walk away for exactly 5 minutes, do something completely unrelated, and come back with a clean slate."
                : "When anxiety hits, your brain's fear center takes over. Try the 5-4-3-2-1 grounding exercise to bring your focus back to the present moment.";

            console.log("Telemetry Anomaly Triggered:", anomalyReason);
            
            const avgDwell = dwellTimes.length ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length : 0;
            const avgFlight = flightTimes.length ? flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length : 0;
            const backspaceRatio = totalKeystrokes > 0 ? backspaceCount / totalKeystrokes : 0;
            
            triggerTelemetryAlert(anomalyReason, actionPlan, avgDwell, avgFlight, backspaceRatio);
        }
    });

    inputField.addEventListener('keydown', (e) => {
        if (anomalyTriggered) return;

        // Ignore modifier keys to prevent artificial 0ms flight times
        const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'];
        if (ignoredKeys.includes(e.key)) return;
        
        const now = performance.now();

        // Check if they are holding down a key (auto-repeat)
        if (e.repeat) {
            const ignoreRepeatKeys = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];
            
            // Only trigger held-key anomaly for non-navigation/deletion keys
            if (!ignoreRepeatKeys.includes(e.key)) {
                if (keydownTimes[e.code]) {
                    const heldDuration = now - keydownTimes[e.code];
                    if (heldDuration > 1500) { // Held for more than 1.5 seconds
                        anomalyTriggered = true;
                        const reason = "You seem to be holding down a key. This often indicates frustration or that you're zoning out.";
                        const actionPlan = "Take your hands off the keyboard for a moment. Close your eyes, take a deep breath, and reset before you continue.";
                        
                        const avgDwell = dwellTimes.length ? dwellTimes.reduce((a, b) => a + b, 0) / dwellTimes.length : 0;
                        const avgFlight = flightTimes.length ? flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length : 0;
                        const backspaceRatio = totalKeystrokes > 0 ? backspaceCount / totalKeystrokes : 0;
                        
                        triggerTelemetryAlert(reason, actionPlan, avgDwell, avgFlight, backspaceRatio);
                    }
                }
            }

            // Still count held down backspace/delete towards the backspace ratio!
            if (e.key === 'Backspace' || e.key === 'Delete') {
                backspaceCount++;
                totalKeystrokes++;
                checkAnomalies();
            }

            return; // Ignore normal auto-repeats for dwell time metrics
        }

        keydownTimes[e.code] = now;

        if (e.key === 'Backspace' || e.key === 'Delete') {
            backspaceCount++;
        }

        totalKeystrokes++;

        checkAnomalies();
    });

    inputField.addEventListener('keyup', (e) => {
        if (anomalyTriggered) return;

        const ignoredKeys = ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'];
        if (ignoredKeys.includes(e.key)) return;

        const now = performance.now();
        
        if (keydownTimes[e.code]) {
            const dwell = now - keydownTimes[e.code];
            if (dwell > 0 && dwell < 2000) { // filter out extreme outliers (e.g., leaving desk)
                dwellTimes.push(dwell);
                if (dwellTimes.length > 20) dwellTimes.shift(); // Rolling window
            }
            delete keydownTimes[e.code];
        }

        if (lastKeyupTime) {
            const flight = now - lastKeyupTime;
            if (flight >= 0 && flight < 2000) {
                flightTimes.push(flight);
                if (flightTimes.length > 20) flightTimes.shift(); // Rolling window
            }
        }
        
        lastKeyupTime = now;
    });

    function checkAnomalies() {
        if (totalKeystrokes < 10) return; // Need a smaller baseline

        // Calculate averages over the rolling window
        const avgDwell = dwellTimes.reduce((a, b) => a + b, 0) / (dwellTimes.length || 1);
        const avgFlight = flightTimes.reduce((a, b) => a + b, 0) / (flightTimes.length || 1);
        const backspaceRatio = backspaceCount / totalKeystrokes;

        // Update Debug UI
        const debugUI = document.getElementById('telemetryDebug');
        if (debugUI) {
            debugUI.textContent = `Flight: ${Math.round(avgFlight)}ms | Dwell: ${Math.round(avgDwell)}ms | BS: ${Math.round(backspaceRatio*100)}%`;
        }

        // Anomaly logic
        let anomalyDetected = false;
        let anomalyReason = "";
        let actionPlan = "";

        if (backspaceRatio > 0.45) { 
            anomalyDetected = true;
            anomalyReason = "It looks like you might be experiencing some cognitive friction or feeling stuck. That's completely normal when tackling difficult material.";
            actionPlan = "Step away from the keyboard and try to explain the concept out loud to an imaginary person. If you're still stuck, break the task down into three much smaller, manageable steps.";
        } else if (avgFlight < 40) { 
            anomalyDetected = true;
            anomalyReason = "I'm sensing that you might be feeling overwhelmed or agitated right now. Don't worry, we can slow things down.";
            actionPlan = "Close your eyes and take 5 deep, slow breaths. Disconnect from the screen for a moment to let your nervous system reset before continuing.";
        } else if (avgFlight < 80 && backspaceRatio > 0.20) { 
            anomalyDetected = true;
            anomalyReason = "You seem to be rushing and correcting yourself frequently. It might help to take a deep breath and reset your focus.";
            actionPlan = "Slow your pace down slightly. Try to prioritize accuracy over speed for the next paragraph. Taking it slower will actually help you finish faster by reducing errors.";
        } else if (avgDwell > 350) { 
            anomalyDetected = true;
            anomalyReason = "You appear to be hesitating or experiencing mental fatigue. It's okay to take a step back and let your mind rest.";
            actionPlan = "Your brain is telling you it's tired. Stand up, stretch your legs, and get a glass of water. A quick physical break will restore your cognitive energy.";
        }

        if (anomalyDetected) {
            anomalyTriggered = true;
            console.log("Telemetry Anomaly Triggered:", anomalyReason, { avgFlight, avgDwell, backspaceRatio });
            triggerTelemetryAlert(anomalyReason, actionPlan, avgDwell, avgFlight, backspaceRatio);
        }
    }

    function triggerTelemetryAlert(reason, actionPlan, dwell, flight, bsRatio) {
        // Save to local storage for the Coach dashboard
        const telemetryData = {
            timestamp: new Date().toISOString(),
            reason: reason,
            actionPlan: actionPlan || "We recommend pausing your current task. Take a 5-minute deep breathing break away from the screen before attempting to refocus.",
            metrics: {
                dwellTime: Math.round(dwell),
                flightTime: Math.round(flight),
                errorRate: Math.round(bsRatio * 100)
            }
        };
        localStorage.setItem('ifocus_telemetry_insight', JSON.stringify(telemetryData));

        // Show toast alert
        const toast = document.getElementById('telemetryToast');
        if (toast) {
            toast.classList.remove('hidden');
            toast.style.display = 'block'; // Force display just in case
            
            // Force browser reflow to ensure transition works
            void toast.offsetWidth;
            
            toast.classList.add('show');
        }
    }

    // ===== Proactive Burnout / Inactivity Intervention (Demonstration 4) =====
    let idleTimer = null;
    const IDLE_TIMEOUT_MS = 60000; // 1 minute for demonstration

    function resetIdleTimer() {
        if (anomalyTriggered) return;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => {
            if (anomalyTriggered) return;
            anomalyTriggered = true;
            const anomalyReason = "Inactivity detected. Student appears paralyzed, stuck, or distracted without interacting.";
            const actionPlan = "Are you stuck on a concept, or did you get distracted? Try writing down just one single word related to your task to break the paralysis. If you're completely lost, reach out for help.";
            console.log("Telemetry Anomaly Triggered:", anomalyReason);
            
            // Re-use the alert system to proactively reach out
            triggerTelemetryAlert(anomalyReason, actionPlan, 0, 0, 0);
            
            // Optionally update the toast text to be specific to inactivity
            const toast = document.getElementById('telemetryToast');
            if (toast) {
                const body = toast.querySelector('.toast-body');
                if (body) {
                    body.textContent = "You've been idle for a while. Are you feeling stuck on a task? Let the AI coach help you break it down.";
                }
            }
        }, IDLE_TIMEOUT_MS);
    }

    // Reset idle timer on any general page interaction
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keydown', resetIdleTimer);
    document.addEventListener('click', resetIdleTimer);
    
    // Start the timer initially
    resetIdleTimer();

    // ===== Expose Reset Method for Journal Submission =====
    window.resetTelemetry = function() {
        anomalyTriggered = false;
        totalKeystrokes = 0;
        backspaceCount = 0;
        flightTimes = [];
        dwellTimes = [];
        keydownTimes = {};
        lastKeyupTime = null;
        resetIdleTimer();
    };

});

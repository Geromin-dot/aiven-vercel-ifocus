document.addEventListener('DOMContentLoaded', () => {
    // Only show the mini-timer if we are NOT on the command-center page where the main timer is
    if (document.getElementById('timerDisplay')) return;

    // Create the mini-timer UI
    const timerDiv = document.createElement('div');
    timerDiv.id = 'globalMiniTimer';
    timerDiv.style.position = 'fixed';
    timerDiv.style.top = '1.5rem';
    timerDiv.style.right = '1.5rem';
    timerDiv.style.background = '#ffffff';
    timerDiv.style.border = '1px solid rgba(0,0,0,0.05)';
    timerDiv.style.borderRadius = '16px';
    timerDiv.style.boxShadow = '0 12px 30px -10px rgba(0,0,0,0.15)';
    timerDiv.style.padding = '0.75rem 1.25rem';
    timerDiv.style.display = 'none';
    timerDiv.style.alignItems = 'center';
    timerDiv.style.gap = '1rem';
    timerDiv.style.zIndex = '9999';
    timerDiv.style.cursor = 'pointer';
    timerDiv.style.transition = 'transform 0.2s ease, box-shadow 0.2s ease';
    timerDiv.style.animation = 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    timerDiv.title = 'Click to return to your Focus Session';
    document.body.appendChild(timerDiv);

    // Add keyframes for the slide-to-left animation
    if (!document.getElementById('miniTimerStyles')) {
        const style = document.createElement('style');
        style.id = 'miniTimerStyles';
        style.innerHTML = `
            @keyframes slideInRight {
                0% { transform: translateX(120%); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    // Hover effect
    timerDiv.addEventListener('mouseenter', () => {
        // We override transform, but since the animation finishes at translateX(0), 
        // translating Y is perfectly fine.
        timerDiv.style.transform = 'translateY(-2px)';
        timerDiv.style.boxShadow = '0 16px 36px -10px rgba(0,0,0,0.2)';
    });
    timerDiv.addEventListener('mouseleave', () => {
        timerDiv.style.transform = 'translateY(0)';
        timerDiv.style.boxShadow = '0 12px 30px -10px rgba(0,0,0,0.15)';
    });

    // Click to go back to command center
    timerDiv.addEventListener('click', () => {
        window.location.href = 'command-center.html';
    });

    function updateGlobalTimer() {
        const saved = localStorage.getItem('ifocus_timer_state');
        if (!saved) {
            timerDiv.style.display = 'none';
            return;
        }
        
        try {
            const state = JSON.parse(saved);
            // Only show if the timer is actively running and we have a target end time
            if (state.isRunning && state.targetEndTime) {
                const now = Date.now();
                let left = Math.floor((state.targetEndTime - now) / 1000);
                if (left < 0) left = 0;
                
                const minutes = Math.floor(left / 60);
                const seconds = left % 60;
                
                const dotColor = state.isBreak ? '#34d399' : '#e53935'; // Green for break, Red for work
                const labelText = state.isBreak ? 'Break Time' : 'Focus Session';
                
                timerDiv.innerHTML = `
                    <div style="background: rgba(0,0,0,0.03); padding: 0.6rem; border-radius: 12px; display: flex; justify-content: center; align-items: center; position: relative;">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${dotColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <div style="position: absolute; top: 0; right: 0; width: 8px; height: 8px; background: ${dotColor}; border-radius: 50%; box-shadow: 0 0 8px ${dotColor};"></div>
                    </div>
                    <div style="display: flex; flex-direction: column;">
                        <span style="font-size: 0.7rem; color: var(--text-secondary, #6b7280); text-transform: uppercase; letter-spacing: 1px; font-weight: 700; margin-bottom: 2px;">${labelText}</span>
                        <span style="font-size: 1.3rem; font-weight: 700; color: var(--text-primary, #111827); font-family: 'Inter', sans-serif; letter-spacing: 0.5px;">
                            ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
                        </span>
                    </div>
                `;
                timerDiv.style.display = 'flex';
            } else {
                timerDiv.style.display = 'none';
            }
        } catch (e) {
            console.error("Error reading global timer state:", e);
            timerDiv.style.display = 'none';
        }
    }

    // Run every second
    setInterval(updateGlobalTimer, 1000);
    updateGlobalTimer(); // initial call
});

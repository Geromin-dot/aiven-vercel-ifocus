document.addEventListener('DOMContentLoaded', () => {
    renderHistory();
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const text = document.getElementById('reflectionInput').value.trim();
    if (!text) return;

    const btn = document.getElementById('analyzeBtn');
    btn.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:3px;margin:auto;"></div>';
    btn.disabled = true;

    try {
        await analyzeSentiment(text);
    } catch (e) {
        console.error(e);
        const section = document.getElementById('interventionSection');
        const content = document.getElementById('interventionContent');
        section.classList.remove('hidden');
        content.innerHTML = `<p style="color: var(--error);">Analysis failed. Please check console or try again later.</p>`;
    }

    btn.innerHTML = '<span class="btn-text">Submit Journal & Analyze</span><svg class="sparkle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>';
    btn.disabled = false;
});

async function analyzeSentiment(text) {
    // 1. Fetch current tasks from window (exposed by command-center.js)
    let currentTasks = [];
    let completedTasksCount = 0;
    if (window.getTasks) {
        const allTasks = window.getTasks();
        currentTasks = allTasks.filter(t => !t.completed);
        completedTasksCount = allTasks.filter(t => t.completed).length;
    }
    const taskListStr = currentTasks.map(t => `${t.id}: ${t.text} (Priority: ${t.priority})`).join('\n');

    // 1b. Fetch Telemetry Insight
    let telemetryContext = "Typing Telemetry: Not used for sentiment override.";
    const storedTelemetry = localStorage.getItem('ifocus_telemetry_insight');
    if (storedTelemetry) {
        try {
            const tel = JSON.parse(storedTelemetry);
            const tenMinsAgo = Date.now() - (10 * 60 * 1000);
            if (new Date(tel.timestamp).getTime() > tenMinsAgo) {
                telemetryContext = `Typing Telemetry: Flagged reason: ${tel.reason}`;
            }
        } catch (e) { }
    }

    const prompt = `
You are an AI study coach analyzing a student's reflection journal entry.

Student Reflection: "${text}"

Current Tasks:
${taskListStr || "No active tasks."}

Productivity Context:
Student has completed ${completedTasksCount} tasks today.

${telemetryContext}

Your job is to do THREE things:
1. Categorize the student's emotional state into EXACTLY ONE of the following FOUR categories: Stressed, Distracted, Motivated, or Engaged.
   - We trust the student's own reflection. If they express they are feeling stressed, anxious, tired, or overwhelmed, classify them as "Stressed".
2. Determine the optimal order for the tasks based on their reflection. Use these default rules:
   - Stressed: Quick Wins (Low effort/priority) first, High effort last.
   - Distracted: Keep original order.
   - Motivated/Engaged: High effort first, Quick Wins last.
3. Write a thoughtful, personalized 2-3 sentence action plan. DO NOT just talk about task ordering or pomodoro timers. Give them GENUINE, highly specific psychological advice, cognitive behavioral strategies, or study techniques tailored to the EXACT subject or worry they mentioned (e.g., if they mention Math, give a real math-anxiety tip; if they mention exhaustion, give a real burnout tip).

Reply STRICTLY in valid JSON format like this, do not use markdown blocks, just the JSON:
{
  "state": "Stressed",
  "orderedIds": [3, 1, 2],
  "actionPlan": "It's completely valid to feel exhausted. Let's take it easy and just knock out a small quick win to build momentum."
}
`;

    let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
    let response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1 }
        })
    });

    // If 404 (not found) or 503 (overloaded), try to auto-discover a working model
    if (response.status === 404 || response.status === 503) {
        console.log(`Model ${modelToUse} failed with ${response.status}. Auto-discovering alternative models...`);
        const modelsRes = await fetch(`/api/models`);
        if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const availableModels = modelsData.models || [];
            const validModel = availableModels.find(m =>
                m.supportedGenerationMethods &&
                m.supportedGenerationMethods.includes('generateContent') &&
                m.name.includes('gemini') &&
                m.name !== modelToUse
            );
            if (validModel) {
                modelToUse = validModel.name;
                localStorage.setItem('cached_gemini_model', modelToUse);
                console.log("Retrying with alternative model:", modelToUse);
                response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1 }
                    })
                });
            }
        }
    }

    if (!response.ok) {
        const errText = await response.text();
        console.error("API Error Response:", errText);
        throw new Error(`Failed to reach AI: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text.trim();

    // Remove markdown formatting if the AI wraps it in json blocks
    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleanJson);

    let state = parsed.state || "Engaged";
    let actionPlan = parsed.actionPlan || "Keep up the good work!";
    let orderedIds = parsed.orderedIds || [];

    // 2. Process Task Ordering
    if (window.getTasks && window.setTasks && window.forceRenderTasks) {
        const allTasks = window.getTasks();
        const activeTasks = allTasks.filter(t => !t.completed);
        const completedTasks = allTasks.filter(t => t.completed);

        let newActiveTasks = [];
        if (orderedIds && orderedIds.length > 0) {
            orderedIds.forEach(id => {
                const task = activeTasks.find(t => t.id == id || t.id === id);
                if (task) newActiveTasks.push(task);
            });
            // Add any remaining active tasks that the AI missed
            activeTasks.forEach(task => {
                if (!newActiveTasks.includes(task)) newActiveTasks.push(task);
            });
        } else {
            // Fallback to original order
            newActiveTasks = [...activeTasks];
        }

        // Rebuild and save
        window.setTasks([...newActiveTasks, ...completedTasks]);

        // Animate the reorder
        const taskListEl = document.getElementById('taskList');
        if (taskListEl) {
            taskListEl.style.opacity = '0';
            setTimeout(() => {
                window.forceRenderTasks();
                taskListEl.style.transition = 'opacity 0.4s ease';
                taskListEl.style.opacity = '1';
            }, 200);
        } else {
            window.forceRenderTasks();
        }
    }

    document.getElementById('reflectionInput').value = '';
    localStorage.removeItem('ifocus_telemetry_insight');
    if (window.resetTelemetry) window.resetTelemetry();
    saveEntry(text, state, actionPlan);
}

function applyIntervention(state, actionPlan, text = "") {
    const modal = document.getElementById('pastEntryModal');
    if (!modal) return;

    // Clear the input box since we just submitted successfully
    if (text) {
        document.getElementById('reflectionInput').value = '';
    }

    document.getElementById('pastEntryDate').textContent = "Just now";
    document.getElementById('pastEntryText').textContent = `"${text}"`;

    let recommendation = "";
    if (state === "Stressed") {
        recommendation = `
            <div class="state-badge state-Stressed">Stressed / Overwhelmed</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Coach's Insight</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    } else if (state === "Distracted") {
        recommendation = `
            <div class="state-badge state-Distracted">Distracted</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Coach's Insight</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    } else if (state === "Engaged" || state === "Motivated") {
        recommendation = `
            <div class="state-badge state-${state}">${state}</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Flow State Detected</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    } else if (state === "Contradiction") {
        recommendation = `
            <div class="state-badge" style="background: var(--warning); color: #000;">Authenticity Alert</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Coach's Insight</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action suggested:</strong> ${actionPlan}</p>
        `;
    }

    document.getElementById('pastEntryInsight').innerHTML = recommendation;
    modal.classList.remove('hidden');
}

// ===== Journal History Logic =====

function getHistory() {
    const stored = localStorage.getItem('ifocus_journal_history');
    return stored ? JSON.parse(stored) : [];
}

function saveEntry(text, state, actionPlan) {
    const history = getHistory();
    history.unshift({
        id: Date.now(),
        date: new Date().toISOString(),
        text: text,
        state: state,
        actionPlan: actionPlan
    });
    localStorage.setItem('ifocus_journal_history', JSON.stringify(history));
    renderHistory();
    document.getElementById('reflectionInput').value = '';

    // Dispatch event so the timer (focus.js) can react
    window.dispatchEvent(new CustomEvent('ReflectionSubmitted', { detail: { state: state, actionPlan: actionPlan } }));
}

function renderHistory() {
    const historyContainer = document.getElementById('journalHistory');
    if (!historyContainer) return; // Prevent error on pages without history

    const history = getHistory();

    if (history.length === 0) {
        historyContainer.innerHTML = `
            <div class="empty-state" style="padding: 2rem 1rem;">
                <p>No journal entries yet.</p>
                <p style="font-size: 0.85rem; margin-top: 0.5rem; color: var(--text-secondary);">Your daily reflections will appear here.</p>
            </div>
        `;
        return;
    }

    historyContainer.innerHTML = history.map((entry, idx) => `
        <div class="journal-entry" onclick="viewPastEntry(${idx})">
            <div class="entry-date">${new Date(entry.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="entry-preview">${entry.text}</span>
                <span class="state-badge state-${entry.state}" style="margin: 0; transform: scale(0.7); transform-origin: right;">${entry.state}</span>
            </div>
        </div>
    `).join('');
}

// Expose to window for inline onclick
window.viewPastEntry = function (index) {
    const history = getHistory();
    const entry = history[index];
    if (!entry) return;

    const modal = document.getElementById('pastEntryModal');
    if (!modal) return;

    document.getElementById('pastEntryDate').textContent = new Date(entry.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('pastEntryText').textContent = `"${entry.text}"`;

    let recommendation = "";
    const state = entry.state;
    const actionPlan = entry.actionPlan;

    if (state === "Stressed") {
        recommendation = `<div class="state-badge state-Stressed">Stressed / Overwhelmed</div><p style="margin-top:1rem; line-height: 1.5; color: var(--text-secondary);"><strong>Coach's Insight:</strong> ${actionPlan}</p>`;
    } else if (state === "Distracted") {
        recommendation = `<div class="state-badge state-Distracted">Distracted</div><p style="margin-top:1rem; line-height: 1.5; color: var(--text-secondary);"><strong>Coach's Insight:</strong> ${actionPlan}</p>`;
    } else if (state === "Engaged" || state === "Motivated") {
        recommendation = `<div class="state-badge state-${state}">${state}</div><p style="margin-top:1rem; line-height: 1.5; color: var(--text-secondary);"><strong>Flow State Detected:</strong> ${actionPlan}</p>`;
    } else if (state === "Contradiction") {
        recommendation = `<div class="state-badge" style="background: var(--warning); color: #000;">Authenticity Alert</div><p style="margin-top:1rem; line-height: 1.5; color: var(--text-secondary);"><strong>Coach's Insight:</strong> ${actionPlan}</p>`;
    }

    document.getElementById('pastEntryInsight').innerHTML = recommendation;
    modal.classList.remove('hidden');
};

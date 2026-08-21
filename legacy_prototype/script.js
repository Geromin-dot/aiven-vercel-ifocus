document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const dropZone = document.getElementById('dropZone');
    const pdfUpload = document.getElementById('pdfUpload');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const notesArea = document.getElementById('notesArea');
    const generateBtn = document.getElementById('generateBtn');
    
    const collectionsSection = document.getElementById('collectionsSection');
    const collectionsGrid = document.getElementById('collectionsGrid');
    const showCreateBtn = document.getElementById('showCreateBtn');
    const backToCollectionsBtn = document.getElementById('backToCollectionsBtn');
    const inputSection = document.getElementById('inputSection');
    const loadingSection = document.getElementById('loadingSection');
    const deckSection = document.getElementById('deckSection');
    
    const progressFill = document.getElementById('progressFill');
    const flashcardContainer = document.getElementById('flashcardContainer');
    
    const prevCardBtn = document.getElementById('prevCardBtn');
    const nextCardBtn = document.getElementById('nextCardBtn');
    const cardCounter = document.getElementById('cardCounter');
    const needsReviewBtn = document.getElementById('needsReviewBtn');
    const gotItBtn = document.getElementById('gotItBtn');
    const masteryProgressText = document.getElementById('masteryProgressText');
    const masteryProgressBar = document.getElementById('masteryProgressBar');
    const newDeckBtn = document.getElementById('newDeckBtn');
    const saveDeckBtn = document.getElementById('saveDeckBtn');
    const deckNameInput = document.getElementById('deckNameInput');
    const activeDeckTitle = document.getElementById('activeDeckTitle');

    // State
    let extractedText = "";
    let currentCards = [];
    let currentCardIndex = 0;
    let currentDeckSaved = false;
    let currentDeckIndex = -1;

    // ===== Collections Management =====
    function getCollections() {
        const stored = localStorage.getItem('ifocus_flashcard_collections');
        return stored ? JSON.parse(stored) : [];
    }

    function saveCollections(collections) {
        localStorage.setItem('ifocus_flashcard_collections', JSON.stringify(collections));
    }

    function renderCollections() {
        const collections = getCollections();

        if (collections.length === 0) {
            collectionsGrid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                        <line x1="8" y1="21" x2="16" y2="21"></line>
                        <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                    <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No collections yet</p>
                    <p>Generate your first flashcard deck to get started!</p>
                </div>
            `;
            return;
        }

        collectionsGrid.innerHTML = collections.map((col, idx) => {
            const total = col.cards.length;
            const mastered = col.cards.filter(c => c.needsReview === false).length;
            const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;
            const createdDate = new Date(col.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            
            return `
            <div class="collection-card" data-index="${idx}" style="position: relative; border: ${col.activated ? '2px solid var(--primary-accent)' : '1px solid var(--glass-border)'}; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: ${col.activated ? '#f4f8f4' : 'var(--glass-bg)'};">
                
                <!-- Header (Icon + Kebab) -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="background: #e8e2c8; color: #5a4b1c; width: 40px; height: 40px; border-radius: 10px; display: flex; justify-content: center; align-items: center;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
                    </div>
                    
                    <div class="kebab-menu" style="position: relative; cursor: pointer; color: var(--text-secondary); padding: 0.25rem;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="5" r="2"></circle><circle cx="12" cy="19" r="2"></circle></svg>
                        <div class="kebab-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: white; border: 1px solid var(--glass-border); border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); padding: 0.5rem; flex-direction: column; gap: 0.25rem; z-index: 10; min-width: 120px;">
                            <button class="action-btn rename-collection" data-index="${idx}">Rename</button>
                            <button class="action-btn delete-collection" data-index="${idx}">Delete</button>
                        </div>
                    </div>
                </div>

                <!-- Title and Stats -->
                <div>
                    <h3 style="margin-bottom: 0.25rem; font-size: 1.1rem; color: var(--text-primary); word-break: break-word;">${col.name}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">${total} Cards • Created ${createdDate}</p>
                </div>

                <!-- Mastery Progress -->
                <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: var(--text-primary); font-weight: 500;">
                        <span>Mastery</span>
                        <span>${percentage}%</span>
                    </div>
                    <div style="width: 100%; height: 6px; background: rgba(0,0,0,0.08); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${percentage}%; height: 100%; background: var(--primary-accent); border-radius: 3px;"></div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                    <button class="btn-primary small study-collection-btn" data-index="${idx}" style="width: 100%;">
                        Study Deck
                    </button>
                    <button class="btn-secondary small toggle-active-btn ${col.activated ? 'is-active' : ''}" data-index="${idx}">
                        <span class="default-text">${col.activated ? 'Activated' : 'Activate for Vault'}</span>
                        <span class="hover-text">Disable</span>
                    </button>
                </div>
            </div>
            `;
        }).join('');

        // Handle kebab menu dropdowns
        collectionsGrid.querySelectorAll('.kebab-menu').forEach(menu => {
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
                // Close others
                collectionsGrid.querySelectorAll('.kebab-dropdown').forEach(d => {
                    if (d !== menu.querySelector('.kebab-dropdown')) d.style.display = 'none';
                });
                const dropdown = menu.querySelector('.kebab-dropdown');
                dropdown.style.display = dropdown.style.display === 'flex' ? 'none' : 'flex';
            });
        });

        // Attach click events to open a collection
        collectionsGrid.querySelectorAll('.collection-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.delete-collection') || e.target.closest('.rename-collection') || e.target.closest('.toggle-active-btn') || e.target.closest('.study-collection-btn')) return;
                const idx = Number(card.dataset.index);
                openCollection(idx, false);
            });
        });

        // Attach study events
        collectionsGrid.querySelectorAll('.study-collection-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.index);
                openCollection(idx, true); // Shuffle when explicitly studying
            });
        });

        // Attach toggle active events
        collectionsGrid.querySelectorAll('.toggle-active-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.index);
                const collections = getCollections();
                collections[idx].activated = !collections[idx].activated;
                saveCollections(collections);
                renderCollections();
            });
        });

        // Attach rename events
        collectionsGrid.querySelectorAll('.rename-collection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.index);
                const collections = getCollections();
                
                const renameModal = document.getElementById('renameModal');
                const renameInput = document.getElementById('renameInput');
                const saveRenameBtn = document.getElementById('saveRenameBtn');
                const cancelRenameBtn = document.getElementById('cancelRenameBtn');
                
                if (renameModal && renameInput) {
                    renameInput.value = collections[idx].name;
                    renameModal.classList.remove('hidden');
                    renameInput.focus();
                    
                    const closeModal = () => {
                        renameModal.classList.add('hidden');
                        saveRenameBtn.onclick = null;
                        cancelRenameBtn.onclick = null;
                    };
                    
                    cancelRenameBtn.onclick = closeModal;
                    
                    saveRenameBtn.onclick = () => {
                        const newName = renameInput.value.trim();
                        if (newName) {
                            collections[idx].name = newName;
                            saveCollections(collections);
                            renderCollections();
                        }
                        closeModal();
                    };
                }
            });
        });

        // Attach delete events
        collectionsGrid.querySelectorAll('.delete-collection').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = Number(btn.dataset.index);
                const collections = getCollections();
                if (confirm(`Delete "${collections[idx].name}"?`)) {
                    collections.splice(idx, 1);
                    saveCollections(collections);
                    renderCollections();
                }
            });
        });
    }

    function openCollection(index, shuffle = false) {
        const collections = getCollections();
        const col = collections[index];
        if (!col) return;

        currentDeckIndex = index;
        currentCards = shuffle ? [...col.cards].sort(() => Math.random() - 0.5) : [...col.cards];
        currentDeckSaved = true;
        activeDeckTitle.textContent = col.name;
        saveDeckBtn.style.display = 'none';
        
        collectionsSection.classList.add('hidden');
        inputSection.classList.add('hidden');
        deckSection.classList.remove('hidden');
        initDeck();
    }

    function showCollections() {
        collectionsSection.classList.remove('hidden');
        inputSection.classList.add('hidden');
        deckSection.classList.add('hidden');
        loadingSection.classList.add('hidden');
        renderCollections();
    }

    // ===== Navigation between views =====
    showCreateBtn.addEventListener('click', () => {
        collectionsSection.classList.add('hidden');
        inputSection.classList.remove('hidden');
        deckNameInput.value = '';
        notesArea.value = '';
        extractedText = '';
        fileNameDisplay.textContent = '';
        if (pdfUpload) pdfUpload.value = '';
    });

    backToCollectionsBtn.addEventListener('click', showCollections);

    // --- Tab Switching ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            document.getElementById(tab.dataset.target).classList.add('active');
        });
    });

    // --- File Drag & Drop ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    pdfUpload.addEventListener('change', function() {
        handleFiles(this.files);
    });

    async function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        
        if (file.type !== 'application/pdf') {
            alert('Please upload a PDF file.');
            return;
        }

        fileNameDisplay.textContent = `Selected: ${file.name}`;
        
        // Auto-fill deck name from filename
        if (!deckNameInput.value) {
            deckNameInput.value = file.name.replace('.pdf', '');
        }

        try {
            extractedText = await extractTextFromPDF(file);
            console.log("PDF Text Extracted, length:", extractedText.length);
        } catch (error) {
            console.error("Error reading PDF", error);
            alert("Could not read PDF file.");
        }
    }

    // --- PDF.js Text Extraction ---
    async function extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        let fullText = "";
        
        // Extract from first 10 pages max to avoid huge payloads
        const maxPages = Math.min(pdf.numPages, 10);
        
        for (let i = 1; i <= maxPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            let pageText = "";
            let lastY = -1;
            
            for (const item of textContent.items) {
                if (lastY !== item.transform[5] && lastY !== -1) {
                    pageText += "\n";
                }
                pageText += item.str;
                lastY = item.transform[5];
            }
            
            fullText += pageText + "\n";
        }
        return fullText;
    }



    // --- Generate Deck ---
    generateBtn.addEventListener('click', async () => {
        // Determine input source
        const activeTab = document.querySelector('.tab.active').dataset.target;
        let contentToProcess = "";
        
        if (activeTab === 'text-input') {
            contentToProcess = notesArea.value.trim();
        } else {
            contentToProcess = extractedText;
        }

        if (!contentToProcess) {
            alert("Please provide some text or upload a PDF first.");
            return;
        }

        // Show loading state
        inputSection.classList.add('hidden');
        loadingSection.classList.remove('hidden');
        
        // Animate progress bar
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressFill.style.width = `${progress}%`;
        }, 500);

        try {
            currentCards = await generateFlashcards(contentToProcess);
            currentDeckSaved = false;
            clearInterval(progressInterval);
            progressFill.style.width = `100%`;
            
            // Set deck title
            const deckName = deckNameInput.value.trim() || 'Untitled Deck';
            activeDeckTitle.textContent = deckName;
            saveDeckBtn.style.display = '';

            setTimeout(() => {
                loadingSection.classList.add('hidden');
                deckSection.classList.remove('hidden');
                initDeck();
            }, 800);
            
        } catch (error) {
            clearInterval(progressInterval);
            alert("Error generating flashcards: " + error.message);
            loadingSection.classList.add('hidden');
            inputSection.classList.remove('hidden');
        }
    });

    // --- AI Generation Logic ---
    async function generateFlashcards(text) {
        // Use Gemini API via Serverless Backend
        // Truncate text to avoid token limits on free tier (approx 30,000 chars)
        const truncatedText = text.substring(0, 30000);
        
        const prompt = `
            Analyze the following educational material and extract the most important terms, concepts, formulas, or dates.
            Generate exactly 5-10 high-quality flashcards based on this material.
            
            CRITICAL INSTRUCTIONS: 
            1. The text may be extracted from a PDF and contain random line breaks, typos, or messy OCR formatting. You must intelligently ignore this messiness and extract the logical concepts.
            2. The "front" of the card MUST ONLY be the term, concept name, or short question. It MUST NOT contain the answer or definition itself. 
            3. The "back" of the card MUST contain the core definition or answer. Distill it into a few short, punchy keywords or a concise summary.
            4. GROUP ENUMERATIONS: If the material contains a list, enumeration, or sequence (e.g., "The main stages are..."), DO NOT split it into separate cards for each item. Create ONE single flashcard where the "front" asks for the list (e.g., "Main stages of Cellular Respiration") and the "back" contains the full enumerated list using newlines (\\n).
            
            Return the output STRICTLY as a JSON array of objects with this format. Do not use markdown blocks:
            [
              {
                "tag": "Definition|Concept|Formula|Date|Fact",
                "front": "The Term or Concept ONLY",
                "back": "Concise keywords or short summary (e.g., 'Requires oxygen to survive')"
              }
            ]
            
            Material:
            ${truncatedText}
        `;

        try {
            let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
            let response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
                })
            });

            // If 404 Not Found, automatically discover which models the backend actually has access to
            if (response.status === 404) {
                console.log("Model not found. Auto-discovering available models...");
                const modelsRes = await fetch(`/api/models`);
                if (modelsRes.ok) {
                    const modelsData = await modelsRes.json();
                    const availableModels = modelsData.models || [];
                    
                    // Find a model that supports generateContent and has 'gemini' in the name
                    const validModel = availableModels.find(m => 
                        m.supportedGenerationMethods && 
                        m.supportedGenerationMethods.includes('generateContent') && 
                        m.name.includes('gemini')
                    );

                    if (validModel) {
                        console.log("Auto-discovered working model:", validModel.name);
                        modelToUse = validModel.name;
                        localStorage.setItem('cached_gemini_model', modelToUse);
                        
                        // Retry with the discovered model
                        response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: prompt }] }],
                                generationConfig: { temperature: 0.2, responseMimeType: "application/json" }
                            })
                        });
                    } else {
                        throw new Error("API Request Failed: The backend API key has no access to any Gemini text models.");
                    }
                }
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error Response:", errorText);
                throw new Error(`API Request Failed (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const textResponse = data.candidates[0].content.parts[0].text;
            
            try {
                // Strip out markdown ```json ... ``` formatting
                const cleanJson = textResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
                const parsed = JSON.parse(cleanJson);
                
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                } else {
                    throw new Error("Invalid format received from AI.");
                }
            } catch (e) {
                console.error("Parse error", e, textResponse);
                throw new Error("Failed to parse AI response. It might have been formatted incorrectly.");
            }
            
        } catch (error) {
            console.error("Generation Error:", error);
            throw error;
        }
    }

    // --- Deck UI Logic ---
    function initDeck() {
        if (currentCards.length === 0) return;
        currentCardIndex = 0;
        renderCard();
        updateControls();
    }

    function renderCard() {
        const cardData = currentCards[currentCardIndex];
        
        const swapToggle = document.getElementById('swapFrontBackToggle');
        const isSwapped = swapToggle ? swapToggle.checked : false;

        const frontText = isSwapped ? cardData.back : cardData.front;
        const backText = isSwapped ? cardData.front : cardData.back;
        
        let outlineClass = '';
        if (cardData.needsReview === true) outlineClass = 'review-red';
        if (cardData.needsReview === false) outlineClass = 'mastered-green';

        flashcardContainer.innerHTML = `
            <div class="flashcard" id="currentCard">
                <div class="card-face card-front ${outlineClass}">
                    <span class="tag">${cardData.tag || 'Flashcard'}</span>
                    <div class="card-content">${frontText}</div>
                    <div class="flip-hint">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                        Click to flip
                    </div>
                </div>
                <div class="card-face card-back ${outlineClass}">
                    <div class="card-content">${backText}</div>
                </div>
            </div>
        `;

        const cardEl = document.getElementById('currentCard');
        cardEl.addEventListener('click', () => {
            cardEl.classList.toggle('flipped');
        });
    }

    function updateControls() {
        const masteredCount = currentCards.filter(c => c.needsReview === false).length;
        const totalCount = currentCards.length;
        
        if (masteryProgressText) {
            masteryProgressText.textContent = `${masteredCount} / ${totalCount} Mastered`;
        }
        if (masteryProgressBar) {
            const percent = totalCount === 0 ? 0 : (masteredCount / totalCount) * 100;
            masteryProgressBar.style.width = `${percent}%`;
        }
        
        if (cardCounter) {
            cardCounter.textContent = `${currentCardIndex + 1} / ${currentCards.length}`;
        }
        if (prevCardBtn) {
            prevCardBtn.disabled = currentCardIndex === 0;
        }
        if (nextCardBtn) {
            nextCardBtn.disabled = currentCardIndex === currentCards.length - 1;
        }
    }

    function moveToNextCard() {
        if (currentCards.length === 0) return;
        
        if (currentCardIndex < currentCards.length - 1) {
            currentCardIndex++;
        } else {
            currentCardIndex = 0;
        }
        
        renderCard();
        updateControls();
    }

    function autoSaveCurrentDeck() {
        if (currentDeckIndex !== -1 && currentDeckSaved) {
            const collections = getCollections();
            if (collections[currentDeckIndex]) {
                collections[currentDeckIndex].cards = currentCards;
                saveCollections(collections);
            }
        }
    }

    const closeMasteredModalBtn = document.getElementById('closeMasteredModalBtn');
    if (closeMasteredModalBtn) {
        closeMasteredModalBtn.addEventListener('click', () => {
            document.getElementById('masteredModal').classList.add('hidden');
        });
    }

    if (needsReviewBtn) {
        needsReviewBtn.addEventListener('click', () => {
            currentCards[currentCardIndex].needsReview = true;
            autoSaveCurrentDeck();
            
            const cardFaces = document.querySelectorAll('#currentCard .card-face');
            cardFaces.forEach(face => {
                face.classList.remove('mastered-green');
                face.classList.add('review-red');
            });
            
            updateControls();
        });
    }

    if (gotItBtn) {
        gotItBtn.addEventListener('click', () => {
            currentCards[currentCardIndex].needsReview = false;
            autoSaveCurrentDeck();
            
            const cardFaces = document.querySelectorAll('#currentCard .card-face');
            cardFaces.forEach(face => {
                face.classList.remove('review-red');
                face.classList.add('mastered-green');
            });
            
            updateControls();
            
            const masteredCount = currentCards.filter(c => c.needsReview === false).length;
            if (masteredCount === currentCards.length && currentCards.length > 0) {
                const modal = document.getElementById('masteredModal');
                if (modal) modal.classList.remove('hidden');
            }
        });
    }

    if (prevCardBtn) {
        prevCardBtn.addEventListener('click', () => {
            if (currentCardIndex > 0) {
                currentCardIndex--;
                renderCard();
                updateControls();
            }
        });
    }

    if (nextCardBtn) {
        nextCardBtn.addEventListener('click', () => {
            if (currentCardIndex < currentCards.length - 1) {
                currentCardIndex++;
                renderCard();
                updateControls();
            }
        });
    }

    const swapFrontBackToggle = document.getElementById('swapFrontBackToggle');
    if (swapFrontBackToggle) {
        swapFrontBackToggle.addEventListener('change', () => {
            if (!deckSection.classList.contains('hidden') && currentCards.length > 0) {
                renderCard();
            }
        });
    }

    // --- Keyboard Navigation ---
    document.addEventListener('keydown', (e) => {
        if (deckSection.classList.contains('hidden')) return;
        
        const cardEl = document.getElementById('currentCard');
        if (e.code === 'Space') {
            e.preventDefault();
            if (cardEl) cardEl.classList.toggle('flipped');
        } else if (e.code === 'ArrowRight' && nextCardBtn && !nextCardBtn.disabled) {
            nextCardBtn.click();
        } else if (e.code === 'ArrowLeft' && prevCardBtn && !prevCardBtn.disabled) {
            prevCardBtn.click();
        }
    });

    // ===== Save Deck to Collections =====
    saveDeckBtn.addEventListener('click', () => {
        if (currentDeckSaved) return;
        const name = activeDeckTitle.textContent || 'Untitled Deck';
        const collections = getCollections();
        collections.unshift({
            name: name,
            cards: currentCards,
            createdAt: new Date().toISOString(),
        });
        saveCollections(collections);
        currentDeckSaved = true;
        currentDeckIndex = 0;
        saveDeckBtn.textContent = 'Saved!';
        saveDeckBtn.style.borderColor = 'var(--success)';
        saveDeckBtn.style.background = 'rgba(16, 185, 129, 0.15)';
        saveDeckBtn.style.color = 'var(--success)';
        setTimeout(() => {
            saveDeckBtn.innerHTML = 'Save to Collections';
        }, 2000);
    });

    // ===== New Deck / Back =====
    newDeckBtn.addEventListener('click', () => {
        showCollections();
        progressFill.style.width = '0%';
        notesArea.value = '';
        extractedText = '';
        fileNameDisplay.textContent = '';
        pdfUpload.value = '';
    });

    // ===== Initial render: show collections =====
    renderCollections();

    // Handle global click to close kebab menus
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.kebab-menu')) {
            document.querySelectorAll('.kebab-dropdown').forEach(d => {
                d.style.display = 'none';
            });
        }
    });
});

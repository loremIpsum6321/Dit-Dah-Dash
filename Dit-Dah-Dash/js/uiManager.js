# Dit-Dah-Dash/js/uiManager.js
# Updated: 2025-04-28
# In file: js/uiManager.js
"""
js/uiManager.js
---------------
Handles DOM interactions, UI visibility, displays updates, modal settings UI,
themes, event listeners, results screen management, and paddle texture handling.
Includes fixes for fixed cursor/scrolling text and correct input feedback.
Adds volume control and hint peeking.
Manages key mapping settings UI.
Updates hint pulse animation to target SVGs.
**v2 Changes:**
- Correct feedback now applies to both user and target pattern containers.
**v3 Changes:**
- Added drag and drop functionality for paddle textures.
- Stores texture URLs in localStorage.
- Loads textures on initialization.
**v4 Changes:**
- Added logic to trigger CSS pulse animation on the hint pattern container after a delay.
**v5 Changes:**
- Fixed correct input feedback logic (green flash).
- Added key mapping UI elements, state, and event handling.
- Updated hint pulse to apply animation class directly to SVGs.
**v6 Changes:**
- Added more robust logging for feedback state changes.
- Ensured feedback timeouts are consistently cleared and managed.
**v7 Changes:**
- Modified setPatternDisplayState for 'correct' feedback: Uses 'correct-flash' class for a brief background change on containers, instead of 'correct-pattern'.
"""

class UIManager {
    /**
     * Initializes the UIManager by getting references to key DOM elements.
     * Loads textures, settings, and binds drag/drop events.
     */
    constructor() {
        // Core Containers / Wrappers
        this.bodyElement = document.body;
        this.gameContainer = document.getElementById('game-container');
        this.displayArea = document.getElementById('display-area');
        this.gameUiWrapper = document.getElementById('game-ui-wrapper');
        this.playbackArea = document.getElementById('playback-area');
        this.sandboxArea = document.getElementById('sandbox-area');
        this.inputArea = document.getElementById('input-area');

        // Main Menu Elements
        this.mainMenuOverlay = document.getElementById('main-menu-overlay');
        this.startGameButton = document.getElementById('start-game-button');
        this.showSandboxButton = document.getElementById('show-sandbox-button');
        this.showPlaybackButton = document.getElementById('show-playback-button');
        this.showSettingsButton = document.getElementById('show-settings-button');

        // Game Mode Elements
        this.textDisplayWrapper = document.getElementById('text-display-wrapper');
        this.textDisplay = document.getElementById('text-display');
        this.targetPatternContainer = document.getElementById('target-pattern-container');
        this.targetPatternOuterWrapper = document.getElementById('target-pattern-outer-wrapper');
        this.toggleHintButton = document.getElementById('toggle-hint-button');
        this.userPatternContainer = document.getElementById('user-pattern-container');
        this.statsDisplay = document.getElementById('stats-display');
        this.timerDisplay = document.getElementById('timer-display');
        this.wpmDisplay = document.getElementById('wpm-display');
        this.accuracyDisplay = document.getElementById('accuracy-display');
        this.grossWpmDisplay = document.getElementById('gross-wpm-display');

        // Input Area Elements (Paddles)
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        this.ditPaddleLabel = this.ditButton?.querySelector('.paddle-label');
        this.dahPaddleLabel = this.dahButton?.querySelector('.paddle-label');
        this.ditPaddleSvg = this.ditButton?.querySelector('.paddle-svg');
        this.dahPaddleSvg = this.dahButton?.querySelector('.paddle-svg');

        // Volume Control Elements
        this.volumeControlArea = document.getElementById('volume-control-area');
        this.volumeSlider = document.getElementById('volume-slider');
        this.speakerIcon = document.getElementById('speaker-icon');
        this.speakerWave1 = document.getElementById('speaker-wave-1');
        this.speakerWave2 = document.getElementById('speaker-wave-2');
        this.speakerWave3 = document.getElementById('speaker-wave-3');

        // Playback Mode Elements
        this.playbackInput = document.getElementById('playback-input');
        this.playSentenceButton = document.getElementById('play-sentence-button');
        this.playbackMorseDisplay = document.getElementById('playback-morse-display');

        // Sandbox Mode Elements
        this.sandboxInput = document.getElementById('sandbox-input');
        this.startSandboxButton = document.getElementById('start-sandbox-button');
        this.sandboxMorsePreview = document.getElementById('sandbox-morse-preview');

        // Settings Modal Elements
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsCloseButton = document.getElementById('settings-close-button');
        this.wpmSlider = document.getElementById('wpm-slider');
        this.wpmValueDisplay = document.getElementById('wpm-value-display');
        this.frequencySlider = document.getElementById('frequency-slider');
        this.frequencyValueDisplay = document.getElementById('frequency-value-display');
        this.soundToggle = document.getElementById('sound-toggle');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.resetProgressButton = document.getElementById('reset-progress-button');
        // Key Mapping Inputs
        this.ditKeyInput = document.getElementById('dit-key-input');
        this.dahKeyInput = document.getElementById('dah-key-input');

        // Overlay Screens
        this.resultsScreen = document.getElementById('results-screen');
        this.levelSelectionScreen = document.getElementById('level-selection-screen');

        // Results Screen Elements
        this.resultsRatingContainer = document.getElementById('results-rating');
        this.resultsStatsContainer = document.getElementById('results-stats');
        this.resultsTime = document.getElementById('results-time');
        this.resultsNetWpm = document.getElementById('results-net-wpm');
        this.resultsGrossWpm = document.getElementById('results-gross-wpm');
        this.resultsAccuracy = document.getElementById('results-accuracy');
        this.levelUnlockMessage = document.getElementById('level-unlock-message');

        // Level Selection Screen Elements
        this.levelListContainer = document.getElementById('level-list');

        // Menu Navigation Buttons
        this.gameMenuButton = document.getElementById('game-menu-button');
        this.playbackMenuButton = document.getElementById('playback-menu-button');
        this.sandboxMenuButton = document.getElementById('sandbox-menu-button');
        this.resultsMenuButton = document.getElementById('results-menu-button');
        this.levelSelectMenuButton = document.getElementById('level-select-menu-button');

        // Internal State & Constants
        this.currentWpm = MorseConfig.DEFAULT_WPM;
        this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
        this.currentVolume = MorseConfig.AUDIO_DEFAULT_VOLUME;
        this.currentDitKey = MorseConfig.KEYBINDING_DEFAULTS.dit;
        this.currentDahKey = MorseConfig.KEYBINDING_DEFAULTS.dah;
        this.isSoundEnabled = true;
        this.isDarkModeEnabled = false;
        this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE;
        this.isControlHeld = false;
        this.hintWasVisibleBeforePeek = false;
        this.keyInputCurrentlyListening = null; // 'dit', 'dah', or null

        // --- Separate Timeouts for feedback ---
        this._incorrectFlashTimeout = null; // Character flash
        this._incorrectPatternTimeout = null; // Pattern bg/fill flash (incorrect)
        this._correctFlashTimeout = null; // Pattern bg/fill flash (correct)
        this._hintPulseTimer = null; // Hint SVG pulse start delay
        // --- End Separate Timeouts ---

        // SVG Strings
        this.ditSvgString = `<svg class="pattern-dit" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="15" /></svg>`;
        this.dahSvgString = `<svg class="pattern-dah" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="10" rx="3"/></svg>`;

        // Paddle Texture URLs
        this.paddleTextures = { dit: null, dah: null };


        // Initial Setup
        this._loadSettings();
        this._loadPaddleTextures();
        this._updateWpmDisplay(this.currentWpm);
        this._updateFrequencyDisplay(this.currentFrequency);
        this._updateVolumeSliderUI(this.currentVolume);
        this._updateSpeakerIcon(this.currentVolume);
        this._updateKeyMappingDisplay();
        this._applyDarkMode(this.isDarkModeEnabled);
        this._applyHintVisibility(this.isHintVisible, false);
        if (this.soundToggle) this.soundToggle.checked = this.isSoundEnabled;
        if (this.darkModeToggle) this.darkModeToggle.checked = this.isDarkModeEnabled;
        if (this.frequencySlider) {
            this.frequencySlider.min = MorseConfig.AUDIO_MIN_FREQUENCY;
            this.frequencySlider.max = MorseConfig.AUDIO_MAX_FREQUENCY;
            this.frequencySlider.value = this.currentFrequency;
        }
        if (this.wpmSlider) {
            this.wpmSlider.value = this.currentWpm;
        }
        if (this.volumeSlider) {
            this.volumeSlider.value = this.currentVolume;
        }
        this._addGlobalEventListeners();
        this._addDragDropListeners();
        console.log("UIManager Initialized");
    }

    // --- UI View Management ---
    _hideAllViews() {
        this.gameUiWrapper?.classList.add('hidden');
        this.inputArea?.classList.add('hidden');
        this.playbackArea?.classList.add('hidden');
        this.sandboxArea?.classList.add('hidden');
        this.mainMenuOverlay?.classList.add('hidden');
        this.resultsScreen?.classList.add('hidden');
        this.levelSelectionScreen?.classList.add('hidden');
        this._stopHintPulse("View Change");
        this._updateDisplayAreaSizing(); // Update size after hiding/showing views
    }

    showMainMenu() {
        this._hideAllViews();
        this.mainMenuOverlay?.classList.remove('hidden');
        console.log("UI: Showing Main Menu");
    }

    showGameUI() {
         this._hideAllViews();
         this.gameUiWrapper?.classList.remove('hidden');
         this.inputArea?.classList.remove('hidden');
         this._applyHintVisibility(this.isHintVisible, false);
         this.updatePaddleLabels('game');
         console.log("UI: Showing Game/Sandbox Interface");
         this._updateDisplayAreaSizing();
    }

    showPlaybackUI() {
        this._hideAllViews();
        this.playbackArea?.classList.remove('hidden');
        this.setPlaybackButtonEnabled(true, 'Play Morse');
        this.updatePlaybackMorseDisplay("");
        if (this.playbackInput) this.playbackInput.value = '';
        console.log("UI: Showing Playback Interface");
    }

    showSandboxUI() {
        this._hideAllViews();
        this.sandboxArea?.classList.remove('hidden');
        this.updateSandboxMorsePreview("");
        if (this.sandboxInput) {
            this.sandboxInput.value = '';
            this.sandboxInput.focus();
        }
        console.log("UI: Showing Sandbox Setup Interface");
    }

    showLevelSelectionScreen(levelsWithStatus) {
        console.log("UI: Attempting to show Level Selection Screen...");
        this._hideAllViews();
        this.levelSelectionScreen?.classList.remove('hidden');

        if (!this.levelListContainer || !this.levelSelectionScreen) {
            console.error("Level selection container or screen element not found!");
            return;
        }
        console.log("UI: Level Selection Screen element found, populating list...");

        this.levelListContainer.innerHTML = '';
        levelsWithStatus.forEach(level => {
             const button = document.createElement('button');
             button.textContent = `Level ${level.id}: ${level.name}`;
             button.dataset.levelId = level.id;
             button.classList.add('level-button');
             if (level.isUnlocked) {
                 button.disabled = false;
                 button.classList.add(level.highScore ? 'completed' : 'unlocked');
                 const highScoreText = level.highScore
                      ? `${level.highScore.score.toFixed(1)} WPM, ${level.highScore.accuracy.toFixed(1)}%`
                      : 'No score yet';
                 button.title = `Status: ${level.highScore ? 'Completed' : 'Unlocked'}\nHigh Score: ${highScoreText}`;
             } else {
                 button.disabled = true;
                 button.classList.add('locked');
                 button.title = level.unlock_criteria
                     ? `Requires ${level.unlock_criteria.min_wpm} WPM & ${level.unlock_criteria.min_accuracy}% Accuracy on Level ${level.id - 1}`
                     : 'Locked';
             }
             this.levelListContainer.appendChild(button);
        });
        console.log("UI: Showing Level Selection Screen - List Populated.");
        this._updateDisplayAreaSizing();
    }

    hideLevelSelectionScreen() {
        this.levelSelectionScreen?.classList.add('hidden');
        console.log("UI: Hiding Level Selection Screen.");
    }

    /** Shows the results overlay and configures UI elements for results mode. */
    showResultsScreen(scores, unlockedLevelId, hasNextLevelOption, mode) {
        this._hideAllViews();
        this.resultsScreen?.classList.remove('hidden');
        this.inputArea?.classList.remove('hidden');

        if (!this.resultsScreen) return;
        this.resultsTime.textContent = `Time: ${scores.elapsedTimeSeconds.toFixed(1)}s`;
        this.resultsNetWpm.textContent = `Net WPM: ${scores.netWpm.toFixed(1)}`;
        this.resultsGrossWpm.textContent = `Gross WPM: ${scores.grossWpm.toFixed(1)}`;
        this.resultsAccuracy.textContent = `Accuracy: ${scores.accuracy.toFixed(1)}%`;

        this.updateStarRating(scores.accuracy);

        if (mode === AppMode.GAME) {
            this.levelUnlockMessage.textContent = unlockedLevelId ? `Congratulations! Level ${unlockedLevelId} unlocked!` : '';
            this.levelUnlockMessage.style.display = unlockedLevelId ? 'block' : 'block';
        } else { // Sandbox
            this.levelUnlockMessage.textContent = '';
            this.levelUnlockMessage.style.display = 'none';
        }

        const keyDisplayDit = MorseConfig.getKeyDisplay(this.currentDitKey);
        const keyDisplayDah = MorseConfig.getKeyDisplay(this.currentDahKey);
        const instructionEl = this.resultsScreen.querySelector('.results-instructions');
        if (instructionEl) {
            instructionEl.innerHTML = `Press <span class="key-hint">${keyDisplayDit}</span> (Retry) or <span class="key-hint">${keyDisplayDah}</span> (Next)`;
        }

        this.updatePaddleLabels('results', hasNextLevelOption, mode);
        console.log(`UI: Showing Results (Mode: ${mode})`);
        this._updateDisplayAreaSizing();
    }

    /** Updates the star display based on score/accuracy. */
    updateStarRating(accuracy) {
        if (!this.resultsRatingContainer) return;
        const stars = this.resultsRatingContainer.querySelectorAll('.star');
        let filledStars = 0;
        if (accuracy >= 98) filledStars = 3;
        else if (accuracy >= 90) filledStars = 2;
        else if (accuracy >= 75) filledStars = 1;

        stars.forEach((star, index) => {
            star.classList.toggle('filled', index < filledStars);
            star.textContent = index < filledStars ? '★' : '☆';
        });
    }

    /** Adjusts display area height based on input area visibility */
    _updateDisplayAreaSizing() {
        const isInputHidden = this.inputArea?.classList.contains('hidden');
        this.bodyElement.classList.toggle('input-area-hidden', isInputHidden);
    }


    // --- Helper Functions ---
    _createPatternSvg(type) { return type === '.' ? this.ditSvgString : this.dahSvgString; }

    /** Updates the target (hint) pattern display. */
    updateTargetPatternDisplay(morseSequence) {
        if (!this.targetPatternContainer) return;
        this._stopHintPulse("Target Pattern Update");
        this.targetPatternContainer.innerHTML = '';
        if (morseSequence) {
             morseSequence.split('').forEach(el => {
                 if (el === '.' || el === '-') this.targetPatternContainer.innerHTML += this._createPatternSvg(el);
             });
        }
        this._applyHintVisibility(this.isHintVisible);
    }

    /** Updates the user input pattern display. */
    updateUserPatternDisplay(morseSequence) {
        if (!this.userPatternContainer) return;
        if (morseSequence) {
            this._stopHintPulse("User Input Started");
        }
        this.userPatternContainer.innerHTML = '';
        if (morseSequence) {
             morseSequence.split('').forEach(el => {
                 if (el === '.' || el === '-') this.userPatternContainer.innerHTML += this._createPatternSvg(el);
             });
        }
    }

    updatePlaybackMorseDisplay(formattedMorse) { if (this.playbackMorseDisplay) this.playbackMorseDisplay.textContent = formattedMorse || '\u00A0'; }
    updateSandboxMorsePreview(formattedMorse) { if (this.sandboxMorsePreview) this.sandboxMorsePreview.textContent = formattedMorse || '\u00A0'; }

    /** Sets the visual state (default, correct-flash, incorrect-pattern) for the pattern containers. */
    setPatternDisplayState(state) {
        const userContainer = this.userPatternContainer;
        const targetContainer = this.targetPatternContainer; // Hint container

        if (!userContainer) return; // Need at least user container

        console.log(`[Feedback DBG] setPatternDisplayState called with: ${state}`);

        // --- Clear conflicting timeouts ---
        if (state !== 'correct' && this._correctFlashTimeout) {
            console.log("[Feedback DBG] Clearing existing CORRECT timeout.");
            clearTimeout(this._correctFlashTimeout);
            this._correctFlashTimeout = null;
        }
        if (state !== 'incorrect' && this._incorrectPatternTimeout) {
            console.log("[Feedback DBG] Clearing existing INCORRECT timeout.");
            clearTimeout(this._incorrectPatternTimeout);
            this._incorrectPatternTimeout = null;
        }

        // --- Remove current states ---
        userContainer.classList.remove('correct-flash', 'incorrect-pattern');
        targetContainer?.classList.remove('correct-flash', 'incorrect-pattern'); // Only if target exists

        // --- Stop Hint Pulse ---
        if (state === 'correct' || state === 'incorrect') {
            this._stopHintPulse(`Feedback: ${state}`);
        }

        // --- Apply new state and set removal timer ---
        if (state === 'correct') {
            console.log("[Feedback DBG] Applying 'correct-flash' class.");
            userContainer.classList.add('correct-flash');
            if (targetContainer) targetContainer.classList.add('correct-flash');

            // Use a slightly shorter duration maybe than incorrect?
            const correctFlashDuration = MorseConfig.INCORRECT_FLASH_DURATION * 0.8;

            this._correctFlashTimeout = setTimeout(() => {
                 console.log("[Feedback DBG] CORRECT timeout fired. Removing 'correct-flash'.");
                 userContainer.classList.remove('correct-flash');
                 if (targetContainer) targetContainer.classList.remove('correct-flash');
                 this._correctFlashTimeout = null;
            }, correctFlashDuration);

        } else if (state === 'incorrect') {
            console.log("[Feedback DBG] Applying 'incorrect-pattern' class.");
            userContainer.classList.add('incorrect-pattern');
            if (targetContainer) targetContainer.classList.add('incorrect-pattern');

            this._incorrectPatternTimeout = setTimeout(() => {
                console.log("[Feedback DBG] INCORRECT timeout fired. Removing 'incorrect-pattern'.");
                userContainer.classList.remove('incorrect-pattern');
                if (targetContainer) targetContainer.classList.remove('incorrect-pattern');
                this._incorrectPatternTimeout = null;
            }, MorseConfig.INCORRECT_FLASH_DURATION);
        } else {
             console.log("[Feedback DBG] State is 'default'. Classes removed.");
        }
    }


    /** Renders the sentence text into the display area. */
    renderSentence(sentence) {
        if (!this.textDisplay || !this.textDisplayWrapper) return;
        this.textDisplay.innerHTML = '';
        this.textDisplay.style.fontSize = '';
        this.textDisplay.style.transform = 'translateX(0px)';
        this.textDisplayWrapper.scrollLeft = 0;

        if (sentence) {
            sentence.split('').forEach((char, index) => {
                const span = document.createElement('span');
                span.textContent = char;
                span.classList.add('char', 'pending');
                span.dataset.index = index;
                if (char === ' ') span.classList.add('space');
                this.textDisplay.appendChild(span);
            });
        }
        this.resetCharacterStyles();
        this.updateUserPatternDisplay("");
        this.setPatternDisplayState('default');
        this._adjustTextDisplayFontSize();
        this._stopHintPulse("New Sentence Rendered");
    }

    /** Adjusts the font size of the text display to fit vertically. */
    _adjustTextDisplayFontSize() {
        const element = this.textDisplay;
        const container = this.textDisplayWrapper;
        if (!element || !container || !element.textContent) {
            if(element) element.style.fontSize = '';
            return;
        }

        element.style.fontSize = '';
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const minFontSize = 10;
        let iterations = 0;
        const maxIterations = 100;

        while (element.scrollHeight > container.clientHeight && currentFontSize > minFontSize && iterations < maxIterations) {
            currentFontSize *= 0.95;
            element.style.fontSize = `${currentFontSize}px`;
            iterations++;
        }
        if (iterations >= maxIterations) console.warn("Max font size adjustment iterations reached.");
    }

    /** Resets all character spans to the 'pending' state. */
    resetCharacterStyles() {
        this.textDisplay?.querySelectorAll('.char').forEach(span => {
            span.className = 'char pending'; // Base classes
            if (span.textContent === ' ') span.classList.add('space');
        });
    }

    /** Updates the visual state of a specific character span. */
    updateCharacterState(charIndex, state) {
        const charSpan = this.textDisplay?.querySelector(`.char[data-index="${charIndex}"]`);
        if (charSpan) {
            charSpan.classList.remove('pending', 'current', 'completed', 'incorrect');
            charSpan.classList.add(state);

            if (state === 'incorrect') {
                this._stopHintPulse("Character Incorrect");
                if (this._incorrectFlashTimeout) clearTimeout(this._incorrectFlashTimeout);
                this._incorrectFlashTimeout = setTimeout(() => {
                    if (charSpan.classList.contains('incorrect')) {
                        charSpan.classList.remove('incorrect');
                        const currentGameState = window.morseGameState;
                        if (currentGameState && currentGameState.currentCharIndex === charIndex &&
                            (currentGameState.isPlaying() || currentGameState.status === GameStatus.READY || currentGameState.status === GameStatus.LISTENING)) {
                            charSpan.classList.add('current');
                        } else {
                            charSpan.classList.add('pending');
                        }
                    }
                    this._incorrectFlashTimeout = null;
                }, MorseConfig.INCORRECT_FLASH_DURATION);
            } else if (this._incorrectFlashTimeout && charSpan.classList.contains('incorrect')) {
                clearTimeout(this._incorrectFlashTimeout);
                this._incorrectFlashTimeout = null;
            }

            if (state === 'current') {
                this._centerCurrentCharacterHorizontally(charSpan);
            } else if (state === 'completed') {
                this._stopHintPulse("Character Completed");
            }
        }
    }


    /** Highlights the next character, updates the target pattern, clears user input, and handles hint pulse. */
    highlightCharacter(currentIdx, targetChar) {
        const prevSpan = this.textDisplay?.querySelector('.char.current');
        if (prevSpan && prevSpan.dataset.index != currentIdx) {
            if (!prevSpan.classList.contains('incorrect') && !prevSpan.classList.contains('completed')) {
                prevSpan.classList.remove('current');
                prevSpan.classList.add('pending');
            } else {
                prevSpan.classList.remove('current');
            }
        }

        this.updateCharacterState(currentIdx, 'current');

        let morseSequence = null;
        if (window.morseDecoder) {
            morseSequence = window.morseDecoder.encodeCharacter(targetChar);
        }
        this.updateTargetPatternDisplay(morseSequence ?? "");

        this.updateUserPatternDisplay("");
        this.setPatternDisplayState('default'); // Reset pattern feedback

        // Start hint pulse timer if hint is visible and sequence exists
        if (this.isHintVisible && morseSequence) {
            this._startHintPulseTimer();
        } else {
            this._stopHintPulse("Highlight Character (no pulse condition)");
        }
    }

    /** Scrolls the text display wrapper horizontally to keep the current character centered. */
    _centerCurrentCharacterHorizontally(element) {
        const container = this.textDisplayWrapper;
        const textDisplay = this.textDisplay;
        if (!container || !element || !textDisplay) return;

        requestAnimationFrame(() => {
            const currentElement = textDisplay.querySelector(`.char[data-index="${element.dataset.index}"]`);
            if (!currentElement) return;

            const containerRect = container.getBoundingClientRect();
            const elementRect = currentElement.getBoundingClientRect();
            const containerCenter = containerRect.left + containerRect.width / 2;
            const elementCenter = elementRect.left + elementRect.width / 2;
            const scrollAdjustment = elementCenter - containerCenter;
            let targetScrollLeft = container.scrollLeft + scrollAdjustment;
            const maxScrollLeft = container.scrollWidth - containerRect.width;
            targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft));

            if (Math.abs(container.scrollLeft - targetScrollLeft) > 1) {
                container.scrollTo({
                    left: targetScrollLeft,
                    behavior: 'smooth'
                });
            }
        });
    }

    // --- Stat Updates ---
    updateTimer(elapsedTimeMs) { const totalSeconds = Math.floor(elapsedTimeMs / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const milliseconds = Math.floor((elapsedTimeMs % 1000) / 100); const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds)}`; if (this.timerDisplay) this.timerDisplay.textContent = `Time: ${formattedTime}`; }
    updateWpmDisplay(netWpm) { if(this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: ${netWpm.toFixed(0)}`; }
    updateAccuracyDisplay(accuracy) { if(this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: ${accuracy.toFixed(1)}%`; }
    updateGrossWpmDisplay(grossWpm) { if(this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: ${grossWpm.toFixed(0)}`; }
    resetStatsDisplay() { this.updateTimer(0); this.updateWpmDisplay(0); this.updateAccuracyDisplay(100); this.updateGrossWpmDisplay(0); this.updateTargetPatternDisplay(""); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._applyHintVisibility(this.isHintVisible, false); }

    // --- Settings ---
    _updateWpmDisplay(wpm) { if(this.wpmValueDisplay) this.wpmValueDisplay.textContent = wpm; }
    _updateFrequencyDisplay(freq) { if(this.frequencyValueDisplay) this.frequencyValueDisplay.textContent = freq; }

    // --- Volume UI Updates ---
    _updateVolumeSliderUI(volume) { if (this.volumeSlider) this.volumeSlider.value = volume; }
    _updateSpeakerIcon(volume) {
        const waves = [this.speakerWave1, this.speakerWave2, this.speakerWave3];
        waves.forEach(wave => { if (wave) wave.style.display = 'none'; });
        if (volume > 0.7 && this.speakerWave3) this.speakerWave3.style.display = 'inline';
        if (volume > 0.3 && this.speakerWave2) this.speakerWave2.style.display = 'inline';
        if (volume > 0 && this.speakerWave1) this.speakerWave1.style.display = 'inline';
    }
    // --- End Volume UI Updates ---

    // --- Key Mapping UI Updates ---
    _updateKeyMappingDisplay() {
        if (this.ditKeyInput) {
            this.ditKeyInput.value = MorseConfig.getKeyDisplay(this.currentDitKey);
            this.ditKeyInput.classList.remove('listening');
            this.ditKeyInput.placeholder = "Click to set";
        }
        if (this.dahKeyInput) {
            this.dahKeyInput.value = MorseConfig.getKeyDisplay(this.currentDahKey);
            this.dahKeyInput.classList.remove('listening');
            this.dahKeyInput.placeholder = "Click to set";
        }
        this.keyInputCurrentlyListening = null; // Ensure listening state is reset
    }
    // --- End Key Mapping UI Updates ---

    _saveSettings() {
         try {
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM, this.currentWpm);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND, this.isSoundEnabled);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE, this.isDarkModeEnabled);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY, this.currentFrequency);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE, this.isHintVisible);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_VOLUME, this.currentVolume);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY, this.currentDitKey); // Save Dit key
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY, this.currentDahKey); // Save Dah key
             console.log("Settings Saved:", { wpm: this.currentWpm, sound: this.isSoundEnabled, dark: this.isDarkModeEnabled, freq: this.currentFrequency, hint: this.isHintVisible, volume: this.currentVolume, ditKey: this.currentDitKey, dahKey: this.currentDahKey });
         } catch (e) {
             console.error("Error saving settings:", e);
         }
     }

    _loadSettings() {
        try {
            const savedWpm = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM);
            const savedSound = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND);
            const savedDarkMode = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE);
            const savedFrequency = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY);
            const savedHintVisible = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE);
            const savedVolume = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_VOLUME);
            const savedDitKey = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY); // Load Dit key
            const savedDahKey = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY); // Load Dah key

            this.currentWpm = savedWpm !== null ? parseInt(savedWpm, 10) : MorseConfig.DEFAULT_WPM;
            this.isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : true;
            this.isDarkModeEnabled = savedDarkMode !== null ? JSON.parse(savedDarkMode) : false;
            this.currentFrequency = savedFrequency !== null ? parseInt(savedFrequency, 10) : MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
            this.isHintVisible = savedHintVisible !== null ? JSON.parse(savedHintVisible) : MorseConfig.HINT_DEFAULT_VISIBLE;
            this.currentVolume = savedVolume !== null ? parseFloat(savedVolume) : MorseConfig.AUDIO_DEFAULT_VOLUME;
            // Load keys, using defaults if not found or invalid
            this.currentDitKey = (savedDitKey && savedDitKey.trim() !== '') ? savedDitKey : MorseConfig.KEYBINDING_DEFAULTS.dit;
            this.currentDahKey = (savedDahKey && savedDahKey.trim() !== '') ? savedDahKey : MorseConfig.KEYBINDING_DEFAULTS.dah;

            // Basic validation to prevent assigning same key to both
            if (this.currentDitKey === this.currentDahKey) {
                console.warn(`Loaded keys are identical ('${this.currentDitKey}'). Resetting Dah key to default.`);
                this.currentDahKey = MorseConfig.KEYBINDING_DEFAULTS.dah;
                // If default Dah is ALSO the same as Dit, reset Dit too (edge case)
                if (this.currentDitKey === this.currentDahKey) {
                    this.currentDitKey = MorseConfig.KEYBINDING_DEFAULTS.dit;
                }
                this._saveSettings(); // Re-save corrected settings
            }


            // Clamp frequency and volume
            this.currentFrequency = Math.max(MorseConfig.AUDIO_MIN_FREQUENCY, Math.min(MorseConfig.AUDIO_MAX_FREQUENCY, this.currentFrequency));
            this.currentVolume = Math.max(0.0, Math.min(1.0, this.currentVolume));

            console.log("Settings Loaded:", { wpm: this.currentWpm, sound: this.isSoundEnabled, dark: this.isDarkModeEnabled, freq: this.currentFrequency, hint: this.isHintVisible, volume: this.currentVolume, ditKey: this.currentDitKey, dahKey: this.currentDahKey });
        } catch (e) {
            console.error("Error loading settings:", e);
            this.currentWpm = MorseConfig.DEFAULT_WPM;
            this.isSoundEnabled = true;
            this.isDarkModeEnabled = false;
            this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
            this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE;
            this.currentVolume = MorseConfig.AUDIO_DEFAULT_VOLUME;
            this.currentDitKey = MorseConfig.KEYBINDING_DEFAULTS.dit; // Default key on error
            this.currentDahKey = MorseConfig.KEYBINDING_DEFAULTS.dah; // Default key on error
        }
        // Update UI elements to reflect loaded state (done in constructor)
    }

    /** Visually resets the key mapping inputs to defaults (called by main.js on progress reset) */
    resetKeyMappingInputs() {
         this.currentDitKey = MorseConfig.KEYBINDING_DEFAULTS.dit;
         this.currentDahKey = MorseConfig.KEYBINDING_DEFAULTS.dah;
         this._saveSettings(); // Save the defaults
         this._updateKeyMappingDisplay();
         // Notify main.js to update InputHandler
         if (this.callbacks && this.callbacks.onKeyMappingChange) {
            this.callbacks.onKeyMappingChange({ dit: this.currentDitKey, dah: this.currentDahKey });
         }
     }

    setButtonActive(buttonType, isActive) { const button = buttonType === 'dit' ? this.ditButton : this.dahButton; if (button) button.classList.toggle('active', isActive); }

    /** Updates paddle content for game vs results mode. */
    updatePaddleLabels(mode, hasNextLevel = false, gameMode = AppMode.GAME) {
        const buttons = [this.ditButton, this.dahButton];
        const labels = [this.ditPaddleLabel, this.dahPaddleLabel];

        if (!buttons[0] || !buttons[1] || !labels[0] || !labels[1]) return;

        if (mode === 'results') {
            labels[0].textContent = "Retry"; // Dit = Retry
            labels[1].textContent = "Next";  // Dah = Next
            const isNextDisabled = (gameMode === AppMode.SANDBOX || !hasNextLevel);
            buttons[0].disabled = false; // Retry always enabled
            buttons[1].disabled = isNextDisabled;
            buttons.forEach(btn => btn.classList.add('results-label-active'));
        } else { // Game mode
            labels[0].textContent = "";
            labels[1].textContent = "";
            buttons[0].disabled = false;
            buttons[1].disabled = false;
            buttons.forEach(btn => btn.classList.remove('results-label-active'));
        }
    }

    setPlaybackButtonEnabled(enabled, text = 'Play Morse') { if (this.playSentenceButton) { this.playSentenceButton.disabled = !enabled; this.playSentenceButton.textContent = text; } }
    _applyDarkMode(enable) { this.bodyElement.classList.toggle('dark-mode', enable); }

    /** Applies the visual hint visibility state, respecting the peek state. */
    _applyHintVisibility(visible, startPulse = true) {
        let effectiveVisibility = visible;
        const reasonPrefix = `applyHintVisibility(visible=${visible}, startPulse=${startPulse})`;

        if (this.isControlHeld) {
            effectiveVisibility = true;
            this._stopHintPulse(`${reasonPrefix} -> Peek Active`);
        } else {
            if (!visible) {
                this._stopHintPulse(`${reasonPrefix} -> Hint Hidden`);
            } else if (startPulse) {
                // Start timer only if the target container is actually visible (i.e., game UI is showing)
                if(this.targetPatternContainer && this.targetPatternContainer.offsetParent !== null) {
                    this._startHintPulseTimer();
                } else {
                    this._stopHintPulse(`${reasonPrefix} -> Hint Visible (No Initial Pulse - Container Hidden)`);
                }
            } else {
                this._stopHintPulse(`${reasonPrefix} -> Hint Visible (No Initial Pulse)`);
            }
        }

        this.targetPatternOuterWrapper?.classList.toggle('hint-hidden', !effectiveVisibility);
        this.toggleHintButton?.setAttribute('aria-pressed', String(this.isHintVisible));
    }

    /** Starts the timer to add the pulsing animation class to hint SVGs. */
    _startHintPulseTimer() {
        this._stopHintPulse("Starting New Pulse Timer");
        const svgs = this.targetPatternContainer?.querySelectorAll('svg');
        if (!svgs || svgs.length === 0 || this.targetPatternOuterWrapper?.classList.contains('hint-hidden')) {
            // console.log("[Hint Pulse DBG] Condition not met: No container/svgs or hint hidden.");
            return;
        }

        const pulseDelayMs = 2000;
        console.log(`[Hint Pulse DBG] Scheduling pulse for ${svgs.length} SVGs in ${pulseDelayMs}ms`);
        this._hintPulseTimer = setTimeout(() => {
            // Check conditions *again* when timer fires
            const currentSvgs = this.targetPatternContainer?.querySelectorAll('svg');
            if (currentSvgs && currentSvgs.length > 0 && !this.targetPatternOuterWrapper?.classList.contains('hint-hidden')) {
                console.log("[Hint Pulse DBG] Timeout fired: Adding .hint-svg-pulse class.");
                currentSvgs.forEach(svg => svg.classList.add('hint-svg-pulse'));
            } else {
                 console.log("[Hint Pulse DBG] Timeout fired, but SVGs gone or hint now hidden. Pulse cancelled.");
            }
            this._hintPulseTimer = null;
        }, pulseDelayMs);
    }

    /** Clears the hint pulse timer and removes the pulsing animation class from SVGs. */
    _stopHintPulse(reason = "Unknown") {
        let stoppedTimer = false;
        let removedClassCount = 0;
        if (this._hintPulseTimer) {
            clearTimeout(this._hintPulseTimer);
            this._hintPulseTimer = null;
            stoppedTimer = true;
        }
        const svgs = this.targetPatternContainer?.querySelectorAll('svg.hint-svg-pulse');
        if (svgs && svgs.length > 0) {
            svgs.forEach(svg => svg.classList.remove('hint-svg-pulse'));
            removedClassCount = svgs.length;
        }
        if (stoppedTimer || removedClassCount > 0) {
            console.log(`[Hint Pulse DBG] Stop Pulse. Reason: ${reason}. Timer cleared: ${stoppedTimer}. Classes removed: ${removedClassCount}.`);
        }
    }

    /** Handles the global keydown event, primarily for hint peeking. */
     _handleGlobalKeyDown(event) {
        const targetElement = event.target;
        const isInputFocused = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA';
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput;
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');
        const isGameVisible = this.gameUiWrapper && !this.gameUiWrapper.classList.contains('hidden');

        // Don't peek if an input/textarea has focus OR if a key mapping input has focus
        // Also don't peek if settings modal is open (unless key map input has focus, handled below)
        if (isInputFocused || isKeyMapInputFocused || !isGameVisible || (isSettingsOpen && !isKeyMapInputFocused) ) {
            // Allow key mapping input handling even if settings open
            if (isKeyMapInputFocused && event.key !== 'Control') {
                // Let key mapping handler deal with non-Control keys
            } else if (event.key === 'Control' && isKeyMapInputFocused) {
                // Ignore Control press if key map input focused
                return;
            } else if (!isGameVisible) {
                 return; // Ignore if game not visible
            } else if (isInputFocused || isSettingsOpen) {
                return; // Ignore if other input has focus or settings open
            }
        }


        if (event.key === 'Control' && !this.isControlHeld) {
            console.log("[Peek DBG] Ctrl Down Detected. Starting peek.");
            this.isControlHeld = true;
            this.hintWasVisibleBeforePeek = this.isHintVisible;
            console.log(`[Peek DBG] Stored hintWasVisibleBeforePeek: ${this.hintWasVisibleBeforePeek}`);
            console.log("[Peek DBG] Calling _applyHintVisibility(true, false) for peek start.");
            this._applyHintVisibility(true, false);
        }
    }

    /** Handles the global keyup event, primarily for hint peeking. */
    _handleGlobalKeyUp(event) {
         if (event.key === 'Control') {
            console.log("[Peek DBG] Ctrl Up Detected.");
            if (this.isControlHeld) {
                 console.log("[Peek DBG] Was holding Ctrl. Ending peek.");
                 this.isControlHeld = false;
                 if (this.hintWasVisibleBeforePeek) {
                     console.log("[Peek DBG] Hint was visible. Toggling OFF after peek.");
                     this.isHintVisible = false;
                     this._saveSettings();
                     this._applyHintVisibility(false);
                     if (this.callbacks && this.callbacks.onHintToggle) {
                        this.callbacks.onHintToggle(this.isHintVisible);
                     }
                 } else {
                     console.log("[Peek DBG] Hint was hidden. Restoring hidden state after peek.");
                     this._applyHintVisibility(false);
                 }
            } else {
                 console.log("[Peek DBG] Ctrl Up, but wasn't tracking hold.");
            }
         }
    }


    /** Adds global event listeners needed by the UI manager (e.g., hint peek). */
    _addGlobalEventListeners() {
        document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
        document.addEventListener('keyup', this._handleGlobalKeyUp.bind(this));
        this.volumeSlider?.addEventListener('mouseup', () => this.volumeSlider.blur());
        this.volumeSlider?.addEventListener('touchend', () => this.volumeSlider.blur());
    }

    // --- Paddle Texture Drag and Drop ---
    _loadPaddleTextures() {
        try {
            const savedTextures = localStorage.getItem(MorseConfig.STORAGE_KEY_PADDLE_TEXTURES);
            if (savedTextures) {
                const parsedTextures = JSON.parse(savedTextures);
                if (parsedTextures.dit) {
                    this._applyTexture(this.ditButton, parsedTextures.dit);
                    this.paddleTextures.dit = parsedTextures.dit;
                }
                if (parsedTextures.dah) {
                    this._applyTexture(this.dahButton, parsedTextures.dah);
                    this.paddleTextures.dah = parsedTextures.dah;
                }
                // console.log("Paddle textures loaded:", this.paddleTextures);
            }
        } catch (e) {
            console.error("Error loading paddle textures:", e);
            this.paddleTextures = { dit: null, dah: null };
        }
    }
    _savePaddleTextures() {
        try {
            localStorage.setItem(MorseConfig.STORAGE_KEY_PADDLE_TEXTURES, JSON.stringify(this.paddleTextures));
            // console.log("Paddle textures saved:", this.paddleTextures);
        } catch (e) {
            console.error("Error saving paddle textures:", e);
        }
    }
    _addDragDropListeners() {
        [this.ditButton, this.dahButton].forEach(paddle => {
            if (paddle) {
                paddle.addEventListener('dragover', this._handleDragOver.bind(this));
                paddle.addEventListener('dragleave', this._handleDragLeave.bind(this));
                paddle.addEventListener('drop', this._handleDrop.bind(this));
            }
        });
    }
    _handleDragOver(event) {
        event.preventDefault(); event.stopPropagation();
        const paddle = event.currentTarget;
        if (paddle) { paddle.classList.add('drag-over'); event.dataTransfer.dropEffect = 'copy'; }
    }
    _handleDragLeave(event) {
        event.preventDefault(); event.stopPropagation();
        const paddle = event.currentTarget;
        if (paddle) paddle.classList.remove('drag-over');
    }
    _handleDrop(event) {
        event.preventDefault(); event.stopPropagation();
        const paddle = event.currentTarget;
        if (!paddle) return;
        paddle.classList.remove('drag-over');
        const paddleType = paddle.id === 'dit-button' ? 'dit' : 'dah'; // Use ID

        const dt = event.dataTransfer;
        const files = dt.files;

        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageDataUrl = e.target.result;
                    this._applyTexture(paddle, imageDataUrl);
                    this.paddleTextures[paddleType] = imageDataUrl;
                    this._savePaddleTextures();
                };
                reader.readAsDataURL(file);
                // console.log(`Applying file texture to ${paddleType} paddle: ${file.name}`);
            } else {
                alert("Please drop an image file.");
            }
        } else {
            let imageUrl = dt.getData('text/uri-list') || dt.getData('URL');
            if (!imageUrl) {
                 const htmlData = dt.getData('text/html');
                 if (htmlData) {
                     const tempDiv = document.createElement('div');
                     tempDiv.innerHTML = htmlData;
                     const imgElement = tempDiv.querySelector('img');
                     if (imgElement) imageUrl = imgElement.src;
                 }
            }
            if (imageUrl && (imageUrl.startsWith('http') || imageUrl.startsWith('data:image'))) {
                this._applyTexture(paddle, imageUrl);
                this.paddleTextures[paddleType] = imageUrl;
                this._savePaddleTextures();
                // console.log(`Applying URL texture to ${paddleType} paddle: ${imageUrl}`);
            } else {
                 alert("Could not get a valid image URL from the dropped item.");
            }
        }
    }
    _applyTexture(paddleElement, imageUrl) {
        if (!paddleElement) return;
        paddleElement.style.backgroundImage = `url('${imageUrl}')`;
        paddleElement.classList.add('has-texture');
        // console.log("Texture applied to:", paddleElement.id);
    }
    _removeTexture(paddleElement) {
         if (!paddleElement) return;
         paddleElement.style.backgroundImage = 'none';
         paddleElement.classList.remove('has-texture');
         const paddleType = paddleElement.id === 'dit-button' ? 'dit' : 'dah';
         if (paddleType) {
            this.paddleTextures[paddleType] = null;
            this._savePaddleTextures();
         }
        // console.log("Texture removed from:", paddleElement.id);
    }
    // --- End Paddle Texture Drag and Drop ---

    // --- Key Mapping Event Handlers ---
    _handleKeyMappingInputFocus(event) {
        const inputElement = event.target;
        const type = inputElement.id === 'dit-key-input' ? 'dit' : 'dah';

        if (this.keyInputCurrentlyListening) {
            this._updateKeyMappingDisplay();
        }

        inputElement.value = "Listening...";
        inputElement.classList.add('listening');
        this.keyInputCurrentlyListening = type;
        console.log(`Key mapping: Listening for ${type} key...`);
    }

    _handleKeyMappingKeyDown(event) {
        if (!this.keyInputCurrentlyListening) return;

        event.preventDefault();
        event.stopPropagation();

        const newKey = event.key;
        const type = this.keyInputCurrentlyListening;
        let isValid = true;
        let errorMessage = "";

        console.log(`Key mapping: Detected key "${newKey}" for ${type}`);

        // --- Validation ---
        if (newKey.trim() === '' || newKey === ' ') { // Disallow empty or space
            isValid = false;
            errorMessage = "Key cannot be empty or space.";
        } else if (type === 'dit' && newKey === this.currentDahKey) {
            isValid = false;
            errorMessage = `Key "${MorseConfig.getKeyDisplay(newKey)}" is already assigned to Dah.`;
        } else if (type === 'dah' && newKey === this.currentDitKey) {
            isValid = false;
            errorMessage = `Key "${MorseConfig.getKeyDisplay(newKey)}" is already assigned to Dit.`;
        }

        // --- Update or Reject ---
        if (isValid) {
            console.log(`Key mapping: Assigning "${newKey}" to ${type}.`);
            if (type === 'dit') this.currentDitKey = newKey;
            else this.currentDahKey = newKey;

            this._saveSettings();
            this._updateKeyMappingDisplay(); // Resets listening state

             if (this.callbacks && this.callbacks.onKeyMappingChange) {
                this.callbacks.onKeyMappingChange({ dit: this.currentDitKey, dah: this.currentDahKey });
             }

        } else {
            console.warn(`Key mapping: Invalid key "${newKey}" for ${type}. Reason: ${errorMessage}`);
            alert(`Invalid key: ${errorMessage}`);
            const inputElement = (type === 'dit') ? this.ditKeyInput : this.dahKeyInput;
            if (inputElement) inputElement.value = "Listening..."; // Keep listening prompt
        }
    }

    _handleKeyMappingBlur(event) {
        if (this.keyInputCurrentlyListening) {
            console.log("Key mapping: Blurred while listening, cancelling.");
            this._updateKeyMappingDisplay(); // Reverts display and resets listening state
        }
    }
    // --- End Key Mapping Event Handlers ---


    addEventListeners(callbacks) {
        this.callbacks = callbacks;

        // Main Menu
        this.startGameButton?.addEventListener('click', callbacks.onShowLevelSelect);
        this.showSandboxButton?.addEventListener('click', callbacks.onShowSandbox);
        this.showPlaybackButton?.addEventListener('click', callbacks.onShowPlayback);

        // Playback
        this.playSentenceButton?.addEventListener('click', callbacks.onPlaySentence);
        this.playbackMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Sandbox
        this.startSandboxButton?.addEventListener('click', callbacks.onStartSandbox);
        this.sandboxInput?.addEventListener('input', callbacks.onSandboxInputChange);
        this.sandboxMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Level Selection
        this.levelListContainer?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON' && e.target.classList.contains('level-button') && !e.target.disabled) {
                const levelId = parseInt(e.target.dataset.levelId, 10);
                if (callbacks.onLevelSelect) callbacks.onLevelSelect(levelId);
            }
        });
        this.levelSelectMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Results Screen Navigation
        this.resultsMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Settings Modal Content
        this.wpmSlider?.addEventListener('input', (e) => this._updateWpmDisplay(parseInt(e.target.value, 10)));
        this.wpmSlider?.addEventListener('change', (e) => { this.currentWpm = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onWpmChange) callbacks.onWpmChange(this.currentWpm); });
        this.frequencySlider?.addEventListener('input', (e) => this._updateFrequencyDisplay(parseInt(e.target.value, 10)));
        this.frequencySlider?.addEventListener('change', (e) => { this.currentFrequency = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onFrequencyChange) callbacks.onFrequencyChange(this.currentFrequency); });
        this.soundToggle?.addEventListener('change', (e) => { this.isSoundEnabled = e.target.checked; this._saveSettings(); if (callbacks.onSoundToggle) callbacks.onSoundToggle(this.isSoundEnabled); });
        this.darkModeToggle?.addEventListener('change', (e) => { this.isDarkModeEnabled = e.target.checked; this._applyDarkMode(this.isDarkModeEnabled); this._saveSettings(); if (callbacks.onDarkModeToggle) callbacks.onDarkModeToggle(this.isDarkModeEnabled); });
        this.resetProgressButton?.addEventListener('click', () => { if (callbacks.onResetProgress) callbacks.onResetProgress(); });

        // Key Mapping Inputs (in Modal)
        this.ditKeyInput?.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
        this.dahKeyInput?.addEventListener('click', this._handleKeyMappingInputFocus.bind(this));
        this.ditKeyInput?.addEventListener('keydown', this._handleKeyMappingKeyDown.bind(this));
        this.dahKeyInput?.addEventListener('keydown', this._handleKeyMappingKeyDown.bind(this));
        this.ditKeyInput?.addEventListener('blur', this._handleKeyMappingBlur.bind(this));
        this.dahKeyInput?.addEventListener('blur', this._handleKeyMappingBlur.bind(this));

        // Volume Slider (Game UI)
         this.volumeSlider?.addEventListener('input', (e) => {
             const newVolume = parseFloat(e.target.value);
             this._updateSpeakerIcon(newVolume);
             if (callbacks.onVolumeChange) callbacks.onVolumeChange(newVolume);
         });
         this.volumeSlider?.addEventListener('change', (e) => {
             const newVolume = parseFloat(e.target.value);
             this.currentVolume = newVolume;
             this._saveSettings();
             if (callbacks.onVolumeChange) callbacks.onVolumeChange(this.currentVolume);
         });

        // Game UI
        this.toggleHintButton?.addEventListener('click', () => {
            this.isHintVisible = !this.isHintVisible;
            this._saveSettings();
            this._applyHintVisibility(this.isHintVisible);
            if (callbacks.onHintToggle) callbacks.onHintToggle(this.isHintVisible);
        });
        this.gameMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const currentSpan = this.textDisplay?.querySelector('.char.current');
                this._adjustTextDisplayFontSize();
                if (currentSpan) {
                    this._centerCurrentCharacterHorizontally(currentSpan);
                }
                 this._updateDisplayAreaSizing();
            }, 150);
        });

        console.log("UI Event Listeners Added.");
    }

    // --- Getters for Initial/Current State ---
    getInitialWpm() { return this.currentWpm; }
    getInitialSoundState() { return this.isSoundEnabled; }
    getInitialDarkModeState() { return this.isDarkModeEnabled; }
    getInitialFrequency() { return this.currentFrequency; }
    getInitialHintState() { return this.isHintVisible; }
    getInitialVolume() { return this.currentVolume; }
    getCurrentDitKey() { return this.currentDitKey; }
    getCurrentDahKey() { return this.currentDahKey; }
    getPlaybackSentence() { return this.playbackInput ? this.playbackInput.value : ""; }
    getSandboxSentence() { return this.sandboxInput ? this.sandboxInput.value : ""; }
}

// Ensure this runs after config.js
window.morseUIManager = new UIManager();
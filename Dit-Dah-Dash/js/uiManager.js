/* Dit-Dah-Dash/js/uiManager.js */
/* In file: js/uiManager.js */
/**
 * js/uiManager.js
 * ---------------
 * Handles DOM interactions, UI visibility, displays updates, modal settings UI,
 * themes, event listeners, and results screen management including star rating
 * and paddle label changes.
 * Includes fixes for fixed cursor/scrolling text and correct input feedback.
 * Uses separate timeouts for correct/incorrect feedback.
 * Adds volume control elements, state, and methods.
 * Adds Hint Peeking functionality using Control key.
 * **v2 Changes:**
 * - Correct feedback now applies to both user and target pattern containers.
 */

class UIManager {
    /**
     * Initializes the UIManager by getting references to key DOM elements.
     */
    constructor() {
        // Core Containers / Wrappers
        this.bodyElement = document.body;
        this.gameContainer = document.getElementById('game-container');
        this.displayArea = document.getElementById('display-area');
        this.gameUiWrapper = document.getElementById('game-ui-wrapper'); // Contains text, patterns, stats
        this.playbackArea = document.getElementById('playback-area');
        this.sandboxArea = document.getElementById('sandbox-area');
        this.inputArea = document.getElementById('input-area'); // Main paddle area

        // Main Menu Elements
        this.mainMenuOverlay = document.getElementById('main-menu-overlay');
        this.startGameButton = document.getElementById('start-game-button');
        this.showSandboxButton = document.getElementById('show-sandbox-button');
        this.showPlaybackButton = document.getElementById('show-playback-button');
        this.showSettingsButton = document.getElementById('show-settings-button'); // Opens modal

        // Game Mode Elements (within gameUiWrapper)
        this.textDisplayWrapper = document.getElementById('text-display-wrapper');
        this.textDisplay = document.getElementById('text-display');
        this.targetPatternContainer = document.getElementById('target-pattern-container');
        this.targetPatternOuterWrapper = document.getElementById('target-pattern-outer-wrapper');
        this.toggleHintButton = document.getElementById('toggle-hint-button');
        this.userPatternContainer = document.getElementById('user-pattern-container');
        this.statsDisplay = document.getElementById('stats-display'); // Shown during game and results overlay
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

        // Settings Modal Elements (Content inside the modal)
        this.settingsModal = document.getElementById('settings-modal'); // The modal itself
        this.settingsCloseButton = document.getElementById('settings-close-button'); // Modal close
        this.wpmSlider = document.getElementById('wpm-slider');
        this.wpmValueDisplay = document.getElementById('wpm-value-display');
        this.frequencySlider = document.getElementById('frequency-slider');
        this.frequencyValueDisplay = document.getElementById('frequency-value-display');
        this.soundToggle = document.getElementById('sound-toggle');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.resetProgressButton = document.getElementById('reset-progress-button');

        // Overlay Screens
        this.resultsScreen = document.getElementById('results-screen'); // Contains results text & stats
        this.levelSelectionScreen = document.getElementById('level-selection-screen'); // The overlay itself

        // Results Screen Elements
        this.resultsRatingContainer = document.getElementById('results-rating'); // Star rating container
        this.resultsStatsContainer = document.getElementById('results-stats'); // Stats container (p tags inside)
        this.resultsTime = document.getElementById('results-time');
        this.resultsNetWpm = document.getElementById('results-net-wpm');
        this.resultsGrossWpm = document.getElementById('results-gross-wpm');
        this.resultsAccuracy = document.getElementById('results-accuracy');
        this.levelUnlockMessage = document.getElementById('level-unlock-message');
        this.levelSelectButton = document.getElementById('level-select-button'); // Button on results screen

        // Level Selection Screen Elements
        this.levelListContainer = document.getElementById('level-list'); // Container for level buttons

        // Menu Navigation Buttons (within specific views)
        this.gameMenuButton = document.getElementById('game-menu-button');
        this.playbackMenuButton = document.getElementById('playback-menu-button');
        this.sandboxMenuButton = document.getElementById('sandbox-menu-button');
        this.resultsMenuButton = document.getElementById('results-menu-button');
        this.levelSelectMenuButton = document.getElementById('level-select-menu-button');

        // Internal State & Constants
        this.currentWpm = MorseConfig.DEFAULT_WPM;
        this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
        this.currentVolume = MorseConfig.AUDIO_DEFAULT_VOLUME; // Add volume state
        this.isSoundEnabled = true;
        this.isDarkModeEnabled = false;
        this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE;
        this.isControlHeld = false; // For hint peeking
        this.hintWasVisibleBeforePeek = false; // For hint peeking logic

        // --- Separate Timeouts for feedback ---
        this._incorrectFlashTimeout = null; // Timeout for incorrect character flash
        this._incorrectPatternTimeout = null; // Timeout for incorrect pattern flash
        this._correctPatternTimeout = null; // Timeout for correct pattern flash
        // --- End Separate Timeouts ---
        this.ditSvgString = `<svg class="pattern-dit" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="15" /></svg>`;
        this.dahSvgString = `<svg class="pattern-dah" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="10" rx="3"/></svg>`;

        // Initial Setup
        this._loadSettings();
        this._updateWpmDisplay(this.currentWpm);
        this._updateFrequencyDisplay(this.currentFrequency);
        this._updateVolumeSliderUI(this.currentVolume); // Update volume UI
        this._updateSpeakerIcon(this.currentVolume);     // Update speaker UI
        this._applyDarkMode(this.isDarkModeEnabled);
        this._applyHintVisibility(this.isHintVisible);
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
        // Ensure volume slider value reflects loaded state
        if (this.volumeSlider) {
            this.volumeSlider.value = this.currentVolume;
        }
        this._addGlobalEventListeners(); // Add global listeners for hint peek
    }

    // --- UI View Management ---
    _hideAllViews() {
        this.gameUiWrapper?.classList.add('hidden');
        this.gameUiWrapper?.classList.remove('results-active'); // Reset results state
        this.inputArea?.classList.add('hidden');
        this.playbackArea?.classList.add('hidden');
        this.sandboxArea?.classList.add('hidden');
        this.mainMenuOverlay?.classList.add('hidden');
        this.resultsScreen?.classList.add('hidden');
        this.levelSelectionScreen?.classList.add('hidden');
    }

    showMainMenu() {
        this._hideAllViews();
        this.mainMenuOverlay?.classList.remove('hidden');
        console.log("UI: Showing Main Menu");
    }

    showGameUI() {
         this._hideAllViews();
         this.gameUiWrapper?.classList.remove('hidden');
         this.gameUiWrapper?.classList.remove('results-active'); // Ensure not in results state
         this.inputArea?.classList.remove('hidden');
         this._applyHintVisibility(this.isHintVisible); // Apply current hint setting
         this.updatePaddleLabels('game'); // Set paddles to SVG mode
         console.log("UI: Showing Game/Sandbox Interface");
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
        this._hideAllViews(); // Hide everything else first
        this.levelSelectionScreen?.classList.remove('hidden'); // Show the level select overlay

        if (!this.levelListContainer || !this.levelSelectionScreen) {
            console.error("Level selection container or screen element not found!");
            return;
        }
        console.log("UI: Level Selection Screen element found, populating list...");

        this.levelListContainer.innerHTML = ''; // Clear previous list
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
    }

    hideLevelSelectionScreen() {
        this.levelSelectionScreen?.classList.add('hidden');
        console.log("UI: Hiding Level Selection Screen.");
    }

    /** Shows the results overlay and configures UI elements for results mode. */
    showResultsScreen(scores, unlockedLevelId, hasNextLevelOption, mode) {
        this._hideAllViews();
        this.resultsScreen?.classList.remove('hidden'); // Show results overlay
        this.inputArea?.classList.remove('hidden');     // Show paddles

        // Update results text content
        if (!this.resultsScreen) return;
        this.resultsTime.textContent = `Time: ${scores.elapsedTimeSeconds.toFixed(1)}s`;
        this.resultsNetWpm.textContent = `Net WPM: ${scores.netWpm.toFixed(1)}`;
        this.resultsGrossWpm.textContent = `Gross WPM: ${scores.grossWpm.toFixed(1)}`;
        this.resultsAccuracy.textContent = `Accuracy: ${scores.accuracy.toFixed(1)}%`;

        // Update Star Rating (visual example based on accuracy)
        this.updateStarRating(scores.accuracy);

        // Update Unlock Message & Level Select Button visibility
        if (mode === AppMode.GAME) {
            this.levelUnlockMessage.textContent = unlockedLevelId ? `Congratulations! Level ${unlockedLevelId} unlocked!` : '';
            this.levelUnlockMessage.style.display = unlockedLevelId ? 'block' : 'block'; // Keep space even if empty?
            if (this.levelSelectButton) this.levelSelectButton.style.display = 'inline-block';
        } else { // Sandbox
            this.levelUnlockMessage.textContent = '';
            this.levelUnlockMessage.style.display = 'none';
            if (this.levelSelectButton) this.levelSelectButton.style.display = 'none';
        }

        // Configure paddles for results mode (text labels)
        this.updatePaddleLabels('results', hasNextLevelOption, mode);
        console.log(`UI: Showing Results (Mode: ${mode})`);
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
            if (index < filledStars) {
                star.classList.add('filled');
                star.textContent = '★'; // Filled star character
            } else {
                star.classList.remove('filled');
                star.textContent = '☆'; // Empty star character
            }
        });
    }

    // --- Helper Functions ---
    _createPatternSvg(type) { return type === '.' ? this.ditSvgString : this.dahSvgString; }
    updateTargetPatternDisplay(morseSequence) { if (!this.targetPatternContainer) return; this.targetPatternContainer.innerHTML = ''; if (morseSequence) morseSequence.split('').forEach(el => { if (el === '.' || el === '-') this.targetPatternContainer.innerHTML += this._createPatternSvg(el); }); this._applyHintVisibility(this.isHintVisible); }
    updateUserPatternDisplay(morseSequence) { if (!this.userPatternContainer) return; this.userPatternContainer.innerHTML = ''; if (morseSequence) morseSequence.split('').forEach(el => { if (el === '.' || el === '-') this.userPatternContainer.innerHTML += this._createPatternSvg(el); }); }
    updatePlaybackMorseDisplay(formattedMorse) { if (this.playbackMorseDisplay) this.playbackMorseDisplay.textContent = formattedMorse || '\u00A0'; }
    updateSandboxMorsePreview(formattedMorse) { if (this.sandboxMorsePreview) this.sandboxMorsePreview.textContent = formattedMorse || '\u00A0'; }

    /**
     * Sets the visual state (default, correct, incorrect) for the pattern containers.
     * Applies feedback to both user and target containers.
     * Uses separate timeouts for correct and incorrect feedback.
     * @param {'default' | 'correct' | 'incorrect'} state - The state to apply.
     */
    setPatternDisplayState(state) {
        const containers = [this.userPatternContainer, this.targetPatternContainer];
        if (!containers[0] || !containers[1]) return;

        // Clear existing timeouts for the *other* states
        if (state !== 'correct' && this._correctPatternTimeout) {
            clearTimeout(this._correctPatternTimeout);
            this._correctPatternTimeout = null;
            containers.forEach(c => c?.classList.remove('correct-pattern'));
        }
        if (state !== 'incorrect' && this._incorrectPatternTimeout) {
            clearTimeout(this._incorrectPatternTimeout);
            this._incorrectPatternTimeout = null;
            containers.forEach(c => c?.classList.remove('incorrect-pattern'));
        }

        // Remove previous states explicitly before adding new one
        containers.forEach(c => {
            c?.classList.remove('correct-pattern', 'incorrect-pattern');
        });

        if (state === 'correct') {
            containers.forEach(c => c?.classList.add('correct-pattern'));
            this._correctPatternTimeout = setTimeout(() => {
                containers.forEach(c => c?.classList.remove('correct-pattern'));
                this._correctPatternTimeout = null;
            }, MorseConfig.INCORRECT_FLASH_DURATION); // Use same duration
        } else if (state === 'incorrect') {
            containers.forEach(c => c?.classList.add('incorrect-pattern'));
            this._incorrectPatternTimeout = setTimeout(() => {
                containers.forEach(c => c?.classList.remove('incorrect-pattern'));
                this._incorrectPatternTimeout = null;
            }, MorseConfig.INCORRECT_FLASH_DURATION);
        }
        // If state is 'default', classes are already removed
    }


    /**
     * Renders the sentence text into the display area.
     * @param {string} sentence - The sentence text.
     */
    renderSentence(sentence) {
        if (!this.textDisplay || !this.textDisplayWrapper) return;
        this.textDisplay.innerHTML = '';
        this.textDisplay.style.fontSize = ''; // Reset font size before adding content
        this.textDisplay.style.transform = 'translateX(0px)'; // Reset transform for centering logic
        this.textDisplayWrapper.scrollLeft = 0; // Reset scroll position

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
        this.resetCharacterStyles(); // Ensure all are pending
        this.updateUserPatternDisplay(""); // Clear user input
        this.setPatternDisplayState('default'); // Reset pattern feedback
        this._adjustTextDisplayFontSize(); // Adjust font size based on new content
    }

    /**
     * Adjusts the font size of the text display to fit vertically.
     * @private
     */
    _adjustTextDisplayFontSize() {
        const element = this.textDisplay;
        const container = this.textDisplayWrapper;
        if (!element || !container || !element.textContent) {
            if(element) element.style.fontSize = ''; // Reset if empty
            return;
        }

        element.style.fontSize = ''; // Reset to base size
        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const minFontSize = 10; // Minimum font size
        let iterations = 0;
        const maxIterations = 100; // Prevent infinite loops

        // Shrink font size until it fits vertically
        while (element.scrollHeight > container.clientHeight && currentFontSize > minFontSize && iterations < maxIterations) {
            currentFontSize *= 0.95; // Reduce font size by 5%
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

    /**
     * Updates the visual state of a specific character span.
     * Handles correct, incorrect (with flash), pending, and current states.
     * @param {number} charIndex - The index of the character to update.
     * @param {'pending' | 'current' | 'completed' | 'incorrect'} state - The new state.
     */
    updateCharacterState(charIndex, state) {
        const charSpan = this.textDisplay?.querySelector(`.char[data-index="${charIndex}"]`);
        if (charSpan) {
            // Clear existing state classes (except base 'char' and 'space')
            charSpan.classList.remove('pending', 'current', 'completed', 'incorrect');
            // Add the new state class
            charSpan.classList.add(state);

            // Handle incorrect flash timeout for the character span
            if (state === 'incorrect') {
                if (this._incorrectFlashTimeout) clearTimeout(this._incorrectFlashTimeout);
                this._incorrectFlashTimeout = setTimeout(() => {
                    if (charSpan.classList.contains('incorrect')) {
                        charSpan.classList.remove('incorrect');
                        const currentGameState = window.morseGameState;
                        // Check if this is still the current character before reverting to 'current'
                        if (currentGameState && currentGameState.currentCharIndex === charIndex &&
                            (currentGameState.isPlaying() || currentGameState.status === GameStatus.READY || currentGameState.status === GameStatus.LISTENING)) {
                            charSpan.classList.add('current');
                        } else {
                            // If it's no longer the current character (e.g., user progressed fast), revert to pending
                            charSpan.classList.add('pending');
                        }
                    }
                    this._incorrectFlashTimeout = null;
                }, MorseConfig.INCORRECT_FLASH_DURATION);
            } else if (this._incorrectFlashTimeout && charSpan.classList.contains('incorrect')) {
                // If state changes *from* incorrect (e.g., user types correct immediately after), clear timeout
                clearTimeout(this._incorrectFlashTimeout);
                this._incorrectFlashTimeout = null;
            }

            // Center the character if it becomes the current one
            if (state === 'current') {
                this._centerCurrentCharacterHorizontally(charSpan);
            }
        }
    }


    /**
     * Highlights the next character, updates the target pattern, and clears user input.
     * @param {number} currentIdx - The index of the character to highlight.
     * @param {string} targetChar - The actual character to highlight (raw case).
     */
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

        if (window.morseDecoder) {
            const morseSequence = window.morseDecoder.encodeCharacter(targetChar);
            this.updateTargetPatternDisplay(morseSequence ?? "");
        }

        this.updateUserPatternDisplay("");
        this.setPatternDisplayState('default'); // Reset pattern feedback
    }

    /**
     * Scrolls the text display wrapper horizontally to keep the current character centered.
     * @param {HTMLElement} element - The currently highlighted character span.
     * @private
     */
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
                    behavior: 'smooth' // Use smooth scrolling
                });
            }
        });
    }

    // --- Stat Updates ---
    updateTimer(elapsedTimeMs) { const totalSeconds = Math.floor(elapsedTimeMs / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const milliseconds = Math.floor((elapsedTimeMs % 1000) / 100); const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds)}`; if (this.timerDisplay) this.timerDisplay.textContent = `Time: ${formattedTime}`; }
    updateWpmDisplay(netWpm) { if(this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: ${netWpm.toFixed(0)}`; }
    updateAccuracyDisplay(accuracy) { if(this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: ${accuracy.toFixed(1)}%`; }
    updateGrossWpmDisplay(grossWpm) { if(this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: ${grossWpm.toFixed(0)}`; }
    resetStatsDisplay() { this.updateTimer(0); this.updateWpmDisplay(0); this.updateAccuracyDisplay(100); this.updateGrossWpmDisplay(0); this.updateTargetPatternDisplay(""); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._applyHintVisibility(this.isHintVisible); }

    // --- Settings ---
    _updateWpmDisplay(wpm) { if(this.wpmValueDisplay) this.wpmValueDisplay.textContent = wpm; }
    _updateFrequencyDisplay(freq) { if(this.frequencyValueDisplay) this.frequencyValueDisplay.textContent = freq; }

    // --- Volume UI Updates ---
    /**
     * Updates the visual appearance of the volume slider's position.
     * @param {number} volume - Volume level (0.0 to 1.0).
     * @private
     */
    _updateVolumeSliderUI(volume) {
        if (this.volumeSlider) {
            this.volumeSlider.value = volume;
        }
    }

    /**
     * Updates the speaker icon display based on the volume level.
     * @param {number} volume - Volume level (0.0 to 1.0).
     * @private
     */
    _updateSpeakerIcon(volume) {
        const waves = [this.speakerWave1, this.speakerWave2, this.speakerWave3];
        waves.forEach(wave => { if (wave) wave.style.display = 'none'; });

        if (volume > 0.7) {
            if (this.speakerWave3) this.speakerWave3.style.display = 'inline';
        }
        if (volume > 0.3) { // Also show wave 2 if volume > 0.3
            if (this.speakerWave2) this.speakerWave2.style.display = 'inline';
        }
        if (volume > 0) { // Also show wave 1 if volume > 0
            if (this.speakerWave1) this.speakerWave1.style.display = 'inline';
        }
        // If volume is 0, all waves remain hidden.
    }
    // --- End Volume UI Updates ---

    _saveSettings() {
         try {
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM, this.currentWpm);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND, this.isSoundEnabled);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE, this.isDarkModeEnabled);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY, this.currentFrequency);
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE, this.isHintVisible); // Save hint toggle state
             localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_VOLUME, this.currentVolume); // Save volume
             console.log("Settings Saved:", { wpm: this.currentWpm, sound: this.isSoundEnabled, dark: this.isDarkModeEnabled, freq: this.currentFrequency, hint: this.isHintVisible, volume: this.currentVolume });
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
            const savedHintVisible = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE); // Load hint
            const savedVolume = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_VOLUME); // Load volume

            this.currentWpm = savedWpm !== null ? parseInt(savedWpm, 10) : MorseConfig.DEFAULT_WPM;
            this.isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : true;
            this.isDarkModeEnabled = savedDarkMode !== null ? JSON.parse(savedDarkMode) : false;
            this.currentFrequency = savedFrequency !== null ? parseInt(savedFrequency, 10) : MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
            this.isHintVisible = savedHintVisible !== null ? JSON.parse(savedHintVisible) : MorseConfig.HINT_DEFAULT_VISIBLE; // Load hint state
            this.currentVolume = savedVolume !== null ? parseFloat(savedVolume) : MorseConfig.AUDIO_DEFAULT_VOLUME; // Load volume state

            // Clamp frequency and volume to valid ranges
            this.currentFrequency = Math.max(MorseConfig.AUDIO_MIN_FREQUENCY, Math.min(MorseConfig.AUDIO_MAX_FREQUENCY, this.currentFrequency));
            this.currentVolume = Math.max(0.0, Math.min(1.0, this.currentVolume));

            console.log("Settings Loaded:", { wpm: this.currentWpm, sound: this.isSoundEnabled, dark: this.isDarkModeEnabled, freq: this.currentFrequency, hint: this.isHintVisible, volume: this.currentVolume });
        } catch (e) {
            console.error("Error loading settings:", e);
            this.currentWpm = MorseConfig.DEFAULT_WPM;
            this.isSoundEnabled = true;
            this.isDarkModeEnabled = false;
            this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
            this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE; // Default hint state on error
            this.currentVolume = MorseConfig.AUDIO_DEFAULT_VOLUME; // Default volume on error
        }
        // Update UI elements to reflect loaded state (done in constructor)
    }

    setButtonActive(buttonType, isActive) { const button = buttonType === 'dit' ? this.ditButton : this.dahButton; if (button) button.classList.toggle('active', isActive); }

    /** Updates paddle content for game vs results mode. */
    updatePaddleLabels(mode, hasNextLevel = false, gameMode = AppMode.GAME) {
        const buttons = [this.ditButton, this.dahButton];
        const labels = [this.ditPaddleLabel, this.dahPaddleLabel];
        const svgs = [this.ditPaddleSvg, this.dahPaddleSvg];

        if (!buttons[0] || !buttons[1] || !labels[0] || !labels[1] || !svgs[0] || !svgs[1]) return;

        if (mode === 'results') {
            // Swap: DAH = Next, DIT = Retry
            labels[0].textContent = "Retry"; // Dit = Retry
            labels[1].textContent = "Next"; // Dah = Next
            const isNextDisabled = (gameMode === AppMode.SANDBOX || !hasNextLevel);
            buttons[0].disabled = false; // Retry is always enabled
            buttons[1].disabled = isNextDisabled; // Next might be disabled
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

    /**
     * Applies the visual hint visibility state, respecting the peek state.
     * @param {boolean} visible - The desired visibility state (true for visible, false for hidden).
     * @private
     */
    _applyHintVisibility(visible) {
        // Ignore if Control is held and we're trying to apply the non-peek state
        if (this.isControlHeld && visible !== this.hintWasVisibleBeforePeek) {
            // Currently peeking, apply the temporary peek state instead
            this.targetPatternOuterWrapper?.classList.toggle('hint-hidden', false); // Force visible during peek
        } else {
            // Not peeking, or applying the original state after peek, apply normally
            this.targetPatternOuterWrapper?.classList.toggle('hint-hidden', !visible);
        }
         // Update ARIA attribute based on the *intended* persistent state (isHintVisible)
        this.toggleHintButton?.setAttribute('aria-pressed', String(this.isHintVisible));
    }


    /**
     * Handles the global keydown event, primarily for hint peeking.
     * @param {KeyboardEvent} event - The keydown event.
     * @private
     */
     _handleGlobalKeyDown(event) {
        // Ignore if focus is on an input field, text area, or settings modal is open
        const targetElement = event.target;
        const isInputFocused = targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA';
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');
        // Only peek if game UI is visible
        const isGameVisible = this.gameUiWrapper && !this.gameUiWrapper.classList.contains('hidden');

        if (isInputFocused || isSettingsOpen || !isGameVisible) {
            return;
        }

        // Hint Peek Logic
        if (event.key === 'Control' && !this.isControlHeld) {
            this.isControlHeld = true;
            this.hintWasVisibleBeforePeek = this.isHintVisible; // Store original state
            if (!this.hintWasVisibleBeforePeek) {
                // console.log("Peek: Showing hint"); // Debug
                this._applyHintVisibility(true); // Temporarily show if it was hidden
            }
            // If it was already visible, we don't do anything on keydown, only on keyup
        }
    }

    /**
     * Handles the global keyup event, primarily for hint peeking.
     * @param {KeyboardEvent} event - The keyup event.
     * @private
     */
    _handleGlobalKeyUp(event) {
         // Hint Peek Logic
         if (event.key === 'Control') {
            if (this.isControlHeld) { // Only act if we were tracking the hold
                 this.isControlHeld = false;
                 if (!this.hintWasVisibleBeforePeek) {
                     // console.log("Peek End: Hiding hint"); // Debug
                     // It was hidden, peeked, now hide it again
                     this._applyHintVisibility(false);
                 } else {
                     // console.log("Peek End: Toggling hint OFF"); // Debug
                     // It was visible, user held/released Ctrl, so toggle it OFF
                     this.isHintVisible = false;
                     this._saveSettings(); // Save the new OFF state
                     this._applyHintVisibility(false);
                     // Optional: Notify main.js if needed
                     if (this.callbacks && this.callbacks.onHintToggle) this.callbacks.onHintToggle(this.isHintVisible);
                 }
            }
         }
    }


    /**
     * Adds global event listeners needed by the UI manager (e.g., hint peek).
     * @private
     */
    _addGlobalEventListeners() {
        document.addEventListener('keydown', this._handleGlobalKeyDown.bind(this));
        document.addEventListener('keyup', this._handleGlobalKeyUp.bind(this));
        // Add listeners to remove focus from volume slider
        this.volumeSlider?.addEventListener('mouseup', () => this.volumeSlider.blur());
        this.volumeSlider?.addEventListener('touchend', () => this.volumeSlider.blur());
    }


    addEventListeners(callbacks) {
        this.callbacks = callbacks; // Store callbacks for hint peek logic

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

        // Results Screen Buttons
        this.levelSelectButton?.addEventListener('click', callbacks.onShowLevelSelect);
        this.resultsMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Settings Modal Content
        this.wpmSlider?.addEventListener('input', (e) => this._updateWpmDisplay(parseInt(e.target.value, 10)));
        this.wpmSlider?.addEventListener('change', (e) => { this.currentWpm = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onWpmChange) callbacks.onWpmChange(this.currentWpm); });
        this.frequencySlider?.addEventListener('input', (e) => this._updateFrequencyDisplay(parseInt(e.target.value, 10)));
        this.frequencySlider?.addEventListener('change', (e) => { this.currentFrequency = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onFrequencyChange) callbacks.onFrequencyChange(this.currentFrequency); });
        this.soundToggle?.addEventListener('change', (e) => { this.isSoundEnabled = e.target.checked; this._saveSettings(); if (callbacks.onSoundToggle) callbacks.onSoundToggle(this.isSoundEnabled); });
        this.darkModeToggle?.addEventListener('change', (e) => { this.isDarkModeEnabled = e.target.checked; this._applyDarkMode(this.isDarkModeEnabled); this._saveSettings(); if (callbacks.onDarkModeToggle) callbacks.onDarkModeToggle(this.isDarkModeEnabled); });
        this.resetProgressButton?.addEventListener('click', () => { if (callbacks.onResetProgress) callbacks.onResetProgress(); });

        // Volume Slider (Game UI)
         this.volumeSlider?.addEventListener('input', (e) => {
             const newVolume = parseFloat(e.target.value);
             this._updateSpeakerIcon(newVolume); // Update icon immediately on input
             // Pass intermediate value for immediate audio feedback if desired
             if (callbacks.onVolumeChange) { // Use the existing callback name
                 callbacks.onVolumeChange(newVolume);
             }
         });
         this.volumeSlider?.addEventListener('change', (e) => {
             const newVolume = parseFloat(e.target.value);
             this.currentVolume = newVolume;
             this._saveSettings(); // Save final value on change
             // Final update call might be redundant if 'input' already called it,
             // but ensures the final saved value is applied.
             if (callbacks.onVolumeChange) {
                 callbacks.onVolumeChange(this.currentVolume);
             }
         });

        // Game UI
        this.toggleHintButton?.addEventListener('click', () => {
            this.isHintVisible = !this.isHintVisible; // Toggle the *actual* state
            this._saveSettings(); // Save the new state
            this._applyHintVisibility(this.isHintVisible); // Apply the visual change
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
            }, 150);
        });

        console.log("UI Event Listeners Added.");
    }

    // --- Getters for Initial State ---
    getInitialWpm() { return this.currentWpm; }
    getInitialSoundState() { return this.isSoundEnabled; }
    getInitialDarkModeState() { return this.isDarkModeEnabled; }
    getInitialFrequency() { return this.currentFrequency; }
    getInitialHintState() { return this.isHintVisible; }
    getInitialVolume() { return this.currentVolume; } // Added getter for volume
    getPlaybackSentence() { return this.playbackInput ? this.playbackInput.value : ""; }
    getSandboxSentence() { return this.sandboxInput ? this.sandboxInput.value : ""; }
}

// Create global instance
window.morseUIManager = new UIManager();
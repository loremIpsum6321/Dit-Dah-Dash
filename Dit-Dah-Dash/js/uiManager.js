/**
 * js/uiManager.js
 * ---------------
 * Handles DOM interactions, manages UI visibility for different views, updates displays,
 * manages settings UI (WPM, Frequency, Sound, Dark Mode, Hint Visibility),
 * applies theme, and sets up event listeners. Includes auto-scrolling and dynamic font sizing.
 */

class UIManager {
    /**
     * Initializes the UIManager by getting references to key DOM elements.
     */
    constructor() {
        // Core Containers / Wrappers
        this.bodyElement = document.body;
        this.gameContainer = document.getElementById('game-container');
        this.gameUiWrapper = document.getElementById('game-ui-wrapper');
        this.playbackArea = document.getElementById('playback-area');
        this.sandboxArea = document.getElementById('sandbox-area');
        this.inputArea = document.getElementById('input-area');

        // Main Menu Elements
        this.mainMenuOverlay = document.getElementById('main-menu-overlay');
        this.startGameButton = document.getElementById('start-game-button');
        this.showSandboxButton = document.getElementById('show-sandbox-button');
        this.showPlaybackButton = document.getElementById('show-playback-button');

        // Game Mode Elements
        this.textDisplayWrapper = document.getElementById('text-display-wrapper');
        this.textDisplay = document.getElementById('text-display');
        this.targetPatternContainer = document.getElementById('target-pattern-container');
        this.toggleHintButton = document.getElementById('toggle-hint-button'); // New
        this.userPatternContainer = document.getElementById('user-pattern-container');
        this.statsDisplay = document.getElementById('stats-display');
        this.timerDisplay = document.getElementById('timer-display');
        this.wpmDisplay = document.getElementById('wpm-display');
        this.accuracyDisplay = document.getElementById('accuracy-display');
        this.grossWpmDisplay = document.getElementById('gross-wpm-display');
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');

        // Playback Mode Elements
        this.playbackInput = document.getElementById('playback-input');
        this.playSentenceButton = document.getElementById('play-sentence-button');
        this.playbackMorseDisplay = document.getElementById('playback-morse-display');
        this.playbackBackButton = document.getElementById('playback-back-button');

        // Sandbox Mode Elements
        this.sandboxInput = document.getElementById('sandbox-input');
        this.startSandboxButton = document.getElementById('start-sandbox-button');
        this.sandboxMorsePreview = document.getElementById('sandbox-morse-preview');
        this.sandboxBackButton = document.getElementById('sandbox-back-button');

        // Settings Elements
        this.settingsArea = document.getElementById('settings-area');
        this.settingsToggleButton = document.getElementById('settings-toggle-button');
        this.settingsControls = document.getElementById('settings-controls');
        this.wpmSlider = document.getElementById('wpm-slider');
        this.wpmValueDisplay = document.getElementById('wpm-value-display');
        this.frequencySlider = document.getElementById('frequency-slider');
        this.frequencyValueDisplay = document.getElementById('frequency-value-display');
        this.soundToggle = document.getElementById('sound-toggle');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.resetProgressButton = document.getElementById('reset-progress-button');

        // Overlay Screens
        this.resultsScreen = document.getElementById('results-screen');
        this.levelSelectionScreen = document.getElementById('level-selection-screen');

        // Results Screen Elements
        this.resultsTime = document.getElementById('results-time');
        this.resultsNetWpm = document.getElementById('results-net-wpm');
        this.resultsGrossWpm = document.getElementById('results-gross-wpm');
        this.resultsAccuracy = document.getElementById('results-accuracy');
        this.levelUnlockMessage = document.getElementById('level-unlock-message');
        this.nextLevelButton = document.getElementById('next-level-button');
        this.retryButton = document.getElementById('retry-button');
        this.levelSelectButton = document.getElementById('level-select-button');
        this.mainMenuResultsButton = document.getElementById('main-menu-results-button');

        // Level Selection Screen Elements
        this.levelListContainer = document.getElementById('level-list');
        this.levelSelectBackButton = document.getElementById('level-select-back-button');

        // Internal state
        this.currentWpm = MorseConfig.DEFAULT_WPM;
        this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
        this.isSoundEnabled = true;
        this.isDarkModeEnabled = false;
        this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE; // New state for hint visibility
        this._incorrectFlashTimeout = null;
        this._feedbackTimeout = null;

        // SVG Templates
        this.ditSvgString = `<svg class="pattern-dit" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="15" /></svg>`;
        this.dahSvgString = `<svg class="pattern-dah" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="10" rx="3"/></svg>`;

        // Initial setup
        this._loadSettings(); // Load all settings
        this._updateWpmDisplay(this.currentWpm);
        this._updateFrequencyDisplay(this.currentFrequency);
        this._applyDarkMode(this.isDarkModeEnabled);
        this._applyHintVisibility(this.isHintVisible); // Apply initial hint visibility
        this.soundToggle.checked = this.isSoundEnabled;
        this.darkModeToggle.checked = this.isDarkModeEnabled;

        // Setup dynamic slider ranges
        if (this.frequencySlider) {
            this.frequencySlider.min = MorseConfig.AUDIO_MIN_FREQUENCY;
            this.frequencySlider.max = MorseConfig.AUDIO_MAX_FREQUENCY;
            this.frequencySlider.value = this.currentFrequency;
        }
    }

    // --- UI View Management ---

    /** Hides all primary views and overlays. */
    _hideAllViews() {
        this.gameUiWrapper?.classList.add('hidden');
        this.inputArea?.classList.add('hidden');
        this.playbackArea?.classList.add('hidden');
        this.sandboxArea?.classList.add('hidden');
        this.mainMenuOverlay?.classList.add('hidden');
        this.resultsScreen?.classList.add('hidden');
        this.levelSelectionScreen?.classList.add('hidden');
        this.hideSettings();
    }

    /** Shows the Main Menu overlay. */
    showMainMenu() {
        this._hideAllViews();
        this.mainMenuOverlay?.classList.remove('hidden');
        this.settingsArea?.classList.add('hidden');
        console.log("UI: Showing Main Menu");
    }

    /** Shows the core Game UI elements (used for Game and Sandbox modes). */
    showGameUI() {
         this._hideAllViews();
         this.gameUiWrapper?.classList.remove('hidden');
         this.inputArea?.classList.remove('hidden');
         this.settingsArea?.classList.remove('hidden');
         this._applyHintVisibility(this.isHintVisible); // Ensure hint visibility is correct when showing game UI
         console.log("UI: Showing Game/Sandbox Interface");
    }

    /** Shows the Sentence Playback UI. */
    showPlaybackUI() {
        this._hideAllViews();
        this.playbackArea?.classList.remove('hidden');
        this.settingsArea?.classList.remove('hidden');
        this.setPlaybackButtonEnabled(true, 'Play Morse');
        this.updatePlaybackMorseDisplay("");
        this.playbackInput.value = '';
        console.log("UI: Showing Playback Interface");
    }

    /** Shows the Sandbox Setup UI. */
    showSandboxUI() {
        this._hideAllViews();
        this.sandboxArea?.classList.remove('hidden');
        this.settingsArea?.classList.remove('hidden');
        this.updateSandboxMorsePreview("");
        this.sandboxInput.value = '';
        this.sandboxInput?.focus();
        console.log("UI: Showing Sandbox Setup Interface");
    }

    /** Shows the Level Selection screen overlay. */
    showLevelSelectionScreen(levelsWithStatus) {
        this._hideAllViews();
        this.settingsArea?.classList.remove('hidden');

        if (!this.levelListContainer) return;
        this.levelListContainer.innerHTML = '';
        levelsWithStatus.forEach(level => {
             const button = document.createElement('button');
             button.textContent = `Level ${level.id}: ${level.name}`;
             button.dataset.levelId = level.id;
             button.classList.add('level-button');
             if (level.isUnlocked) {
                 button.disabled = false;
                 button.classList.add(level.highScore ? 'completed' : 'unlocked');
                 button.title = level.highScore ? `High Score: ${level.highScore.score} WPM, ${level.highScore.accuracy}% Acc` : 'Unlocked';
             } else {
                 button.disabled = true;
                 button.classList.add('locked');
                 button.title = level.unlock_criteria ? `Requires ${level.unlock_criteria.min_wpm} WPM & ${level.unlock_criteria.min_accuracy}% Accuracy on Level ${level.id - 1}` : 'Locked';
             }
             this.levelListContainer.appendChild(button);
        });

        this.levelSelectionScreen?.classList.remove('hidden');
        console.log("UI: Showing Level Selection");
    }

     /** Hides the Level Selection screen overlay. */
     hideLevelSelectionScreen() {
         this.levelSelectionScreen?.classList.add('hidden');
     }

    /** Shows the Results screen overlay. */
    showResultsScreen(scores, unlockedLevelId, hasNextLevelOption, mode) {
         this._hideAllViews();
         this.settingsArea?.classList.remove('hidden');

        if (!this.resultsScreen) return;
        this.resultsTime.textContent = `Time: ${scores.elapsedTimeSeconds.toFixed(1)}s`;
        this.resultsNetWpm.textContent = `Net WPM: ${scores.netWpm.toFixed(1)}`;
        this.resultsGrossWpm.textContent = `Gross WPM: ${scores.grossWpm.toFixed(1)}`;
        this.resultsAccuracy.textContent = `Accuracy: ${scores.accuracy.toFixed(1)}%`;

        if (mode === AppMode.GAME) {
            this.levelUnlockMessage.textContent = unlockedLevelId ? `Congratulations! Level ${unlockedLevelId} unlocked!` : '';
            this.levelUnlockMessage.style.display = unlockedLevelId ? 'block' : 'none';
            this.nextLevelButton.style.display = hasNextLevelOption ? 'inline-block' : 'none';
            this.levelSelectButton.style.display = 'inline-block';
        } else {
            this.levelUnlockMessage.style.display = 'none';
            this.nextLevelButton.style.display = 'none';
            this.levelSelectButton.style.display = 'none';
        }

        this.retryButton.style.display = 'inline-block';
        this.mainMenuResultsButton.style.display = 'inline-block';

        this.resultsScreen.classList.remove('hidden');
        console.log(`UI: Showing Results Screen (Mode: ${mode})`);
    }

    /** Hides the Results screen overlay. */
    hideResultsScreen() {
        this.resultsScreen?.classList.add('hidden');
    }

    // --- Helper Functions ---

    /** Creates an SVG element string ('dit' or 'dah'). */
    _createPatternSvg(type) { return type === '.' ? this.ditSvgString : this.dahSvgString; }
    /** Updates the target Morse pattern display (SVGs always added, CSS controls visibility via class). */
    updateTargetPatternDisplay(morseSequence) { if (!this.targetPatternContainer) return; this.targetPatternContainer.innerHTML = ''; if (morseSequence) morseSequence.split('').forEach(el => { if (el === '.' || el === '-') this.targetPatternContainer.innerHTML += this._createPatternSvg(el); }); this._applyHintVisibility(this.isHintVisible); /* Re-apply visibility class */ }
    /** Updates the user's input Morse pattern display. */
    updateUserPatternDisplay(morseSequence) { if (!this.userPatternContainer) return; this.userPatternContainer.innerHTML = ''; if (morseSequence) morseSequence.split('').forEach(el => { if (el === '.' || el === '-') this.userPatternContainer.innerHTML += this._createPatternSvg(el); }); }
    /** Updates the playback Morse display area. */
    updatePlaybackMorseDisplay(formattedMorse) { if (this.playbackMorseDisplay) this.playbackMorseDisplay.textContent = formattedMorse || '\u00A0'; }
    /** Updates the sandbox Morse preview area. */
    updateSandboxMorsePreview(formattedMorse) { if (this.sandboxMorsePreview) this.sandboxMorsePreview.textContent = formattedMorse || '\u00A0'; }
    /** Sets visual feedback state for pattern displays. */
    setPatternDisplayState(state) { if (!this.targetPatternContainer || !this.userPatternContainer) return; if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout); const containers = [this.targetPatternContainer, this.userPatternContainer]; containers.forEach(c => c.classList.remove('correct-pattern', 'incorrect-pattern')); if (state === 'correct' || state === 'incorrect') { const className = state === 'correct' ? 'correct-pattern' : 'incorrect-pattern'; containers.forEach(c => c.classList.add(className)); this._feedbackTimeout = setTimeout(() => { containers.forEach(c => c.classList.remove(className)); this._feedbackTimeout = null; }, MorseConfig.INCORRECT_FLASH_DURATION); } }
    /** Renders the sentence text. */
    renderSentence(sentence) {
         if (!this.textDisplay) return;
         this.textDisplay.innerHTML = '';
         // Reset font size before adding new content
         this.textDisplay.style.fontSize = ''; // Use CSS default

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

         // Adjust font size after content is rendered
         this._adjustTextDisplayFontSize();
    }

    /**
     * Dynamically adjusts the font size of the text display to fit the container.
     * @private
     */
    _adjustTextDisplayFontSize() {
        const element = this.textDisplay;
        const container = this.textDisplayWrapper;

        if (!element || !container || !element.textContent) {
            element.style.fontSize = ''; // Reset if no content
            return;
        }

        // Resetting ensures we start from the CSS-defined size or inherit
        element.style.fontSize = '';

        let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize);
        const minFontSize = 10; // Minimum font size in pixels to prevent tiny text
        let iterations = 0;
        const maxIterations = 100; // Prevent infinite loops

        // Temporarily allow potential overflow to measure correctly
        const originalOverflow = container.style.overflow;
        container.style.overflow = 'visible';
        element.style.whiteSpace = 'nowrap'; // Check width first

        // Check width overflow (more common with long words)
        while (element.scrollWidth > container.clientWidth && currentFontSize > minFontSize && iterations < maxIterations) {
            currentFontSize *= 0.95; // Reduce font size
            element.style.fontSize = `${currentFontSize}px`;
            iterations++;
        }

        // Check height overflow (after width is potentially adjusted)
        element.style.whiteSpace = 'pre-wrap'; // Reset white-space for height check
        iterations = 0; // Reset iterations for height check
        while (element.scrollHeight > container.clientHeight && currentFontSize > minFontSize && iterations < maxIterations) {
            currentFontSize *= 0.95; // Reduce font size
            element.style.fontSize = `${currentFontSize}px`;
            iterations++;
        }

        // Restore original overflow style
        container.style.overflow = originalOverflow;

        if (iterations >= maxIterations) {
            console.warn("Max font size adjustment iterations reached.");
        }
         console.log(`Adjusted font size to: ${currentFontSize.toFixed(2)}px`);
    }

    /** Resets character spans to 'pending'. */
    resetCharacterStyles() { this.textDisplay?.querySelectorAll('.char').forEach(span => { span.className = 'char pending'; if (span.textContent === ' ') span.classList.add('space'); }); }
    /** Updates visual state of a character span. */
    updateCharacterState(charIndex, state) { const charSpan = this.textDisplay?.querySelector(`.char[data-index="${charIndex}"]`); if (charSpan) { charSpan.classList.remove('pending', 'current', 'completed', 'incorrect'); charSpan.classList.add(state); if (state === 'incorrect') { if (this._incorrectFlashTimeout) clearTimeout(this._incorrectFlashTimeout); this._incorrectFlashTimeout = setTimeout(() => { if (charSpan.classList.contains('incorrect')) { charSpan.classList.remove('incorrect'); const currentGameState = window.morseGameState; if (currentGameState && currentGameState.currentCharIndex === charIndex && (currentGameState.status === GameStatus.LISTENING || currentGameState.status === GameStatus.TYPING || currentGameState.status === GameStatus.DECODING)) { charSpan.classList.add('current'); } else { charSpan.classList.add('pending'); } } this._incorrectFlashTimeout = null; }, MorseConfig.INCORRECT_FLASH_DURATION); } else if (this._incorrectFlashTimeout && charSpan.classList.contains('incorrect')) { clearTimeout(this._incorrectFlashTimeout); this._incorrectFlashTimeout = null; } if (state === 'current') this._scrollIntoViewIfNeeded(charSpan); } }
    /** Highlights character and updates target pattern. */
    highlightCharacter(currentIdx, targetChar) { const prevSpan = this.textDisplay?.querySelector('.char.current'); if (prevSpan && prevSpan.dataset.index != currentIdx) { if (!prevSpan.classList.contains('incorrect') && !prevSpan.classList.contains('completed')) { prevSpan.classList.remove('current'); prevSpan.classList.add('pending'); } else { prevSpan.classList.remove('current'); } } this.updateCharacterState(currentIdx, 'current'); if (window.morseDecoder) { const morseSequence = window.morseDecoder.encodeCharacter(targetChar); this.updateTargetPatternDisplay(morseSequence ?? ""); } this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); }
    /** Scrolls the text display wrapper to ensure the element is visible. */
    _scrollIntoViewIfNeeded(element) { const container = this.textDisplayWrapper; if (!container || !element) return; const elementRect = element.getBoundingClientRect(); const containerRect = container.getBoundingClientRect(); if (elementRect.top < containerRect.top || elementRect.bottom > containerRect.bottom) { element.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } }
    /** Updates live timer display. */
    updateTimer(elapsedTimeMs) { const totalSeconds = Math.floor(elapsedTimeMs / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const milliseconds = Math.floor((elapsedTimeMs % 1000) / 100); const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds)}`; if (this.timerDisplay) this.timerDisplay.textContent = `Time: ${formattedTime}`; }
    /** Updates live WPM/Accuracy displays. */
    updateLiveStats(gameState) { const charsDone = gameState.correctChars; const totalAttempts = charsDone + gameState.incorrectAttempts; const accuracy = totalAttempts > 0 ? Math.max(0, Math.min(100, (charsDone / (charsDone + gameState.incorrectAttempts * MorseConfig.INCORRECT_ATTEMPT_PENALTY)) * 100)) : 100; const elapsedSeconds = gameState.getCurrentElapsedTime() / 1000; let liveNetWpm = 0, liveGrossWpm = 0; if (elapsedSeconds > 1 && charsDone > 0) { liveGrossWpm = (charsDone / MorseConfig.PARIS_STANDARD_WORD_LENGTH) / (elapsedSeconds / 60); liveNetWpm = liveGrossWpm * (accuracy / 100); } if (this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: ${liveNetWpm.toFixed(0)}`; if (this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: ${accuracy.toFixed(1)}%`; if (this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: ${liveGrossWpm.toFixed(0)}`; }
    /** Resets stats and pattern displays. */
    resetStatsDisplay() { this.updateTimer(0); if(this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: 0`; if(this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: 100%`; if(this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: 0`; this.updateTargetPatternDisplay(""); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._applyHintVisibility(this.isHintVisible); /* Reset hint visibility too */ }
    /** Toggles settings panel visibility. */
    toggleSettings() { this.settingsControls?.classList.toggle('hidden'); }
    /** Hides settings panel. */
    hideSettings() { this.settingsControls?.classList.add('hidden'); }
    /** Updates displayed WPM value. */
    _updateWpmDisplay(wpm) { if(this.wpmValueDisplay) this.wpmValueDisplay.textContent = wpm; }
    /** Updates displayed Frequency value. */
    _updateFrequencyDisplay(freq) { if(this.frequencyValueDisplay) this.frequencyValueDisplay.textContent = freq; }
    /** Saves settings to localStorage. */
    _saveSettings() { try { localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM, this.currentWpm); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND, this.isSoundEnabled); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE, this.isDarkModeEnabled); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY, this.currentFrequency); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE, this.isHintVisible); } catch (e) { console.error("Error saving settings:", e); } }
    /** Loads settings from localStorage. */
    _loadSettings() { try { const savedWpm = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM); const savedSound = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND); const savedDarkMode = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE); const savedFrequency = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY); const savedHintVisible = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE); // New
         this.currentWpm = savedWpm !== null ? parseInt(savedWpm, 10) : MorseConfig.DEFAULT_WPM;
         this.isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : true;
         this.isDarkModeEnabled = savedDarkMode !== null ? JSON.parse(savedDarkMode) : false;
         this.currentFrequency = savedFrequency !== null ? parseInt(savedFrequency, 10) : MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
         this.isHintVisible = savedHintVisible !== null ? JSON.parse(savedHintVisible) : MorseConfig.HINT_DEFAULT_VISIBLE; // New

         this.currentFrequency = Math.max(MorseConfig.AUDIO_MIN_FREQUENCY, Math.min(MorseConfig.AUDIO_MAX_FREQUENCY, this.currentFrequency));

         if (this.wpmSlider) this.wpmSlider.value = this.currentWpm;
         if (this.soundToggle) this.soundToggle.checked = this.isSoundEnabled;
         if (this.darkModeToggle) this.darkModeToggle.checked = this.isDarkModeEnabled;
         if (this.frequencySlider) this.frequencySlider.value = this.currentFrequency;
         // Note: Hint visibility has no checkbox in settings, just the eye icon

         this._updateWpmDisplay(this.currentWpm);
         this._updateFrequencyDisplay(this.currentFrequency); } catch (e) { console.error("Error loading settings:", e); // Use defaults on error
         this.currentWpm = MorseConfig.DEFAULT_WPM;
         this.isSoundEnabled = true;
         this.isDarkModeEnabled = false;
         this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
         this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE;

         if (this.wpmSlider) this.wpmSlider.value = this.currentWpm;
         if (this.soundToggle) this.soundToggle.checked = this.isSoundEnabled;
         if (this.darkModeToggle) this.darkModeToggle.checked = this.isDarkModeEnabled;
         if (this.frequencySlider) this.frequencySlider.value = this.currentFrequency;
         this._updateWpmDisplay(this.currentWpm);
         this._updateFrequencyDisplay(this.currentFrequency); } }
    /** Sets active state for dit/dah buttons. */
    setButtonActive(buttonType, isActive) { const button = (buttonType === 'dit') ? this.ditButton : this.dahButton; if (button) button.classList.toggle('active', isActive); }
    /** Disables or enables the Play Sentence button, updates text. */
    setPlaybackButtonEnabled(enabled, text = 'Play Morse') { if (this.playSentenceButton) { this.playSentenceButton.disabled = !enabled; this.playSentenceButton.textContent = text; } }
    /** Applies or removes the dark mode class from the body. */
    _applyDarkMode(enable) { this.bodyElement.classList.toggle('dark-mode', enable); }
    /** Applies or removes the hint visibility class from the target pattern container. */
    _applyHintVisibility(visible) { this.targetPatternContainer?.classList.toggle('hint-hidden', !visible); } // New

    /** Adds event listeners for UI elements. */
    addEventListeners(callbacks) {
        // Main Menu
        this.startGameButton?.addEventListener('click', callbacks.onShowLevelSelect);
        this.showSandboxButton?.addEventListener('click', callbacks.onShowSandbox);
        this.showPlaybackButton?.addEventListener('click', callbacks.onShowPlayback);

        // Playback
        this.playSentenceButton?.addEventListener('click', callbacks.onPlaySentence);
        this.playbackBackButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Sandbox
        this.startSandboxButton?.addEventListener('click', callbacks.onStartSandbox);
        this.sandboxInput?.addEventListener('input', callbacks.onSandboxInputChange);
        this.sandboxBackButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Level Selection
        this.levelListContainer?.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.classList.contains('level-button') && !e.target.disabled) { if (callbacks.onLevelSelect) callbacks.onLevelSelect(parseInt(e.target.dataset.levelId, 10)); } });
        this.levelSelectBackButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Results Screen Buttons
        this.retryButton?.addEventListener('click', () => { if (callbacks.onRetryLevel) callbacks.onRetryLevel(); });
        this.nextLevelButton?.addEventListener('click', () => { if (callbacks.onNextLevel) callbacks.onNextLevel(); });
        this.levelSelectButton?.addEventListener('click', () => { if (callbacks.onShowLevelSelect) callbacks.onShowLevelSelect(); });
        this.mainMenuResultsButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Settings (shared)
        this.settingsToggleButton?.addEventListener('click', () => this.toggleSettings());
        this.wpmSlider?.addEventListener('input', (e) => this._updateWpmDisplay(parseInt(e.target.value, 10)));
        this.wpmSlider?.addEventListener('change', (e) => { this.currentWpm = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onWpmChange) callbacks.onWpmChange(this.currentWpm); });
        this.frequencySlider?.addEventListener('input', (e) => this._updateFrequencyDisplay(parseInt(e.target.value, 10)));
        this.frequencySlider?.addEventListener('change', (e) => { this.currentFrequency = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onFrequencyChange) callbacks.onFrequencyChange(this.currentFrequency); });
        this.soundToggle?.addEventListener('change', (e) => { this.isSoundEnabled = e.target.checked; this._saveSettings(); if (callbacks.onSoundToggle) callbacks.onSoundToggle(this.isSoundEnabled); });
        this.darkModeToggle?.addEventListener('change', (e) => { this.isDarkModeEnabled = e.target.checked; this._applyDarkMode(this.isDarkModeEnabled); this._saveSettings(); if (callbacks.onDarkModeToggle) callbacks.onDarkModeToggle(this.isDarkModeEnabled); });
        this.resetProgressButton?.addEventListener('click', () => { if (callbacks.onResetProgress) callbacks.onResetProgress(); this.hideSettings(); });

        // Hint Toggle Button (New)
        this.toggleHintButton?.addEventListener('click', () => {
            this.isHintVisible = !this.isHintVisible; // Toggle state
            this._applyHintVisibility(this.isHintVisible); // Apply style change
            this._saveSettings(); // Save the new preference
            if (callbacks.onHintToggle) callbacks.onHintToggle(this.isHintVisible); // Notify main logic if needed
        });

        // Hide settings panel when clicking outside
        document.addEventListener('click', (event) => {
            if (!this.settingsArea?.contains(event.target) && !this.settingsControls?.classList.contains('hidden')) {
                this.hideSettings();
            }
        });

        // Optional: Add resize listener to readjust font if needed
        // window.addEventListener('resize', () => this._adjustTextDisplayFontSize());
    }

    // --- Getters ---
    getInitialWpm() { return this.currentWpm; }
    getInitialSoundState() { return this.isSoundEnabled; }
    getInitialDarkModeState() { return this.isDarkModeEnabled; }
    getInitialFrequency() { return this.currentFrequency; }
    getInitialHintState() { return this.isHintVisible; } // New
    getPlaybackSentence() { return this.playbackInput ? this.playbackInput.value : ""; }
    getSandboxSentence() { return this.sandboxInput ? this.sandboxInput.value : ""; }
}

// Create global instance
window.morseUIManager = new UIManager();
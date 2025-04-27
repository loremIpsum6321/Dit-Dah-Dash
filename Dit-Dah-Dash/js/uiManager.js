/**
 * js/uiManager.js
 * ---------------
 * Handles DOM interactions, UI visibility, displays updates, settings UI,
 * themes, and event listeners. Manages results mode display correctly.
 * Includes checks for level select display.
 */

class UIManager {
    /**
     * Initializes the UIManager by getting references to key DOM elements.
     */
    constructor() {
        // ... (previous constructor code remains the same) ...

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
        this.startGameButton = document.getElementById('start-game-button'); // <<< Ensure this ID matches HTML
        this.showSandboxButton = document.getElementById('show-sandbox-button');
        this.showPlaybackButton = document.getElementById('show-playback-button');
        this.showSettingsButton = document.getElementById('show-settings-button');

        // Game Mode Elements (within gameUiWrapper)
        this.textDisplayWrapper = document.getElementById('text-display-wrapper');
        this.textDisplay = document.getElementById('text-display');
        this.targetPatternContainer = document.getElementById('target-pattern-container');
        this.targetPatternOuterWrapper = document.getElementById('target-pattern-outer-wrapper');
        this.toggleHintButton = document.getElementById('toggle-hint-button');
        this.userPatternContainer = document.getElementById('user-pattern-container');
        this.statsDisplay = document.getElementById('stats-display'); // Also shown during results
        this.timerDisplay = document.getElementById('timer-display');
        this.wpmDisplay = document.getElementById('wpm-display');
        this.accuracyDisplay = document.getElementById('accuracy-display');
        this.grossWpmDisplay = document.getElementById('gross-wpm-display');

        // Input Area Elements (Paddles)
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        this.ditPaddleLabel = this.ditButton?.querySelector('.paddle-label');
        this.dahPaddleLabel = this.dahButton?.querySelector('.paddle-label');

        // Playback Mode Elements
        this.playbackInput = document.getElementById('playback-input');
        this.playSentenceButton = document.getElementById('play-sentence-button');
        this.playbackMorseDisplay = document.getElementById('playback-morse-display');

        // Sandbox Mode Elements
        this.sandboxInput = document.getElementById('sandbox-input');
        this.startSandboxButton = document.getElementById('start-sandbox-button');
        this.sandboxMorsePreview = document.getElementById('sandbox-morse-preview');

        // Settings Elements
        this.settingsControls = document.getElementById('settings-controls');
        this.settingsBackButton = document.getElementById('settings-back-button');
        this.wpmSlider = document.getElementById('wpm-slider');
        this.wpmValueDisplay = document.getElementById('wpm-value-display');
        this.frequencySlider = document.getElementById('frequency-slider');
        this.frequencyValueDisplay = document.getElementById('frequency-value-display');
        this.soundToggle = document.getElementById('sound-toggle');
        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.resetProgressButton = document.getElementById('reset-progress-button');

        // Overlay Screens
        this.resultsScreen = document.getElementById('results-screen'); // Contains results text
        this.levelSelectionScreen = document.getElementById('level-selection-screen'); // <<< The overlay itself

        // Results Screen Elements (Text part)
        this.resultsTime = document.getElementById('results-time');
        this.resultsNetWpm = document.getElementById('results-net-wpm');
        this.resultsGrossWpm = document.getElementById('results-gross-wpm');
        this.resultsAccuracy = document.getElementById('results-accuracy');
        this.levelUnlockMessage = document.getElementById('level-unlock-message');
        this.levelSelectButton = document.getElementById('level-select-button'); // <<< Button on results screen

        // Level Selection Screen Elements
        this.levelListContainer = document.getElementById('level-list'); // <<< Container for level buttons

        // Menu Navigation Buttons
        this.gameMenuButton = document.getElementById('game-menu-button');
        this.playbackMenuButton = document.getElementById('playback-menu-button');
        this.sandboxMenuButton = document.getElementById('sandbox-menu-button');
        this.resultsMenuButton = document.getElementById('results-menu-button');
        this.levelSelectMenuButton = document.getElementById('level-select-menu-button'); // <<< Button inside level select

        // ... (rest of constructor, internal state, SVGs, initial setup) ...
        this.currentWpm = MorseConfig.DEFAULT_WPM;
        this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
        this.isSoundEnabled = true;
        this.isDarkModeEnabled = false;
        this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE;
        this._incorrectFlashTimeout = null;
        this._feedbackTimeout = null;
        this.ditSvgString = `<svg class="pattern-dit" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="15" /></svg>`;
        this.dahSvgString = `<svg class="pattern-dah" viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="30" height="10" rx="3"/></svg>`;
        this._loadSettings();
        this._updateWpmDisplay(this.currentWpm);
        this._updateFrequencyDisplay(this.currentFrequency);
        this._applyDarkMode(this.isDarkModeEnabled);
        this._applyHintVisibility(this.isHintVisible);
        this.soundToggle.checked = this.isSoundEnabled;
        this.darkModeToggle.checked = this.isDarkModeEnabled;
        if (this.frequencySlider) {
            this.frequencySlider.min = MorseConfig.AUDIO_MIN_FREQUENCY;
            this.frequencySlider.max = MorseConfig.AUDIO_MAX_FREQUENCY;
            this.frequencySlider.value = this.currentFrequency;
        }
    }

    // --- UI View Management ---
    _hideAllViews() {
        this.gameUiWrapper?.classList.add('hidden');
        this.gameUiWrapper?.classList.remove('results-active');
        this.inputArea?.classList.add('hidden');
        this.playbackArea?.classList.add('hidden');
        this.sandboxArea?.classList.add('hidden');
        this.mainMenuOverlay?.classList.add('hidden');
        this.resultsScreen?.classList.add('hidden');
        this.levelSelectionScreen?.classList.add('hidden'); // Ensure level select is hidden
        this.settingsControls?.classList.add('hidden');
    }

    showMainMenu() {
        this._hideAllViews();
        this.mainMenuOverlay?.classList.remove('hidden');
        console.log("UI: Showing Main Menu");
    }

    showGameUI() {
         this._hideAllViews();
         this.gameUiWrapper?.classList.remove('hidden');
         this.gameUiWrapper?.classList.remove('results-active');
         this.inputArea?.classList.remove('hidden');
         this._applyHintVisibility(this.isHintVisible);
         this.updatePaddleLabels('game');
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

     showSettings() {
         this._hideAllViews();
         this.settingsControls?.classList.remove('hidden');
         console.log("UI: Showing Settings");
     }

     hideSettings() {
        this.settingsControls?.classList.add('hidden');
        this.showMainMenu();
        console.log("UI: Hiding Settings");
     }


    showLevelSelectionScreen(levelsWithStatus) {
        console.log("UI: Attempting to show Level Selection Screen..."); // <<< Added Log
        this._hideAllViews(); // Hide everything else first
        this.levelSelectionScreen?.classList.remove('hidden'); // Show the level select overlay

        if (!this.levelListContainer || !this.levelSelectionScreen) {
            console.error("Level selection container or screen element not found!"); // <<< Error Log
            return;
        }

        console.log("UI: Level Selection Screen element found, populating list..."); // <<< Added Log

        this.levelListContainer.innerHTML = ''; // Clear previous list
        levelsWithStatus.forEach(level => {
             const button = document.createElement('button');
             button.textContent = `Level ${level.id}: ${level.name}`;
             button.dataset.levelId = level.id;
             button.classList.add('level-button');
             if (level.isUnlocked) {
                 button.disabled = false;
                 button.classList.add(level.highScore ? 'completed' : 'unlocked');
                 button.title = level.highScore ? `High Score: ${level.highScore.score.toFixed(1)} WPM, ${level.highScore.accuracy.toFixed(1)}% Acc` : 'Unlocked'; // Formatted title
             } else {
                 button.disabled = true;
                 button.classList.add('locked');
                 button.title = level.unlock_criteria ? `Requires ${level.unlock_criteria.min_wpm} WPM & ${level.unlock_criteria.min_accuracy}% Accuracy on Level ${level.id - 1}` : 'Locked';
             }
             this.levelListContainer.appendChild(button);
        });

        console.log("UI: Showing Level Selection Screen - List Populated."); // <<< Final Log
    }

    hideLevelSelectionScreen() {
        // This might be called when a level is selected
        this.levelSelectionScreen?.classList.add('hidden');
        console.log("UI: Hiding Level Selection Screen.");
    }

    /** Shows the results overlay text and configures the UI for results mode. */
    showResultsScreen(scores, unlockedLevelId, hasNextLevelOption, mode) {
         this._hideAllViews();
         this.resultsScreen?.classList.remove('hidden');
         this.inputArea?.classList.remove('hidden');
         this.gameUiWrapper?.classList.remove('hidden');
         this.gameUiWrapper?.classList.add('results-active'); // Hides text/patterns via CSS

        if (!this.resultsScreen) return;
        this.resultsTime.textContent = `Time: ${scores.elapsedTimeSeconds.toFixed(1)}s`;
        this.resultsNetWpm.textContent = `Net WPM: ${scores.netWpm.toFixed(1)}`;
        this.resultsGrossWpm.textContent = `Gross WPM: ${scores.grossWpm.toFixed(1)}`;
        this.resultsAccuracy.textContent = `Accuracy: ${scores.accuracy.toFixed(1)}%`;

        if (mode === AppMode.GAME) {
            this.levelUnlockMessage.textContent = unlockedLevelId ? `Congratulations! Level ${unlockedLevelId} unlocked!` : '';
            this.levelUnlockMessage.style.display = unlockedLevelId ? 'block' : 'none';
            if (this.levelSelectButton) this.levelSelectButton.style.display = 'inline-block'; // Ensure button is shown
        } else {
            this.levelUnlockMessage.style.display = 'none';
            if (this.levelSelectButton) this.levelSelectButton.style.display = 'none'; // Hide button in sandbox
        }

        this.updatePaddleLabels('results', hasNextLevelOption, mode);
        console.log(`UI: Showing Results (Mode: ${mode})`);
    }

    // ... (rest of UIManager methods like _createPatternSvg, renderSentence, _adjustTextDisplayFontSize, etc.) ...
    // --- Helper Functions ---
    _createPatternSvg(type) { return type === '.' ? this.ditSvgString : this.dahSvgString; }
    updateTargetPatternDisplay(morseSequence) { if (!this.targetPatternContainer) return; this.targetPatternContainer.innerHTML = ''; if (morseSequence) morseSequence.split('').forEach(el => { if (el === '.' || el === '-') this.targetPatternContainer.innerHTML += this._createPatternSvg(el); }); this._applyHintVisibility(this.isHintVisible); }
    updateUserPatternDisplay(morseSequence) { if (!this.userPatternContainer) return; this.userPatternContainer.innerHTML = ''; if (morseSequence) morseSequence.split('').forEach(el => { if (el === '.' || el === '-') this.userPatternContainer.innerHTML += this._createPatternSvg(el); }); }
    updatePlaybackMorseDisplay(formattedMorse) { if (this.playbackMorseDisplay) this.playbackMorseDisplay.textContent = formattedMorse || '\u00A0'; }
    updateSandboxMorsePreview(formattedMorse) { if (this.sandboxMorsePreview) this.sandboxMorsePreview.textContent = formattedMorse || '\u00A0'; }
    setPatternDisplayState(state) { if (!this.targetPatternContainer || !this.userPatternContainer) return; if (this._feedbackTimeout) clearTimeout(this._feedbackTimeout); const containers = [this.targetPatternContainer, this.userPatternContainer]; containers.forEach(c => c.classList.remove('correct-pattern', 'incorrect-pattern')); if (state === 'correct' || state === 'incorrect') { const className = state === 'correct' ? 'correct-pattern' : 'incorrect-pattern'; containers.forEach(c => c.classList.add(className)); this._feedbackTimeout = setTimeout(() => { containers.forEach(c => c.classList.remove(className)); this._feedbackTimeout = null; }, MorseConfig.INCORRECT_FLASH_DURATION); } }
    renderSentence(sentence) { if (!this.textDisplay || !this.textDisplayWrapper) return; this.textDisplay.innerHTML = ''; this.textDisplay.style.fontSize = ''; this.textDisplayWrapper.scrollLeft = 0; if (sentence) { sentence.split('').forEach((char, index) => { const span = document.createElement('span'); span.textContent = char; span.classList.add('char', 'pending'); span.dataset.index = index; if (char === ' ') span.classList.add('space'); this.textDisplay.appendChild(span); }); } this.resetCharacterStyles(); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._adjustTextDisplayFontSize(); }
    _adjustTextDisplayFontSize() { const element = this.textDisplay; const container = this.textDisplayWrapper; if (!element || !container || !element.textContent) { if(element) element.style.fontSize = ''; return; } element.style.fontSize = ''; let currentFontSize = parseFloat(window.getComputedStyle(element).fontSize); const minFontSize = 10; let iterations = 0; const maxIterations = 100; while (element.scrollHeight > container.clientHeight && currentFontSize > minFontSize && iterations < maxIterations) { currentFontSize *= 0.95; element.style.fontSize = `${currentFontSize}px`; iterations++; } if (iterations >= maxIterations) console.warn("Max font size adjustment iterations reached."); }
    resetCharacterStyles() { this.textDisplay?.querySelectorAll('.char').forEach(span => { span.className = 'char pending'; if (span.textContent === ' ') span.classList.add('space'); }); }
    updateCharacterState(charIndex, state) { const charSpan = this.textDisplay?.querySelector(`.char[data-index="${charIndex}"]`); if (charSpan) { charSpan.classList.remove('pending', 'current', 'completed', 'incorrect'); charSpan.classList.add(state); if (state === 'incorrect') { if (this._incorrectFlashTimeout) clearTimeout(this._incorrectFlashTimeout); this._incorrectFlashTimeout = setTimeout(() => { if (charSpan.classList.contains('incorrect')) { charSpan.classList.remove('incorrect'); const currentGameState = window.morseGameState; if (currentGameState && currentGameState.currentCharIndex === charIndex && (currentGameState.status === GameStatus.LISTENING || currentGameState.status === GameStatus.TYPING || currentGameState.status === GameStatus.DECODING)) { charSpan.classList.add('current'); } else { charSpan.classList.add('pending'); } } this._incorrectFlashTimeout = null; }, MorseConfig.INCORRECT_FLASH_DURATION); } else if (this._incorrectFlashTimeout && charSpan.classList.contains('incorrect')) { clearTimeout(this._incorrectFlashTimeout); this._incorrectFlashTimeout = null; } if (state === 'current') this._centerCurrentCharacterHorizontally(charSpan); } }
    highlightCharacter(currentIdx, targetChar) { const prevSpan = this.textDisplay?.querySelector('.char.current'); if (prevSpan && prevSpan.dataset.index != currentIdx) { if (!prevSpan.classList.contains('incorrect') && !prevSpan.classList.contains('completed')) { prevSpan.classList.remove('current'); prevSpan.classList.add('pending'); } else { prevSpan.classList.remove('current'); } } this.updateCharacterState(currentIdx, 'current'); if (window.morseDecoder) { const morseSequence = window.morseDecoder.encodeCharacter(targetChar); this.updateTargetPatternDisplay(morseSequence ?? ""); } this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); }
    _centerCurrentCharacterHorizontally(element) { const container = this.textDisplayWrapper; if (!container || !element) return; requestAnimationFrame(() => { const currentElement = this.textDisplay?.querySelector(`.char[data-index="${element.dataset.index}"]`); if (!currentElement) return; const containerRect = container.getBoundingClientRect(); const elementRect = currentElement.getBoundingClientRect(); const elementWidth = elementRect.width; const elementCenterRelativeToWrapper = (elementRect.left - containerRect.left) + (elementWidth / 2); const scrollAdjustment = elementCenterRelativeToWrapper - (containerRect.width / 2); let targetScrollLeft = container.scrollLeft + scrollAdjustment; const maxScrollLeft = container.scrollWidth - containerRect.width; targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScrollLeft)); if (Math.abs(container.scrollLeft - targetScrollLeft) > 1) { container.scrollTo({ left: targetScrollLeft, behavior: 'instant' }); } }); }
    updateTimer(elapsedTimeMs) { const totalSeconds = Math.floor(elapsedTimeMs / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; const milliseconds = Math.floor((elapsedTimeMs % 1000) / 100); const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds)}`; if (this.timerDisplay) this.timerDisplay.textContent = `Time: ${formattedTime}`; }
    updateLiveStats(gameState) { const charsDone = gameState.correctChars; const totalAttempts = charsDone + gameState.incorrectAttempts; const accuracy = totalAttempts > 0 ? Math.max(0, Math.min(100, (charsDone / (charsDone + gameState.incorrectAttempts * MorseConfig.INCORRECT_ATTEMPT_PENALTY)) * 100)) : 100; const elapsedSeconds = gameState.getCurrentElapsedTime() / 1000; let liveNetWpm = 0, liveGrossWpm = 0; if (elapsedSeconds > 1 && charsDone > 0) { liveGrossWpm = (charsDone / MorseConfig.PARIS_STANDARD_WORD_LENGTH) / (elapsedSeconds / 60); liveNetWpm = liveGrossWpm * (accuracy / 100); } if (this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: ${liveNetWpm.toFixed(0)}`; if (this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: ${accuracy.toFixed(1)}%`; if (this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: ${liveGrossWpm.toFixed(0)}`; }
    resetStatsDisplay() { this.updateTimer(0); if(this.wpmDisplay) this.wpmDisplay.textContent = `Net WPM: 0`; if(this.accuracyDisplay) this.accuracyDisplay.textContent = `Accuracy: 100%`; if(this.grossWpmDisplay) this.grossWpmDisplay.textContent = `Gross WPM: 0`; this.updateTargetPatternDisplay(""); this.updateUserPatternDisplay(""); this.setPatternDisplayState('default'); this._applyHintVisibility(this.isHintVisible); }
    _updateWpmDisplay(wpm) { if(this.wpmValueDisplay) this.wpmValueDisplay.textContent = wpm; }
    _updateFrequencyDisplay(freq) { if(this.frequencyValueDisplay) this.frequencyValueDisplay.textContent = freq; }
    _saveSettings() { try { localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM, this.currentWpm); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND, this.isSoundEnabled); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE, this.isDarkModeEnabled); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY, this.currentFrequency); localStorage.setItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE, this.isHintVisible); } catch (e) { console.error("Error saving settings:", e); } }
    _loadSettings() { try { const savedWpm = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_WPM); const savedSound = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_SOUND); const savedDarkMode = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_DARK_MODE); const savedFrequency = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_FREQUENCY); const savedHintVisible = localStorage.getItem(MorseConfig.STORAGE_KEY_SETTINGS_HINT_VISIBLE); this.currentWpm = savedWpm !== null ? parseInt(savedWpm, 10) : MorseConfig.DEFAULT_WPM; this.isSoundEnabled = savedSound !== null ? JSON.parse(savedSound) : true; this.isDarkModeEnabled = savedDarkMode !== null ? JSON.parse(savedDarkMode) : false; this.currentFrequency = savedFrequency !== null ? parseInt(savedFrequency, 10) : MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY; this.isHintVisible = savedHintVisible !== null ? JSON.parse(savedHintVisible) : MorseConfig.HINT_DEFAULT_VISIBLE; this.currentFrequency = Math.max(MorseConfig.AUDIO_MIN_FREQUENCY, Math.min(MorseConfig.AUDIO_MAX_FREQUENCY, this.currentFrequency)); if (this.wpmSlider) this.wpmSlider.value = this.currentWpm; if (this.soundToggle) this.soundToggle.checked = this.isSoundEnabled; if (this.darkModeToggle) this.darkModeToggle.checked = this.isDarkModeEnabled; if (this.frequencySlider) this.frequencySlider.value = this.currentFrequency; this._updateWpmDisplay(this.currentWpm); this._updateFrequencyDisplay(this.currentFrequency); } catch (e) { console.error("Error loading settings:", e); this.currentWpm = MorseConfig.DEFAULT_WPM; this.isSoundEnabled = true; this.isDarkModeEnabled = false; this.currentFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY; this.isHintVisible = MorseConfig.HINT_DEFAULT_VISIBLE; if (this.wpmSlider) this.wpmSlider.value = this.currentWpm; if (this.soundToggle) this.soundToggle.checked = this.isSoundEnabled; if (this.darkModeToggle) this.darkModeToggle.checked = this.isDarkModeEnabled; if (this.frequencySlider) this.frequencySlider.value = this.currentFrequency; this._updateWpmDisplay(this.currentWpm); this._updateFrequencyDisplay(this.currentFrequency); } }
    setButtonActive(buttonType, isActive) { const button = buttonType === 'dit' ? this.ditButton : this.dahButton; if (button) button.classList.toggle('active', isActive); }
    updatePaddleLabels(mode, hasNextLevel = false, gameMode = AppMode.GAME) { if (!this.ditPaddleLabel || !this.dahPaddleLabel) return; if (mode === 'results') { if (gameMode === AppMode.GAME) { this.ditPaddleLabel.textContent = hasNextLevel ? "Next (.)" : "Next (N/A)"; } else { this.ditPaddleLabel.textContent = "Next (N/A)"; } this.dahPaddleLabel.textContent = "Retry (-)"; if (this.ditButton) { this.ditButton.disabled = (gameMode === AppMode.SANDBOX || !hasNextLevel); } if (this.dahButton) { this.dahButton.disabled = false; } } else { this.ditPaddleLabel.textContent = ""; this.dahPaddleLabel.textContent = ""; if (this.ditButton) this.ditButton.disabled = false; if (this.dahButton) this.dahButton.disabled = false; } }
    setPlaybackButtonEnabled(enabled, text = 'Play Morse') { if (this.playSentenceButton) { this.playSentenceButton.disabled = !enabled; this.playSentenceButton.textContent = text; } }
    _applyDarkMode(enable) { this.bodyElement.classList.toggle('dark-mode', enable); }
    _applyHintVisibility(visible) { this.targetPatternOuterWrapper?.classList.toggle('hint-hidden', !visible); }

    addEventListeners(callbacks) {
        // Main Menu
        if (this.startGameButton) {
            this.startGameButton.addEventListener('click', () => {
                console.log("Start Game button clicked"); // <<< Log
                callbacks.onShowLevelSelect();
            });
        } else console.error("Start Game button not found");

        this.showSandboxButton?.addEventListener('click', callbacks.onShowSandbox);
        this.showPlaybackButton?.addEventListener('click', callbacks.onShowPlayback);
        this.showSettingsButton?.addEventListener('click', callbacks.onShowSettings);

        // Playback
        this.playSentenceButton?.addEventListener('click', callbacks.onPlaySentence);
        this.playbackMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Sandbox
        this.startSandboxButton?.addEventListener('click', callbacks.onStartSandbox);
        this.sandboxInput?.addEventListener('input', callbacks.onSandboxInputChange);
        this.sandboxMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Level Selection Screen - Listener for level buttons
        if (this.levelListContainer) {
            this.levelListContainer.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON' && e.target.classList.contains('level-button') && !e.target.disabled) {
                    const levelId = parseInt(e.target.dataset.levelId, 10);
                    console.log(`Level button clicked: ${levelId}`); // <<< Log
                    if (callbacks.onLevelSelect) callbacks.onLevelSelect(levelId);
                }
            });
        } else console.error("Level list container not found");
        // Level Selection Screen - Menu button
        this.levelSelectMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Results Screen Buttons
        if (this.levelSelectButton) {
             this.levelSelectButton.addEventListener('click', () => {
                 console.log("Results: Level Select button clicked"); // <<< Log
                 if (callbacks.onShowLevelSelect) callbacks.onShowLevelSelect();
             });
         } else console.error("Results Level Select button not found");
        this.resultsMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Settings (Overlay)
        this.settingsBackButton?.addEventListener('click', callbacks.onHideSettings);
        this.wpmSlider?.addEventListener('input', (e) => this._updateWpmDisplay(parseInt(e.target.value, 10)));
        this.wpmSlider?.addEventListener('change', (e) => { this.currentWpm = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onWpmChange) callbacks.onWpmChange(this.currentWpm); });
        this.frequencySlider?.addEventListener('input', (e) => this._updateFrequencyDisplay(parseInt(e.target.value, 10)));
        this.frequencySlider?.addEventListener('change', (e) => { this.currentFrequency = parseInt(e.target.value, 10); this._saveSettings(); if (callbacks.onFrequencyChange) callbacks.onFrequencyChange(this.currentFrequency); });
        this.soundToggle?.addEventListener('change', (e) => { this.isSoundEnabled = e.target.checked; this._saveSettings(); if (callbacks.onSoundToggle) callbacks.onSoundToggle(this.isSoundEnabled); });
        this.darkModeToggle?.addEventListener('change', (e) => { this.isDarkModeEnabled = e.target.checked; this._applyDarkMode(this.isDarkModeEnabled); this._saveSettings(); if (callbacks.onDarkModeToggle) callbacks.onDarkModeToggle(this.isDarkModeEnabled); });
        this.resetProgressButton?.addEventListener('click', () => { if (callbacks.onResetProgress) callbacks.onResetProgress(); /* Let callback handle nav */ });

        // Hint Toggle Button (Game UI)
        this.toggleHintButton?.addEventListener('click', () => { this.isHintVisible = !this.isHintVisible; this._applyHintVisibility(this.isHintVisible); this._saveSettings(); if (callbacks.onHintToggle) callbacks.onHintToggle(this.isHintVisible); });

        // Game Menu Button
        this.gameMenuButton?.addEventListener('click', callbacks.onShowMainMenu);

        // Resize handler
        let resizeTimeout;
        window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(() => { const currentSpan = this.textDisplay?.querySelector('.char.current'); this._adjustTextDisplayFontSize(); if (currentSpan) { this._centerCurrentCharacterHorizontally(currentSpan); } }, 150); });

        console.log("UI Event Listeners Added."); // <<< Log
    }

    // ... (getInitial methods) ...
    getInitialWpm() { return this.currentWpm; }
    getInitialSoundState() { return this.isSoundEnabled; }
    getInitialDarkModeState() { return this.isDarkModeEnabled; }
    getInitialFrequency() { return this.currentFrequency; }
    getInitialHintState() { return this.isHintVisible; }
    getPlaybackSentence() { return this.playbackInput ? this.playbackInput.value : ""; }
    getSandboxSentence() { return this.sandboxInput ? this.sandboxInput.value : ""; }
}

// Create global instance
window.morseUIManager = new UIManager();
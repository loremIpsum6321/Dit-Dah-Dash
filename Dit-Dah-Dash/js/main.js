/* Dit-Dah-Dash/js/main.js */
/* In file: js/main.js */
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes (including key mappings), controls game logic,
 * and manages the results screen flow.
 * **v2 Changes:**
 * - Correct feedback calls uiManager.setPatternDisplayState('correct').
 * - handleResultsInput calls specific retry/next functions.
 * **v3 Changes:**
 * - Pass initial key mappings to InputHandler.
 * - Add callback and handler for key mapping changes from settings.
 * - Update reset progress logic to include resetting key mapping UI.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Dit-Dah-Dash Initializing...");

    // --- Module Instances ---
    // UIManager must exist first as it loads settings/state
    const uiManager = window.morseUIManager;
    if (!uiManager) {
        console.error("FATAL: UIManager failed to initialize. Cannot proceed.");
        alert("Error: UI failed to load. Please refresh.");
        return; // Stop execution if UI Manager is missing
    }
    const gameState = window.morseGameState;
    const decoder = window.morseDecoder;
    const audioPlayer = window.morseAudioPlayer;
    const levelManager = window.morseLevelManager;
    const scoreCalculator = window.morseScoreCalculator;
    let inputHandler = null; // Initialized after initial settings are known
    let settingsModal = null;

    let gameTimerIntervalId = null;

    // --- Initialization ---
    function initializeApp() {
        audioPlayer.initializeAudioContext(); // Attempt early init
        initializeSettingsModal();

        // Load settings via UIManager (happens in its constructor)
        // Get initial keys AFTER UIManager loads them
        const initialKeys = {
            dit: uiManager.getCurrentDitKey(),
            dah: uiManager.getCurrentDahKey()
        };

        initializeInputHandler(initialKeys); // Pass keys to InputHandler
        applyInitialSettings();   // Apply other settings
        setupEventListeners();
        showMainMenu(); // Show main menu initially
        console.log("Dit-Dah-Dash Initialized.");
    }

    function initializeSettingsModal() {
        if (settingsModal) return;
        const openButtonId = uiManager?.showSettingsButton?.id || 'show-settings-button';
        settingsModal = new Modal(
            'settings-modal',
            openButtonId,
            'settings-close-button',
            'settings-modal-header',
            handleShowSettings,
            handleHideSettings
        );
        console.log("Settings Modal initialized.");
    }

    function applyInitialSettings() {
        applyWpmSetting(uiManager.getInitialWpm());
        applyFrequencySetting(uiManager.getInitialFrequency());
        applySoundSetting(uiManager.getInitialSoundState());
        applyVolumeSetting(uiManager.getInitialVolume());
        // Key mappings applied during InputHandler initialization
        // Dark mode & hint visibility applied by UIManager constructor
    }

    function initializeInputHandler(initialKeys) {
        if (inputHandler) return;
        inputHandler = new InputHandler(
            gameState,
            decoder,
            audioPlayer,
            uiManager,
            { // Callbacks object
                onInput: handleInputHandlerInput,
                onCharacterDecode: handleCharacterDecode,
                onResultsInput: handleResultsInput
            },
            initialKeys // Pass initial keys
        );
        console.log("InputHandler initialized.");
    }

    function setupEventListeners() {
        uiManager.addEventListeners({
            // Navigation
            onShowLevelSelect: handleShowLevelSelect,
            onShowSandbox: handleShowSandboxInput,
            onShowPlayback: handleShowPlayback,
            onShowMainMenu: showMainMenu,
            // Settings Modal open/close handled by Modal instance

            // Actions
            onPlaySentence: playSentenceFromInput,
            onStartSandbox: startSandboxPractice,
            onSandboxInputChange: updateSandboxPreview,
            onLevelSelect: selectLevel,

            // Settings Value Changes (from UIManager elements)
            onWpmChange: applyWpmSetting,
            onFrequencyChange: applyFrequencySetting,
            onSoundToggle: applySoundSetting,
            onVolumeChange: applyVolumeSetting,
            onDarkModeToggle: applyDarkModeSetting,
            onHintToggle: applyHintSetting,
            onKeyMappingChange: handleKeyMappingChange, // Callback for key changes
            onResetProgress: resetProgress,
        });

        const primeAudioContext = () => {
            console.log("Priming audio context via global touchstart...");
            audioPlayer.initializeAudioContext();
            document.body.removeEventListener('touchstart', primeAudioContext, { capture: true });
        };
        document.body.addEventListener('touchstart', primeAudioContext, { passive: true, capture: true });
    }

    // --- UI View Transitions & State Management ---
    function showMainMenu() {
        console.log("Navigating to Main Menu...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.MENU;
        gameState.currentMode = AppMode.MENU;
        uiManager.showMainMenu();
    }

    function handleShowLevelSelect() {
        console.log("Navigating to Level Select...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        if (gameState.currentMode !== AppMode.GAME && gameState.status !== GameStatus.SHOWING_RESULTS) {
            gameState.reset();
        }
        gameState.status = GameStatus.LEVEL_SELECT;
        gameState.currentMode = AppMode.GAME;
        const levels = levelManager.getAllLevelsWithStatus();
        uiManager.showLevelSelectionScreen(levels);
    }

    function handleShowSandboxInput() {
        console.log("Navigating to Sandbox Input...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.SANDBOX_INPUT;
        gameState.currentMode = AppMode.SANDBOX;
        uiManager.showSandboxUI();
        updateSandboxPreview();
    }

    function handleShowPlayback() {
        console.log("Navigating to Playback...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset();
        gameState.status = GameStatus.PLAYBACK_INPUT;
        gameState.currentMode = AppMode.PLAYBACK;
        uiManager.showPlaybackUI();
    }

    function handleShowSettings() {
        console.log("Navigating to Settings...");
        if (gameState.isPlaying() || gameState.status === GameStatus.READY) {
            stopGameUpdateTimer();
        }
        gameState.status = GameStatus.SETTINGS;
        gameState.currentMode = AppMode.SETTINGS;
        // Modal opening handled by Modal instance
    }

     function handleHideSettings() {
        console.log("Exiting Settings...");
        // Always return to main menu for simplicity after closing settings
        showMainMenu();
    }

    // --- Game/Sandbox Mode Logic ---
    function startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        const sentenceText = levelManager.getSpecificSentence(levelId, sentenceIndex);
        if (sentenceText === null) {
            console.error(`Cannot start level: Invalid levelId ${levelId} / sentenceIndex ${sentenceIndex}.`);
            showMainMenu(); return;
        }

        gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);
        applyCurrentSettingsToModules(); // Apply WPM, Freq, Volume, Keys
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay();

        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
        } else if (sentenceText.trim().length === 0){
            console.warn("Starting level with empty or whitespace-only sentence.");
            gameState.status = GameStatus.FINISHED;
            handleSentenceFinished();
            return;
        } else {
             console.error("Could not get first character even though sentence is not empty.");
             uiManager.updateTargetPatternDisplay("");
        }

        stopGameUpdateTimer();
        console.log("Game ready.");
    }

    function startSandboxPractice() {
        const sentenceText = uiManager.getSandboxSentence();
        if (!sentenceText || !sentenceText.trim()) { alert("Please enter a sentence."); return; }
        console.log(`Attempting to start Sandbox with: "${sentenceText}"`);

        gameState.startSandboxSentence(sentenceText);
        applyCurrentSettingsToModules(); // Apply WPM, Freq, Volume, Keys
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay();

        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
        } else {
             console.warn("Starting sandbox with whitespace-only sentence.");
             gameState.status = GameStatus.FINISHED;
             handleSentenceFinished();
             return;
        }
        stopGameUpdateTimer();
        console.log("Sandbox ready.");
    }

    function selectLevel(levelId) {
        console.log(`Level ${levelId} selected from list.`);
        if (gameState.status !== GameStatus.LEVEL_SELECT) {
            console.warn(`selectLevel called but status is not LEVEL_SELECT (${gameState.status})`);
            return;
        }
        if (levelManager.isLevelUnlocked(levelId)) {
            startGameLevel(levelId, 0);
        } else {
            console.warn(`Attempted to select locked level: ${levelId}`);
        }
     }

    // --- Input Handling Callbacks (from InputHandler) ---
    function handleInputHandlerInput(inputChar) {
        if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            if (gameState.startTimer()) {
                 startGameUpdateTimer();
            }
        }
    }

    function handleCharacterDecode() {
        if (gameState.status !== GameStatus.DECODING || !(gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            console.warn("handleCharacterDecode called in unexpected state/mode:", gameState.status, gameState.currentMode);
            if (gameState.status === GameStatus.DECODING) gameState.status = GameStatus.LISTENING;
            return;
        }

        const sequence = gameState.currentInputSequence;
        const targetChar = gameState.getTargetCharacter();

        gameState.currentInputSequence = "";
        gameState.inputTimestamps = [];
        uiManager.updateUserPatternDisplay("");

        if (!sequence) {
            gameState.status = GameStatus.LISTENING;
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            }
            uiManager.setPatternDisplayState('default');
            return;
        }

        const decodedChar = decoder.decodeSequence(sequence);

        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- CORRECT ---
            uiManager.updateCharacterState(gameState.currentCharIndex, 'completed');
            uiManager.setPatternDisplayState('correct'); // GREEN flash

            const moreChars = gameState.moveToNextCharacter(); // Advances index, sets state

            if (moreChars) {
                const nextCharIndex = gameState.currentCharIndex;
                const nextCharRaw = gameState.getTargetCharacterRaw();
                if (nextCharRaw !== null) {
                    uiManager.highlightCharacter(nextCharIndex, nextCharRaw);
                }
            } else {
                // --- SENTENCE FINISHED ---
                handleSentenceFinished();
            }
        } else {
            // --- INCORRECT ---
            gameState.registerIncorrectAttempt();
            uiManager.updateCharacterState(gameState.currentCharIndex, 'incorrect'); // RED flash char
            audioPlayer.playIncorrectSound();
            uiManager.setPatternDisplayState('incorrect'); // RED flash pattern

            gameState.status = GameStatus.LISTENING;

            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            } else {
                uiManager.updateTargetPatternDisplay("");
            }
        }
    }


    function handleSentenceFinished() {
        if (gameState.status === GameStatus.SHOWING_RESULTS || gameState.status === GameStatus.MENU) return;

        if (gameState.status !== GameStatus.FINISHED) {
            gameState.stopTimer();
        }
        if (gameState.status !== GameStatus.FINISHED) {
             gameState.status = GameStatus.FINISHED;
        }
        stopGameUpdateTimer();

        const scores = scoreCalculator.calculateScores(gameState);

        let unlockedNextLevelId = null;
        let hasNextLevelOption = false;

        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) {
            const unlockResult = levelManager.recordScoreAndCheckUnlocks(gameState.currentLevelId, scores);
            unlockedNextLevelId = unlockResult.unlockedNextLevelId;

            const nextSentenceDetails = levelManager.getNextSentence(gameState);
            hasNextLevelOption = nextSentenceDetails !== null && levelManager.isLevelUnlocked(nextSentenceDetails.levelId);
        } else {
            hasNextLevelOption = false;
        }

        uiManager.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, gameState.currentMode);
        gameState.status = GameStatus.SHOWING_RESULTS;
        console.log(`${gameState.currentMode} sentence finished, showing results.`);
    }

    // --- Results Screen Input Handling ---
    function handleResultsInput(type) {
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        // SWAPPED: Dah = Next, Dit = Retry
        if (type === 'dah') {
            nextLevel();
        } else if (type === 'dit') {
            retryLevel();
        }
    }

    // --- Game Timer for Live Stats ---
    function startGameUpdateTimer() {
        stopGameUpdateTimer();
        gameTimerIntervalId = setInterval(() => {
            if (gameState.isPlaying()) {
                const elapsed = gameState.getCurrentElapsedTime();
                uiManager.updateTimer(elapsed);
            } else if (gameTimerIntervalId) {
                 stopGameUpdateTimer();
            }
        }, 100);
    }

    function stopGameUpdateTimer() {
        if (gameTimerIntervalId !== null) {
            clearInterval(gameTimerIntervalId);
            gameTimerIntervalId = null;
        }
    }

    // --- Settings Handlers ---
    function applyWpmSetting(wpm) {
        if (wpm > 0) {
            decoder.updateWpm(wpm);
            audioPlayer.updateWpm(wpm);
            if (inputHandler) inputHandler.updateWpm(wpm);
            console.log(`WPM setting applied: ${wpm}`);
        }
    }

    function applyFrequencySetting(freq) {
        if (freq >= MorseConfig.AUDIO_MIN_FREQUENCY && freq <= MorseConfig.AUDIO_MAX_FREQUENCY) {
            audioPlayer.updateFrequency(freq);
            console.log(`Frequency setting applied: ${freq} Hz`);
        }
    }

    function applySoundSetting(isEnabled) {
        audioPlayer.setSoundEnabled(isEnabled);
        console.log(`Sound setting applied: ${isEnabled}`);
    }

    function applyVolumeSetting(level) {
        const volumeLevel = parseFloat(level);
        if (!isNaN(volumeLevel) && volumeLevel >= 0 && volumeLevel <= 1) {
            audioPlayer.setVolume(volumeLevel);
            console.log(`Volume setting applied: ${volumeLevel.toFixed(2)}`);
        }
    }

    function applyDarkModeSetting(isEnabled) {
        console.log(`Dark Mode setting applied: ${isEnabled}`);
        // UI handled by UIManager directly
    }

    function applyHintSetting(isVisible) {
        console.log(`Hint Visibility setting applied: ${isVisible}`);
        // UI handled by UIManager directly
    }

    /** Handles changes to key mappings from the UIManager settings inputs. */
    function handleKeyMappingChange(newMappings) {
        if (inputHandler) {
            inputHandler.updateKeyMappings(newMappings);
        } else {
            console.error("Cannot update key mappings: InputHandler not initialized.");
        }
        // Update results screen instructions if currently visible
        if (gameState.status === GameStatus.SHOWING_RESULTS) {
             const keyDisplayDit = MorseConfig.getKeyDisplay(newMappings.dit);
             const keyDisplayDah = MorseConfig.getKeyDisplay(newMappings.dah);
             const instructionEl = uiManager.resultsScreen?.querySelector('.results-instructions');
             if (instructionEl) {
                 instructionEl.innerHTML = `Press <span class="key-hint">${keyDisplayDit}</span> (Retry) or <span class="key-hint">${keyDisplayDah}</span> (Next)`;
             }
        }
    }

    /** Ensures modules have the latest settings from UI/Storage. */
    function applyCurrentSettingsToModules() {
        const currentWpm = uiManager.getInitialWpm(); // Using 'getInitial' as it holds current state
        const currentFreq = uiManager.getInitialFrequency();
        const soundEnabled = uiManager.getInitialSoundState();
        const currentVolume = uiManager.getInitialVolume();
        const currentKeys = {
            dit: uiManager.getCurrentDitKey(),
            dah: uiManager.getCurrentDahKey()
        };

        // Ensure InputHandler is initialized (should be, but safety check)
        if (!inputHandler) initializeInputHandler(currentKeys);

        applyWpmSetting(currentWpm);
        applyFrequencySetting(currentFreq);
        applySoundSetting(soundEnabled);
        applyVolumeSetting(currentVolume);
        if (inputHandler) inputHandler.updateKeyMappings(currentKeys); // Update keys

        if (soundEnabled) {
             audioPlayer.initializeAudioContext();
        }
    }

    // --- Navigation/Action Helpers ---
    function retryLevel() {
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null && gameState.currentSentenceIndex !== null) {
            console.log(`Retrying Level ${gameState.currentLevelId}, Sentence ${gameState.currentSentenceIndex + 1}`);
            startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex);
        } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) {
            console.log("Retrying Sandbox sentence.");
            startSandboxPractice(); // Uses gameState.currentSentence
        } else {
            console.warn("Retry called in invalid state, returning to main menu.");
            showMainMenu();
        }
    }

    function nextLevel() {
        if (gameState.currentMode !== AppMode.GAME || gameState.currentLevelId === null) {
            console.warn("Next Level called outside Game mode or without level ID, returning to main menu.");
            showMainMenu();
            return;
        }

        const next = levelManager.getNextSentence(gameState);

        if (next && levelManager.isLevelUnlocked(next.levelId)) {
            console.log(`Moving to next: Level ${next.levelId}, Sentence ${next.sentenceIndex + 1}`);
            startGameLevel(next.levelId, next.sentenceIndex);
        } else {
            console.log("No next level/sentence available or unlocked, returning to level select.");
            handleShowLevelSelect();
        }
    }

    function resetProgress() {
        if (confirm("Reset all high scores and level progress? This cannot be undone.")) {
            levelManager.resetProgress();

            // Reset settings in UI Manager and apply them
            uiManager._loadSettings(); // Reloads defaults/cleared state
            applyInitialSettings(); // Re-apply defaults to modules

            // Explicitly update UI elements in settings modal
            uiManager._updateWpmDisplay(uiManager.getInitialWpm());
            uiManager._updateFrequencyDisplay(uiManager.getInitialFrequency());
            uiManager._updateVolumeSliderUI(uiManager.getInitialVolume());
            uiManager._updateSpeakerIcon(uiManager.getInitialVolume());
            uiManager.resetKeyMappingInputs(); // Reset key mapping UI & update InputHandler via callback

            if (uiManager.wpmSlider) uiManager.wpmSlider.value = uiManager.getInitialWpm();
            if (uiManager.frequencySlider) uiManager.frequencySlider.value = uiManager.getInitialFrequency();
            if (uiManager.volumeSlider) uiManager.volumeSlider.value = uiManager.getInitialVolume();
            if (uiManager.soundToggle) uiManager.soundToggle.checked = uiManager.getInitialSoundState();
            if (uiManager.darkModeToggle) uiManager.darkModeToggle.checked = uiManager.getInitialDarkModeState();
            uiManager._applyDarkMode(uiManager.getInitialDarkModeState());
            uiManager._applyHintVisibility(uiManager.getInitialHintState());

            // Close settings modal if open and navigate
            if (settingsModal && !settingsModal.modalElement.classList.contains('hidden')) {
                settingsModal.close(); // Will trigger onClose -> showMainMenu
                 setTimeout(handleShowLevelSelect, 50); // Navigate after modal close animation
            } else {
                 handleShowLevelSelect();
            }
            alert("Progress reset.");
        }
    }

    // --- Playback Mode Logic ---
    function playSentenceFromInput() {
        if (gameState.isAudioPlayingBack()) {
            audioPlayer.stopPlayback();
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            return;
        }

        const sentence = uiManager.getPlaybackSentence();
        if (!sentence || !sentence.trim()) { alert("Please enter a sentence."); return; }

        applyCurrentSettingsToModules(); // Ensure WPM is current

        const morseSequence = decoder.encodeSentence(sentence);
        const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
        uiManager.updatePlaybackMorseDisplay(displayMorse);

        if (!morseSequence) { alert("Could not generate Morse code."); return; }

        uiManager.setPlaybackButtonEnabled(false, 'Stop Playback');

        audioPlayer.playMorseSequence(morseSequence, () => {
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            console.log("Playback complete.");
        });
    }
    // --- Sandbox Mode Logic ---
    function updateSandboxPreview() {
        const sentence = uiManager.getSandboxSentence();
        if (sentence && sentence.trim()) {
            applyCurrentSettingsToModules(); // Ensure decoder WPM is current
            const morseSequence = decoder.encodeSentence(sentence);
            const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
            uiManager.updateSandboxMorsePreview(displayMorse);
        } else {
            uiManager.updateSandboxMorsePreview("");
        }
    }

    // --- App Initialization ---
    initializeApp();

}); // End DOMContentLoaded
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes (WPM, Frequency, Sound, Dark Mode, Hint Visibility),
 * and controls the main game/sandbox/playback logic.
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log("Dit-Dah-Dash Initializing...");

    // --- Module Instances ---
    const uiManager = window.morseUIManager;
    const gameState = window.morseGameState;
    const decoder = window.morseDecoder;
    const audioPlayer = window.morseAudioPlayer;
    const levelManager = window.morseLevelManager;
    const scoreCalculator = window.morseScoreCalculator;
    let inputHandler = null;

    let gameTimerIntervalId = null;

    // --- Initialization ---

    /** Initializes settings, input handler, listeners, and shows the main menu */
    function initializeApp() {
    // Initialize inputHandler FIRST
    initializeInputHandler(); // Moved up

    // THEN apply settings which might use inputHandler
    applyInitialSettings(); // Now inputHandler should exist

    setupEventListeners();
    showMainMenu();
    console.log("Dit-Dah-Dash Initialized and Ready.");
    }

    /** Applies initial settings loaded by UIManager to relevant modules */
    function applyInitialSettings() {
        applyWpmSetting(uiManager.getInitialWpm());
        applyFrequencySetting(uiManager.getInitialFrequency());
        applySoundSetting(uiManager.getInitialSoundState());
        // Dark mode is applied directly by UIManager on load/toggle
        // Hint visibility is applied directly by UIManager on load/toggle
    }

    /** Creates the InputHandler instance */
    function initializeInputHandler() {
         if (inputHandler) return;
         inputHandler = new InputHandler(
             gameState, decoder, audioPlayer, uiManager,
             { // Callbacks
                 onInput: handleInputHandlerInput,
                 onCharacterDecode: handleCharacterDecode,
             }
         );
         console.log("InputHandler initialized.");
    }

    /** Sets up all UI event listeners via UIManager */
    function setupEventListeners() {
        uiManager.addEventListeners({
            // Navigation
            onShowLevelSelect: handleShowLevelSelect,
            onShowSandbox: handleShowSandboxInput,
            onShowPlayback: handleShowPlayback,
            onShowMainMenu: showMainMenu,
            // Actions
            onPlaySentence: playSentenceFromInput,
            onStartSandbox: startSandboxPractice,
            onSandboxInputChange: updateSandboxPreview,
            onLevelSelect: selectLevel,
            onRetryLevel: retryLevel,
            onNextLevel: nextLevel,
            // Settings
            onWpmChange: applyWpmSetting,
            onFrequencyChange: applyFrequencySetting,
            onSoundToggle: applySoundSetting,
            onDarkModeToggle: applyDarkModeSetting,
            onHintToggle: applyHintSetting, // New
            onResetProgress: resetProgress,
        });
    }

    // --- UI View Transitions ---

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
         gameState.reset();
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

    // --- Game/Sandbox Mode Logic ---

    function startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        uiManager.hideLevelSelectionScreen();

        const sentenceText = levelManager.getSpecificSentence(levelId, sentenceIndex);
        if (sentenceText === null) {
            console.error(`Cannot start level: Invalid levelId/sentenceIndex.`);
            showMainMenu(); return;
        }

        gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);
        applyCurrentSettingsToModules(); // Ensure audio/timing settings are current

        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay(); // Resets stats and applies hint visibility
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) uiManager.highlightCharacter(gameState.currentCharIndex, firstChar);
        else uiManager.updateTargetPatternDisplay("");

        stopGameUpdateTimer();
        gameState.clearResultsInput();

        console.log("Game ready.");
    }

    function startSandboxPractice() {
        const sentenceText = uiManager.getSandboxSentence();
        if (!sentenceText || !sentenceText.trim()) {
            alert("Please enter a sentence to practice.");
            return;
        }
        console.log(`Attempting to start Sandbox with: "${sentenceText}"`);

        gameState.startSandboxSentence(sentenceText);
        applyCurrentSettingsToModules();

        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay();
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) uiManager.highlightCharacter(gameState.currentCharIndex, firstChar);
        else uiManager.updateTargetPatternDisplay("");

        stopGameUpdateTimer();
        gameState.clearResultsInput();

        console.log("Sandbox ready.");
    }

    function selectLevel(levelId) {
         if (gameState.status !== GameStatus.LEVEL_SELECT) return;
         if (levelManager.isLevelUnlocked(levelId)) {
             startGameLevel(levelId, 0);
         } else {
             console.warn(`Attempted to select locked level: ${levelId}`);
         }
     }

     function handleInputHandlerInput(inputChar) {
         if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
             if (gameState.startTimer()) {
                startGameUpdateTimer();
             }
         }
     }

    function handleCharacterDecode() {
         if (gameState.status !== GameStatus.DECODING ||
             !(gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
             return;
         }

        const sequence = gameState.currentInputSequence;
        const targetChar = gameState.getTargetCharacter();

        gameState.clearCurrentInput();

        if (!sequence) {
            gameState.status = GameStatus.LISTENING;
            if (targetChar !== null) {
                 const targetMorse = decoder.encodeCharacter(targetChar);
                 uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            }
            return;
        }

        const decodedChar = decoder.decodeSequence(sequence);

        if (decodedChar && targetChar && decodedChar === targetChar) { // CORRECT
            uiManager.updateCharacterState(gameState.currentCharIndex, 'completed');
            audioPlayer.playCorrectSound();
            uiManager.setPatternDisplayState('correct');

            const moreChars = gameState.moveToNextCharacter();

            if (moreChars) {
                 const nextChar = gameState.getTargetCharacterRaw();
                 if (nextChar !== null) {
                    uiManager.highlightCharacter(gameState.currentCharIndex, nextChar); // This calls updateTargetPatternDisplay
                 } else {
                     uiManager.updateTargetPatternDisplay("");
                 }
            } else {
                handleSentenceFinished();
            }
        } else { // INCORRECT
            gameState.registerIncorrectAttempt();
            uiManager.updateCharacterState(gameState.currentCharIndex, 'incorrect');
            audioPlayer.playIncorrectSound();
            uiManager.setPatternDisplayState('incorrect');
            gameState.status = GameStatus.LISTENING;

            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? ""); // Re-show hint after incorrect
            } else {
                 uiManager.updateTargetPatternDisplay("");
            }
        }
    }

    function handleSentenceFinished() {
         if (gameState.status === GameStatus.SHOWING_RESULTS) return;
         if (gameState.status !== GameStatus.FINISHED) {
             if (!gameState.stopTimer()) {
                 gameState.status = GameStatus.FINISHED;
             }
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
        gameState.clearResultsInput();
        gameState.status = GameStatus.SHOWING_RESULTS;
        console.log(`${gameState.currentMode} sentence finished, showing results.`);
    }

    function startGameUpdateTimer() {
        stopGameUpdateTimer();
        gameTimerIntervalId = setInterval(() => {
            if (gameState.isPlaying()) {
                uiManager.updateTimer(gameState.getCurrentElapsedTime());
                uiManager.updateLiveStats(gameState);
            } else {
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
        decoder.updateWpm(wpm);
        audioPlayer.updateWpm(wpm);
        if (inputHandler) inputHandler.updateWpm(wpm);
        console.log(`WPM setting applied: ${wpm}`);
    }

    function applyFrequencySetting(freq) {
        audioPlayer.updateFrequency(freq);
        console.log(`Frequency setting applied: ${freq} Hz`);
    }

    function applySoundSetting(isEnabled) {
        audioPlayer.setSoundEnabled(isEnabled);
        console.log(`Sound setting applied: ${isEnabled}`);
    }

    function applyDarkModeSetting(isEnabled) {
        // UIManager handles the class toggle directly
        console.log(`Dark Mode setting applied: ${isEnabled}`);
    }

    function applyHintSetting(isVisible) {
        // UIManager handles the class toggle directly
        console.log(`Hint Visibility setting applied: ${isVisible}`);
    }

    /** Helper to apply WPM and Frequency settings from UIManager to modules */
    function applyCurrentSettingsToModules() {
        const currentWpm = uiManager.getInitialWpm();
        const currentFreq = uiManager.getInitialFrequency();
        applyWpmSetting(currentWpm);
        applyFrequencySetting(currentFreq);
        if (inputHandler) {
            inputHandler.updateWpm(currentWpm);
        } else {
            initializeInputHandler();
            inputHandler.updateWpm(currentWpm);
        }
    }

    function retryLevel() {
         if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) {
            startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex);
         } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) {
             startSandboxPractice();
         } else {
            handleShowLevelSelect();
         }
     }

     function nextLevel() {
         if (gameState.currentMode !== AppMode.GAME || gameState.currentLevelId === null) {
             handleShowLevelSelect();
             return;
         }
         const next = levelManager.getNextSentence(gameState);
         if (next && levelManager.isLevelUnlocked(next.levelId)) {
             startGameLevel(next.levelId, next.sentenceIndex);
         } else {
             handleShowLevelSelect();
         }
     }

     function resetProgress() {
         if (confirm("Reset all high scores and level progress? This cannot be undone.")) {
             levelManager.resetProgress();
             // Reload settings from storage and reapply them
             uiManager._loadSettings();
             applyInitialSettings(); // Re-apply WPM, Freq, Sound
             // Re-apply UI state based on loaded settings
             uiManager._updateWpmDisplay(uiManager.getInitialWpm());
             uiManager._updateFrequencyDisplay(uiManager.getInitialFrequency());
             uiManager.soundToggle.checked = uiManager.getInitialSoundState();
             uiManager.darkModeToggle.checked = uiManager.getInitialDarkModeState();
             uiManager._applyDarkMode(uiManager.getInitialDarkModeState());
             uiManager._applyHintVisibility(uiManager.getInitialHintState());

             handleShowLevelSelect();
             alert("Progress reset.");
         }
      }

    // --- Playback Mode Logic ---

    function playSentenceFromInput() {
        if (gameState.isAudioPlayingBack()) {
             audioPlayer.stopPlayback();
             uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
             if (gameState.status === GameStatus.PLAYING_BACK) gameState.status = GameStatus.PLAYBACK_INPUT;
             return;
        }

        const sentence = uiManager.getPlaybackSentence();
        if (!sentence || !sentence.trim()) { alert("Please enter a sentence."); return; }

        const morseSequence = decoder.encodeSentence(sentence);
        const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
        uiManager.updatePlaybackMorseDisplay(displayMorse);

        if (!morseSequence) { alert("Could not generate Morse. Check input characters."); return; }

        uiManager.setPlaybackButtonEnabled(false, 'Stop Playback');
        gameState.status = GameStatus.PLAYING_BACK;

        applyCurrentSettingsToModules(); // Use current WPM/Freq for playback

        audioPlayer.playMorseSequence(morseSequence, () => {
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            if (gameState.status === GameStatus.PLAYING_BACK) {
                 gameState.status = GameStatus.PLAYBACK_INPUT;
            }
            console.log("Playback complete callback executed.");
        });
    }

    // --- Sandbox Mode Logic ---

    function updateSandboxPreview() {
        const sentence = uiManager.getSandboxSentence();
        if (sentence && sentence.trim()) {
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
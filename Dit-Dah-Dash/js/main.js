/* In file: js/main.js */
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes via modal, controls game logic, and handles results screen input.
 * Manages the game update timer for live stats.
 * Correct feedback is now visual only (no sound).
 * Handles correct input feedback trigger.
 * Connects InputHandler and AudioPlayer for tone end callbacks.
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
    let settingsModal = null; // Placeholder for Modal instance

    let gameTimerIntervalId = null; // For live stats update

    // --- Initialization ---
    function initializeApp() {
        initializeSettingsModal(); // Initialize modal first
        initializeInputHandler(); // Init InputHandler
        initializeAudioPlayerCallbacks(); // Connect AudioPlayer and InputHandler
        applyInitialSettings();
        setupEventListeners();
        showMainMenu(); // Show main menu initially
        console.log("Dit-Dah-Dash Initialized.");
    }

    function initializeSettingsModal() {
        if (settingsModal) return;
        settingsModal = new Modal(
            'settings-modal',       // Modal element ID
            'show-settings-button', // Button that opens the modal
            'settings-close-button',// Button that closes the modal
            'settings-modal-header', // Draggable header ID
            handleShowSettings,     // onOpen callback
            handleHideSettings      // onClose callback
        );
        console.log("Settings Modal initialized.");
    }

    function applyInitialSettings() {
        applyWpmSetting(uiManager.getInitialWpm());
        applyFrequencySetting(uiManager.getInitialFrequency());
        applySoundSetting(uiManager.getInitialSoundState());
        // Dark mode is applied directly by UIManager on load
    }

    function initializeInputHandler() {
        if (inputHandler) return;
        inputHandler = new InputHandler(
            gameState,
            decoder,
            audioPlayer,
            uiManager,
            { // Callbacks
                onInput: handleInputHandlerInput,
                onCharacterDecode: handleCharacterDecode,
                onResultsInput: handleResultsInput
            }
        );
        console.log("InputHandler initialized.");
    }

    /** Sets up the callback from AudioPlayer to InputHandler */
    function initializeAudioPlayerCallbacks() {
        if (audioPlayer && inputHandler && inputHandler.handleToneEnd) {
            audioPlayer.setOnToneEndCallback(inputHandler.handleToneEnd.bind(inputHandler));
            console.log("AudioPlayer onToneEndCallback connected to InputHandler.");
        } else {
            console.error("Failed to connect AudioPlayer callback - instances not ready?");
        }
    }

    function setupEventListeners() {
        // Most UI events are handled within UIManager, which calls back functions here
        uiManager.addEventListeners({
            // Navigation Callbacks (from UIManager)
            onShowLevelSelect: handleShowLevelSelect,
            onShowSandbox: handleShowSandboxInput,
            onShowPlayback: handleShowPlayback,
            onShowMainMenu: showMainMenu,
            // Settings are handled by the Modal instance now (onOpen/onClose)
            // onShowSettings: handleShowSettings, // Removed, handled by Modal
            // onHideSettings: handleHideSettings, // Removed, handled by Modal

            // Action Callbacks
            onPlaySentence: playSentenceFromInput,
            onStartSandbox: startSandboxPractice,
            onSandboxInputChange: updateSandboxPreview,
            onLevelSelect: selectLevel, // Callback when level picked from list

            // Settings Value Changes (from UIManager elements inside modal)
            onWpmChange: applyWpmSetting,
            onFrequencyChange: applyFrequencySetting,
            onSoundToggle: applySoundSetting,
            onDarkModeToggle: applyDarkModeSetting,
            onHintToggle: applyHintSetting, // Hint toggle is still in game UI
            onResetProgress: resetProgress,
        });
    }

    // --- UI View Transitions & State Management ---
    function showMainMenu() {
        console.log("Navigating to Main Menu...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        gameState.reset(); // Reset state completely
        gameState.status = GameStatus.MENU;
        gameState.currentMode = AppMode.MENU;
        uiManager.showMainMenu();
    }

    /** Handles showing the Level Selection screen */
    function handleShowLevelSelect() {
        console.log("Navigating to Level Select...");
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        // Don't fully reset if coming from results/game to preserve potential context
        if (gameState.currentMode !== AppMode.GAME && gameState.status !== GameStatus.SHOWING_RESULTS) {
            gameState.reset();
        }
        gameState.status = GameStatus.LEVEL_SELECT;
        gameState.currentMode = AppMode.GAME; // Ensure mode is game
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

    /** Called when the settings modal is opened */
    function handleShowSettings() {
        console.log("Navigating to Settings...");
        // Stop game timer if settings opened during gameplay
        if (gameState.isPlaying() || gameState.status === GameStatus.READY) {
            stopGameUpdateTimer(); // Pause timer display updates
        }
        gameState.status = GameStatus.SETTINGS;
        gameState.currentMode = AppMode.SETTINGS;
        // UI is handled by the Modal's open() method
    }

     /** Called when the settings modal is closed */
    function handleHideSettings() {
        console.log("Exiting Settings...");
        // Decide where to return - typically main menu unless game was active?
        // For simplicity, always return to main menu for now.
        showMainMenu();
        // Alternatively, could check previous state:
        // if (previousState === GameStatus.LISTENING || ...) resumeGame();
        // else showMainMenu();
    }

    // --- Game/Sandbox Mode Logic ---
    function startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        const sentenceText = levelManager.getSpecificSentence(levelId, sentenceIndex);
        if (sentenceText === null) { console.error(`Cannot start level: Invalid levelId/sentenceIndex.`); showMainMenu(); return; }

        gameState.startLevelSentence(levelId, sentenceIndex, sentenceText);
        applyCurrentSettingsToModules(); // Ensure WPM/Freq are correct
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay(); // Clear previous stats

        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(gameState.currentCharIndex, firstChar);
        } else {
            uiManager.updateTargetPatternDisplay(""); // Handle empty sentence start?
        }
        stopGameUpdateTimer(); // Ensure timer is stopped before first input
        console.log("Game ready.");
    }

    function startSandboxPractice() {
        const sentenceText = uiManager.getSandboxSentence();
        if (!sentenceText || !sentenceText.trim()) { alert("Please enter a sentence."); return; }
        console.log(`Attempting to start Sandbox with: "${sentenceText}"`);

        gameState.startSandboxSentence(sentenceText);
        applyCurrentSettingsToModules(); // Ensure WPM/Freq are correct
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay(); // Clear previous stats

        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(gameState.currentCharIndex, firstChar);
        } else {
            uiManager.updateTargetPatternDisplay("");
        }
        stopGameUpdateTimer(); // Ensure timer is stopped before first input
        console.log("Sandbox ready.");
    }

    /** Handles selection of a level from the list */
    function selectLevel(levelId) {
        console.log(`Level ${levelId} selected from list.`);
        if (gameState.status !== GameStatus.LEVEL_SELECT) {
            console.warn(`selectLevel called but status is not LEVEL_SELECT (${gameState.status})`);
            return; // Should only select when on the level select screen
        }
        if (levelManager.isLevelUnlocked(levelId)) {
            startGameLevel(levelId, 0); // Start the selected level
        } else {
            console.warn(`Attempted to select locked level: ${levelId}`);
            // Optionally show a message to the user
        }
     }

    // --- Input Handling Callbacks (from InputHandler) ---
    function handleInputHandlerInput(inputChar) {
        // Called whenever a dit (.) or dah (-) is added to the sequence *successfully* (not queued)
        // Start the game timer on the very first input if ready
        if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            if (gameState.startTimer()) { // startTimer sets status to LISTENING
                 startGameUpdateTimer(); // Start the visual timer update loop
            }
        }
        // No other action needed here, state is managed by gameState.addInput
    }

    /** Handles the result of a character decode attempt */
    function handleCharacterDecode() {
        // Called when the decoder timeout triggers (inter-character gap detected)
        if (gameState.status !== GameStatus.DECODING || !(gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            console.warn("handleCharacterDecode called in unexpected state/mode.");
            if (gameState.status === GameStatus.DECODING) gameState.status = GameStatus.LISTENING; // Recover state if possible
            return;
        }

        const sequence = gameState.currentInputSequence;
        const targetChar = gameState.getTargetCharacter(); // Expected character (uppercase)

        gameState.clearCurrentInput(); // Clear sequence *before* checking (important!)

        // If no input sequence was present, likely just a pause between inputs
        if (!sequence) {
            gameState.status = GameStatus.LISTENING; // Go back to listening
            // Keep the target pattern visible if there's a target
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            }
            return;
        }

        const decodedChar = decoder.decodeSequence(sequence);

        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- Correct Character ---
            uiManager.updateCharacterState(gameState.currentCharIndex, 'completed');
            uiManager.setPatternDisplayState('correct'); // Trigger green flash
            // audioPlayer.playCorrectSound(); // Sound deactivated

            const moreChars = gameState.moveToNextCharacter(); // Advances state, clears input

            if (moreChars) {
                // Prepare for the next character
                const nextChar = gameState.getTargetCharacterRaw();
                if (nextChar !== null) {
                    uiManager.highlightCharacter(gameState.currentCharIndex, nextChar);
                } else {
                    // Should not happen if moreChars is true, but handle defensively
                    uiManager.updateTargetPatternDisplay("");
                }
                // State is already LISTENING from moveToNextCharacter
            } else {
                // --- Sentence Finished ---
                handleSentenceFinished(); // Handles timer stop, score calculation, results UI
            }
        } else {
            // --- Incorrect Character or Undecodable Sequence ---
            gameState.registerIncorrectAttempt();
            uiManager.updateCharacterState(gameState.currentCharIndex, 'incorrect'); // Flash character red
            audioPlayer.playIncorrectSound(); // Play incorrect sound
            uiManager.setPatternDisplayState('incorrect'); // Flash pattern displays red

            gameState.status = GameStatus.LISTENING; // Go back to listening for the same character

            // Re-display the target pattern for the current character
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            } else {
                uiManager.updateTargetPatternDisplay(""); // Clear if no target (shouldn't happen here)
            }
        }
    }


    function handleSentenceFinished() {
        if (gameState.status === GameStatus.SHOWING_RESULTS) return; // Prevent double execution

        // Ensure timer is stopped and status is FINISHED
        if (gameState.status !== GameStatus.FINISHED) {
            if (!gameState.stopTimer()) { // stopTimer sets status to FINISHED if successful
                 gameState.status = GameStatus.FINISHED; // Force status if timer couldn't stop (already stopped?)
            }
        }
        stopGameUpdateTimer(); // Stop the visual update loop

        const scores = scoreCalculator.calculateScores(gameState);

        // Update final stats display before showing results overlay
        uiManager.updateTimer(gameState.elapsedTime); // Show final time
        // uiManager.updateWpmDisplay(scores.netWpm); // Stats are shown on results overlay now
        // uiManager.updateAccuracyDisplay(scores.accuracy);
        // uiManager.updateGrossWpmDisplay(scores.grossWpm);


        let unlockedNextLevelId = null;
        let hasNextLevelOption = false;

        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) {
            const unlockResult = levelManager.recordScoreAndCheckUnlocks(gameState.currentLevelId, scores);
            unlockedNextLevelId = unlockResult.unlockedNextLevelId;

            // Check if there's a playable next sentence/level
            const nextSentenceDetails = levelManager.getNextSentence(gameState);
            hasNextLevelOption = nextSentenceDetails !== null && levelManager.isLevelUnlocked(nextSentenceDetails.levelId);
        } else { // Sandbox mode
            hasNextLevelOption = false; // No "next" in sandbox
        }

        // Show the results screen overlay
        uiManager.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, gameState.currentMode);
        gameState.status = GameStatus.SHOWING_RESULTS; // Set state *after* UI transition
        console.log(`${gameState.currentMode} sentence finished, showing results.`);
    }

    // --- Results Screen Input Handling ---
    function handleResultsInput(type) {
        // Called by InputHandler when a paddle is pressed in SHOWING_RESULTS state
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        if (type === 'dit') { // Dit = Next
            console.log("Results: Dit pressed - Attempting Next");
            if (gameState.currentMode === AppMode.GAME) {
                 const next = levelManager.getNextSentence(gameState);
                 if (next && levelManager.isLevelUnlocked(next.levelId)) {
                     nextLevel(); // Call function to start next level/sentence
                 } else {
                     console.log("Results: Next ignored (No next level/sentence available or unlocked).");
                     // Optional: Visual feedback like shaking the button?
                 }
             } else { // Sandbox mode
                 console.log("Results: Next ignored (Sandbox).");
             }
        } else if (type === 'dah') { // Dah = Retry
            console.log("Results: Dah pressed - Attempting Retry");
            retryLevel(); // Call function to retry current level/sentence
        }
    }

    // --- Game Timer for Live Stats ---
    function startGameUpdateTimer() {
        stopGameUpdateTimer(); // Clear any existing interval
        console.log("Starting game update timer...");
        gameTimerIntervalId = setInterval(() => {
            if (gameState.isPlaying()) {
                const elapsed = gameState.getCurrentElapsedTime();
                uiManager.updateTimer(elapsed);
                // // Calculate and update live stats (WPM, Acc) - Disabled for now to reduce calculation load
                // // Use calculateScores which now handles live calculation correctly
                // const liveStats = scoreCalculator.calculateLiveStats(gameState);
                // uiManager.updateWpmDisplay(liveStats.netWpm);
                // uiManager.updateAccuracyDisplay(liveStats.accuracy);
                // uiManager.updateGrossWpmDisplay(liveStats.grossWpm);
            } else {
                 // If no longer playing but timer is running, stop it
                 // (Should be stopped by handleSentenceFinished, but as a safeguard)
                 if(gameTimerIntervalId) {
                    console.log("Game no longer playing, stopping update timer.");
                    stopGameUpdateTimer();
                 }
            }
        }, 100); // Update 10 times per second
    }

    function stopGameUpdateTimer() {
        if (gameTimerIntervalId !== null) {
            // console.log("Stopping game update timer.");
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
        // Dark mode application is handled by UIManager directly
        console.log(`Dark Mode setting applied: ${isEnabled}`);
    }

    function applyHintSetting(isVisible) {
        // Hint application is handled by UIManager directly
        console.log(`Hint Visibility setting applied: ${isVisible}`);
    }

    // Ensures modules have the latest settings, e.g., when starting a game
    function applyCurrentSettingsToModules() {
        const currentWpm = uiManager.getInitialWpm(); // Gets from UIManager's state
        const currentFreq = uiManager.getInitialFrequency();
        if (!inputHandler) initializeInputHandler(); // Should already be initialized
        if (!audioPlayer.onToneEndCallback) initializeAudioPlayerCallbacks(); // Ensure callback is set
        applyWpmSetting(currentWpm);
        applyFrequencySetting(currentFreq);
        // Sound/Dark/Hint are applied via UIManager or AudioPlayer directly
    }

    // --- Navigation/Action Helpers ---
    function retryLevel() {
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) {
            console.log(`Retrying Level ${gameState.currentLevelId}, Sentence ${gameState.currentSentenceIndex + 1}`);
            startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex);
        } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) {
            console.log("Retrying Sandbox sentence.");
            startSandboxPractice();
        } else {
            console.warn("Retry called invalid state, returning to level select.");
            handleShowLevelSelect(); // Fallback
        }
    }

    function nextLevel() {
        if (gameState.currentMode !== AppMode.GAME || gameState.currentLevelId === null) {
            console.warn("Next Level called outside Game mode, returning to level select.");
            handleShowLevelSelect(); // Fallback
            return;
        }
        const next = levelManager.getNextSentence(gameState);
        if (next && levelManager.isLevelUnlocked(next.levelId)) {
            console.log(`Moving to next: Level ${next.levelId}, Sentence ${next.sentenceIndex + 1}`);
            startGameLevel(next.levelId, next.sentenceIndex);
        } else {
            console.log("No next level/sentence available or unlocked, returning to level select.");
            handleShowLevelSelect(); // Go back to level select if no more levels
        }
    }

    function resetProgress() {
        if (confirm("Reset all high scores and level progress? This cannot be undone.")) {
            levelManager.resetProgress();
            // Reload settings in UI Manager and apply them
            uiManager._loadSettings(); // Reloads from (now potentially empty) storage
            applyInitialSettings(); // Apply the defaults or reloaded settings
            // Update UI elements in settings modal (if open) or UIManager's internal state
             uiManager._updateWpmDisplay(uiManager.getInitialWpm());
             uiManager._updateFrequencyDisplay(uiManager.getInitialFrequency());
             if (uiManager.soundToggle) uiManager.soundToggle.checked = uiManager.getInitialSoundState();
             if (uiManager.darkModeToggle) uiManager.darkModeToggle.checked = uiManager.getInitialDarkModeState();
             uiManager._applyDarkMode(uiManager.getInitialDarkModeState()); // Re-apply theme
             uiManager._applyHintVisibility(uiManager.getInitialHintState()); // Re-apply hint visibility

            // Close modal if open and go to level select
            if (settingsModal && !settingsModal.modalElement.classList.contains('hidden')) {
                settingsModal.close(); // This will trigger onClose -> showMainMenu
            }
            handleShowLevelSelect(); // Explicitly navigate after reset
            alert("Progress reset.");
        }
    }

    // --- Playback Mode Logic ---
    function playSentenceFromInput() {
        if (gameState.isAudioPlayingBack()) {
            audioPlayer.stopPlayback(); // Handles stopping audio and state change
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            // gameState status is updated by audioPlayer.stopPlayback
            return;
        }

        const sentence = uiManager.getPlaybackSentence();
        if (!sentence || !sentence.trim()) { alert("Please enter a sentence."); return; }

        const morseSequence = decoder.encodeSentence(sentence);
        const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' '); // Make readable
        uiManager.updatePlaybackMorseDisplay(displayMorse);

        if (!morseSequence) { alert("Could not generate Morse code for this sentence."); return; }

        uiManager.setPlaybackButtonEnabled(false, 'Stop Playback'); // Disable button, change text
        // gameState status will be updated by audioPlayer.playMorseSequence
        applyCurrentSettingsToModules(); // Ensure correct WPM/Freq for playback
        audioPlayer.playMorseSequence(morseSequence, () => {
            // Completion Callback
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse');
            // gameState status is updated by audioPlayer on completion
            console.log("Playback complete.");
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
            uiManager.updateSandboxMorsePreview(""); // Clear preview if input is empty
        }
    }

    // --- App Initialization ---
    initializeApp();

}); // End DOMContentLoaded
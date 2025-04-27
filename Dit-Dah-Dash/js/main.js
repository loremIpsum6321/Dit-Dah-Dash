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
 * Connects InputHandler and AudioPlayer for tone end callbacks via InputHandler constructor.
 * Ensures early audio context initialization attempt on load.
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
    let inputHandler = null; // Initialized later
    let settingsModal = null; // Placeholder for Modal instance

    let gameTimerIntervalId = null; // For live stats update

    // --- Initialization ---
    function initializeApp() {
        // Try to initialize audio context early (best effort for mobile)
        // User interaction might still be needed later.
        audioPlayer.initializeAudioContext();

        initializeSettingsModal(); // Initialize modal first
        initializeInputHandler(); // Init InputHandler (this now connects audio callback too)
        // initializeAudioPlayerCallbacks(); // No longer needed here, handled in InputHandler constructor
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
        // Pass the necessary instances to the InputHandler constructor
        inputHandler = new InputHandler(
            gameState,
            decoder,
            audioPlayer,
            uiManager,
            { // Callbacks object
                onInput: handleInputHandlerInput,
                onCharacterDecode: handleCharacterDecode,
                onResultsInput: handleResultsInput
            }
        );
        console.log("InputHandler initialized and AudioPlayer callback connected.");
    }

    /** Sets up the callback from AudioPlayer to InputHandler - REMOVED (now done in IH constructor) */
    // function initializeAudioPlayerCallbacks() { ... } // Removed

    function setupEventListeners() {
        // Most UI events are handled within UIManager, which calls back functions here
        uiManager.addEventListeners({
            // Navigation Callbacks (from UIManager)
            onShowLevelSelect: handleShowLevelSelect,
            onShowSandbox: handleShowSandboxInput,
            onShowPlayback: handleShowPlayback,
            onShowMainMenu: showMainMenu,
            // Settings handled by Modal instance (onOpen/onClose)

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

        // Add a global touchstart listener to attempt audio context resume on first touch
        // This is a fallback/enhancement for mobile browser restrictions
        const primeAudioContext = () => {
            console.log("Priming audio context via global touchstart...");
            audioPlayer.initializeAudioContext();
            // Remove listener after first successful priming attempt
            document.body.removeEventListener('touchstart', primeAudioContext, { capture: true });
        };
        document.body.addEventListener('touchstart', primeAudioContext, { passive: true, capture: true });

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
            // Consider pausing audio/input if needed, but currently just stops timer updates
        }
        gameState.status = GameStatus.SETTINGS;
        gameState.currentMode = AppMode.SETTINGS;
        // UI is handled by the Modal's open() method
    }

     /** Called when the settings modal is closed */
    function handleHideSettings() {
        console.log("Exiting Settings...");
        // Decide where to return. If a game was active, could potentially resume,
        // but for simplicity, returning to Main Menu is often safest.
        // Let's check the previous state.
        // TODO: Implement a more robust state management for pausing/resuming.
        // For now, just go to main menu.
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
        applyCurrentSettingsToModules(); // Ensure WPM/Freq are correct
        uiManager.showGameUI();
        uiManager.renderSentence(sentenceText);
        uiManager.resetStatsDisplay(); // Clear previous stats

        // Highlight first non-space character
        const firstCharIndex = gameState.currentCharIndex; // Already advanced past leading spaces
        const firstChar = gameState.getTargetCharacterRaw(); // Gets char at current index
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
        } else if (sentenceText.trim().length === 0){
            // Handle empty sentence case immediately
            console.warn("Starting level with empty or whitespace-only sentence.");
            gameState.status = GameStatus.FINISHED; // Mark as finished
            handleSentenceFinished(); // Go directly to results (0 scores)
            return;
        } else {
             // This case should ideally not happen if startLevelSentence works correctly
             console.error("Could not get first character even though sentence is not empty.");
             uiManager.updateTargetPatternDisplay("");
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

        // Highlight first non-space character
        const firstCharIndex = gameState.currentCharIndex;
        const firstChar = gameState.getTargetCharacterRaw();
        if (firstChar !== null) {
            uiManager.highlightCharacter(firstCharIndex, firstChar);
        } else {
             // This implies the input was only spaces
             console.warn("Starting sandbox with whitespace-only sentence.");
             gameState.status = GameStatus.FINISHED; // Mark as finished
             handleSentenceFinished(); // Go directly to results
             return;
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
            // Optional: Show a message to the user via UI Manager
        }
     }

    // --- Input Handling Callbacks (from InputHandler) ---
    function handleInputHandlerInput(inputChar) {
        // Called whenever a dit (.) or dah (-) is successfully added to the sequence
        // Start the game timer on the very first input if ready
        if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            if (gameState.startTimer()) { // startTimer sets status to LISTENING then TYPING
                 startGameUpdateTimer(); // Start the visual timer update loop
            }
            // gameState.addInput already handled setting state to TYPING
        }
        // No other action needed here, state is managed by gameState.addInput and InputHandler
    }

    /** Handles the result of a character decode attempt (called by InputHandler via decoder schedule) */
    function handleCharacterDecode() {
        // This function is called when the inter-character gap timeout fires.
        // The gameState.status should be DECODING at this point.
        if (gameState.status !== GameStatus.DECODING || !(gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) {
            console.warn("handleCharacterDecode called in unexpected state/mode:", gameState.status, gameState.currentMode);
            if (gameState.status === GameStatus.DECODING) gameState.status = GameStatus.LISTENING; // Attempt recovery
            return;
        }

        const sequence = gameState.currentInputSequence;
        const targetChar = gameState.getTargetCharacter(); // Expected character (uppercase, non-space)

        // It's crucial to clear the input sequence *after* getting it, before checking result.
        // However, gameState.clearCurrentInput() also resets the status, so let's clear manually here.
        gameState.currentInputSequence = ""; // Clear sequence directly
        gameState.inputTimestamps = []; // Clear timestamps
        // gameState.clearCharacterTimeout(); // Decoder already cleared this

        // Update UI for cleared input
        uiManager.updateUserPatternDisplay("");

        // If no sequence was present when decode triggered (e.g., pause without input), just revert to listening
        if (!sequence) {
            gameState.status = GameStatus.LISTENING; // Go back to listening
            // Re-display target pattern if applicable
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            } else {
                 // This means we finished the sentence while waiting for decode - should be handled by moveToNextCharacter
            }
            return;
        }

        // Decode the sequence we captured
        const decodedChar = decoder.decodeSequence(sequence);

        // --- Compare Decoded Character with Target ---
        if (decodedChar && targetChar && decodedChar === targetChar) {
            // --- CORRECT ---
            uiManager.updateCharacterState(gameState.currentCharIndex, 'completed');
            uiManager.setPatternDisplayState('correct'); // Visual feedback

            const moreChars = gameState.moveToNextCharacter(); // Advances index, handles spaces, clears input state, sets status to LISTENING or FINISHED

            if (moreChars) {
                // Prepare for the next character
                const nextCharIndex = gameState.currentCharIndex;
                const nextCharRaw = gameState.getTargetCharacterRaw();
                if (nextCharRaw !== null) {
                    uiManager.highlightCharacter(nextCharIndex, nextCharRaw); // Highlights & updates target pattern
                }
                // gameState.status is already LISTENING
            } else {
                // --- SENTENCE FINISHED ---
                // gameState.status is now FINISHED
                handleSentenceFinished(); // Calculate scores, show results UI
            }
        } else {
            // --- INCORRECT --- (or undecodable sequence)
            gameState.registerIncorrectAttempt();
            uiManager.updateCharacterState(gameState.currentCharIndex, 'incorrect'); // Visual feedback (flash red)
            audioPlayer.playIncorrectSound();
            uiManager.setPatternDisplayState('incorrect'); // Visual feedback

            gameState.status = GameStatus.LISTENING; // Go back to listening for the *same* character

            // Re-display the target pattern for the current character
            if (targetChar !== null) {
                const targetMorse = decoder.encodeCharacter(targetChar);
                uiManager.updateTargetPatternDisplay(targetMorse ?? "");
            } else {
                 // Should not happen if we are in an incorrect state for a character
                uiManager.updateTargetPatternDisplay("");
            }
        }
    }


    function handleSentenceFinished() {
        // Ensure this runs only once per sentence completion
        if (gameState.status === GameStatus.SHOWING_RESULTS || gameState.status === GameStatus.MENU) return;

        // Ensure timer is stopped and status is FINISHED
        if (gameState.status !== GameStatus.FINISHED) {
            gameState.stopTimer(); // This sets status to FINISHED if successful
        }
        // If stopTimer failed (e.g., already stopped, or never started), force status
        if (gameState.status !== GameStatus.FINISHED) {
             gameState.status = GameStatus.FINISHED;
        }
        stopGameUpdateTimer(); // Stop the visual update loop

        const scores = scoreCalculator.calculateScores(gameState);

        // Update final stats display on the main game UI *before* showing results overlay
        // This prevents seeing stale stats briefly if the overlay is transparent
        uiManager.updateTimer(gameState.elapsedTime);
        // uiManager.updateWpmDisplay(scores.netWpm); // Shown on overlay
        // uiManager.updateAccuracyDisplay(scores.accuracy); // Shown on overlay
        // uiManager.updateGrossWpmDisplay(scores.grossWpm); // Shown on overlay

        let unlockedNextLevelId = null;
        let hasNextLevelOption = false;

        // Handle scoring and unlocking only in Game mode
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) {
            const unlockResult = levelManager.recordScoreAndCheckUnlocks(gameState.currentLevelId, scores);
            unlockedNextLevelId = unlockResult.unlockedNextLevelId;

            // Check if there's a *playable* next step (next sentence in level, or next unlocked level)
            const nextSentenceDetails = levelManager.getNextSentence(gameState);
            hasNextLevelOption = nextSentenceDetails !== null && levelManager.isLevelUnlocked(nextSentenceDetails.levelId);
        } else { // Sandbox mode or error case
            hasNextLevelOption = false; // No "next" in sandbox
        }

        // Show the results screen overlay
        uiManager.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, gameState.currentMode);
        gameState.status = GameStatus.SHOWING_RESULTS; // Set final status *after* UI is shown
        console.log(`${gameState.currentMode} sentence finished, showing results.`);
    }

    // --- Results Screen Input Handling ---
    function handleResultsInput(type) {
        // Called by InputHandler when a paddle is pressed ONLY in SHOWING_RESULTS state
        if (gameState.status !== GameStatus.SHOWING_RESULTS) return;

        // Dit maps to the 'Next' action (if available)
        if (type === 'dit') {
            console.log("Results: Dit pressed - Attempting Next");
            if (gameState.currentMode === AppMode.GAME) {
                 const next = levelManager.getNextSentence(gameState);
                 // Check if 'next' exists and is unlocked
                 if (next && levelManager.isLevelUnlocked(next.levelId)) {
                     nextLevel(); // Function to start the next sentence/level
                 } else {
                     console.log("Results: Next ignored (No next level/sentence available or unlocked).");
                     // Optional: Add visual feedback like shaking the 'Next' paddle?
                 }
             } else { // Sandbox mode has no 'Next' level concept
                 console.log("Results: Next ignored (Sandbox).");
             }
        }
        // Dah maps to the 'Retry' action
        else if (type === 'dah') {
            console.log("Results: Dah pressed - Attempting Retry");
            retryLevel(); // Function to retry the current sentence/level
        }
    }

    // --- Game Timer for Live Stats ---
    function startGameUpdateTimer() {
        stopGameUpdateTimer(); // Clear any existing interval
        // console.log("Starting game update timer..."); // Debug
        gameTimerIntervalId = setInterval(() => {
            // Only update if actively playing (listening, typing, decoding)
            if (gameState.isPlaying()) {
                const elapsed = gameState.getCurrentElapsedTime();
                uiManager.updateTimer(elapsed);
                // Live WPM/Accuracy calculation can be CPU intensive, update less frequently or disable
                // const liveStats = scoreCalculator.calculateLiveStats(gameState); // Needs implementation in scoreCalculator
                // uiManager.updateWpmDisplay(liveStats.netWpm);
                // uiManager.updateAccuracyDisplay(liveStats.accuracy);
            } else if (gameTimerIntervalId) {
                 // If timer is running but game state is no longer 'playing', stop the timer.
                 // This acts as a safeguard against orphaned timers.
                 // console.log("Game no longer playing, stopping update timer."); // Debug
                 stopGameUpdateTimer();
            }
        }, 100); // Update interval (e.g., 100ms for 10fps)
    }

    function stopGameUpdateTimer() {
        if (gameTimerIntervalId !== null) {
            // console.log("Stopping game update timer."); // Debug
            clearInterval(gameTimerIntervalId);
            gameTimerIntervalId = null;
        }
    }

    // --- Settings Handlers ---
    function applyWpmSetting(wpm) {
        if (wpm > 0) {
            decoder.updateWpm(wpm);
            audioPlayer.updateWpm(wpm);
            if (inputHandler) inputHandler.updateWpm(wpm); // Check if IH exists
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

    function applyDarkModeSetting(isEnabled) {
        // Dark mode application is handled by UIManager directly via _applyDarkMode
        console.log(`Dark Mode setting applied: ${isEnabled}`);
    }

    function applyHintSetting(isVisible) {
        // Hint application is handled by UIManager directly via _applyHintVisibility
        console.log(`Hint Visibility setting applied: ${isVisible}`);
    }

    /** Ensures modules have the latest settings from UI/Storage, e.g., before starting a game. */
    function applyCurrentSettingsToModules() {
        // Get settings values directly from UIManager (which holds state loaded from storage)
        const currentWpm = uiManager.getInitialWpm();
        const currentFreq = uiManager.getInitialFrequency();
        const soundEnabled = uiManager.getInitialSoundState(); // Needed for audioPlayer check

        // Ensure InputHandler is initialized
        if (!inputHandler) initializeInputHandler();

        // Apply settings
        applyWpmSetting(currentWpm);
        applyFrequencySetting(currentFreq);
        applySoundSetting(soundEnabled); // Ensure audio player state matches toggle

        // Ensure audio context is ready if sound is enabled
        if (soundEnabled) {
             audioPlayer.initializeAudioContext();
        }
        // Dark Mode & Hint visibility are handled by UIManager CSS classes directly.
    }

    // --- Navigation/Action Helpers ---
    function retryLevel() {
        // Check current mode and necessary state exists
        if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null && gameState.currentSentenceIndex !== null) {
            console.log(`Retrying Level ${gameState.currentLevelId}, Sentence ${gameState.currentSentenceIndex + 1}`);
            // Start the same level and sentence index again
            startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex);
        } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) {
            console.log("Retrying Sandbox sentence.");
            // Restart the sandbox with the *same* sentence stored in gameState
            startSandboxPractice(); // This uses gameState.currentSentence
        } else {
            console.warn("Retry called in invalid state, returning to main menu.");
            showMainMenu(); // Fallback to main menu if state is inconsistent
        }
    }

    function nextLevel() {
        // Only applicable in Game mode
        if (gameState.currentMode !== AppMode.GAME || gameState.currentLevelId === null) {
            console.warn("Next Level called outside Game mode or without level ID, returning to main menu.");
            showMainMenu(); // Fallback
            return;
        }

        // Get details for the next potential step
        const next = levelManager.getNextSentence(gameState);

        // Check if 'next' exists and the level it belongs to is unlocked
        if (next && levelManager.isLevelUnlocked(next.levelId)) {
            console.log(`Moving to next: Level ${next.levelId}, Sentence ${next.sentenceIndex + 1}`);
            startGameLevel(next.levelId, next.sentenceIndex);
        } else {
            // No more sentences/levels, or next level is locked
            console.log("No next level/sentence available or unlocked, returning to level select.");
            handleShowLevelSelect(); // Go back to level select screen
        }
    }

    function resetProgress() {
        if (confirm("Reset all high scores and level progress? This cannot be undone.")) {
            levelManager.resetProgress();

            // Reload settings in UI Manager (which re-reads localStorage) and apply them
            uiManager._loadSettings();
            applyInitialSettings(); // Apply the defaults or reloaded (cleared) settings

            // Explicitly update UI elements in settings modal to reflect defaults
             uiManager._updateWpmDisplay(uiManager.getInitialWpm());
             uiManager._updateFrequencyDisplay(uiManager.getInitialFrequency());
             if (uiManager.wpmSlider) uiManager.wpmSlider.value = uiManager.getInitialWpm();
             if (uiManager.frequencySlider) uiManager.frequencySlider.value = uiManager.getInitialFrequency();
             if (uiManager.soundToggle) uiManager.soundToggle.checked = uiManager.getInitialSoundState();
             if (uiManager.darkModeToggle) uiManager.darkModeToggle.checked = uiManager.getInitialDarkModeState();
             // Re-apply theme and hint visibility based on potentially reset settings
             uiManager._applyDarkMode(uiManager.getInitialDarkModeState());
             uiManager._applyHintVisibility(uiManager.getInitialHintState());

            // Close settings modal if open and navigate to level select
            if (settingsModal && !settingsModal.modalElement.classList.contains('hidden')) {
                settingsModal.close(); // This will trigger onClose -> showMainMenu (or other logic if changed)
                 // If modal close doesn't navigate correctly, force navigation:
                 setTimeout(handleShowLevelSelect, 50); // Short delay after close
            } else {
                 handleShowLevelSelect(); // Navigate directly if modal wasn't open
            }
            alert("Progress reset.");
        }
    }

    // --- Playback Mode Logic ---
    function playSentenceFromInput() {
        // If already playing back, stop it
        if (gameState.isAudioPlayingBack()) {
            audioPlayer.stopPlayback(); // Handles stopping audio and state update
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse'); // Re-enable button
            return;
        }

        const sentence = uiManager.getPlaybackSentence();
        if (!sentence || !sentence.trim()) { alert("Please enter a sentence."); return; }

        // Ensure settings are current before encoding/playing
        applyCurrentSettingsToModules();

        const morseSequence = decoder.encodeSentence(sentence);
        // Format for display (replace markers with visual separators)
        const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' ');
        uiManager.updatePlaybackMorseDisplay(displayMorse);

        if (!morseSequence) { alert("Could not generate Morse code for this sentence (check for unknown characters)."); return; }

        uiManager.setPlaybackButtonEnabled(false, 'Stop Playback'); // Disable button during playback
        // audioPlayer handles setting gameState status to PLAYING_BACK

        audioPlayer.playMorseSequence(morseSequence, () => {
            // --- Playback Completion Callback ---
            uiManager.setPlaybackButtonEnabled(true, 'Play Morse'); // Re-enable button
            // audioPlayer handles setting gameState status back (e.g., to PLAYBACK_INPUT)
            console.log("Playback complete.");
        });
    }
    // --- Sandbox Mode Logic ---
    function updateSandboxPreview() {
        const sentence = uiManager.getSandboxSentence();
        if (sentence && sentence.trim()) {
             // Ensure decoder has current WPM for potential timing hints (though not used in preview)
            applyCurrentSettingsToModules();
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
/**
 * js/main.js
 * ----------
 * Entry point for the Dit-Dah-Dash application.
 * Initializes modules, sets up event listeners, manages UI view transitions,
 * handles settings changes, controls game logic, and handles results screen input.
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
    function initializeApp() { initializeInputHandler(); applyInitialSettings(); setupEventListeners(); showMainMenu(); console.log("Dit-Dah-Dash Initialized."); }
    function applyInitialSettings() { applyWpmSetting(uiManager.getInitialWpm()); applyFrequencySetting(uiManager.getInitialFrequency()); applySoundSetting(uiManager.getInitialSoundState()); }
    function initializeInputHandler() { if (inputHandler) return; inputHandler = new InputHandler( gameState, decoder, audioPlayer, uiManager, { onInput: handleInputHandlerInput, onCharacterDecode: handleCharacterDecode, onResultsInput: handleResultsInput } ); console.log("InputHandler initialized."); }

    function setupEventListeners() {
        uiManager.addEventListeners({
            // Navigation
            onShowLevelSelect: handleShowLevelSelect, // <<< Function to call
            onShowSandbox: handleShowSandboxInput,
            onShowPlayback: handleShowPlayback,
            onShowMainMenu: showMainMenu,
            onShowSettings: uiManager.showSettings,
            onHideSettings: uiManager.hideSettings,
            // Actions
            onPlaySentence: playSentenceFromInput,
            onStartSandbox: startSandboxPractice,
            onSandboxInputChange: updateSandboxPreview,
            onLevelSelect: selectLevel, // <<< Function to call when level picked
            // Settings
            onWpmChange: applyWpmSetting,
            onFrequencyChange: applyFrequencySetting,
            onSoundToggle: applySoundSetting,
            onDarkModeToggle: applyDarkModeSetting,
            onHintToggle: applyHintSetting,
            onResetProgress: resetProgress,
        });
    }

    // --- UI View Transitions ---
    function showMainMenu() { console.log("Navigating to Main Menu..."); stopGameUpdateTimer(); audioPlayer.stopPlayback(); gameState.reset(); gameState.status = GameStatus.MENU; gameState.currentMode = AppMode.MENU; uiManager.showMainMenu(); }

    /** Handles showing the Level Selection screen */
    function handleShowLevelSelect() {
        console.log("Navigating to Level Select..."); // <<< Log
        stopGameUpdateTimer();
        audioPlayer.stopPlayback();
        if (gameState.currentMode !== AppMode.GAME) gameState.reset(); // Keep game state if coming from results/game
        gameState.status = GameStatus.LEVEL_SELECT;
        gameState.currentMode = AppMode.GAME; // Ensure mode is game
        const levels = levelManager.getAllLevelsWithStatus();
        uiManager.showLevelSelectionScreen(levels); // <<< Call UI Manager function
    }

    function handleShowSandboxInput() { console.log("Navigating to Sandbox Input..."); stopGameUpdateTimer(); audioPlayer.stopPlayback(); gameState.reset(); gameState.status = GameStatus.SANDBOX_INPUT; gameState.currentMode = AppMode.SANDBOX; uiManager.showSandboxUI(); updateSandboxPreview(); }
    function handleShowPlayback() { console.log("Navigating to Playback..."); stopGameUpdateTimer(); audioPlayer.stopPlayback(); gameState.reset(); gameState.status = GameStatus.PLAYBACK_INPUT; gameState.currentMode = AppMode.PLAYBACK; uiManager.showPlaybackUI(); }

    // --- Game/Sandbox Mode Logic ---
    function startGameLevel(levelId, sentenceIndex = 0) {
        console.log(`Attempting to start Level ${levelId}, Sentence ${sentenceIndex + 1}`);
        const sentenceText = levelManager.getSpecificSentence(levelId, sentenceIndex);
        if (sentenceText === null) { console.error(`Cannot start level: Invalid levelId/sentenceIndex.`); showMainMenu(); return; }
        gameState.startLevelSentence(levelId, sentenceIndex, sentenceText); applyCurrentSettingsToModules(); uiManager.showGameUI(); uiManager.renderSentence(sentenceText); uiManager.resetStatsDisplay();
        const firstChar = gameState.getTargetCharacterRaw(); if (firstChar !== null) uiManager.highlightCharacter(gameState.currentCharIndex, firstChar); else uiManager.updateTargetPatternDisplay("");
        stopGameUpdateTimer(); console.log("Game ready.");
    }
    function startSandboxPractice() {
        const sentenceText = uiManager.getSandboxSentence(); if (!sentenceText || !sentenceText.trim()) { alert("Please enter a sentence."); return; }
        console.log(`Attempting to start Sandbox with: "${sentenceText}"`);
        gameState.startSandboxSentence(sentenceText); applyCurrentSettingsToModules(); uiManager.showGameUI(); uiManager.renderSentence(sentenceText); uiManager.resetStatsDisplay();
        const firstChar = gameState.getTargetCharacterRaw(); if (firstChar !== null) uiManager.highlightCharacter(gameState.currentCharIndex, firstChar); else uiManager.updateTargetPatternDisplay("");
        stopGameUpdateTimer(); console.log("Sandbox ready.");
    }

    /** Handles selection of a level from the list */
    function selectLevel(levelId) {
        console.log(`Level ${levelId} selected from list.`); // <<< Log
        if (gameState.status !== GameStatus.LEVEL_SELECT) {
            console.warn(`selectLevel called but status is not LEVEL_SELECT (${gameState.status})`);
            return; // Should only select when on the level select screen
        }
        if (levelManager.isLevelUnlocked(levelId)) {
            startGameLevel(levelId, 0); // Start the selected level
        } else {
            console.warn(`Attempted to select locked level: ${levelId}`);
        }
     }

    function handleInputHandlerInput(inputChar) { if (gameState.status === GameStatus.READY && (gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) { if (gameState.startTimer()) startGameUpdateTimer(); } }
    function handleCharacterDecode() { if (gameState.status !== GameStatus.DECODING || !(gameState.currentMode === AppMode.GAME || gameState.currentMode === AppMode.SANDBOX)) { console.warn("handleCharacterDecode called in unexpected state/mode."); return; } const sequence = gameState.currentInputSequence; const targetChar = gameState.getTargetCharacter(); gameState.clearCurrentInput(); if (!sequence) { gameState.status = GameStatus.LISTENING; if (targetChar !== null) { const targetMorse = decoder.encodeCharacter(targetChar); uiManager.updateTargetPatternDisplay(targetMorse ?? ""); } return; } const decodedChar = decoder.decodeSequence(sequence); if (decodedChar && targetChar && decodedChar === targetChar) { uiManager.updateCharacterState(gameState.currentCharIndex, 'completed'); audioPlayer.playCorrectSound(); uiManager.setPatternDisplayState('correct'); const moreChars = gameState.moveToNextCharacter(); if (moreChars) { const nextChar = gameState.getTargetCharacterRaw(); if (nextChar !== null) uiManager.highlightCharacter(gameState.currentCharIndex, nextChar); else uiManager.updateTargetPatternDisplay(""); } else { handleSentenceFinished(); } } else { gameState.registerIncorrectAttempt(); uiManager.updateCharacterState(gameState.currentCharIndex, 'incorrect'); audioPlayer.playIncorrectSound(); uiManager.setPatternDisplayState('incorrect'); gameState.status = GameStatus.LISTENING; if (targetChar !== null) { const targetMorse = decoder.encodeCharacter(targetChar); uiManager.updateTargetPatternDisplay(targetMorse ?? ""); } else { uiManager.updateTargetPatternDisplay(""); } } }
    function handleSentenceFinished() { if (gameState.status === GameStatus.SHOWING_RESULTS) return; if (gameState.status !== GameStatus.FINISHED) { if (!gameState.stopTimer()) gameState.status = GameStatus.FINISHED; } stopGameUpdateTimer(); const scores = scoreCalculator.calculateScores(gameState); let unlockedNextLevelId = null; let hasNextLevelOption = false; if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) { const unlockResult = levelManager.recordScoreAndCheckUnlocks(gameState.currentLevelId, scores); unlockedNextLevelId = unlockResult.unlockedNextLevelId; const nextSentenceDetails = levelManager.getNextSentence(gameState); hasNextLevelOption = nextSentenceDetails !== null && levelManager.isLevelUnlocked(nextSentenceDetails.levelId); } else { hasNextLevelOption = false; } uiManager.showResultsScreen(scores, unlockedNextLevelId, hasNextLevelOption, gameState.currentMode); gameState.status = GameStatus.SHOWING_RESULTS; console.log(`${gameState.currentMode} sentence finished, showing results.`); }
    function handleResultsInput(type) { if (gameState.status !== GameStatus.SHOWING_RESULTS) return; if (type === 'dit') { console.log("Results: Dit pressed - Attempting Next"); if (gameState.currentMode === AppMode.GAME) { const next = levelManager.getNextSentence(gameState); if (next && levelManager.isLevelUnlocked(next.levelId)) nextLevel(); else console.log("Results: Next ignored (No next/unlocked)."); } else { console.log("Results: Next ignored (Sandbox)."); } } else if (type === 'dah') { console.log("Results: Dah pressed - Attempting Retry"); retryLevel(); } }
    function startGameUpdateTimer() { stopGameUpdateTimer(); gameTimerIntervalId = setInterval(() => { if (gameState.isPlaying()) { uiManager.updateTimer(gameState.getCurrentElapsedTime()); uiManager.updateLiveStats(gameState); } else if (gameState.status === GameStatus.FINISHED || gameState.status === GameStatus.SHOWING_RESULTS) { uiManager.updateTimer(gameState.getCurrentElapsedTime()); stopGameUpdateTimer(); } else { stopGameUpdateTimer(); } }, 100); }
    function stopGameUpdateTimer() { if (gameTimerIntervalId !== null) { clearInterval(gameTimerIntervalId); gameTimerIntervalId = null; } }

    // --- Settings Handlers ---
    function applyWpmSetting(wpm) { decoder.updateWpm(wpm); audioPlayer.updateWpm(wpm); if (inputHandler) inputHandler.updateWpm(wpm); console.log(`WPM setting applied: ${wpm}`); }
    function applyFrequencySetting(freq) { audioPlayer.updateFrequency(freq); console.log(`Frequency setting applied: ${freq} Hz`); }
    function applySoundSetting(isEnabled) { audioPlayer.setSoundEnabled(isEnabled); console.log(`Sound setting applied: ${isEnabled}`); }
    function applyDarkModeSetting(isEnabled) { console.log(`Dark Mode setting applied: ${isEnabled}`); }
    function applyHintSetting(isVisible) { console.log(`Hint Visibility setting applied: ${isVisible}`); }
    function applyCurrentSettingsToModules() { const currentWpm = uiManager.getInitialWpm(); const currentFreq = uiManager.getInitialFrequency(); if (!inputHandler) initializeInputHandler(); applyWpmSetting(currentWpm); applyFrequencySetting(currentFreq); }

    function retryLevel() { if (gameState.currentMode === AppMode.GAME && gameState.currentLevelId !== null) { console.log(`Retrying Level ${gameState.currentLevelId}, Sentence ${gameState.currentSentenceIndex + 1}`); startGameLevel(gameState.currentLevelId, gameState.currentSentenceIndex); } else if (gameState.currentMode === AppMode.SANDBOX && gameState.currentSentence) { console.log("Retrying Sandbox sentence."); startSandboxPractice(); } else { console.warn("Retry called invalid state, returning to level select."); handleShowLevelSelect(); } }
    function nextLevel() { if (gameState.currentMode !== AppMode.GAME || gameState.currentLevelId === null) { console.warn("Next Level called outside Game mode, returning to level select."); handleShowLevelSelect(); return; } const next = levelManager.getNextSentence(gameState); if (next && levelManager.isLevelUnlocked(next.levelId)) { console.log(`Moving to next: Level ${next.levelId}, Sentence ${next.sentenceIndex + 1}`); startGameLevel(next.levelId, next.sentenceIndex); } else { console.log("No next level/sentence available or unlocked, returning to level select."); handleShowLevelSelect(); } }
    function resetProgress() { if (confirm("Reset all high scores and level progress? This cannot be undone.")) { levelManager.resetProgress(); uiManager._loadSettings(); applyInitialSettings(); uiManager._updateWpmDisplay(uiManager.getInitialWpm()); uiManager._updateFrequencyDisplay(uiManager.getInitialFrequency()); uiManager.soundToggle.checked = uiManager.getInitialSoundState(); uiManager.darkModeToggle.checked = uiManager.getInitialDarkModeState(); uiManager._applyDarkMode(uiManager.getInitialDarkModeState()); uiManager._applyHintVisibility(uiManager.getInitialHintState()); handleShowLevelSelect(); alert("Progress reset."); } }

    // --- Playback Mode Logic ---
    function playSentenceFromInput() { if (gameState.isAudioPlayingBack()) { audioPlayer.stopPlayback(); uiManager.setPlaybackButtonEnabled(true, 'Play Morse'); if (gameState.status === GameStatus.PLAYING_BACK) gameState.status = GameStatus.PLAYBACK_INPUT; return; } const sentence = uiManager.getPlaybackSentence(); if (!sentence || !sentence.trim()) { alert("Please enter a sentence."); return; } const morseSequence = decoder.encodeSentence(sentence); const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' '); uiManager.updatePlaybackMorseDisplay(displayMorse); if (!morseSequence) { alert("Could not generate Morse."); return; } uiManager.setPlaybackButtonEnabled(false, 'Stop Playback'); gameState.status = GameStatus.PLAYING_BACK; applyCurrentSettingsToModules(); audioPlayer.playMorseSequence(morseSequence, () => { uiManager.setPlaybackButtonEnabled(true, 'Play Morse'); if (gameState.status === GameStatus.PLAYING_BACK) gameState.status = GameStatus.PLAYBACK_INPUT; console.log("Playback complete."); }); }
    // --- Sandbox Mode Logic ---
    function updateSandboxPreview() { const sentence = uiManager.getSandboxSentence(); if (sentence && sentence.trim()) { const morseSequence = decoder.encodeSentence(sentence); const displayMorse = morseSequence.replace(/\|/g, ' / ').replace(/\//g,' '); uiManager.updateSandboxMorsePreview(displayMorse); } else { uiManager.updateSandboxMorsePreview(""); } }

    // --- App Initialization ---
    initializeApp();
}); // End DOMContentLoaded
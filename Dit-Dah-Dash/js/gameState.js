/**
 * js/gameState.js
 * ---------------
 * Manages the state of the application, including game progress, playback state,
 * timing, current input, and mode (Game, Sandbox, Playback, Menu).
 */

// Defines the possible states of the application (focusing on activity)
const GameStatus = {
    IDLE: 'idle',                   // App is idle, main menu likely shown
    MENU: 'menu',                   // Main menu is actively displayed
    LEVEL_SELECT: 'level_select',   // Level selection screen is active
    READY: 'ready',                 // Sentence loaded (game/sandbox), waiting for first input
    LISTENING: 'listening',         // Actively listening for first dit/dah (game/sandbox)
    TYPING: 'typing',               // Receiving dits/dahs for current character (game/sandbox)
    DECODING: 'decoding',           // Short pause after last input, deciding character (game/sandbox)
    FINISHED: 'finished',           // Sentence completed calculation phase (game/sandbox)
    SHOWING_RESULTS: 'showing_results', // Results screen is active (game/sandbox)
    PLAYBACK_INPUT: 'playback_input', // Playback screen is shown, waiting for input/play
    PLAYING_BACK: 'playing_back',     // Audio playback is active (playback)
    SANDBOX_INPUT: 'sandbox_input', // Sandbox setup screen is active
    PAUSED: 'paused'                // (Optional) Game paused state
};

// Defines the current operational mode
const AppMode = {
    MENU: 'menu',
    GAME: 'game',           // Standard level progression
    SANDBOX: 'sandbox',     // Custom sentence practice
    PLAYBACK: 'playback'    // Sentence audio playback tool
};


class GameState {
    /**
     * Initializes the GameState object.
     */
    constructor() {
        this.reset(); // Initial state setup
    }

    /**
     * Resets the application state, typically called on startup or returning to menu.
     */
     reset() {
        this.status = GameStatus.IDLE; // Start as idle, main.js will set to MENU
        this.currentMode = AppMode.MENU; // Track the mode
        // Game/Sandbox-specific state
        this.currentLevelId = null;     // null in sandbox mode
        this.currentSentenceIndex = 0;  // 0 in sandbox mode
        this.currentSentence = "";
        this.totalCharsInSentence = 0;
        this.currentCharIndex = 0;
        this.startTime = 0;
        this.endTime = 0;
        this.elapsedTime = 0;
        this.correctChars = 0;
        this.incorrectAttempts = 0;
        this.totalInputs = 0; // Game/Sandbox inputs

        // Input tracking state
        this.currentInputSequence = ""; // Morse sequence during gameplay (.,-)
        this.resultsInputSequence = ""; // Morse sequence on results screen (.,-) - REMOVED FUNCTIONALITY
        this.inputTimestamps = [];
        this.lastInputTime = 0;
        this.characterTimeoutId = null; // For game decoding timer
        this.isIambicHandling = false;
        this.iambicState = null; // 'dit' or 'dah'

        console.log("Application state reset.");
    }


    /**
     * Sets up the game state for a specific level and sentence (GAME context).
     * Assumes reset() or similar cleanup was called before this.
     * @param {number} levelId - The ID of the level being started.
     * @param {number} sentenceIndex - The index of the sentence within the level.
     * @param {string} sentenceText - The text of the sentence.
     */
    startLevelSentence(levelId, sentenceIndex, sentenceText) {
        // Reset only game-specific counters/tracking
        this.currentMode = AppMode.GAME;
        this.currentLevelId = levelId;
        this.currentSentenceIndex = sentenceIndex;
        this.currentSentence = sentenceText;
        this.totalCharsInSentence = sentenceText.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0;
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = ""; this.resultsInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;

        this._skipLeadingSpaces();
        this.status = GameStatus.READY; // Set state after setup
        console.log(`Starting Level ${levelId}, Sentence ${sentenceIndex + 1}. Mode: ${this.currentMode}, Status: ${this.status}`);
    }

    /**
     * Sets up the game state for a custom sentence (SANDBOX context).
     * @param {string} sentenceText - The custom sentence text.
     */
    startSandboxSentence(sentenceText) {
        // Reset only game-specific counters/tracking
        this.currentMode = AppMode.SANDBOX;
        this.currentLevelId = null; // No level ID in sandbox
        this.currentSentenceIndex = 0; // Only one sentence
        this.currentSentence = sentenceText;
        this.totalCharsInSentence = sentenceText.split('').filter(char => char !== ' ').length;
        this.currentCharIndex = 0;
        this.startTime = 0; this.endTime = 0; this.elapsedTime = 0;
        this.correctChars = 0; this.incorrectAttempts = 0; this.totalInputs = 0;
        this.currentInputSequence = ""; this.resultsInputSequence = "";
        this.inputTimestamps = []; this.lastInputTime = 0; this.characterTimeoutId = null;
        this.isIambicHandling = false; this.iambicState = null;

        this._skipLeadingSpaces();
        this.status = GameStatus.READY; // Set state after setup
        console.log(`Starting Sandbox. Mode: ${this.currentMode}, Status: ${this.status}`);
    }

    /** Skips leading spaces in the current sentence. */
    _skipLeadingSpaces() {
        while (this.currentCharIndex < this.currentSentence.length && this.currentSentence[this.currentCharIndex] === ' ') {
            this.currentCharIndex++;
        }
    }

     /** Starts the game/sandbox timer if status is READY. */
     startTimer() {
        if (this.status === GameStatus.READY) {
            this.startTime = performance.now();
            this.status = GameStatus.LISTENING;
            this.lastInputTime = this.startTime;
            console.log("Timer started.");
            return true;
        }
        return false;
     }

    /** Stops the game/sandbox timer and sets status to FINISHED. */
    stopTimer() {
        if (this.startTime > 0 && this.status !== GameStatus.FINISHED && this.status !== GameStatus.SHOWING_RESULTS) {
            this.endTime = performance.now();
            this.elapsedTime = this.endTime - this.startTime;
            this.status = GameStatus.FINISHED;
            console.log(`Timer stopped. Elapsed: ${this.elapsedTime.toFixed(0)}ms`);
            return true;
        }
         // Prevent stopping multiple times or if never started
         if (this.status === GameStatus.FINISHED || this.status === GameStatus.SHOWING_RESULTS) return false;
         if (this.startTime === 0) { this.status = GameStatus.FINISHED; return false; } // Mark finished if stop requested without start
        return false;
    }

    /** Updates the game/sandbox input sequence. */
    addInput(input) {
        const now = performance.now();
        this.totalInputs++; // Track game/sandbox inputs
        this.inputTimestamps.push({ input, time: now });
        this.lastInputTime = now;

        if (this.status === GameStatus.READY) {
            this.startTimer(); // Starts timer and sets status to LISTENING
            this.status = GameStatus.TYPING; // Immediately switch to TYPING on first input
            this.currentInputSequence += input;
            this.clearCharacterTimeout(); // Clear any nascent timeout
        } else if (this.status === GameStatus.LISTENING || this.status === GameStatus.TYPING || this.status === GameStatus.DECODING) {
            if (this.status === GameStatus.LISTENING) this.status = GameStatus.TYPING; // Ensure TYPING state
            this.currentInputSequence += input;
            this.clearCharacterTimeout(); // Reset timeout on each input while typing
        } else if (this.status === GameStatus.SHOWING_RESULTS) {
             // Input on results screen is now ignored (removed '..' shortcut)
             this.resultsInputSequence = ""; // Keep clear
        }
    }

    /** Clears the current game/sandbox input sequence. */
    clearCurrentInput() {
        this.currentInputSequence = "";
        this.inputTimestamps = [];
        this.clearCharacterTimeout();
        if (window.morseUIManager) { // Update UI accordingly
             window.morseUIManager.updateUserPatternDisplay("");
             // window.morseUIManager.updateInputSequenceDisplay(""); // Text display removed
             window.morseUIManager.setPatternDisplayState('default');
        }
        // Reset to listening state only if actively playing game/sandbox characters
        if (this.isPlaying()) {
            this.status = GameStatus.LISTENING;
        }
    }

     /** Clears the input sequence used on the results screen (redundant now). */
    clearResultsInput() { this.resultsInputSequence = ""; }

    /** Stores the ID for the character decode timeout. */
    setCharacterTimeout(timeoutId) { this.clearCharacterTimeout(); this.characterTimeoutId = timeoutId; }

    /** Clears the pending character decode timeout. */
    clearCharacterTimeout() { if (this.characterTimeoutId) { clearTimeout(this.characterTimeoutId); this.characterTimeoutId = null; } }

    /** Advances to the next game/sandbox character. Returns true if more chars exist, false if sentence complete. */
    moveToNextCharacter() {
        this.correctChars++;
        this.currentCharIndex++;
        while (this.currentCharIndex < this.currentSentence.length && this.currentSentence[this.currentCharIndex] === ' ') {
            this.currentCharIndex++;
        }
        this.clearCurrentInput(); // Clears sequence, updates UI, sets state to LISTENING if playing

        if (this.currentCharIndex >= this.currentSentence.length) {
            this.stopTimer(); // Sets status to FINISHED
            console.log("Sentence finished!");
            return false; // No more characters
        } else {
            console.log(`Moved to character index: ${this.currentCharIndex} ('${this.getTargetCharacter()}')`);
            // Set state back to LISTENING explicitly after moving
            this.status = GameStatus.LISTENING;
            return true; // More characters remain
        }
    }


    /** Records an incorrect game/sandbox attempt. */
    registerIncorrectAttempt() {
        this.incorrectAttempts++;
        console.log("Incorrect attempt registered. Total:", this.incorrectAttempts);
    }

    /** Checks if the game is in an active playing state (input matters for game/sandbox). */
    isPlaying() {
        return (this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) &&
               (this.status === GameStatus.LISTENING ||
               this.status === GameStatus.TYPING ||
               this.status === GameStatus.DECODING);
    }

     /** Checks if audio playback is active. */
     isAudioPlayingBack() {
         return this.currentMode === AppMode.PLAYBACK && this.status === GameStatus.PLAYING_BACK;
     }

    /** Gets the target game/sandbox character (uppercase or space). */
    getTargetCharacter() {
        const targetStates = [GameStatus.READY, GameStatus.LISTENING, GameStatus.TYPING, GameStatus.DECODING];
        if ((this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) &&
            targetStates.includes(this.status) && this.currentCharIndex < this.currentSentence.length) {
             const char = this.currentSentence[this.currentCharIndex];
             return char === ' ' ? ' ' : char.toUpperCase();
        } return null;
    }

     /** Gets the target game/sandbox character (raw case). */
     getTargetCharacterRaw() {
         const targetStates = [GameStatus.READY, GameStatus.LISTENING, GameStatus.TYPING, GameStatus.DECODING];
          if ((this.currentMode === AppMode.GAME || this.currentMode === AppMode.SANDBOX) &&
              targetStates.includes(this.status) && this.currentCharIndex < this.currentSentence.length) {
             return this.currentSentence[this.currentCharIndex];
         } return null;
     }

    /** Gets the current calculated elapsed game/sandbox time. */
    getCurrentElapsedTime() {
        if (this.startTime === 0) return 0;
        if (this.status === GameStatus.FINISHED || this.status === GameStatus.SHOWING_RESULTS) {
             // Handle case where stopTimer() was called but endTime wasn't set (e.g., manual finish)
             if (this.status === GameStatus.FINISHED && this.endTime === 0) return performance.now() - this.startTime;
            return this.elapsedTime;
        }
        // READY, LISTENING, TYPING, DECODING all count as active timing
        if (this.status === GameStatus.READY || this.isPlaying()) return performance.now() - this.startTime;

        return 0; // Return 0 if not actively timing
    }
}

// Create global instance & expose status/mode enums
window.morseGameState = new GameState();
window.GameStatus = GameStatus; // Make enum accessible globally
window.AppMode = AppMode;       // Make enum accessible globally
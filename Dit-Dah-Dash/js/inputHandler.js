/**
 * js/inputHandler.js
 * ------------------
 * Handles user input from main Dit/Dah paddles (touch/mouse/keyboard).
 * Implements automatic repetition and Iambic B keying for game/sandbox.
 * Handles separate input logic for RESULTS mode using the same paddles.
 * Ensures correct visual feedback for keyboard input.
 */

class InputHandler {
    /**
     * @constructor
     * @param {GameState} gameState - Central game state manager.
     * @param {MorseDecoder} decoder - Handles Morse decoding/timing.
     * @param {AudioPlayer} audioPlayer - Handles audio generation.
     * @param {UIManager} uiManager - Handles DOM updates and button feedback.
     * @param {object} callbacks - Functions for input events.
     * @param {function} callbacks.onInput - Callback for dit/dah during gameplay/sandbox.
     * @param {function} callbacks.onCharacterDecode - Callback for character decode attempt in gameplay/sandbox.
     * @param {function} callbacks.onResultsInput - Callback for dit/dah on results screen.
     */
    constructor(gameState, decoder, audioPlayer, uiManager, callbacks) {
        this.gameState = gameState;
        this.decoder = decoder;
        this.audioPlayer = audioPlayer;
        this.uiManager = uiManager;
        this.callbacks = callbacks; // { onInput, onCharacterDecode, onResultsInput }

        // DOM Elements (Main Paddles Only)
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        this.playbackInput = document.getElementById('playback-input'); // To ignore kbd focus
        this.sandboxInput = document.getElementById('sandbox-input');   // To ignore kbd focus

        // Input State
        this.ditPressed = false;      // Mouse/Touch
        this.dahPressed = false;      // Mouse/Touch
        this.ditKeyPressed = false;   // Keyboard '.' or 'e'
        this.dahKeyPressed = false;   // Keyboard '-' or 't'

        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null; // 'dit' or 'dah'
        this.lastDitEmitTime = 0;
        this.lastDahEmitTime = 0;

        // Timing (derived from WPM)
        this.wpm = MorseConfig.DEFAULT_WPM;
        this.ditDuration = 0;
        this.dahDuration = 0;
        this.intraCharGap = 0;

        // Timers
        this.ditIntervalId = null;
        this.dahIntervalId = null;
        this.iambicTimeoutId = null;

        // Bind event listeners
        this._bindEvents();
        this.updateWpm(uiManager.getInitialWpm());
    }

    /** Updates WPM and recalculates timing values. */
    updateWpm(newWpm) {
        if (newWpm <= 0) return;
        this.wpm = newWpm;
        const baseDit = 1200 / this.wpm;
        this.ditDuration = baseDit; this.dahDuration = baseDit * 3;
        this.intraCharGap = baseDit * MorseConfig.INTRA_CHAR_GAP_MULTIPLIER;
        console.log(`InputHandler timings updated for ${newWpm} WPM: Dit=${this.ditDuration.toFixed(0)}ms, Dah=${this.dahDuration.toFixed(0)}ms, Gap=${this.intraCharGap.toFixed(0)}ms`);
        this.audioPlayer.updateWpm(newWpm); this.decoder.updateWpm(newWpm);
    }

    /** Central handler for press events (touch, mouse, key). */
    _press(type, method) {
        // Determine context
        const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                   (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (!isGameInputContext && !isResultsContext) return; // Ignore if not in valid context

        const now = performance.now();
        let statePossiblyChanged = false;
        let pressStartTimeKey = (type === 'dit') ? 'dit' : 'dah';

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && !this.ditPressed) { this.ditPressed = true; statePossiblyChanged = true; }
            else if (method === 'key' && !this.ditKeyPressed) { this.ditKeyPressed = true; statePossiblyChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && !this.dahPressed) { this.dahPressed = true; statePossiblyChanged = true; }
            else if (method === 'key' && !this.dahKeyPressed) { this.dahKeyPressed = true; statePossiblyChanged = true; }
        }

        if (statePossiblyChanged) {
            this.pressStartTime[pressStartTimeKey] = now;
            const isCurrentlyActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
            this.uiManager.setButtonActive(type, isCurrentlyActive); // Update UI

            if (isResultsContext) {
                this._handleResultsInput(type); // Directly handle results input on press
            } else if (isGameInputContext) {
                 this.decoder.cancelScheduledDecode(); // Cancel game decode on new press
                 this._processInputStateChange(); // Re-evaluate iambic/repeat for game
            }
        }
    }

    /** Central handler for release events (touch, mouse, key). */
    _release(type, method) {
        // Only process releases relevant to active modes
        const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX);
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (!isGameInputContext && !isResultsContext) return; // Ignore if not in valid context

        let statePossiblyChanged = false;

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) { this.ditPressed = false; statePossiblyChanged = true; }
            else if (method === 'key' && this.ditKeyPressed) { this.ditKeyPressed = false; statePossiblyChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) { this.dahPressed = false; statePossiblyChanged = true; }
            else if (method === 'key' && this.dahKeyPressed) { this.dahKeyPressed = false; statePossiblyChanged = true; }
        }

        if (statePossiblyChanged) {
            // Check if *any* press method is still active for this button type
            const isStillActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
            this.uiManager.setButtonActive(type, isStillActive); // Update UI based on remaining presses

            // Only reprocess game input state if the release was for game paddles
            if (isGameInputContext && (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
                 this._processInputStateChange(); // Re-evaluate iambic/repeat/decode for game
            }
            // No special action needed on release for results context
        }
    }


    /** Binds touch, mouse and keyboard event listeners to main paddles. */
    _bindEvents() {
        // Touch Events
        this.ditButton.addEventListener('touchstart', (e) => this._handlePressStart(e, 'dit'), { passive: false });
        this.dahButton.addEventListener('touchstart', (e) => this._handlePressStart(e, 'dah'), { passive: false });
        // Mouse Events
        this.ditButton.addEventListener('mousedown', (e) => this._handlePressStart(e, 'dit'));
        this.dahButton.addEventListener('mousedown', (e) => this._handlePressStart(e, 'dah'));
        // Global Release Handlers
        document.addEventListener('touchend', this._handlePressEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this._handlePressEnd.bind(this), { passive: false });
        document.addEventListener('mouseup', this._handlePressEnd.bind(this));
        // Prevent Context Menu
        [this.ditButton, this.dahButton].forEach(button => button.addEventListener('contextmenu', e => e.preventDefault()));
        // Keyboard Events
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    _handleKeyDown(event) {
        const targetElement = event.target;
        if (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') { return; }

        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (!isGameContext && !isResultsContext) return;
        if (event.repeat) return;

        if (event.key === '.' || event.key === 'e' || event.key === '0') { // Dit
            event.preventDefault();
            if (!this.ditKeyPressed) this._press('dit', 'key'); // Let _press handle context
        } else if (event.key === '-' || event.key === 't' || event.key === 'T') { // Dah
            event.preventDefault();
            if (!this.dahKeyPressed) this._press('dah', 'key'); // Let _press handle context
        }
    }

    _handleKeyUp(event) {
         const targetElement = event.target;
         if (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA') { return; }

        if (event.key === '.' || event.key === 'e' || event.key === '0') { // Dit release
            event.preventDefault();
            if (this.ditKeyPressed) this._release('dit', 'key');
         }
        else if (event.key === '-' || event.key === 't' || event.key === 'T') { // Dah release
            event.preventDefault();
            if (this.dahKeyPressed) this._release('dah', 'key');
         }
    }

    _handlePressStart(event, type) {
        event.preventDefault();
        this.audioPlayer.initializeAudioContext();
        this._press(type, event.type.startsWith('touch') ? 'touch' : 'mouse');
    }

     _handlePressEnd(event) {
         const checkRelease = (button, type) => {
             if (event.type === 'mouseup') {
                 if (type === 'dit' && this.ditPressed) { this._release(type, 'mouse'); return true; }
                 if (type === 'dah' && this.dahPressed) { this._release(type, 'mouse'); return true; }
             } else if (event.type === 'touchend' || event.type === 'touchcancel') {
                 for (let i = 0; i < event.changedTouches.length; i++) {
                     const touch = event.changedTouches[i];
                     const targetAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
                     if (button === targetAtPoint || button.contains(targetAtPoint)) {
                         if (type === 'dit' && this.ditPressed) { this._release(type, 'touch'); return true; }
                         if (type === 'dah' && this.dahPressed) { this._release(type, 'touch'); return true; }
                         break;
                     }
                 }
             }
             return false;
         };

         let releasedDit = checkRelease(this.ditButton, 'dit');
         let releasedDah = checkRelease(this.dahButton, 'dah');

         // Fallback for touches ending off-element
          if ((event.type === 'touchend' || event.type === 'touchcancel')) {
              if (this.ditPressed && !releasedDit && !this.isTouchActiveOnElement(event.touches, this.ditButton)) this._release('dit', 'touch');
              if (this.dahPressed && !releasedDah && !this.isTouchActiveOnElement(event.touches, this.dahButton)) this._release('dah', 'touch');
          }
     }

     /** Helper to check if any active touches are over a specific element */
     isTouchActiveOnElement(touchList, element) {
        for (let i = 0; i < touchList.length; i++) { const touch = touchList[i]; const targetAtPoint = document.elementFromPoint(touch.clientX, touch.clientY); if (element === targetAtPoint || element.contains(targetAtPoint)) return true; } return false;
     }


    /** Central logic to determine input mode (gameplay/sandbox only). */
    _processInputStateChange() {
         if (!((this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying()))) { this._clearAllTimers(); return; }

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;

        this._clearAllTimers(); // Clear previous timers

        if ((isDitActive || isDahActive) && (this.gameState.status === GameStatus.LISTENING || this.gameState.status === GameStatus.DECODING)) {
            this.decoder.cancelScheduledDecode();
            if (this.gameState.status === GameStatus.DECODING) { this.gameState.status = GameStatus.TYPING; }
        }

        if (isDitActive && isDahActive) { // Iambic B
            this.gameState.isIambicHandling = true;
            const lastPressTimeDit = this.pressStartTime.dit || 0; const lastPressTimeDah = this.pressStartTime.dah || 0;
            this.gameState.iambicState = (lastPressTimeDah > lastPressTimeDit) ? 'dah' : 'dit';
            this._triggerIambicOutput();
        } else if (isDitActive) { // Dit only
            this.gameState.isIambicHandling = true; this.gameState.iambicState = 'dit';
            this._startAutoRepeat('dit');
        } else if (isDahActive) { // Dah only
            this.gameState.isIambicHandling = true; this.gameState.iambicState = 'dah';
            this._startAutoRepeat('dah');
        } else { // No active input
            this.gameState.isIambicHandling = false; this.gameState.iambicState = null;
             if (this.gameState.currentInputSequence && (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.DECODING)) {
                this._scheduleDecodeAfterDelay();
             }
        }
    }

    /** Starts automatic repetition (gameplay/sandbox only). */
    _startAutoRepeat(type) {
        const elementDuration = (type === 'dit' ? this.ditDuration : this.dahDuration);
        const interval = elementDuration + this.intraCharGap;

        const repeatAction = () => {
            const isDitGameActive = this.ditPressed || this.ditKeyPressed; const isDahGameActive = this.dahPressed || this.dahKeyPressed;
            if (((type === 'dit' && isDitGameActive && !isDahGameActive) || (type === 'dah' && isDahGameActive && !isDitGameActive)) && this.gameState.isPlaying()) {
                this._emitInput(type, false); // Emit game element
                const timerId = setTimeout(repeatAction, interval);
                if (type === 'dit') { this.ditIntervalId = timerId; } else { this.dahIntervalId = timerId; }
            } else { this._clearAllTimers(); this._processInputStateChange(); }
        };

        if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
             this._emitInput(type, false); // Emit first element
             const firstTimerId = setTimeout(repeatAction, interval);
             if (type === 'dit') { this.ditIntervalId = firstTimerId; } else { this.dahIntervalId = firstTimerId; }
        } else { this._clearAllTimers(); }
    }


    /** Emits a single Dit or Dah input, routing based on context. */
    _emitInput(type, isManualResultsCall = false) { // isManualResultsCall only used by _handleResultsInput
        const now = performance.now();
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS || isManualResultsCall;

        // Apply rate limiting only to game inputs
        if (!isResultsContext) {
             let minTimeSinceLastEmit = (type === 'dit') ? (this.ditDuration * 0.5) : (this.dahDuration * 0.5);
             let lastEmitTime = (type === 'dit') ? this.lastDitEmitTime : this.lastDahEmitTime;
             if (now - lastEmitTime < minTimeSinceLastEmit) return;
        }

        if (type === 'dit') { this.lastDitEmitTime = now; } else { this.lastDahEmitTime = now; }

        this.audioPlayer.playTone(type); // Play tone always
        const morseChar = (type === 'dit') ? '.' : '-';

        if (isResultsContext) {
            if (this.callbacks.onResultsInput) this.callbacks.onResultsInput(type);
        } else { // Game/Sandbox Input
            if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                 this.gameState.addInput(morseChar);
                 this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);
                 if (this.callbacks.onInput) this.callbacks.onInput(morseChar);
            }
        }
        this.lastInputTypeGenerated = type;
    }


    /** Triggers the next output in an Iambic sequence (gameplay only). */
    _triggerIambicOutput() {
        this._clearIambicTimeout();
        const isDitGameActive = this.ditPressed || this.ditKeyPressed; const isDahGameActive = this.dahPressed || this.dahKeyPressed;
        if (!this.gameState.isIambicHandling || !isDitGameActive || !isDahGameActive || !this.gameState.isPlaying()) { this._processInputStateChange(); return; }
        const elementToSend = this.gameState.iambicState; if (!elementToSend) { console.error("Iambic state is null."); this._clearAllTimers(); this._processInputStateChange(); return; }
        this._emitInput(elementToSend, false); // Emit game element
        const nextElement = (elementToSend === 'dit') ? 'dah' : 'dit'; this.gameState.iambicState = nextElement;
        const currentDuration = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration); const delay = currentDuration + this.intraCharGap;
        this.iambicTimeoutId = setTimeout(() => this._triggerIambicOutput(), delay);
    }


    /** Schedules the character decode function (gameplay/sandbox only). */
     _scheduleDecodeAfterDelay() {
         if (!this.gameState.currentInputSequence || this.gameState.status !== GameStatus.TYPING || !(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) { this.gameState.isIambicHandling = false; this.gameState.iambicState = null; if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) { this.gameState.status = GameStatus.LISTENING; } return; }
         this.gameState.status = GameStatus.DECODING;
         this.decoder.scheduleDecode(() => {
             if (this.gameState.status === GameStatus.DECODING && (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) { if (this.callbacks.onCharacterDecode) this.callbacks.onCharacterDecode(); }
             else { if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) { this.gameState.clearCurrentInput(); if (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) { this.gameState.status = GameStatus.LISTENING; } } }
             this.gameState.isIambicHandling = false; this.gameState.iambicState = null;
         });
     }

     /** Directly handles input on the results screen (called by _press). */
    _handleResultsInput(type) {
        if (this.gameState.status !== GameStatus.SHOWING_RESULTS) return;
        console.log(`Results Input Detected: ${type}`);
        // We emit here to get audio feedback, but the main action happens in main.js's callback
        this._emitInput(type, true); // True signifies this is for results context
    }

    /** Clears all iambic/repeat generation timers. */
    _clearAllTimers() { if (this.iambicTimeoutId) { clearTimeout(this.iambicTimeoutId); this.iambicTimeoutId = null; } if (this.ditIntervalId) { clearTimeout(this.ditIntervalId); this.ditIntervalId = null; } if (this.dahIntervalId) { clearTimeout(this.dahIntervalId); this.dahIntervalId = null; } }
     /** Clears the specific iambic timeout. */
     _clearIambicTimeout() { if (this.iambicTimeoutId) { clearTimeout(this.iambicTimeoutId); this.iambicTimeoutId = null; } }
}
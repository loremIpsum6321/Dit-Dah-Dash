/**
 * js/inputHandler.js
 * ------------------
 * Handles user input from main Dit/Dah paddles (touch/mouse/keyboard).
 * Implements automatic repetition and Iambic B keying for game/sandbox.
 * Triggers discrete audio tones for each generated Morse element.
 * Handles separate input logic for RESULTS mode using the same paddles.
 * Ensures correct visual feedback for keyboard input.
 * Fixes call to audioPlayer for input tones.
 * Adds timing check to prevent duplicate iambic inputs.
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
        this.settingsModal = document.getElementById('settings-modal'); // To ignore kbd focus when modal open

        // Input State
        this.ditPressed = false;      // Mouse/Touch
        this.dahPressed = false;      // Mouse/Touch
        this.ditKeyPressed = false;   // Keyboard '.' or 'e' or '0'
        this.dahKeyPressed = false;   // Keyboard '-' or 't' or 'T'

        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null; // 'dit' or 'dah'
        this.lastEmitTime = 0; // Timestamp of the *start* of the last emitted element (sound)

        // Timing (derived from WPM) - Used for sequence generation timing
        this.wpm = MorseConfig.DEFAULT_WPM;
        this.ditDuration = 0; // ms - duration of the sound/element
        this.dahDuration = 0; // ms - duration of the sound/element
        this.intraCharGap = 0; // ms - gap *after* an element within a char

        // Timers
        this.repeatOrIambicTimerId = null; // Single timer for auto-repeat or iambic logic

        // Bind event listeners
        this._bindEvents();
        this.updateWpm(uiManager.getInitialWpm());
    }

    /** Updates WPM and recalculates timing values for sequence generation. */
    updateWpm(newWpm) {
        if (newWpm <= 0) return;
        this.wpm = newWpm;
        const baseDit = 1200 / this.wpm; // Dit duration in milliseconds
        this.ditDuration = baseDit;
        this.dahDuration = baseDit * MorseConfig.DAH_DURATION_UNITS;
        this.intraCharGap = baseDit * MorseConfig.INTRA_CHARACTER_GAP_UNITS;
        console.log(`InputHandler sequence timings updated for ${newWpm} WPM: Dit=${this.ditDuration.toFixed(0)}ms, Dah=${this.dahDuration.toFixed(0)}ms, IntraGap=${this.intraCharGap.toFixed(0)}ms`);
        this.audioPlayer.updateWpm(newWpm); // Keep audio player WPM in sync
        this.decoder.updateWpm(newWpm); // Keep decoder WPM in sync
    }

    /** Central handler for press events (touch, mouse, key). */
    _press(type, method) {
        const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                   (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (!isGameInputContext && !isResultsContext) return;

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
            this.uiManager.setButtonActive(type, isCurrentlyActive);

            if (isResultsContext) {
                // Use playInputTone for immediate feedback, allows cancellation
                this.audioPlayer.playInputTone(type);
                if (this.callbacks.onResultsInput) this.callbacks.onResultsInput(type);
            } else if (isGameInputContext) {
                 this.decoder.cancelScheduledDecode();
                 this._processInputStateChange();
            }
        }
    }

    /** Central handler for release events (touch, mouse, key). */
    _release(type, method) {
        const mightBeRelevantContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX || this.gameState.status === GameStatus.SHOWING_RESULTS);

        if (!mightBeRelevantContext) return;

        let statePossiblyChanged = false;

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) { this.ditPressed = false; statePossiblyChanged = true; }
            else if (method === 'key' && this.ditKeyPressed) { this.ditKeyPressed = false; statePossiblyChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) { this.dahPressed = false; statePossiblyChanged = true; }
            else if (method === 'key' && this.dahKeyPressed) { this.dahKeyPressed = false; statePossiblyChanged = true; }
        }

        if (statePossiblyChanged) {
            const isStillActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);

            // Stop the specific input tone only if this type is fully released
            if (!isStillActive) {
                 // Check if the currently playing input tone matches the released type
                 if (this.audioPlayer.inputToneNode && this.audioPlayer.inputToneNode.type === type) {
                     this.audioPlayer.stopInputTone();
                 }
            }

            this.uiManager.setButtonActive(type, isStillActive);

             const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);
             if (isGameInputContext) {
                  this._processInputStateChange();
             }
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
        if (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || !this.settingsModal?.classList.contains('hidden')) {
            return;
        }

        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (!isGameContext && !isResultsContext) return;
        if (event.repeat) return; // Ignore keyboard auto-repeat

        if (event.key === '.' || event.key === 'e' || event.key === '0') { // Dit
            event.preventDefault();
            if (!this.ditKeyPressed) this._press('dit', 'key');
        } else if (event.key === '-' || event.key === 't' || event.key === 'T') { // Dah
            event.preventDefault();
            if (!this.dahKeyPressed) this._press('dah', 'key');
        }
    }

    _handleKeyUp(event) {
         const targetElement = event.target;
         if (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || !this.settingsModal?.classList.contains('hidden')) {
             return;
         }

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
         // Handle release correctly for both mouse and touch, considering multiple touches
         let releasedDit = false;
         let releasedDah = false;

         if (event.type === 'mouseup') {
             // Mouse release is simpler, assume release if button was pressed
             if (this.ditPressed) { releasedDit = this._release('dit', 'mouse'); }
             if (this.dahPressed) { releasedDah = this._release('dah', 'mouse'); }
         } else if (event.type === 'touchend' || event.type === 'touchcancel') {
              // Check changed touches to see which specific touches ended
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 const targetAtTouchEnd = document.elementFromPoint(touch.clientX, touch.clientY);

                 // Check if the touch ending corresponds to one of our buttons
                 if (this.ditPressed && (this.ditButton === targetAtTouchEnd || this.ditButton.contains(targetAtTouchEnd))) {
                     // If this touch ending was over the dit button, try to release dit
                     if (!this.isTouchActiveOnElement(event.touches, this.ditButton)) { // Ensure no *other* touches are still on dit
                         releasedDit = this._release('dit', 'touch');
                     }
                 }
                 if (this.dahPressed && (this.dahButton === targetAtTouchEnd || this.dahButton.contains(targetAtTouchEnd))) {
                    // If this touch ending was over the dah button, try to release dah
                     if (!this.isTouchActiveOnElement(event.touches, this.dahButton)) { // Ensure no *other* touches are still on dah
                        releasedDah = this._release('dah', 'touch');
                     }
                 }
             }
             // Fallback: If a button was pressed but no specific touch end matched it,
             // release it if there are *no remaining active touches* on it.
             if (this.ditPressed && !releasedDit && !this.isTouchActiveOnElement(event.touches, this.ditButton)) {
                 this._release('dit', 'touch');
             }
             if (this.dahPressed && !releasedDah && !this.isTouchActiveOnElement(event.touches, this.dahButton)) {
                 this._release('dah', 'touch');
             }
         }
     }

     /** Helper to check if any active touches (from a TouchList) are currently over a specific element */
     isTouchActiveOnElement(touchList, element) {
        for (let i = 0; i < touchList.length; i++) {
            const touch = touchList[i];
            const targetAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
            if (element === targetAtPoint || element.contains(targetAtPoint)) {
                return true; // Found an active touch on the element
            }
        }
        return false; // No active touches found on the element
     }


    /** Central logic to determine input mode (gameplay/sandbox only) and manage timers. */
    _processInputStateChange() {
         if (!((this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING))) {
            this._clearRepeatOrIambicTimer();
            this.lastEmitTime = 0; // Reset last emit time when not in active game context
            return;
         }

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;

        this._clearRepeatOrIambicTimer(); // Stop any pending repeat/iambic action

         // If input happens during decoding, cancel decode and go back to typing
         if ((isDitActive || isDahActive) && this.gameState.status === GameStatus.DECODING) {
             this.decoder.cancelScheduledDecode();
             this.gameState.status = GameStatus.TYPING;
         }

        if (isDitActive && isDahActive) {
            // Iambic Mode
            this.gameState.isIambicHandling = true;
            const lastPressTimeDit = this.pressStartTime.dit || 0;
            const lastPressTimeDah = this.pressStartTime.dah || 0;
            // Set the *next* element to be sent based on which was pressed last
            this.gameState.iambicState = (lastPressTimeDah > lastPressTimeDit) ? 'dah' : 'dit';
            // Immediately trigger the first output if timing allows
            this._triggerRepeatOrIambicOutput();
        } else if (isDitActive) {
            // Dit Only Mode (Repeat)
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dit';
            this._triggerRepeatOrIambicOutput();
        } else if (isDahActive) {
            // Dah Only Mode (Repeat)
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dah';
            this._triggerRepeatOrIambicOutput();
        } else { // No active input
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
             // If input sequence exists and we were typing, schedule decode
             if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                this._scheduleDecodeAfterDelay();
             } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                 // If typing but sequence is empty (e.g., after incorrect clear), go back to listening
                 this.gameState.status = GameStatus.LISTENING;
             }
             // No timer needed if no keys are pressed
        }
    }

    /** Emits a single Dit or Dah to the game state sequence AND triggers audio feedback. */
    _emitInputToSequence(type) {
        const now = performance.now();
        const morseChar = (type === 'dit') ? '.' : '-';

        if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
             this.gameState.addInput(morseChar); // Adds to sequence and updates state
             this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);
             this.audioPlayer.playInputTone(type); // Play the discrete tone
             if (this.callbacks.onInput) this.callbacks.onInput(morseChar);
             this.lastInputTypeGenerated = type;
             this.lastEmitTime = now; // Record the time this element *started*
        }
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence, checking timing. */
    _triggerRepeatOrIambicOutput() {
        this._clearRepeatOrIambicTimer(); // Clear previous timer before deciding next action

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;
        const elementToSend = this.gameState.iambicState; // Which element *should* be sent next

        // --- Sanity Checks & State Validation ---
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
            this.lastEmitTime = 0; return; // Not in a state to send input
        }
        if (!elementToSend) {
             console.error("Iambic/Repeat state is null when trying to trigger output.");
             this.lastEmitTime = 0;
             this._processInputStateChange(); // Re-evaluate state
             return;
        }

        // --- Check if the correct keys are still pressed for the current mode ---
        if (this.gameState.isIambicHandling && (!isDitActive || !isDahActive)) {
             // Switched from iambic to single key press, re-evaluate
             this._processInputStateChange();
             return;
        }
        if (!this.gameState.isIambicHandling && elementToSend === 'dit' && !isDitActive) {
            // Dit was released, stop repeating/re-evaluate
            this._processInputStateChange();
            return;
        }
        if (!this.gameState.isIambicHandling && elementToSend === 'dah' && !isDahActive) {
            // Dah was released, stop repeating/re-evaluate
            this._processInputStateChange();
            return;
        }

        // --- Timing Check (Prevent Duplicate Inputs) ---
        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        const lastElementDuration = (this.lastInputTypeGenerated === 'dit' ? this.ditDuration : this.dahDuration);
        const requiredTime = lastElementDuration + this.intraCharGap; // Time needed after last emit START

        // If not enough time has passed since the START of the last emitted element, wait.
        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTime) {
            // Not enough time passed, schedule the check again after the remaining time
            const remainingTime = requiredTime - timeSinceLastEmit;
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(10, remainingTime)); // Min 10ms delay
            // console.log(`Timing check failed: ${timeSinceLastEmit.toFixed(0)} < ${requiredTime.toFixed(0)}. Rescheduling in ${remainingTime.toFixed(0)}ms`); // Debug
            return;
        }
        // console.log(`Timing check passed: ${timeSinceLastEmit.toFixed(0)} >= ${requiredTime.toFixed(0)}`); // Debug

        // --- Emit the Element ---
        this._emitInputToSequence(elementToSend); // Emits sound and updates game state/UI

        // --- Prepare for Next Element (Iambic/Repeat) ---
        const currentElementDuration = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
        const delayForNext = currentElementDuration + this.intraCharGap; // Delay until the *next* element can START

        // If in iambic mode, flip the state for the *next* potential element
        if (this.gameState.isIambicHandling) {
            this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit';
        }
        // If not iambic, iambicState remains the same (e.g., 'dit' for dit-repeat)

        // Schedule the next call to this function after the calculated delay
        this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), delayForNext);
    }



    /** Schedules the character decode function (gameplay/sandbox only). */
     _scheduleDecodeAfterDelay() {
         // Only schedule if there's input and we are in typing state
         if (!this.gameState.currentInputSequence || this.gameState.status !== GameStatus.TYPING || !(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) {
            // Reset state if necessary
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
            if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                this.gameState.status = GameStatus.LISTENING; // Go back to listening if sequence is empty
            }
            return;
         }

         // Set status to decoding *before* scheduling timeout
         this.gameState.status = GameStatus.DECODING;
         this.decoder.scheduleDecode(() => {
             // This callback runs *after* the timeout defined in decoder.scheduleDecode

             // Only decode if we are *still* in the DECODING state and in the right mode
             if (this.gameState.status === GameStatus.DECODING && (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) {
                 if (this.callbacks.onCharacterDecode) {
                     this.callbacks.onCharacterDecode(); // Trigger the main decode logic
                 }
             }
             // After decode attempt (whether successful or not), reset iambic state.
             // The main decode logic in main.js should set the status back to LISTENING or handle FINISHED state.
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
             // Check if state is stuck in decoding (e.g., decode logic failed), reset to listening as fallback
             if (this.gameState.status === GameStatus.DECODING && this.gameState.currentMode !== AppMode.MENU) {
                 console.warn("State was DECODING after decode callback finished, resetting to LISTENING.");
                 this.gameState.clearCurrentInput(); // Ensure input is cleared too
                 this.gameState.status = GameStatus.LISTENING;
             }
         });
     }

    /** Clears the single iambic/repeat generation timer. */
    _clearRepeatOrIambicTimer() {
        if (this.repeatOrIambicTimerId) {
            clearTimeout(this.repeatOrIambicTimerId);
            this.repeatOrIambicTimerId = null;
        }
    }
}
/* In file: js/inputHandler.js */
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
 * Implements a single-input queue to handle rapid inputs during audio playback.
 * Refined queue processing via onToneEnd callback for better responsiveness.
 * Ensures decode check happens after processing queued input.
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
        this.queuedInput = null; // Single input queue ('dit' or 'dah')

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

        // --- Queueing Check (Game Context Only) ---
        if (isGameInputContext && this.audioPlayer.inputToneNode) {
            if (this.queuedInput === null) {
                this.queuedInput = type;
                // console.log(`Audio busy on press, queued: ${type}`); // Debug
                const wasDitActive = this.ditPressed || this.ditKeyPressed;
                const wasDahActive = this.dahPressed || this.dahKeyPressed;
                 if (type === 'dit' && !wasDitActive) this.uiManager.setButtonActive('dit', true);
                 if (type === 'dah' && !wasDahActive) this.uiManager.setButtonActive('dah', true);
                 if (type === 'dit') { if (method === 'key') this.ditKeyPressed = true; else this.ditPressed = true; }
                 else { if (method === 'key') this.dahKeyPressed = true; else this.dahPressed = true; }
                return;
            } else {
                 // console.log(`Audio busy on press, queue full. Ignored: ${type}`); // Debug
                 return;
            }
        }

        // --- Standard Press Processing ---
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
            this.uiManager.setButtonActive(type, isStillActive);

             const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);

             // Process queue *first* if applicable
             if (isGameInputContext && this.queuedInput !== null && !this.audioPlayer.inputToneNode) {
                 this.handleToneEnd(); // Manually trigger queue processing
             }

             // Then process the state change due to the release itself
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

        if ((isGameContext || isResultsContext) && (event.key === '.' || event.key === 'e' || event.key === '0' || event.key === '-' || event.key === 't' || event.key === 'T')) {
            if (!event.repeat) {
                event.preventDefault();
                if (event.key === '.' || event.key === 'e' || event.key === '0') { // Dit
                    if (!this.ditKeyPressed) this._press('dit', 'key');
                } else if (event.key === '-' || event.key === 't' || event.key === 'T') { // Dah
                    if (!this.dahKeyPressed) this._press('dah', 'key');
                }
            }
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
         let releasedType = null;

         if (event.type === 'mouseup') {
             if (this.ditPressed) { releasedType = 'dit'; this._release('dit', 'mouse'); }
             if (this.dahPressed) { releasedType = 'dah'; this._release('dah', 'mouse'); }
         } else if (event.type === 'touchend' || event.type === 'touchcancel') {
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 const targetAtTouchEnd = document.elementFromPoint(touch.clientX, touch.clientY);

                 if (this.ditPressed && (this.ditButton === targetAtTouchEnd || this.ditButton.contains(targetAtTouchEnd))) {
                     if (!this.isTouchActiveOnElement(event.touches, this.ditButton)) {
                         releasedType = 'dit'; this._release('dit', 'touch');
                     }
                 }
                 if (this.dahPressed && (this.dahButton === targetAtTouchEnd || this.dahButton.contains(targetAtTouchEnd))) {
                     if (!this.isTouchActiveOnElement(event.touches, this.dahButton)) {
                        releasedType = 'dah'; this._release('dah', 'touch');
                     }
                 }
             }
             if (this.ditPressed && releasedType !== 'dit' && !this.isTouchActiveOnElement(event.touches, this.ditButton)) {
                 this._release('dit', 'touch');
             }
             if (this.dahPressed && releasedType !== 'dah' && !this.isTouchActiveOnElement(event.touches, this.dahButton)) {
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
                return true;
            }
        }
        return false;
     }


    /** Central logic to determine input mode (gameplay/sandbox only) and manage timers. */
    _processInputStateChange() {
         const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                    (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);

         if (!isGameInputContext) {
            this._clearRepeatOrIambicTimer();
            this.lastEmitTime = 0;
            this.queuedInput = null;
            return;
         }

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;

        this._clearRepeatOrIambicTimer();

         if ((isDitActive || isDahActive) && this.gameState.status === GameStatus.DECODING) {
             this.decoder.cancelScheduledDecode();
             this.gameState.status = GameStatus.TYPING;
         }

        if (isDitActive && isDahActive) {
            this.gameState.isIambicHandling = true;
            const lastPressTimeDit = this.pressStartTime.dit || 0;
            const lastPressTimeDah = this.pressStartTime.dah || 0;
            if (this.gameState.iambicState === null) {
                this.gameState.iambicState = (lastPressTimeDah > lastPressTimeDit) ? 'dah' : 'dit';
            }
            this._triggerRepeatOrIambicOutput();
        } else if (isDitActive) {
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dit';
            this._triggerRepeatOrIambicOutput();
        } else if (isDahActive) {
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dah';
            this._triggerRepeatOrIambicOutput();
        } else { // No active input
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
             if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                // Only schedule decode if no queue and no audio playing - let handleToneEnd do it otherwise
                if (this.queuedInput === null && !this.audioPlayer.inputToneNode) {
                    this._scheduleDecodeAfterDelay();
                }
             } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                 this.gameState.status = GameStatus.LISTENING;
             }
        }
    }

    /**
     * Updates game state/UI for a single Dit or Dah element. Does NOT play audio.
     * @param {'dit' | 'dah'} type - The type of input to process.
     * @returns {string} The corresponding morse character ('.' or '-').
     */
    _emitInputToSequence(type) {
        const now = performance.now();
        const morseChar = (type === 'dit') ? '.' : '-';

        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
            console.warn("_emitInputToSequence called in wrong state:", this.gameState.status);
            return morseChar;
        }

        this.gameState.addInput(morseChar);
        this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);
        if (this.callbacks.onInput) this.callbacks.onInput(morseChar);
        this.lastInputTypeGenerated = type;
        this.lastEmitTime = now;

        return morseChar;
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence, checking timing. */
    _triggerRepeatOrIambicOutput() {
        this._clearRepeatOrIambicTimer();

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;
        const elementToSend = this.gameState.iambicState;

        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
             this.lastEmitTime = 0; return;
        }
        if (!elementToSend) { return; }

        // --- Key Press Check ---
        if (this.gameState.isIambicHandling && (!isDitActive || !isDahActive)) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dit' && !isDitActive) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dah' && !isDahActive) { this._processInputStateChange(); return; }

        // --- Timing Check ---
        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        const lastElementDuration = (this.lastInputTypeGenerated === 'dit' ? this.ditDuration : (this.lastInputTypeGenerated === 'dah' ? this.dahDuration : 0));
        const requiredTime = lastElementDuration + this.intraCharGap;

        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTime) {
            const remainingTime = requiredTime - timeSinceLastEmit;
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTime));
            return;
        }

        // --- Check Audio Busy State and Emit/Queue ---
        if (this.audioPlayer.inputToneNode) {
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
                 // console.log(`Audio busy, queued: ${elementToSend}`); // Debug
             } else {
                 // console.log(`Audio busy, queue full. Dropped: ${elementToSend}`); // Debug
             }
         } else {
             // --- Audio is free - Process immediately ---
             this._emitInputToSequence(elementToSend);
             this.audioPlayer.playInputTone(elementToSend);

             // --- Schedule Next Trigger ---
             const currentElementDuration = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
             const delayForNext = currentElementDuration + this.intraCharGap;

             if (this.gameState.isIambicHandling) {
                 this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit';
             }

             const stillDitActive = this.ditPressed || this.ditKeyPressed;
             const stillDahActive = this.dahPressed || this.dahKeyPressed;
             const shouldContinue = (this.gameState.isIambicHandling && stillDitActive && stillDahActive) ||
                                     (!this.gameState.isIambicHandling && elementToSend === 'dit' && stillDitActive) ||
                                     (!this.gameState.isIambicHandling && elementToSend === 'dah' && stillDahActive);

             if (shouldContinue) {
                this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNext));
             } else {
                 this._processInputStateChange();
             }
         }
    }

    /**
     * Callback function triggered by AudioPlayer when an input tone finishes playing.
     * Processes any queued input, schedules decode check, and potentially restarts the repeat/iambic sequence.
     */
    handleToneEnd() {
         let processedQueueItem = false;
         if (this.queuedInput !== null) {
             const typeToProcess = this.queuedInput;
             this.queuedInput = null;
             // console.log(`Processing queued input: ${typeToProcess}`); // Debug

             this._emitInputToSequence(typeToProcess);
             this.audioPlayer.playInputTone(typeToProcess);
             processedQueueItem = true;

             // **Set state to TYPING and Schedule decode check**
             if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                this.gameState.status = GameStatus.TYPING;
                this._scheduleDecodeAfterDelay();
             }
         }

         // Use setTimeout to check for held keys and potentially continue sequence.
         setTimeout(() => {
             const isDitActive = this.ditPressed || this.ditKeyPressed;
             const isDahActive = this.dahPressed || this.dahKeyPressed;

             if (isDitActive || isDahActive) {
                  this._processInputStateChange();
             } else if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                 // If no queue was processed AND no keys active, but we were typing, ensure decode check is scheduled.
                 // This handles the case where a single non-queued element finishes playing and keys are released.
                 this._scheduleDecodeAfterDelay();
             } else if (!isDitActive && !isDahActive) {
                 // If no keys active and nothing else to do, ensure state is consistent.
                 this._processInputStateChange();
             }
         }, 1); // Minimal delay
     }


    /** Schedules the character decode function (gameplay/sandbox only). */
     _scheduleDecodeAfterDelay() {
        this.decoder.cancelScheduledDecode(); // Cancel any existing timer first

         const canSchedule = (this.gameState.currentInputSequence &&
                             (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.LISTENING) &&
                             (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX));

         if (!canSchedule) {
             // console.log(`Decode scheduling skipped. Status: ${this.gameState.status}, Sequence: '${this.gameState.currentInputSequence}'`); // Debug
             if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             return;
         }

         // console.log(`Scheduling decode for sequence: '${this.gameState.currentInputSequence}'`); // Debug
         this.gameState.status = GameStatus.DECODING;
         this.decoder.scheduleDecode(() => {
             if (this.gameState.status === GameStatus.DECODING &&
                 (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX))
             {
                 if (this.callbacks.onCharacterDecode) {
                     this.callbacks.onCharacterDecode();
                 } else {
                      console.error("onCharacterDecode callback is missing!");
                      if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
                 }
             } else {
                 // console.log(`Decode callback skipped. Status: ${this.gameState.status}, Mode: ${this.gameState.currentMode}`); // Debug
                 if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
             }
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
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
/**
 * js/inputHandler.js
 * ------------------
 * Handles user input from the Dit and Dah buttons using touch/mouse events,
 * and keyboard events ('.' for dit, '-' for dah).
 * Implements automatic repetition for single key holds and Iambic B keying
 * when both keys are held. Timings based on WPM and configurable gap multiplier.
 * Communicates inputs and timing events to other modules.
 * Includes rate-limiting to prevent double execution on rapid inputs.
 * Handles input logic for GAME and SANDBOX modes.
 */

class InputHandler {
    /**
     * @constructor
     * @param {GameState} gameState - The central game state manager.
     * @param {MorseDecoder} decoder - Handles Morse sequence decoding and timing.
     * @param {AudioPlayer} audioPlayer - Handles audio generation.
     * @param {UIManager} uiManager - Handles DOM updates and button feedback.
     * @param {object} callbacks - Functions to call on input events.
     * @param {function} callbacks.onInput - Callback when a dit/dah is generated *during gameplay/sandbox*.
     * @param {function} callbacks.onCharacterDecode - Callback when a character decode should be attempted *during gameplay/sandbox*.
     * @param {function} callbacks.onResultsShortcut - Callback when the '..' shortcut is completed on results screen (REMOVED).
     */
    constructor(gameState, decoder, audioPlayer, uiManager, callbacks) {
        this.gameState = gameState;
        this.decoder = decoder;
        this.audioPlayer = audioPlayer;
        this.uiManager = uiManager;
        this.callbacks = callbacks; // { onInput, onCharacterDecode, onResultsShortcut }

        // DOM Elements
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        // Keep references to text inputs to ignore keyboard shortcuts
        this.playbackInput = document.getElementById('playback-input');
        this.sandboxInput = document.getElementById('sandbox-input');


        // Input State
        this.ditPressed = false;
        this.dahPressed = false;
        this.ditKeyPressed = false;
        this.dahKeyPressed = false;
        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null;
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

    /**
     * Updates WPM and recalculates timing values.
     * @param {number} newWpm - The new Words Per Minute setting.
     */
    updateWpm(newWpm) {
        if (newWpm <= 0) return;
        this.wpm = newWpm;
        const baseDit = 1200 / this.wpm;
        this.ditDuration = baseDit;
        this.dahDuration = baseDit * 3;
        this.intraCharGap = baseDit * MorseConfig.INTRA_CHAR_GAP_MULTIPLIER;
        console.log(`InputHandler timings updated for ${newWpm} WPM: Dit=${this.ditDuration.toFixed(0)}ms, Dah=${this.dahDuration.toFixed(0)}ms, Gap=${this.intraCharGap.toFixed(0)}ms (Multiplier: ${MorseConfig.INTRA_CHAR_GAP_MULTIPLIER})`);
        this.audioPlayer.updateWpm(newWpm);
        this.decoder.updateWpm(newWpm);
    }

    /**
     * Central handler for press events (touch, mouse, key).
     * @param {'dit' | 'dah'} type - The type of input pressed.
     * @param {'touch' | 'key' | 'mouse'} method - The method of input.
     */
    _press(type, method) {
        // Ignore presses if not in a mode that accepts game input
        if (!(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) return;
        // Also ignore if finished or showing results
        if (this.gameState.status === GameStatus.FINISHED || this.gameState.status === GameStatus.SHOWING_RESULTS) return;


        const wasDitActive = this.ditPressed || this.ditKeyPressed;
        const wasDahActive = this.dahPressed || this.dahKeyPressed;
        let statePossiblyChanged = false;

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && !this.ditPressed) {
                this.ditPressed = true;
                this.pressStartTime.dit = performance.now();
                statePossiblyChanged = true;
            } else if (method === 'key' && !this.ditKeyPressed) {
                this.ditKeyPressed = true;
                this.pressStartTime.dit = performance.now();
                statePossiblyChanged = true;
            }
        } else if (type === 'dah') {
             if ((method === 'touch' || method === 'mouse') && !this.dahPressed) {
                this.dahPressed = true;
                this.pressStartTime.dah = performance.now();
                statePossiblyChanged = true;
            } else if (method === 'key' && !this.dahKeyPressed) {
                this.dahKeyPressed = true;
                this.pressStartTime.dah = performance.now();
                statePossiblyChanged = true;
            }
        }

        if (statePossiblyChanged) {
            const isDitActive = this.ditPressed || this.ditKeyPressed;
            const isDahActive = this.dahPressed || this.dahKeyPressed;

            this.uiManager.setButtonActive('dit', isDitActive);
            this.uiManager.setButtonActive('dah', isDahActive);

            // Only process state changes if actually playing (incl. READY)
            if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                 this.decoder.cancelScheduledDecode(); // Cancel decode on new press during play/ready
                 this._processInputStateChange(); // Re-evaluate iambic/repeat
            } else {
                // console.log(`_press ignored: Not in active game/sandbox state (${this.gameState.status})`); // Debug
            }
        }
    }

    /**
     * Central handler for release events (touch, mouse, key).
     * @param {'dit' | 'dah'} type - The type of input released.
     * @param {'touch' | 'key' | 'mouse'} method - The method of input.
     */
    _release(type, method) {
        // Only process releases relevant to active modes
        if (!(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) return;
        // Also ignore if finished or showing results
        if (this.gameState.status === GameStatus.FINISHED || this.gameState.status === GameStatus.SHOWING_RESULTS) return;

        const wasDitActive = this.ditPressed || this.ditKeyPressed;
        const wasDahActive = this.dahPressed || this.dahKeyPressed;
        let statePossiblyChanged = false;

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) {
                this.ditPressed = false; statePossiblyChanged = true;
            } else if (method === 'key' && this.ditKeyPressed) {
                this.ditKeyPressed = false; statePossiblyChanged = true;
            }
        } else if (type === 'dah') {
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) {
                this.dahPressed = false; statePossiblyChanged = true;
            } else if (method === 'key' && this.dahKeyPressed) {
                this.dahKeyPressed = false; statePossiblyChanged = true;
            }
        }

        if (statePossiblyChanged) {
            const isDitActive = this.ditPressed || this.ditKeyPressed;
            const isDahActive = this.dahPressed || this.dahKeyPressed;

            this.uiManager.setButtonActive('dit', isDitActive);
            this.uiManager.setButtonActive('dah', isDahActive);

            // Only process state changes if actually playing (incl. READY)
             if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
                 this._processInputStateChange(); // Re-evaluate iambic/repeat/decode scheduling
             } else {
                // console.log(`_release ignored: Not in active game/sandbox state (${this.gameState.status})`); // Debug
             }
        }
    }


    /** Binds touch, mouse and keyboard event listeners. */
    _bindEvents() {
        // Touch Events
        this.ditButton.addEventListener('touchstart', (e) => this._handlePressStart(e, 'dit'), { passive: false });
        this.dahButton.addEventListener('touchstart', (e) => this._handlePressStart(e, 'dah'), { passive: false });
        document.addEventListener('touchend', this._handlePressEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this._handlePressEnd.bind(this), { passive: false });
        // Mouse Events
        this.ditButton.addEventListener('mousedown', (e) => this._handlePressStart(e, 'dit'));
        this.dahButton.addEventListener('mousedown', (e) => this._handlePressStart(e, 'dah'));
        document.addEventListener('mouseup', this._handlePressEnd.bind(this));
        // Prevent Context Menu
        [this.ditButton, this.dahButton].forEach(button => button.addEventListener('contextmenu', e => e.preventDefault()));
        // Keyboard Events
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    _handleKeyDown(event) {
        // *** FIX: Check if focus is on a text input field first ***
        const targetElement = event.target;
        if (targetElement === this.playbackInput || targetElement === this.sandboxInput) {
            // If focus is on playback or sandbox text input, allow default behavior
            return;
        }

        // --- Existing logic ---
        // Allow keyboard input only in relevant modes/states *for Morse*
        if (!(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) return;
        if (this.gameState.status === GameStatus.FINISHED || this.gameState.status === GameStatus.SHOWING_RESULTS || this.gameState.status === GameStatus.SANDBOX_INPUT || this.gameState.status === GameStatus.PLAYBACK_INPUT) return; // No kbd Morse on results/setup screens

        if (event.repeat) return;
        if (event.key === '.' || event.key === 'e' || event.key === 'E') { // Allow 'e' for dit
            event.preventDefault(); // Prevent default only if handling as Morse
            if (!this.ditKeyPressed) this._press('dit', 'key');
        } else if (event.key === '-' || event.key === 't' || event.key === 'T') { // Allow 't' for dah
            event.preventDefault(); // Prevent default only if handling as Morse
            if (!this.dahKeyPressed) this._press('dah', 'key');
        }
    }
    _handleKeyUp(event) {
         // *** FIX: Check if focus is on a text input field first ***
         const targetElement = event.target;
         if (targetElement === this.playbackInput || targetElement === this.sandboxInput) {
             // If focus is on playback or sandbox text input, ignore keyup for Morse release logic
             return;
         }

        // --- Existing logic ---
        if (!(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) return;

        if (event.key === '.' || event.key === 'e' || event.key === 'E') {
            event.preventDefault(); // Still prevent default on keyup if it was a Morse key
            this._release('dit', 'key');
         }
        else if (event.key === '-' || event.key === 't' || event.key === 'T') {
            event.preventDefault(); // Still prevent default on keyup if it was a Morse key
            this._release('dah', 'key');
         }
    }
    _handlePressStart(event, type) {
        event.preventDefault();
        // Initialize audio context on first interaction, if needed
        this.audioPlayer.initializeAudioContext();
        // Pass the press event regardless of mode initially; _press checks mode.
        this._press(type, event.type.startsWith('touch') ? 'touch' : 'mouse');
    }
     _handlePressEnd(event) {
         // Handle release events, _release checks mode.
         if (event.type === 'mouseup') {
             if (this.ditPressed) this._release('dit', 'mouse');
             if (this.dahPressed) this._release('dah', 'mouse');
         } else if (event.type === 'touchend' || event.type === 'touchcancel') {
             // Check changedTouches for specific releases
             for (let i = 0; i < event.changedTouches.length; i++) {
                 const touch = event.changedTouches[i];
                 if (this.ditButton.contains(touch.target) || document.elementFromPoint(touch.clientX, touch.clientY) === this.ditButton) {
                     if (this.ditPressed) this._release('dit', 'touch');
                 }
                 if (this.dahButton.contains(touch.target) || document.elementFromPoint(touch.clientX, touch.clientY) === this.dahButton) {
                      if (this.dahPressed) this._release('dah', 'touch');
                 }
             }
             // Fallback if targets aren't directly identifiable (e.g., touch moved off button)
             if (this.ditPressed && !this.isTouchActiveOnElement(event.touches, this.ditButton)) this._release('dit', 'touch');
             if (this.dahPressed && !this.isTouchActiveOnElement(event.touches, this.dahButton)) this._release('dah', 'touch');
         }
     }

     /** Helper to check if any active touches are over a specific element */
     isTouchActiveOnElement(touchList, element) {
        for (let i = 0; i < touchList.length; i++) {
            const touch = touchList[i];
            // Use elementFromPoint for more reliable check, especially with potential transforms
            const targetAtPoint = document.elementFromPoint(touch.clientX, touch.clientY);
            if (element === targetAtPoint || element.contains(targetAtPoint)) {
                return true;
            }
        }
        return false;
     }


    /** Central logic to determine input mode (gameplay/sandbox only). */
    _processInputStateChange() {
         // This function should only run if we are in game/sandbox and not finished/showing results
         if (!(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) ||
             this.gameState.status === GameStatus.FINISHED || this.gameState.status === GameStatus.SHOWING_RESULTS) {
             return;
         }

        // console.log("_processInputStateChange called"); // Debug
        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;

        this._clearAllTimers(); // Clear iambic/repeat timers

        // Cancel pending decode if *any* key becomes active while LISTENING or DECODING
        if ((isDitActive || isDahActive) && (this.gameState.status === GameStatus.LISTENING || this.gameState.status === GameStatus.DECODING)) {
            this.decoder.cancelScheduledDecode();
            // If canceling decode, transition back to TYPING if needed
            if (this.gameState.status === GameStatus.DECODING) {
                 this.gameState.status = GameStatus.TYPING;
            }
        }

        if (isDitActive && isDahActive) {
            // console.log("Entering Iambic Mode"); // Debug
            this.gameState.isIambicHandling = true;
            const lastPressTimeDit = this.pressStartTime.dit || 0;
            const lastPressTimeDah = this.pressStartTime.dah || 0;
            // Prioritize the *last* pressed key if both are active
            const iambicStartElement = (lastPressTimeDah > lastPressTimeDit) ? 'dah' : 'dit';
            this.gameState.iambicState = iambicStartElement;
            this._triggerIambicOutput();
        } else if (isDitActive) {
            // console.log("Entering Dit Auto Repeat"); // Debug
            this.gameState.isIambicHandling = true;
            this.gameState.iambicState = 'dit';
            this._startAutoRepeat('dit');
        } else if (isDahActive) {
            // console.log("Entering Dah Auto Repeat"); // Debug
            this.gameState.isIambicHandling = true;
            this.gameState.iambicState = 'dah';
            this._startAutoRepeat('dah');
        } else {
            // console.log("No inputs active, potentially scheduling decode."); // Debug
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
             // Only schedule decode if there's something in the sequence and we were typing/decoding
             if (this.gameState.currentInputSequence && (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.DECODING)) {
                this._scheduleDecodeAfterDelay();
             } else if (this.gameState.status === GameStatus.LISTENING) {
                // If state is LISTENING and no input is active, just remain LISTENING.
             }
        }
    }

    /** Starts automatic repetition (handles first emit). */
    _startAutoRepeat(type) {
        // console.log(`Starting auto-repeat sequence for ${type}`); // Debug
        const elementDuration = (type === 'dit' ? this.ditDuration : this.dahDuration);
        const interval = elementDuration + this.intraCharGap;

        const repeatAction = () => {
            const isDitActive = this.ditPressed || this.ditKeyPressed;
            const isDahActive = this.dahPressed || this.dahKeyPressed;
            // Ensure still in the correct single-key state and game is playing
            if (((type === 'dit' && isDitActive && !isDahActive) || (type === 'dah' && isDahActive && !isDitActive)) && this.gameState.isPlaying()) {
                // console.log(`Auto-repeat attempting emit: ${type}`); // Debug
                this._emitInput(type); // Emit the element
                const timerId = setTimeout(repeatAction, interval); // Schedule the next repeat
                if (type === 'dit') { this.ditIntervalId = timerId; } else { this.dahIntervalId = timerId; }
            } else {
                // console.log("Auto-repeat stopping due to state change or game ended."); // Debug
                this._clearAllTimers(); // Clear this specific timer
                this._processInputStateChange(); // Re-evaluate the overall input state (might schedule decode)
            }
        };

        // Emit the first element immediately *only* if game is playing or ready
        if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
             // console.log(`Auto-repeat emitting first: ${type}`); // Debug
             this._emitInput(type);
             const firstTimerId = setTimeout(repeatAction, interval); // Schedule first repeat
             if (type === 'dit') { this.ditIntervalId = firstTimerId; } else { this.dahIntervalId = firstTimerId; }
        } else {
             // console.log(`Auto-repeat initial emit skipped: Not in playing state (${this.gameState.status})`); // Debug
             this._clearAllTimers(); // Ensure timers are clear if we didn't start
        }
    }


    /** Emits a single Dit or Dah input. */
    _emitInput(type) {
        const now = performance.now();
        let minTimeSinceLastEmit = 0;
        let lastEmitTime = 0;

        // Basic rate limiting per type
        if (type === 'dit') {
            minTimeSinceLastEmit = this.ditDuration * 0.5; // Allow slightly faster inputs than full duration
            lastEmitTime = this.lastDitEmitTime;
        } else {
            minTimeSinceLastEmit = this.dahDuration * 0.5;
            lastEmitTime = this.lastDahEmitTime;
        }

        if (now - lastEmitTime < minTimeSinceLastEmit) {
            // console.log(`>>> Emit ${type} IGNORED - Rate Limit. Delta: ${(now - lastEmitTime).toFixed(0)}ms < ${minTimeSinceLastEmit.toFixed(0)}ms`); // Debug
            return;
        }

        // console.log(`>>> Emitting input: ${type} at ${now.toFixed(0)} (State: ${this.gameState.status})`); // Debug

        if (type === 'dit') { this.lastDitEmitTime = now; } else { this.lastDahEmitTime = now; }

        this.audioPlayer.playTone(type);
        const morseChar = (type === 'dit') ? '.' : '-';

        // Add input to gameState only if playing or ready
        if (this.gameState.isPlaying() || this.gameState.status === GameStatus.READY) {
             this.gameState.addInput(morseChar); // This handles timer start and state changes (READY -> LISTENING -> TYPING)
             // Update user pattern display
             this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);
             // Notify main logic (optional, gameState.addInput covers state changes)
             if (this.callbacks.onInput) this.callbacks.onInput(morseChar);
        } else if (this.gameState.status === GameStatus.SHOWING_RESULTS) {
             // Input ignored on results screen
        }

        this.lastInputTypeGenerated = type;
    }


    /** Triggers the next output in an Iambic sequence. */
    _triggerIambicOutput() {
        this._clearIambicTimeout();

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;

        // Ensure still in iambic mode (both keys down) and game is playing
        if (!this.gameState.isIambicHandling || !isDitActive || !isDahActive || !this.gameState.isPlaying()) {
            // console.log(`Iambic condition failed (Iambic: ${this.gameState.isIambicHandling}, Dit: ${isDitActive}, Dah: ${isDahActive}, Playing: ${this.gameState.isPlaying()}), stopping.`); // Debug
            this._processInputStateChange(); // Re-evaluate state (might switch to single key repeat or schedule decode)
            return;
        }

        const elementToSend = this.gameState.iambicState;
        if (!elementToSend) {
            console.error("Iambic state is null during trigger.");
            this._clearAllTimers();
            this._processInputStateChange(); // Try to recover state
            return;
        }

        // console.log(`Iambic attempting emit: ${elementToSend}`); // Debug
        this._emitInput(elementToSend); // Emit the current element

        // Determine the next element based on pure alternation for Iambic B
        const nextElement = (elementToSend === 'dit') ? 'dah' : 'dit';
        this.gameState.iambicState = nextElement; // Set state for the *next* iteration

        const currentDuration = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
        const delay = currentDuration + this.intraCharGap;

        this.iambicTimeoutId = setTimeout(() => this._triggerIambicOutput(), delay);
        // console.log(`Scheduled next iambic (${nextElement}) in ${delay.toFixed(0)}ms`); // Debug
    }


    /** Schedules the character decode function (gameplay/sandbox only). */
     _scheduleDecodeAfterDelay() {
         // Only schedule if gameplay/sandbox is active (TYPING state) AND there's a sequence to decode
         if (!this.gameState.currentInputSequence || this.gameState.status !== GameStatus.TYPING || !(this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) {
            //   if (this.gameState.status !== GameStatus.TYPING) console.log(`Scheduling decode skipped: Not in TYPING state (${this.gameState.status}).`); // Debug
            //   else if (!this.gameState.currentInputSequence) console.log("Scheduling decode skipped: Empty input sequence."); // Debug
            //   else console.warn("Attempted to schedule decode outside game/sandbox mode:", this.gameState.currentMode); // Debug

              // Ensure flags are reset if decode isn't scheduled
              this.gameState.isIambicHandling = false;
              this.gameState.iambicState = null;
              // If we were TYPING but sequence is now empty (e.g., backspace?), move back to LISTENING
              if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
              }
              return;
          }

         // console.log("Scheduling decode callback for sequence:", this.gameState.currentInputSequence); // Debug
         // Set state to DECODING *before* scheduling timeout
         this.gameState.status = GameStatus.DECODING;

         this.decoder.scheduleDecode(() => {
             // console.log("Decode callback executing..."); // Debug
             // Check if state is still DECODING before proceeding
             if (this.gameState.status === GameStatus.DECODING && (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)) {
                 if (this.callbacks.onCharacterDecode) {
                     this.callbacks.onCharacterDecode(); // Let main.js handle the result
                 }
                 // main.js's handleCharacterDecode will transition state to LISTENING or FINISHED
             } else {
                //  console.warn("Decode callback skipped, state changed before execution:", this.gameState.status); // Debug
                 // If state changed away from DECODING before timeout, ensure input is cleared
                 // unless it's already FINISHED/SHOWING_RESULTS
                 if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                     this.gameState.clearCurrentInput();
                     // If we are still in a playable mode, reset to LISTENING
                     if (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) {
                         this.gameState.status = GameStatus.LISTENING;
                     }
                 }
             }
             // Reset iambic flags after potential decode
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
         });
     }

    /** Clears all iambic/repeat generation timers. */
    _clearAllTimers() {
        if (this.iambicTimeoutId) { clearTimeout(this.iambicTimeoutId); this.iambicTimeoutId = null; }
        if (this.ditIntervalId) { clearTimeout(this.ditIntervalId); this.ditIntervalId = null; }
        if (this.dahIntervalId) { clearTimeout(this.dahIntervalId); this.dahIntervalId = null; }
        // console.log("Cleared iambic/repeat generation timers."); // Debug
    }

     /** Clears the specific iambic timeout. */
     _clearIambicTimeout() {
        if (this.iambicTimeoutId) { clearTimeout(this.iambicTimeoutId); this.iambicTimeoutId = null; }
     }
}
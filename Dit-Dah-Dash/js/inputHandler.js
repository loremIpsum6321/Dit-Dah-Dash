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
 * Improves mobile touch handling to prevent hangs.
 * Adds flag to prevent re-triggering results actions while paddle held.
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
        this.ditPressed = false;      // Mouse/Touch state for dit
        this.dahPressed = false;      // Mouse/Touch state for dah
        this.ditKeyPressed = false;   // Keyboard state for dit
        this.dahKeyPressed = false;   // Keyboard state for dah

        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null; // 'dit' or 'dah'
        this.lastEmitTime = 0; // Timestamp of the *start* of the last emitted element (sound)
        this.queuedInput = null; // Single input queue ('dit' or 'dah')
        this.resultsActionTriggered = false; // Flag to prevent re-triggering results actions

        // Track active touch identifiers to prevent multi-touch issues
        this.activeTouchIds = { dit: null, dah: null };

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

        // Set the audio player callback *here* after both instances exist
        this.audioPlayer.setOnToneEndCallback(this.handleToneEnd.bind(this));
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

        // Initialize audio context on any relevant press, especially important for mobile first interaction
        if (isGameInputContext || isResultsContext) {
             this.audioPlayer.initializeAudioContext();
        }

        // --- Queueing Check (Game Context Only) ---
        if (isGameInputContext && this.audioPlayer.inputToneNode) {
            if (this.queuedInput === null) {
                this.queuedInput = type;
                // console.log(`Audio busy on press, queued: ${type}`); // Debug
                // Update button state visually even if queued
                const wasDitActive = this.ditPressed || this.ditKeyPressed;
                const wasDahActive = this.dahPressed || this.dahKeyPressed;
                 if (type === 'dit' && !wasDitActive) this.uiManager.setButtonActive('dit', true);
                 if (type === 'dah' && !wasDahActive) this.uiManager.setButtonActive('dah', true);
                 // Set the internal state flag (pressed/keyPressed)
                 if (type === 'dit') { if (method === 'key') this.ditKeyPressed = true; else this.ditPressed = true; }
                 else { if (method === 'key') this.dahKeyPressed = true; else this.dahPressed = true; }
                return; // Don't process further, wait for queue
            } else {
                 // console.log(`Audio busy on press, queue full. Ignored: ${type}`); // Debug
                 // Still update the internal state flag even if queue full (e.g., holding both)
                 if (type === 'dit') { if (method === 'key') this.ditKeyPressed = true; else this.ditPressed = true; }
                 else { if (method === 'key') this.dahKeyPressed = true; else this.dahPressed = true; }
                 return;
            }
        }

        // --- Standard Press Processing (Audio not busy or not game context) ---
        if (!isGameInputContext && !isResultsContext) return; // Ignore if not in relevant context

        const now = performance.now();
        let stateChanged = false;
        let pressStartTimeKey = (type === 'dit') ? 'dit' : 'dah';

        // Update internal state based on method and check if it *actually* changed
        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && !this.ditPressed) { this.ditPressed = true; stateChanged = true; }
            else if (method === 'key' && !this.ditKeyPressed) { this.ditKeyPressed = true; stateChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && !this.dahPressed) { this.dahPressed = true; stateChanged = true; }
            else if (method === 'key' && !this.dahKeyPressed) { this.dahKeyPressed = true; stateChanged = true; }
        }

        // Only process if the state genuinely changed to pressed
        if (stateChanged) {
            this.pressStartTime[pressStartTimeKey] = now;
            const isCurrentlyActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
            this.uiManager.setButtonActive(type, isCurrentlyActive); // Update visual state

            if (isResultsContext) {
                // Results mode: Play sound immediately, trigger callback ONCE per press cycle
                if (!this.resultsActionTriggered) {
                     this.audioPlayer.playInputTone(type);
                     if (this.callbacks.onResultsInput) this.callbacks.onResultsInput(type);
                     this.resultsActionTriggered = true; // Set flag to prevent re-trigger while held
                }
            } else if (isGameInputContext) {
                 // Game mode: Cancel any pending decode, process state change (starts iambic/repeat logic)
                 this.decoder.cancelScheduledDecode();
                 this._processInputStateChange();
            }
        }
    }

    /** Central handler for release events (touch, mouse, key). */
    _release(type, method) {
        // Determine if the release *might* be relevant
        const mightBeRelevantContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX || this.gameState.status === GameStatus.SHOWING_RESULTS);
        if (!mightBeRelevantContext) return;

        let stateChanged = false;

        // Update internal state based on method and check if it *actually* changed
        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) { this.ditPressed = false; stateChanged = true; }
            else if (method === 'key' && this.ditKeyPressed) { this.ditKeyPressed = false; stateChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) { this.dahPressed = false; stateChanged = true; }
            else if (method === 'key' && this.dahKeyPressed) { this.dahKeyPressed = false; stateChanged = true; }
        }

        // Only process if the state genuinely changed to released
        if (stateChanged) {
            // Update visual state based on whether *any* method (touch/mouse/key) is still active
            const isStillActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
            this.uiManager.setButtonActive(type, isStillActive);

             // Reset the results action flag only when *neither* paddle is active
             if (!this.ditPressed && !this.ditKeyPressed && !this.dahPressed && !this.dahKeyPressed) {
                 this.resultsActionTriggered = false;
             }

             const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);

             // Process queue *first* if applicable (audio finished while key was held/released)
             // No longer strictly necessary here as handleToneEnd does it, but harmless as a fallback.
             if (isGameInputContext && this.queuedInput !== null && !this.audioPlayer.inputToneNode) {
                 // console.log("Release detected queue processing opportunity."); // Debug
                 this.handleToneEnd(); // Manually trigger queue processing if audio is free
             }

             // Process the state change caused by the release itself (stops iambic/repeat, schedules decode)
             if (isGameInputContext) {
                  this._processInputStateChange();
             }
             // If in results context, releasing a button doesn't trigger further action, but resets the flag above.
        }
    }


    /** Binds touch, mouse and keyboard event listeners to main paddles. */
    _bindEvents() {
        // Touch Events (use capture phase for touchstart to potentially initialize audio earlier)
        this.ditButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dit'), { passive: false, capture: true });
        this.dahButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dah'), { passive: false, capture: true });

        // Use document level touchend/touchcancel for robust release detection
        document.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this._handleTouchEnd.bind(this), { passive: false });

        // Mouse Events
        this.ditButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dit'));
        this.dahButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dah'));

        // Use document level mouseup for robust release detection
        document.addEventListener('mouseup', this._handleMousePressEnd.bind(this));

        // Prevent Context Menu on paddles
        [this.ditButton, this.dahButton].forEach(button => {
            button.addEventListener('contextmenu', e => e.preventDefault());
            // Also prevent default drag behavior which can interfere on mobile
            button.addEventListener('dragstart', e => e.preventDefault());
        });

        // Keyboard Events
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    // --- Event Handlers ---

    _handleKeyDown(event) {
        // Ignore if focus is on an input field or settings modal is open
        const targetElement = event.target;
        if (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || !this.settingsModal?.classList.contains('hidden')) {
            return;
        }

        // Check if context is relevant (game or results)
        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if ((isGameContext || isResultsContext) && (event.key === '.' || event.key === 'e' || event.key === '0' || event.key === '-' || event.key === 'K' || event.key === 'k' || event.key === 'J' || event.key === 'j')) {
            // Prevent default browser actions for these keys in relevant contexts
            event.preventDefault();

            // Process press only if it's not a repeat event
            if (!event.repeat) {
                if (event.key === '.' || event.key === 'j' || event.key === 'J' || event.key === '0') { // Dit
                    if (!this.ditKeyPressed) { // Check internal flag first
                         this._press('dit', 'key');
                    }
                } else if (event.key === '-' || event.key === 'k' || event.key === 'K') { // Dah
                    if (!this.dahKeyPressed) { // Check internal flag first
                         this._press('dah', 'key');
                    }
                }
            }
        }
    }

    _handleKeyUp(event) {
        // Check if focus allows processing
         const targetElement = event.target;
         if (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || !this.settingsModal?.classList.contains('hidden')) {
             return;
         }

        // Process release if the key matches and was previously pressed
        if (event.key === '.' || event.key === 'j' || event.key === 'J' || event.key === '0') { // Dit release
             event.preventDefault();
             if (this.ditKeyPressed) { // Check internal flag
                 this._release('dit', 'key');
             }
         }
        else if (event.key === '-' || event.key === 'k' || event.key === 'K') { // Dah release
             event.preventDefault();
             if (this.dahKeyPressed) { // Check internal flag
                 this._release('dah', 'key');
             }
         }
    }

     // Handles mouse down
    _handleMousePressStart(event, type) {
        // Only react to left mouse button
        if (event.button !== 0) return;
        event.preventDefault();
        // Audio context initialization is handled in _press now
        this._press(type, 'mouse');
    }

    // Handles mouse up ANYWHERE on the document
    _handleMousePressEnd(event) {
        if (event.button !== 0) return; // Only react to left mouse button release
        // Check if dit or dah was pressed via mouse and release it
        if (this.ditPressed) this._release('dit', 'mouse');
        if (this.dahPressed) this._release('dah', 'mouse');
    }


    // Handles touch start - separate from mouse
    _handleTouchStart(event, type) {
         // Prevent default actions like zoom/scroll on paddle press
        event.preventDefault();

        // If already handling a touch for this button type, ignore subsequent touches
        if (type === 'dit' && this.activeTouchIds.dit !== null) return;
        if (type === 'dah' && this.activeTouchIds.dah !== null) return;

        // Store the identifier of the *first* touch point starting on this button
        const touch = event.changedTouches[0];
        if (type === 'dit') this.activeTouchIds.dit = touch.identifier;
        if (type === 'dah') this.activeTouchIds.dah = touch.identifier;

        // Audio context initialization is handled in _press now
        this._press(type, 'touch');
    }

    // Handles touch end/cancel ANYWHERE on the document
    _handleTouchEnd(event) {
        // Iterate through *changed* touches to see which ones ended
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const endedId = touch.identifier;

            // Check if this ended touch matches the one we stored for dit
            if (this.activeTouchIds.dit === endedId) {
                this.activeTouchIds.dit = null; // Clear the stored ID
                if (this.ditPressed) { // Check internal flag
                    this._release('dit', 'touch');
                }
            }
            // Check if this ended touch matches the one we stored for dah
            else if (this.activeTouchIds.dah === endedId) {
                 this.activeTouchIds.dah = null; // Clear the stored ID
                 if (this.dahPressed) { // Check internal flag
                     this._release('dah', 'touch');
                 }
            }
        }
    }

    /** Central logic to determine input mode (gameplay/sandbox only) and manage timers/state. */
    _processInputStateChange() {
         // Determine if context is relevant for game logic processing
         const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                    (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);

         if (!isGameInputContext) {
            // Not in game context, ensure timers are cleared and state is reset
            this._clearRepeatOrIambicTimer();
            this.lastEmitTime = 0;
            this.queuedInput = null;
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
            return;
         }

        // Get current active state based on *any* input method
        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;

        // Always clear the sequence timer when input state changes
        this._clearRepeatOrIambicTimer();

        // If input happens during DECODING, cancel the decode and go back to TYPING
         if ((isDitActive || isDahActive) && this.gameState.status === GameStatus.DECODING) {
             this.decoder.cancelScheduledDecode(); // Cancel timer
             this.gameState.status = GameStatus.TYPING; // Revert state
         }

        // Determine action based on active keys
        if (isDitActive && isDahActive) {
            // --- Iambic Mode ---
            this.gameState.isIambicHandling = true;
            // Set initial iambic state only if it's null (first time both pressed)
            if (this.gameState.iambicState === null) {
                const pressTimeDit = this.pressStartTime.dit || 0;
                const pressTimeDah = this.pressStartTime.dah || 0;
                 // Whichever was pressed *last* determines the *first* output in iambic
                this.gameState.iambicState = (pressTimeDah > pressTimeDit) ? 'dah' : 'dit';
            }
            // Start the iambic output sequence
            this._triggerRepeatOrIambicOutput();

        } else if (isDitActive) {
            // --- Dit Only Active ---
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dit';
            // Start the dit output (or repeat)
            this._triggerRepeatOrIambicOutput();

        } else if (isDahActive) {
            // --- Dah Only Active ---
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = 'dah';
            // Start the dah output (or repeat)
            this._triggerRepeatOrIambicOutput();

        } else {
            // --- No Input Active ---
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
            // If we were typing and there's a sequence, schedule decode check
             if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                // Schedule decode only if audio is free and no input queued.
                // handleToneEnd will schedule otherwise.
                if (this.queuedInput === null && !this.audioPlayer.inputToneNode) {
                    this._scheduleDecodeAfterDelay();
                }
             } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                 // If typing state but no sequence (e.g., after decode error), revert to listening
                 this.gameState.status = GameStatus.LISTENING;
             }
             // If status was decoding and now no keys, it will revert to listening in scheduleDecode callback
        }
    }

    /**
     * Handles the logic of adding a Morse element ('.' or '-') to the game state sequence.
     * Does NOT play audio or handle timing/queueing.
     * @param {'dit' | 'dah'} type - The type of input to process.
     * @returns {string} The corresponding morse character ('.' or '-').
     */
    _emitInputToSequence(type) {
        const morseChar = (type === 'dit') ? '.' : '-';

        // Check if game is in a state to accept input for the sequence
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
            // console.warn("_emitInputToSequence called in wrong state:", this.gameState.status); // Debug
            return morseChar; // Return char anyway, but gameState won't be updated
        }

        // Add input to game state (this also handles starting timer on first input)
        this.gameState.addInput(morseChar);
        // Update the UI display for the user's input pattern
        this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);
        // Trigger external callback if needed (e.g., for logging)
        if (this.callbacks.onInput) this.callbacks.onInput(morseChar);

        return morseChar;
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence, checking timing and audio state. */
    _triggerRepeatOrIambicOutput() {
        // Clear any existing timer before proceeding
        this._clearRepeatOrIambicTimer();

        // Get current active state
        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;
        const elementToSend = this.gameState.iambicState; // 'dit' or 'dah' based on current logic

        // --- Context & Element Checks ---
        // Ensure we are in a state where input should be generated
        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
             this.lastEmitTime = 0; return; // Not playing, reset emit time and exit
        }
        // Ensure there is an element determined to be sent
        if (!elementToSend) { /* console.log("No element to send.");*/ return; } // Should not happen if called correctly

        // --- Key Press Consistency Check ---
        // If the required key(s) for the current mode (iambic/single) are no longer pressed,
        // stop this sequence and re-evaluate the overall input state.
        if (this.gameState.isIambicHandling && (!isDitActive || !isDahActive)) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dit' && !isDitActive) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dah' && !isDahActive) { this._processInputStateChange(); return; }

        // --- Timing Check ---
        // Ensure enough time has passed since the *start* of the last element sound
        // to accommodate its duration plus the intra-character gap.
        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        // Get duration of the *previous* element that was sounded
        const lastElementDurationMs = (this.lastInputTypeGenerated === 'dit' ? this.ditDuration : (this.lastInputTypeGenerated === 'dah' ? this.dahDuration : 0));
        // Required time = duration of last sound + gap time
        const requiredTimeMs = lastElementDurationMs + this.intraCharGap;

        // If not enough time has passed, schedule a check slightly later
        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            // console.log(`Timing delay: ${remainingTimeMs.toFixed(0)}ms`); // Debug
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        // --- Audio Busy Check & Emit/Queue ---
        if (this.audioPlayer.inputToneNode) {
             // Audio is currently playing an input tone. Queue this element if queue is empty.
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
                 // console.log(`Audio busy, queued: ${elementToSend}`); // Debug
             } // If queue is full, drop the input (this prevents multiple items queueing)
               // else { console.log(`Audio busy, queue full. Dropped: ${elementToSend}`); } // Debug
             // Do not proceed to play audio or schedule next if queued/dropped
             return;
         }

         // --- Audio is free - Process immediately ---
         // 1. Add the element to the game state sequence and update UI
         this._emitInputToSequence(elementToSend);
         // 2. Play the corresponding audio tone
         this.audioPlayer.playInputTone(elementToSend);
         // 3. Record the type and time of this element emission (for next timing check)
         this.lastInputTypeGenerated = elementToSend;
         this.lastEmitTime = performance.now(); // Record time *after* calling playTone

         // --- Schedule Next Trigger (if keys still held appropriately) ---
         const currentElementDurationMs = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
         const delayForNextMs = currentElementDurationMs + this.intraCharGap;

         // Determine the *next* element in iambic mode
         if (this.gameState.isIambicHandling) {
             this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit'; // Toggle for next round
         }
         // Else (single key mode), iambicState remains the same ('dit' or 'dah')

         // Check if the key(s) are still held to justify continuing the sequence
         const stillDitActive = this.ditPressed || this.ditKeyPressed;
         const stillDahActive = this.dahPressed || this.dahKeyPressed;
         const shouldContinue =
               (this.gameState.isIambicHandling && stillDitActive && stillDahActive) || // Both needed for iambic
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dit' && stillDitActive) || // Dit needed for dit repeat
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dah' && stillDahActive);   // Dah needed for dah repeat

         if (shouldContinue) {
            // Schedule the next check/trigger after the current element's duration + gap
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
         } else {
             // If keys released, re-evaluate the overall input state immediately
             this._processInputStateChange();
         }
    }

    /**
     * Callback function triggered by AudioPlayer when an input tone finishes playing naturally.
     * Processes any queued input, schedules decode check if needed, and potentially restarts the repeat/iambic sequence.
     */
    handleToneEnd() {
         let processedQueueItem = false;
         let emittedType = null;

         // --- Process Queued Input ---
         if (this.queuedInput !== null) {
             const typeToProcess = this.queuedInput;
             this.queuedInput = null; // Clear queue *before* processing
             // console.log(`Processing queued input: ${typeToProcess}`); // Debug

             // Emit the queued input to sequence and play its sound
             this._emitInputToSequence(typeToProcess);
             this.audioPlayer.playInputTone(typeToProcess); // This returns immediately
             processedQueueItem = true;
             emittedType = typeToProcess; // Store the type that was just emitted

             // Update state to TYPING if we emitted something
             if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                 this.gameState.status = GameStatus.TYPING;
             }
             // Record the time of this emission
             this.lastInputTypeGenerated = emittedType;
             this.lastEmitTime = performance.now();
         }

         // --- Check for Held Keys & Continue Sequence ---
         // Use a minimal timeout to allow the event loop to process potential key release events
         // that might occur immediately after the sound ends.
         setTimeout(() => {
             const isDitActive = this.ditPressed || this.ditKeyPressed;
             const isDahActive = this.dahPressed || this.dahKeyPressed;

             if (isDitActive || isDahActive) {
                  // If keys are still held, re-evaluate the state. This might:
                  // 1. Continue an iambic sequence (if both held).
                  // 2. Continue a repeat sequence (if one held).
                  // 3. Switch from iambic to repeat if one key was released.
                  this._processInputStateChange();
             } else {
                 // --- No Keys Active ---
                 // If no keys are active, and we weren't processing a queue item,
                 // check if we need to schedule a decode based on the input sequence.
                 if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                     // This handles the case where a single non-queued element finishes,
                     // and the keys were released *during* the sound.
                     this._scheduleDecodeAfterDelay();
                 } else if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                     // If state is typing but sequence is empty (e.g., after incorrect decode), revert to listening.
                     this.gameState.status = GameStatus.LISTENING;
                 }
                  // If a queue item *was* processed, and keys are now released,
                  // schedule decode check based on the sequence *after* the queued item.
                  else if (processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                       this._scheduleDecodeAfterDelay();
                  }
             }
         }, 1); // Minimal delay (1ms)
     }


    /** Schedules the character decode function after the inter-character gap timeout. */
     _scheduleDecodeAfterDelay() {
        // Cancel any existing timer first to avoid multiple decodes scheduled
        this.decoder.cancelScheduledDecode();

         // Check if conditions are met to schedule a decode
         const canSchedule = (
             this.gameState.currentInputSequence && // Must have a sequence to decode
             (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.LISTENING) && // Must be in a typing/listening state
             (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) // Must be in game or sandbox mode
         );

         if (!canSchedule) {
             // If cannot schedule, ensure state is consistent (e.g., LISTENING if typing ended with no sequence)
             if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             return; // Don't schedule
         }

         // console.log(`Scheduling decode for sequence: '${this.gameState.currentInputSequence}'`); // Debug
         this.gameState.status = GameStatus.DECODING; // Set state to indicate waiting for decode

         // Use the decoder's scheduling mechanism
         this.decoder.scheduleDecode(() => {
             // --- This callback runs AFTER the timeout ---
             // Double-check state hasn't changed unexpectedly (e.g., user navigated away)
             if (this.gameState.status === GameStatus.DECODING &&
                 (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX))
             {
                 // Trigger the main decode logic via the callback provided during initialization
                 if (this.callbacks.onCharacterDecode) {
                     this.callbacks.onCharacterDecode(); // This will handle correct/incorrect logic
                 } else {
                      console.error("onCharacterDecode callback is missing!");
                      // Attempt recovery if callback missing
                      if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING;
                 }
             } else {
                 // If state changed before timeout completed, log and potentially revert state
                 // console.log(`Decode callback skipped. Status: ${this.gameState.status}, Mode: ${this.gameState.currentMode}`); // Debug
                 if(this.gameState.status === GameStatus.DECODING) this.gameState.status = GameStatus.LISTENING; // Revert if still decoding but mode changed
             }
             // Reset iambic state after decode attempt
             this.gameState.isIambicHandling = false;
             this.gameState.iambicState = null;
             // Note: The actual state transition (e.g., back to LISTENING) is handled
             // *within* the onCharacterDecode callback in main.js based on the result.
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
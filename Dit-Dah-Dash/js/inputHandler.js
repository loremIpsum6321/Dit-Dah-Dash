/* Dit-Dah-Dash/js/inputHandler.js */
/* In file: js/inputHandler.js */
/**
 * js/inputHandler.js
 * ------------------
 * Handles user input from main Dit/Dah paddles (touch/mouse/keyboard).
 * Implements automatic repetition and Iambic B keying for game/sandbox.
 * Triggers discrete audio tones for each generated Morse element.
 * Handles separate input logic for RESULTS mode using the same paddles.
 * Uses dynamically configurable keybindings.
 * **v3 Changes:**
 * - Removed `resultsActionTriggered` flag to fix two-press bug on results screen.
 * **v4 Changes:**
 * - Updated key handling to use dynamic key mappings from settings.
 * - Added updateKeyMappings method.
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
     * @param {object} initialKeyMappings - Initial keybindings { dit: 'key', dah: 'key' }
     */
    constructor(gameState, decoder, audioPlayer, uiManager, callbacks, initialKeyMappings) {
        this.gameState = gameState;
        this.decoder = decoder;
        this.audioPlayer = audioPlayer;
        this.uiManager = uiManager;
        this.callbacks = callbacks; // { onInput, onCharacterDecode, onResultsInput }

        // DOM Elements
        this.ditButton = document.getElementById('dit-button');
        this.dahButton = document.getElementById('dah-button');
        this.playbackInput = document.getElementById('playback-input');
        this.sandboxInput = document.getElementById('sandbox-input');
        this.settingsModal = document.getElementById('settings-modal');
        this.ditKeyInput = document.getElementById('dit-key-input'); // Settings input
        this.dahKeyInput = document.getElementById('dah-key-input'); // Settings input

        // Key Mappings (Initialized with defaults or loaded settings)
        this.keyMappings = {
            dit: initialKeyMappings?.dit || MorseConfig.KEYBINDING_DEFAULTS.dit,
            dah: initialKeyMappings?.dah || MorseConfig.KEYBINDING_DEFAULTS.dah
        };

        // Input State
        this.ditPressed = false;      // Mouse/Touch state for dit
        this.dahPressed = false;      // Mouse/Touch state for dah
        this.ditKeyPressed = false;   // Keyboard state for dit (using current mapping)
        this.dahKeyPressed = false;   // Keyboard state for dah (using current mapping)

        this.pressStartTime = { dit: 0, dah: 0 };
        this.lastInputTypeGenerated = null;
        this.lastEmitTime = 0;
        this.queuedInput = null;

        // Track active touch identifiers
        this.activeTouchIds = { dit: null, dah: null };

        // Timing
        this.wpm = MorseConfig.DEFAULT_WPM;
        this.ditDuration = 0;
        this.dahDuration = 0;
        this.intraCharGap = 0;

        // Timers
        this.repeatOrIambicTimerId = null;

        // Bind event listeners
        this._bindEvents();
        this.updateWpm(uiManager.getInitialWpm());

        // Set the audio player callback
        this.audioPlayer.setOnToneEndCallback(this.handleToneEnd.bind(this));
        console.log("InputHandler Initialized with keys:", this.keyMappings);
    }

    /** Updates the key mappings used by the input handler. */
    updateKeyMappings(newMappings) {
        if (newMappings && newMappings.dit && newMappings.dah) {
             // Basic validation: ensure keys are not empty and not identical
            const newDit = newMappings.dit.trim();
            const newDah = newMappings.dah.trim();
            if (newDit && newDah && newDit !== newDah) {
                 this.keyMappings.dit = newDit;
                 this.keyMappings.dah = newDah;
                 console.log("InputHandler Key Mappings Updated:", this.keyMappings);
            } else {
                 console.warn("InputHandler: Invalid key mapping update ignored.", newMappings);
            }
        } else {
             console.warn("InputHandler: Invalid key mapping object received.", newMappings);
        }
    }

    /** Updates WPM and recalculates timing values. */
    updateWpm(newWpm) {
        if (newWpm <= 0) return;
        this.wpm = newWpm;
        const baseDit = 1200 / this.wpm;
        this.ditDuration = baseDit;
        this.dahDuration = baseDit * MorseConfig.DAH_DURATION_UNITS;
        this.intraCharGap = baseDit * MorseConfig.INTRA_CHARACTER_GAP_UNITS;
        this.audioPlayer.updateWpm(newWpm);
        this.decoder.updateWpm(newWpm);
    }

    /** Central handler for press events (touch, mouse, key). */
    _press(type, method) {
        const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                   (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (isGameInputContext || isResultsContext) {
             this.audioPlayer.initializeAudioContext();
        }

        // --- Queueing Check (Game Context Only) ---
        if (isGameInputContext && this.audioPlayer.inputToneNode) {
            if (this.queuedInput === null) {
                this.queuedInput = type;
                // console.log(`Audio busy on press, queued: ${type}`);
                const wasDitActive = this.ditPressed || this.ditKeyPressed;
                const wasDahActive = this.dahPressed || this.dahKeyPressed;
                 if (type === 'dit' && !wasDitActive) this.uiManager.setButtonActive('dit', true);
                 if (type === 'dah' && !wasDahActive) this.uiManager.setButtonActive('dah', true);
                 if (type === 'dit') { if (method === 'key') this.ditKeyPressed = true; else this.ditPressed = true; }
                 else { if (method === 'key') this.dahKeyPressed = true; else this.dahPressed = true; }
                return;
            } else {
                 // console.log(`Audio busy on press, queue full. Ignored: ${type}`);
                 if (type === 'dit') { if (method === 'key') this.ditKeyPressed = true; else this.ditPressed = true; }
                 else { if (method === 'key') this.dahKeyPressed = true; else this.dahPressed = true; }
                 return;
            }
        }

        // --- Standard Press Processing ---
        if (!isGameInputContext && !isResultsContext) return;

        const now = performance.now();
        let stateChanged = false;
        let pressStartTimeKey = (type === 'dit') ? 'dit' : 'dah';

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && !this.ditPressed) { this.ditPressed = true; stateChanged = true; }
            else if (method === 'key' && !this.ditKeyPressed) { this.ditKeyPressed = true; stateChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && !this.dahPressed) { this.dahPressed = true; stateChanged = true; }
            else if (method === 'key' && !this.dahKeyPressed) { this.dahKeyPressed = true; stateChanged = true; }
        }

        if (stateChanged) {
            this.pressStartTime[pressStartTimeKey] = now;
            const isCurrentlyActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
            this.uiManager.setButtonActive(type, isCurrentlyActive);

            if (isResultsContext) {
                console.log(`Results Action Triggered by: ${type}`);
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
        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                              (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        if (!isGameContext && !isResultsContext) return;

        let stateChanged = false;

        if (type === 'dit') {
            if ((method === 'touch' || method === 'mouse') && this.ditPressed) { this.ditPressed = false; stateChanged = true; }
            else if (method === 'key' && this.ditKeyPressed) { this.ditKeyPressed = false; stateChanged = true; }
        } else { // dah
            if ((method === 'touch' || method === 'mouse') && this.dahPressed) { this.dahPressed = false; stateChanged = true; }
            else if (method === 'key' && this.dahKeyPressed) { this.dahKeyPressed = false; stateChanged = true; }
        }

        if (stateChanged) {
            const isStillActive = (type === 'dit') ? (this.ditPressed || this.ditKeyPressed) : (this.dahPressed || this.dahKeyPressed);
            this.uiManager.setButtonActive(type, isStillActive);

            if (isGameContext && this.queuedInput !== null && !this.audioPlayer.inputToneNode) {
                // console.log("Release detected queue processing opportunity.");
                this.handleToneEnd();
            }

            if (isGameContext) {
                 this._processInputStateChange();
            }
        }
    }


    /** Binds touch, mouse and keyboard event listeners. */
    _bindEvents() {
        // Touch Events
        this.ditButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dit'), { passive: false, capture: true });
        this.dahButton.addEventListener('touchstart', (e) => this._handleTouchStart(e, 'dah'), { passive: false, capture: true });
        document.addEventListener('touchend', this._handleTouchEnd.bind(this), { passive: false });
        document.addEventListener('touchcancel', this._handleTouchEnd.bind(this), { passive: false });

        // Mouse Events
        this.ditButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dit'));
        this.dahButton.addEventListener('mousedown', (e) => this._handleMousePressStart(e, 'dah'));
        document.addEventListener('mouseup', this._handleMousePressEnd.bind(this));

        // Prevent Context Menu & Drag
        [this.ditButton, this.dahButton].forEach(button => {
            button.addEventListener('contextmenu', e => e.preventDefault());
            button.addEventListener('dragstart', e => e.preventDefault());
        });

        // Keyboard Events
        document.addEventListener('keydown', this._handleKeyDown.bind(this));
        document.addEventListener('keyup', this._handleKeyUp.bind(this));
    }

    // --- Event Handlers ---

    _handleKeyDown(event) {
        // Ignore if focus is on inputs or settings modal (except key mapping inputs)
        const targetElement = event.target;
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput;
        const isOtherInputFocused = !isKeyMapInputFocused && (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        // Allow keydown ONLY if focus is not on an input irrelevant to the game,
        // OR if the settings modal is closed.
        if (isOtherInputFocused || (isSettingsOpen && !isKeyMapInputFocused)) {
            return;
        }

        // If focus is on key mapping inputs, let UIManager handle it
        if (isKeyMapInputFocused) {
            return;
        }

        const isGameContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) && (this.gameState.status === GameStatus.READY || this.gameState.isPlaying());
        const isResultsContext = this.gameState.status === GameStatus.SHOWING_RESULTS;

        // Check against current key mappings (case-insensitive compare might be safer)
        const pressedKey = event.key;
        const isDitKey = pressedKey.toLowerCase() === this.keyMappings.dit.toLowerCase();
        const isDahKey = pressedKey.toLowerCase() === this.keyMappings.dah.toLowerCase();


        if ((isGameContext || isResultsContext) && (isDitKey || isDahKey)) {
            event.preventDefault();

            if (!event.repeat) {
                if (isDitKey) {
                    this._press('dit', 'key');
                } else if (isDahKey) {
                    this._press('dah', 'key');
                }
            }
        }
    }


    _handleKeyUp(event) {
        const targetElement = event.target;
        const isKeyMapInputFocused = targetElement === this.ditKeyInput || targetElement === this.dahKeyInput;
        const isOtherInputFocused = !isKeyMapInputFocused && (targetElement === this.playbackInput || targetElement === this.sandboxInput || targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA');
        const isSettingsOpen = this.settingsModal && !this.settingsModal.classList.contains('hidden');

        if (isOtherInputFocused || (isSettingsOpen && !isKeyMapInputFocused)) {
             return;
        }
         if (isKeyMapInputFocused) {
            return; // Let UIManager handle keyup for key mapping inputs
        }


        const releasedKey = event.key;
        const isDitKey = releasedKey.toLowerCase() === this.keyMappings.dit.toLowerCase();
        const isDahKey = releasedKey.toLowerCase() === this.keyMappings.dah.toLowerCase();


        if (isDitKey) {
             event.preventDefault();
             this._release('dit', 'key');
         }
        else if (isDahKey) {
             event.preventDefault();
             this._release('dah', 'key');
         }
    }

     // Handles mouse down
    _handleMousePressStart(event, type) {
        if (event.button !== 0) return;
        event.preventDefault();
        this._press(type, 'mouse');
    }

    // Handles mouse up ANYWHERE on the document
    _handleMousePressEnd(event) {
        if (event.button !== 0) return;
        if (this.ditPressed) this._release('dit', 'mouse');
        if (this.dahPressed) this._release('dah', 'mouse');
    }


    // Handles touch start
    _handleTouchStart(event, type) {
        event.preventDefault();

        if (type === 'dit' && this.activeTouchIds.dit !== null) return;
        if (type === 'dah' && this.activeTouchIds.dah !== null) return;

        const touch = event.changedTouches[0];
        if (type === 'dit') this.activeTouchIds.dit = touch.identifier;
        if (type === 'dah') this.activeTouchIds.dah = touch.identifier;

        this._press(type, 'touch');
    }

    // Handles touch end/cancel ANYWHERE
    _handleTouchEnd(event) {
        for (let i = 0; i < event.changedTouches.length; i++) {
            const touch = event.changedTouches[i];
            const endedId = touch.identifier;

            if (this.activeTouchIds.dit === endedId) {
                this.activeTouchIds.dit = null;
                this._release('dit', 'touch');
            }
            else if (this.activeTouchIds.dah === endedId) {
                 this.activeTouchIds.dah = null;
                 this._release('dah', 'touch');
            }
        }
    }


    /** Central logic to determine input mode (gameplay/sandbox only) and manage timers/state. */
    _processInputStateChange() {
         const isGameInputContext = (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX) &&
                                    (this.gameState.status === GameStatus.READY || this.gameState.isPlaying() || this.gameState.status === GameStatus.DECODING);

         if (!isGameInputContext) {
            this._clearRepeatOrIambicTimer();
            this.lastEmitTime = 0;
            this.queuedInput = null;
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
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
            if (this.gameState.iambicState === null) {
                const pressTimeDit = this.pressStartTime.dit || 0;
                const pressTimeDah = this.pressStartTime.dah || 0;
                this.gameState.iambicState = (pressTimeDah > pressTimeDit) ? 'dah' : 'dit';
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

        } else {
            this.gameState.isIambicHandling = false;
            this.gameState.iambicState = null;
             if (this.gameState.currentInputSequence && this.gameState.status === GameStatus.TYPING) {
                if (this.queuedInput === null && !this.audioPlayer.inputToneNode) {
                    this._scheduleDecodeAfterDelay();
                }
             } else if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                 this.gameState.status = GameStatus.LISTENING;
             }
        }
    }

    /** Handles adding a Morse element ('.' or '-') to the game state sequence. */
    _emitInputToSequence(type) {
        const morseChar = (type === 'dit') ? '.' : '-';

        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
            return morseChar;
        }

        this.gameState.addInput(morseChar);
        this.uiManager.updateUserPatternDisplay(this.gameState.currentInputSequence);
        if (this.callbacks.onInput) this.callbacks.onInput(morseChar);

        return morseChar;
    }


    /** Triggers the next output in an Auto-Repeat or Iambic sequence. */
    _triggerRepeatOrIambicOutput() {
        this._clearRepeatOrIambicTimer();

        const isDitActive = this.ditPressed || this.ditKeyPressed;
        const isDahActive = this.dahPressed || this.dahKeyPressed;
        const elementToSend = this.gameState.iambicState;

        if (!(this.gameState.isPlaying() || this.gameState.status === GameStatus.READY)) {
             this.lastEmitTime = 0; return;
        }
        if (!elementToSend) { return; }

        if (this.gameState.isIambicHandling && (!isDitActive || !isDahActive)) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dit' && !isDitActive) { this._processInputStateChange(); return; }
        if (!this.gameState.isIambicHandling && elementToSend === 'dah' && !isDahActive) { this._processInputStateChange(); return; }

        const now = performance.now();
        const timeSinceLastEmit = now - this.lastEmitTime;
        const lastElementDurationMs = (this.lastInputTypeGenerated === 'dit' ? this.ditDuration : (this.lastInputTypeGenerated === 'dah' ? this.dahDuration : 0));
        const requiredTimeMs = lastElementDurationMs + this.intraCharGap;

        if (this.lastEmitTime > 0 && timeSinceLastEmit < requiredTimeMs) {
            const remainingTimeMs = requiredTimeMs - timeSinceLastEmit;
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, remainingTimeMs));
            return;
        }

        if (this.audioPlayer.inputToneNode) {
             if (this.queuedInput === null) {
                 this.queuedInput = elementToSend;
                 // console.log(`Audio busy, queued: ${elementToSend}`);
             } // else { console.log(`Audio busy, queue full. Dropped: ${elementToSend}`); }
             return;
         }

         this._emitInputToSequence(elementToSend);
         this.audioPlayer.playInputTone(elementToSend);
         this.lastInputTypeGenerated = elementToSend;
         this.lastEmitTime = performance.now();

         const currentElementDurationMs = (elementToSend === 'dit' ? this.ditDuration : this.dahDuration);
         const delayForNextMs = currentElementDurationMs + this.intraCharGap;

         if (this.gameState.isIambicHandling) {
             this.gameState.iambicState = (elementToSend === 'dit') ? 'dah' : 'dit';
         }

         const stillDitActive = this.ditPressed || this.ditKeyPressed;
         const stillDahActive = this.dahPressed || this.dahKeyPressed;
         const shouldContinue =
               (this.gameState.isIambicHandling && stillDitActive && stillDahActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dit' && stillDitActive) ||
               (!this.gameState.isIambicHandling && this.gameState.iambicState === 'dah' && stillDahActive);

         if (shouldContinue) {
            this.repeatOrIambicTimerId = setTimeout(() => this._triggerRepeatOrIambicOutput(), Math.max(5, delayForNextMs));
         } else {
             this._processInputStateChange();
         }
    }

    /** Callback function triggered by AudioPlayer when an input tone finishes playing naturally. */
    handleToneEnd() {
         let processedQueueItem = false;
         let emittedType = null;

         if (this.queuedInput !== null) {
             const typeToProcess = this.queuedInput;
             this.queuedInput = null;
             // console.log(`Processing queued input: ${typeToProcess}`);

             this._emitInputToSequence(typeToProcess);
             this.audioPlayer.playInputTone(typeToProcess);
             processedQueueItem = true;
             emittedType = typeToProcess;

             if (this.gameState.status !== GameStatus.FINISHED && this.gameState.status !== GameStatus.SHOWING_RESULTS) {
                 this.gameState.status = GameStatus.TYPING;
             }
             this.lastInputTypeGenerated = emittedType;
             this.lastEmitTime = performance.now();
         }

         setTimeout(() => {
             const isDitActive = this.ditPressed || this.ditKeyPressed;
             const isDahActive = this.dahPressed || this.dahKeyPressed;

             if (isDitActive || isDahActive) {
                  this._processInputStateChange();
             } else {
                 if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                     this._scheduleDecodeAfterDelay();
                 } else if (!processedQueueItem && this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                     this.gameState.status = GameStatus.LISTENING;
                 }
                  else if (processedQueueItem && this.gameState.status === GameStatus.TYPING && this.gameState.currentInputSequence) {
                       this._scheduleDecodeAfterDelay();
                  }
             }
         }, 1);
     }


    /** Schedules the character decode function after the inter-character gap timeout. */
     _scheduleDecodeAfterDelay() {
        this.decoder.cancelScheduledDecode();

         const canSchedule = (
             this.gameState.currentInputSequence &&
             (this.gameState.status === GameStatus.TYPING || this.gameState.status === GameStatus.LISTENING) &&
             (this.gameState.currentMode === AppMode.GAME || this.gameState.currentMode === AppMode.SANDBOX)
         );

         if (!canSchedule) {
             if (this.gameState.status === GameStatus.TYPING && !this.gameState.currentInputSequence) {
                  this.gameState.status = GameStatus.LISTENING;
             }
             return;
         }

         // console.log(`Scheduling decode for sequence: '${this.gameState.currentInputSequence}'`);
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
                 // console.log(`Decode callback skipped. Status: ${this.gameState.status}, Mode: ${this.gameState.currentMode}`);
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
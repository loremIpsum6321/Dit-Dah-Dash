/* Dit-Dah-Dash/js/audioPlayer.js */
/* In file: js/audioPlayer.js */
/**
 * js/audioPlayer.js
 * -----------------
 * Handles audio feedback and Morse sequence playback using the Web Audio API.
 * Allows adjustment of WPM, tone frequency, and volume. Plays discrete tones based on timing.
 * Includes fixes for feedback sounds and paddle input cancellation.
 * Correct sound is now disabled.
 * Added callback for when input tones finish playing.
 * Ensures onended callback is reliably called after tone completes naturally.
 * Improves audio context initialization reliability, especially on mobile.
 * Added master gain node for volume control.
 */

class AudioPlayer {
    /**
     * @constructor
     * Initializes audio properties.
     */
    constructor() {
        this.audioContext = null;
        this.masterGainNode = null; // For overall volume control
        this.currentVolume = MorseConfig.AUDIO_DEFAULT_VOLUME;
        this.isSoundEnabled = true; // Sound toggle state
        this.wpm = MorseConfig.DEFAULT_WPM;
        this.toneFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
        this.rampTime = MorseConfig.AUDIO_RAMP_TIME;
        this.isInitialized = false; // Flag to track initialization status

        // Timing (derived from WPM)
        this.ditDurationSec = 0;
        this.dahDurationSec = 0;
        this.intraCharGapSec = 0;
        this.interCharGapSec = 0;
        this.wordGapSec = 0;

        // Playback state
        this.playbackNodes = []; // Stores { osc, gain } for sequence playback
        this.feedbackNodes = []; // Stores { osc, gain } for feedback sounds (incorrect only now)
        this.inputToneNode = null; // Stores { osc, gain, type: 'dit'|'dah' } for the *currently playing* input paddle tone
        this.playbackCompletionTimeoutId = null;
        this.isCurrentlyPlayingBack = false;
        this.onToneEndCallback = null; // Callback when an input tone finishes

        this._calculateTimings(); // Initial calculation based on default WPM
    }

    /**
     * Sets a callback function to be executed when an input tone finishes playing naturally.
     * @param {function | null} callback - The function to call, or null to clear.
     */
    setOnToneEndCallback(callback) {
        this.onToneEndCallback = callback;
    }


    /**
     * Calculates Morse element durations based on the current WPM.
     * @private
     */
    _calculateTimings() {
        if (this.wpm <= 0) return;
        const ditMs = 1200 / this.wpm;
        this.ditDurationSec = ditMs / 1000;
        this.dahDurationSec = (ditMs * MorseConfig.DAH_DURATION_UNITS) / 1000;
        this.intraCharGapSec = (ditMs * MorseConfig.INTRA_CHARACTER_GAP_UNITS) / 1000; // Gap *between* elements
        this.interCharGapSec = (ditMs * MorseConfig.INTER_CHARACTER_GAP_UNITS) / 1000;
        this.wordGapSec = (ditMs * MorseConfig.WORD_GAP_UNITS) / 1000;
    }

    /**
     * Initializes or resumes the Web Audio API context.
     * Required before any sound can be played, often triggered by user interaction.
     * Ensures it only fully initializes once. Returns readiness state.
     * @returns {boolean} True if the audio context is initialized and running/resumed, false otherwise.
     */
    initializeAudioContext() {
        // Avoid re-initialization if already done successfully
        if (this.isInitialized && this.audioContext && this.audioContext.state === 'running') {
            return true;
        }

        // Create context if it doesn't exist
        if (!this.audioContext) {
            try {
                console.log("Attempting to create AudioContext...");
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGainNode = this.audioContext.createGain();
                // Set initial volume based on stored setting or default
                this.masterGainNode.gain.setValueAtTime(
                    this.isSoundEnabled ? this.currentVolume : 0,
                    this.audioContext.currentTime
                );
                this.masterGainNode.connect(this.audioContext.destination);
                this.audioContext.onstatechange = () => {
                     console.log("AudioContext state changed:", this.audioContext.state);
                     // Update initialized flag based on state change
                     this.isInitialized = this.audioContext.state === 'running';
                     // Re-apply volume if state becomes running after being suspended/closed
                     if (this.isInitialized) this.setVolume(this.currentVolume);
                };
                console.log("AudioContext created, state:", this.audioContext.state);
            } catch (e) {
                console.error("Web Audio API initialization failed.", e);
                this.isSoundEnabled = false;
                this.isInitialized = false; // Mark as not initialized on error
                return false;
            }
        }

        // Handle suspended state (common on mobile before interaction)
        if (this.audioContext.state === 'suspended') {
            console.log("AudioContext is suspended, attempting to resume...");
            this.audioContext.resume()
                .then(() => {
                    console.log("AudioContext resumed successfully.");
                    this.isInitialized = true; // Mark as initialized on successful resume
                    this.setVolume(this.currentVolume); // Re-apply volume after resume
                })
                .catch(err => {
                    console.error("AudioContext resume failed:", err);
                    this.isInitialized = false; // Mark as not initialized on resume failure
                });
             // Note: Resume is async, so readiness might not be immediate.
             // Return false for now, subsequent calls will check the state again.
             return false;
        }

        // If context exists and is running, mark as initialized
        if (this.audioContext.state === 'running') {
            this.isInitialized = true;
            return true;
        }

        // If context is closed or in another state, it's not ready
        this.isInitialized = false;
        return false;
    }

    /**
     * Updates the Words Per Minute (WPM) setting and recalculates timings.
     * @param {number} wpm - The new WPM value.
     */
    updateWpm(wpm) {
        if (wpm > 0 && this.wpm !== wpm) {
            this.wpm = wpm;
            this._calculateTimings();
            if (this.isCurrentlyPlayingBack) {
                console.warn("WPM changed during Morse sequence playback. Timing of ongoing sequence might be affected.");
            }
        }
    }

    /**
     * Updates the base frequency for the Morse tones.
     * @param {number} frequency - The new frequency in Hz.
     */
    updateFrequency(frequency) {
        const newFreq = Math.max(MorseConfig.AUDIO_MIN_FREQUENCY, Math.min(MorseConfig.AUDIO_MAX_FREQUENCY, frequency));
        if (this.toneFrequency !== newFreq) {
            this.toneFrequency = newFreq;
            console.log(`Audio tone frequency updated to: ${this.toneFrequency} Hz`);
        }
    }

    /**
     * Sets the master volume level.
     * @param {number} level - Volume level from 0.0 (silent) to 1.0 (full).
     */
    setVolume(level) {
        const newVolume = Math.max(0, Math.min(1, level)); // Clamp between 0 and 1
        this.currentVolume = newVolume;
        console.log(`Setting volume to: ${(newVolume * 100).toFixed(0)}%`);

        if (this.masterGainNode && this.audioContext && this.audioContext.state === 'running') {
            try {
                const targetGain = this.isSoundEnabled ? this.currentVolume : 0;
                this.masterGainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
                // Use linearRampToValueAtTime for smoother volume changes
                this.masterGainNode.gain.linearRampToValueAtTime(
                    targetGain,
                    this.audioContext.currentTime + this.rampTime * 2 // Short ramp time
                );
            } catch (e) {
                console.warn("Could not set master gain - AudioContext likely closed or not ready:", e);
            }
        }
    }

    /**
     * Enables or disables sound output globally (mutes/unmutes).
     * Does not change the underlying volume level.
     * @param {boolean} enabled - True to enable sound, false to disable/mute.
     */
    setSoundEnabled(enabled) {
        if (this.isSoundEnabled === enabled) return; // No change

        this.isSoundEnabled = enabled;
        console.log(`Sound ${enabled ? 'enabled' : 'disabled'}`);
        // Attempt to initialize context if enabling sound and not yet initialized
        if (enabled && !this.isInitialized) {
            this.initializeAudioContext();
        }

        // Apply mute/unmute using the current volume level
        this.setVolume(this.currentVolume); // This will set gain to 0 if !isSoundEnabled

        if (!enabled) {
            this.stopPlayback();
            this.stopInputTone(); // Stop input tone if sound disabled
            this.stopFeedbackSounds();
        }
    }

    /**
     * Plays a single Morse tone (dit or dah) immediately.
     * Ensures the audio context is initialized and ready before playing.
     * @param {'dit' | 'dah'} type - The type of tone to play.
     * @returns {boolean} True if the tone was successfully scheduled, false otherwise.
     */
    playInputTone(type) {
        // Ensure context is initialized and ready FIRST. Crucial for mobile.
        if (!this.isSoundEnabled || !this.initializeAudioContext()) {
            // Silently fail if sound disabled or context not ready, don't log warning spam
            return false;
        }

        // If a tone is somehow still marked as playing, stop it forcefully first.
        if (this.inputToneNode) {
            console.warn(`playInputTone called while inputToneNode was not null. Stopping previous tone (${this.inputToneNode.type}) first.`);
            this.stopInputTone();
        }

        const duration = type === 'dah' ? this.dahDurationSec : this.ditDurationSec;
        if (duration <= 0) {
            console.warn(`playInputTone called with invalid duration (${duration}) for type ${type}`);
            return false;
        }

        // Now schedule the tone, context should be running
        const startTime = this.audioContext.currentTime;
        const toneNodes = this._scheduleTone(startTime, duration, this.toneFrequency, false, type);

        if (!toneNodes) {
            console.error(`Failed to schedule tone for ${type} even after context check.`);
            return false; // Scheduling failed
        }

        this.inputToneNode = toneNodes; // Store reference { osc, gain, type }

        // Setup the onended handler for natural completion
        const currentNodeRef = this.inputToneNode; // Capture ref for closure

        currentNodeRef.osc.onended = () => {
            // Only process if this is still the currently active node
            if (this.inputToneNode === currentNodeRef) {
                this.inputToneNode = null; // Clear the reference *first*
                if (this.onToneEndCallback) {
                    this.onToneEndCallback(); // Notify handler that audio is free
                }
            }
            // Basic cleanup (disconnect nodes)
            try {
                if (currentNodeRef.osc) currentNodeRef.osc.disconnect();
                if (currentNodeRef.gain) currentNodeRef.gain.disconnect();
             } catch(e){
                 // Ignore errors, node might already be disconnected
             }
        };
        return true; // Tone scheduled successfully
    }


    /**
     * Stops the currently playing input tone immediately.
     */
    stopInputTone() {
        if (this.inputToneNode && this.audioContext && this.audioContext.state === 'running') {
            const nodeToStop = this.inputToneNode; // Capture ref before clearing
            this.inputToneNode = null; // Clear reference *immediately*

            // console.log(`Stopping input tone manually: ${nodeToStop.type}`); // Debug

            const now = this.audioContext.currentTime;
            const { osc, gain } = nodeToStop;

            try {
                // Remove the natural 'onended' handler since this is a forced stop
                if (osc) osc.onended = null;

                // Cancel future changes and ramp down gain
                if (gain?.gain) {
                    gain.gain.cancelScheduledValues(now);
                    gain.gain.setValueAtTime(gain.gain.value, now); // Hold current gain value
                    gain.gain.linearRampToValueAtTime(0, now + this.rampTime); // Ramp down smoothly
                }
                // Stop the oscillator shortly after the ramp down completes
                if (osc) {
                    osc.stop(now + this.rampTime + 0.01); // Stop slightly after ramp
                    // Ensure disconnect happens *after* stop time
                    setTimeout(() => {
                        try {
                            if (osc) osc.disconnect();
                            if (gain) gain.disconnect();
                        } catch(e){ /* Ignore */ }
                     }, this.rampTime * 1000 + 20);
                }
            } catch (e) {
                console.warn("Error stopping input audio node:", e);
                // Fallback disconnect
                try { if (osc) osc.disconnect(); if (gain) gain.disconnect(); } catch(e2){}
            }
             // Do NOT trigger the onToneEndCallback here, this is manual stop.
        } else {
             // If stop called but no node or context not running, just clear the reference
             this.inputToneNode = null;
        }
    }


    /**
     * Internal helper to schedule a single oscillator tone.
     * Assumes audio context is valid and running. Connects to masterGainNode.
     * @param {number} startTime - The audioContext time when the tone should start.
     * @param {number} duration - The duration of the tone in seconds.
     * @param {number} frequency - The frequency of the tone in Hz.
     * @param {boolean} isSequencePlayback - If true, tracks the node for sequence cancellation.
     * @param {'dit'|'dah'|null} [type=null] - The type of tone, for tracking input tones.
     * @returns {{osc: OscillatorNode, gain: GainNode, type: string|null} | null} Reference to the created nodes or null on failure.
     * @private
     */
    _scheduleTone(startTime, duration, frequency, isSequencePlayback, type = null) {
        // Ensure context and master gain are ready
        if (!this.initializeAudioContext() || !this.masterGainNode) {
            console.warn("_scheduleTone skipped: AudioContext or Master Gain Node not ready.");
            return null;
        }
        if (duration <= 0) {
             console.warn(`_scheduleTone skipped: duration invalid (${duration})`);
             return null;
        }

        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain(); // Individual gain for ramp
            osc.connect(gain);
            gain.connect(this.masterGainNode); // Connect individual gain to MASTER gain

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            // Gain scheduling (ramp up, hold, ramp down) for the *individual* gain node
            const INDIVIDUAL_GAIN = 0.9; // Don't use full 1.0 to avoid clipping if master is 1.0
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(INDIVIDUAL_GAIN, startTime + this.rampTime);
            // Ensure hold phase exists if duration is longer than ramp times
            if (duration > this.rampTime * 2) {
                 gain.gain.setValueAtTime(INDIVIDUAL_GAIN, startTime + duration - this.rampTime);
            }
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc.start(startTime);
            // Calculate stop time slightly after gain ramp completes
            const stopTime = startTime + duration + this.rampTime; // Add small buffer
            osc.stop(stopTime);

             const nodeRef = { osc, gain, type };

             // Default onended cleanup - will be overridden by playInputTone if needed
             // This basic cleanup handles sequence playback nodes and feedback sounds
             osc.onended = () => {
                 if (isSequencePlayback) {
                    this.playbackNodes = this.playbackNodes.filter(n => n.osc !== osc);
                 } else if (this.feedbackNodes.some(n => n.osc === osc)) {
                    this.feedbackNodes = this.feedbackNodes.filter(n => n.osc !== osc);
                 }
                 // Disconnect nodes after they finish
                 try {
                    if(osc) osc.disconnect();
                    if(gain) gain.disconnect();
                 } catch(e){ /* Ignore if already disconnected */ }
             };

             if (isSequencePlayback) {
                this.playbackNodes.push(nodeRef);
             }

             return nodeRef;
        } catch (error) {
            console.error("AudioPlayer: Error scheduling tone:", error);
            // Attempt cleanup on error
            let tempOsc = osc, tempGain = gain; // Avoid closure issues if vars assigned above error
            try { tempOsc?.disconnect(); tempGain?.disconnect(); } catch(e){}
            return null;
        }
    }

    /**
     * Plays a full Morse sequence based on a formatted string.
     * Assumes the string contains '.', '-', ' ', '/', '|' markers generated by MorseDecoder.
     * Ensures audio context is ready before starting playback.
     * @param {string} morseString - The formatted Morse sequence (e.g., ". - . / - ---").
     * @param {function} [onComplete] - Optional callback function executed when playback finishes naturally.
     */
    playMorseSequence(morseString, onComplete) {
        // Ensure context is initialized and ready FIRST.
        if (!this.isSoundEnabled || !this.initializeAudioContext() || !morseString) {
            console.warn("playMorseSequence skipped: Sound disabled, context not ready, or empty string.");
            if (onComplete) onComplete();
            return;
        }

        this.stopPlayback(); // Stop any previous sequence first
        this.stopInputTone(); // Ensure input tone doesn't interfere
        this.isCurrentlyPlayingBack = true;
        console.log("Starting Morse sequence playback...");
        if (window.morseGameState) window.morseGameState.status = GameStatus.PLAYING_BACK;

        let scheduledTime = this.audioContext.currentTime;
        const elements = morseString.split(/(\s+|\/|\|)/); // Split including delimiters

        elements.forEach(element => {
            if (!element) return; // Skip empty strings from split
            element = element.trim();
            let currentDuration = 0;
            let gapDuration = 0; // Use 0 gap by default unless specified

            if (element === '.') {
                currentDuration = this.ditDurationSec;
                this._scheduleTone(scheduledTime, currentDuration, this.toneFrequency, true);
                gapDuration = this.intraCharGapSec; // Gap AFTER dit
            } else if (element === '-') {
                currentDuration = this.dahDurationSec;
                this._scheduleTone(scheduledTime, currentDuration, this.toneFrequency, true);
                gapDuration = this.intraCharGapSec; // Gap AFTER dah
            } else if (element === '/') {
                 // Inter-character gap is TOTAL gap. We already added intra-char gap implicitly
                 // after the previous element, so only add the *difference*.
                 gapDuration = this.interCharGapSec - this.intraCharGapSec;
                 currentDuration = 0; // No sound duration for gap markers
            } else if (element === '|') {
                 // Word gap is TOTAL gap. Subtract the implicit intra-char gap.
                 gapDuration = this.wordGapSec - this.intraCharGapSec;
                 currentDuration = 0; // No sound duration for gap markers
             }
             // Ignore ' ' (space) delimiters explicitly now handled by split regex

             // Ensure gap is not negative (can happen if inter < intra, although unlikely)
             gapDuration = Math.max(0, gapDuration);

             scheduledTime += currentDuration + gapDuration;
        });

        // Calculate total duration from the start time to the final scheduled time
        const totalDurationMs = (scheduledTime - this.audioContext.currentTime) * 1000;

        // Schedule the completion callback
        this.playbackCompletionTimeoutId = setTimeout(() => {
            this.isCurrentlyPlayingBack = false;
            this.playbackNodes = []; // Clear node references
            this.playbackCompletionTimeoutId = null;
            console.log("Morse sequence playback finished naturally.");
            if (window.morseGameState && window.morseGameState.status === GameStatus.PLAYING_BACK) {
                 // Revert state based on where playback was initiated
                 if(window.morseGameState.currentMode === AppMode.PLAYBACK) {
                     window.morseGameState.status = GameStatus.PLAYBACK_INPUT;
                 }
                 // Could add logic here if playback occurs in other modes
             }
            if (onComplete) onComplete();
        }, Math.max(0, totalDurationMs) + 150); // Add buffer to ensure all sounds finished
    }

    /**
     * Stops any currently playing Morse sequence playback immediately.
     * Cleans up audio nodes and cancels the completion callback.
     */
    stopPlayback() {
        if (this.playbackCompletionTimeoutId) {
            clearTimeout(this.playbackCompletionTimeoutId);
            this.playbackCompletionTimeoutId = null;
        }

        if (this.playbackNodes.length > 0 && this.audioContext && this.audioContext.state === 'running') {
            console.log(`Stopping playback. ${this.playbackNodes.length} nodes active.`);
            const now = this.audioContext.currentTime;
            // Iterate over a copy because the array might be modified by onended handlers
            [...this.playbackNodes].forEach(({ osc, gain }) => {
                try {
                    // Stop gain ramps and fade out
                    if (gain?.gain) {
                        gain.gain.cancelScheduledValues(now);
                        gain.gain.setValueAtTime(gain.gain.value, now);
                        gain.gain.linearRampToValueAtTime(0, now + this.rampTime);
                    }
                    // Stop oscillator after fade out
                    if (osc) {
                        osc.onended = null; // Remove default handler
                        osc.stop(now + this.rampTime + 0.01);
                        // Disconnect slightly later
                         setTimeout(() => {
                             try {
                                if (osc) osc.disconnect();
                                if (gain) gain.disconnect();
                             } catch(e){}
                         }, this.rampTime * 1000 + 20);
                    }
                } catch (e) {
                    console.warn("Error stopping audio node during playback cancellation:", e);
                    try { if (osc) osc.disconnect(); if (gain) gain.disconnect(); } catch(e2){}
                }
            });
            this.playbackNodes = []; // Clear the array immediately
        } else {
             this.playbackNodes = []; // Ensure array is clear even if context wasn't running
        }

         // Update game state if playback was active
         if (this.isCurrentlyPlayingBack) {
             this.isCurrentlyPlayingBack = false;
             if (window.morseGameState && window.morseGameState.status === GameStatus.PLAYING_BACK) {
                 if(window.morseGameState.currentMode === AppMode.PLAYBACK) {
                     window.morseGameState.status = GameStatus.PLAYBACK_INPUT;
                 }
             }
             console.log("Playback stopped manually.");
         }
    }

    // --- Feedback Sounds ---

    /** Stops any currently playing feedback sounds immediately. */
    stopFeedbackSounds() {
         if (this.feedbackNodes.length > 0 && this.audioContext && this.audioContext.state === 'running') {
             const now = this.audioContext.currentTime;
             [...this.feedbackNodes].forEach(({ osc, gain }) => {
                 try {
                     if (gain?.gain) {
                        gain.gain.cancelScheduledValues(now);
                        gain.gain.setValueAtTime(gain.gain.value, now);
                        gain.gain.linearRampToValueAtTime(0, now + this.rampTime);
                     }
                     if (osc) {
                         osc.onended = null;
                         osc.stop(now + this.rampTime + 0.01);
                          setTimeout(() => {
                              try {
                                 if (osc) osc.disconnect();
                                 if (gain) gain.disconnect();
                              } catch(e){}
                          }, this.rampTime * 1000 + 20);
                     }
                 } catch (e) {
                     console.warn("Error stopping feedback audio node:", e);
                     try { if (osc) osc.disconnect(); if (gain) gain.disconnect(); } catch(e2){}
                 }
             });
             this.feedbackNodes = []; // Clear the array
         } else {
              this.feedbackNodes = []; // Ensure array is clear
         }
     }

    /** Plays a short, higher-pitched sound for correct feedback. (DEACTIVATED) */
    playCorrectSound() {
        return; // Do nothing
    }

    /** Plays a slightly longer, lower-pitched sound for incorrect feedback. */
    playIncorrectSound() {
        // Ensure context is initialized and ready
        if (!this.isSoundEnabled || !this.initializeAudioContext()) {
             // console.warn("playIncorrectSound skipped: Sound disabled or context not ready.");
            return;
        }
        // Check if other critical sounds are playing
        if (this.inputToneNode || this.isCurrentlyPlayingBack) {
             // Silently ignore if other sounds playing to prevent overlap
            return;
        }
        this._playFeedbackSound(this.toneFrequency * 0.7, 0.1);
    }

    /**
     * Internal helper to play simple feedback sounds. Ensures only one feedback sound plays at a time.
     * Assumes audio context is valid and running.
     * @param {number} frequency - The frequency of the feedback tone. Must be > 0.
     * @param {number} durationSeconds - The duration of the feedback tone.
     * @private
     */
    _playFeedbackSound(frequency, durationSeconds) {
        // Ensure context and master gain are ready
        if (!this.initializeAudioContext() || !this.masterGainNode) {
            console.warn("_playFeedbackSound skipped: AudioContext or Master Gain Node not ready.");
            return;
        }
        if (frequency <= 0) return;

        this.stopFeedbackSounds(); // Stop existing feedback first

        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain(); // Individual gain for ramp
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, now);

            const feedbackGainLevel = 0.5; // Lower volume for feedback
            // Apply ramp to *individual* gain node
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(feedbackGainLevel, now + this.rampTime);
            if (durationSeconds > this.rampTime * 2) {
                gain.gain.setValueAtTime(feedbackGainLevel, now + durationSeconds - this.rampTime);
            }
            gain.gain.linearRampToValueAtTime(0, now + durationSeconds);

            osc.connect(gain);
            gain.connect(this.masterGainNode); // Connect individual gain to MASTER gain

            osc.start(now);
            const stopTime = now + durationSeconds + this.rampTime + 0.01; // Add buffer
            osc.stop(stopTime);

            const nodeRef = { osc, gain };
            this.feedbackNodes.push(nodeRef);

            // Use default onended handler attached by _scheduleTone/helper (which handles feedbackNodes filtering and disconnect)
            // No need to define onended specifically here anymore.

        } catch (error) {
            console.error("Error playing feedback sound:", error);
            let tempOsc = osc, tempGain = gain; // Avoid closure issues
            try { tempOsc?.disconnect(); tempGain?.disconnect(); } catch(e){}
            this.feedbackNodes = []; // Clear feedback nodes on error
        }
    }
}

// Create global instance
window.morseAudioPlayer = new AudioPlayer();
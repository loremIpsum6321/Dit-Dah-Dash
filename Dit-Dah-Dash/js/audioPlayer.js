/* In file: js/audioPlayer.js */
/**
 * js/audioPlayer.js
 * -----------------
 * Handles audio feedback and Morse sequence playback using the Web Audio API.
 * Allows adjustment of WPM and tone frequency. Plays discrete tones based on timing.
 * Includes fixes for feedback sounds and paddle input cancellation.
 * Correct sound is now disabled.
 * Added callback for when input tones finish playing.
 * Ensures onended callback is reliably called after tone completes naturally.
 */

class AudioPlayer {
    /**
     * @constructor
     * Initializes audio properties.
     */
    constructor() {
        this.audioContext = null;
        this.masterGainNode = null;
        this.isSoundEnabled = true;
        this.wpm = MorseConfig.DEFAULT_WPM;
        this.toneFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY;
        this.rampTime = MorseConfig.AUDIO_RAMP_TIME;

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
     * @returns {boolean} True if the audio context is ready, false otherwise.
     */
    initializeAudioContext() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.masterGainNode = this.audioContext.createGain();
                this.masterGainNode.gain.setValueAtTime(this.isSoundEnabled ? 1 : 0, this.audioContext.currentTime);
                this.masterGainNode.connect(this.audioContext.destination);
                this.audioContext.onstatechange = () => console.log("AudioContext state:", this.audioContext.state);
            } catch (e) {
                console.error("Web Audio API initialization failed.", e);
                this.isSoundEnabled = false;
                return false;
            }
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(err => console.error("AudioContext resume failed:", err));
        }
        return this.audioContext && this.audioContext.state !== 'closed';
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
     * Enables or disables sound output globally.
     * @param {boolean} enabled - True to enable sound, false to disable.
     */
    setSoundEnabled(enabled) {
        this.isSoundEnabled = enabled;
        if (this.masterGainNode && this.audioContext) {
             this.masterGainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
             this.masterGainNode.gain.linearRampToValueAtTime(this.isSoundEnabled ? 1 : 0, this.audioContext.currentTime + this.rampTime * 2);
        }
        if (!enabled) {
            this.stopPlayback();
            this.stopInputTone(); // Stop input tone if sound disabled
            this.stopFeedbackSounds();
        }
    }

    /**
     * Plays a single Morse tone (dit or dah) immediately.
     * This assumes any previous tone was handled or stopped appropriately by the caller.
     * @param {'dit' | 'dah'} type - The type of tone to play.
     */
    playInputTone(type) {
        if (!this.isSoundEnabled || !this.initializeAudioContext()) return;

        // If a tone is somehow still marked as playing, stop it forcefully first.
        // This shouldn't happen often with the new InputHandler logic but acts as a safeguard.
        if (this.inputToneNode) {
            console.warn(`playInputTone called while inputToneNode was not null. Stopping previous tone (${this.inputToneNode.type}) first.`);
            this.stopInputTone(); // Force stop the previous one
        }

        const duration = type === 'dah' ? this.dahDurationSec : this.ditDurationSec;
        if (duration <= 0) {
            console.warn(`playInputTone called with invalid duration (${duration}) for type ${type}`);
            return;
        }

        const startTime = this.audioContext.currentTime;
        const toneNodes = this._scheduleTone(startTime, duration, this.toneFrequency, false, type);
        if (!toneNodes) return; // Scheduling failed

        this.inputToneNode = toneNodes; // Store reference { osc, gain, type }

        // Setup the onended handler for natural completion
        const currentNodeRef = this.inputToneNode; // Capture ref for closure
        // console.log(`Attaching onended for ${type} (${currentNodeRef.osc.__resource_id__ || 'no_id'})`); // Debugging ID if available

        currentNodeRef.osc.onended = () => {
            // console.log(`onended fired for ${currentNodeRef.type} (${currentNodeRef.osc.__resource_id__ || 'no_id'})`); // Debugging ID
            // Only process if this is still the currently active node
            if (this.inputToneNode === currentNodeRef) {
                // console.log(`Clearing inputToneNode and calling callback for ${currentNodeRef.type}`); // Debug
                this.inputToneNode = null; // Clear the reference *first*
                if (this.onToneEndCallback) {
                    this.onToneEndCallback(); // Notify handler that audio is free
                }
            } else {
                // console.log(`onended fired for ${currentNodeRef.type}, but inputToneNode changed. Ignoring.`); // Debug
            }
            // Basic cleanup (disconnect nodes)
            try { currentNodeRef.osc?.disconnect(); currentNodeRef.gain?.disconnect(); } catch(e){}
        };
    }


    /**
     * Stops the currently playing input tone immediately.
     */
    stopInputTone() {
        if (this.inputToneNode && this.audioContext) {
            const nodeToStop = this.inputToneNode; // Capture ref before clearing
            this.inputToneNode = null; // Clear reference *immediately*

            // console.log(`Stopping input tone manually: ${nodeToStop.type} (${nodeToStop.osc.__resource_id__ || 'no_id'})`); // Debugging ID

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
                    setTimeout(() => { try { osc.disconnect(); gain?.disconnect(); } catch(e){} }, this.rampTime * 1000 + 20);
                }
            } catch (e) {
                console.warn("Error stopping input audio node:", e);
                // Fallback disconnect
                try { osc?.disconnect(); gain?.disconnect(); } catch(e2){}
            }
             // Do NOT trigger the onToneEndCallback here, this is manual stop.
        }
    }


    /**
     * Internal helper to schedule a single oscillator tone.
     * @param {number} startTime - The audioContext time when the tone should start.
     * @param {number} duration - The duration of the tone in seconds.
     * @param {number} frequency - The frequency of the tone in Hz.
     * @param {boolean} isSequencePlayback - If true, tracks the node for sequence cancellation.
     * @param {'dit'|'dah'|null} [type=null] - The type of tone, for tracking input tones.
     * @returns {{osc: OscillatorNode, gain: GainNode, type: string|null} | null} Reference to the created nodes or null on failure.
     * @private
     */
    _scheduleTone(startTime, duration, frequency, isSequencePlayback, type = null) {
        if (!this.audioContext || !this.masterGainNode || duration <= 0) {
             console.warn(`_scheduleTone skipped: Context/Gain missing or duration invalid (${duration})`);
             return null;
        }
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(frequency, startTime);

            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(1, startTime + this.rampTime);
            if (duration > this.rampTime * 2) {
                 gain.gain.setValueAtTime(1, startTime + duration - this.rampTime);
            } else {
                 gain.gain.setValueAtTime(1, startTime + this.rampTime);
            }
            gain.gain.linearRampToValueAtTime(0, startTime + duration);

            osc.start(startTime);
            const stopTime = startTime + duration + this.rampTime; // Ensure stop happens after ramp
            osc.stop(stopTime);

             const nodeRef = { osc, gain, type };

             // Default onended cleanup - will be overridden by playInputTone if needed
             osc.onended = () => {
                 if (isSequencePlayback) {
                    this.playbackNodes = this.playbackNodes.filter(n => n !== nodeRef);
                 }
                 try { osc.disconnect(); gain.disconnect(); } catch(e){}
             };

             if (isSequencePlayback) {
                this.playbackNodes.push(nodeRef);
             }

             return nodeRef;
        } catch (error) {
            console.error("AudioPlayer: Error scheduling tone:", error);
            return null;
        }
    }

    /**
     * Plays a full Morse sequence based on a formatted string.
     * Assumes the string contains '.', '-', ' ', '/', '|' markers generated by MorseDecoder.
     * @param {string} morseString - The formatted Morse sequence (e.g., ". - . / - ---").
     * @param {function} [onComplete] - Optional callback function executed when playback finishes naturally.
     */
    playMorseSequence(morseString, onComplete) {
        if (!this.isSoundEnabled || !this.initializeAudioContext() || !morseString) {
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
                gapDuration = this.interCharGapSec - this.intraCharGapSec;
                currentDuration = 0;
            } else if (element === '|') {
                gapDuration = this.wordGapSec - this.intraCharGapSec;
                 currentDuration = 0;
             }
             // Ignore ' ' (space) delimiters

             scheduledTime += currentDuration + gapDuration;
        });

        const totalDurationMs = (scheduledTime - this.audioContext.currentTime) * 1000;

        this.playbackCompletionTimeoutId = setTimeout(() => {
            this.isCurrentlyPlayingBack = false;
            this.playbackNodes = [];
            this.playbackCompletionTimeoutId = null;
            console.log("Morse sequence playback finished naturally.");
            if (window.morseGameState && window.morseGameState.status === GameStatus.PLAYING_BACK) {
                 window.morseGameState.status = GameStatus.PLAYBACK_INPUT;
             }
            if (onComplete) onComplete();
        }, Math.max(0, totalDurationMs) + 150); // Add buffer
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

        if (this.playbackNodes.length > 0 && this.audioContext) {
            console.log(`Stopping playback. ${this.playbackNodes.length} nodes active.`);
            const now = this.audioContext.currentTime;
            [...this.playbackNodes].forEach(({ osc, gain }) => {
                try {
                    if (gain?.gain) {
                        gain.gain.cancelScheduledValues(now);
                        gain.gain.setValueAtTime(gain.gain.value, now);
                        gain.gain.linearRampToValueAtTime(0, now + this.rampTime);
                    }
                    if (osc) {
                        osc.onended = null;
                        osc.stop(now + this.rampTime + 0.01);
                         setTimeout(() => { try { osc.disconnect(); gain?.disconnect(); } catch(e){} }, this.rampTime * 1000 + 20);
                    }
                } catch (e) {
                    console.warn("Error stopping audio node during playback cancellation:", e);
                    try { osc?.disconnect(); gain?.disconnect(); } catch(e2){}
                }
            });
            this.playbackNodes = [];
        }

         if (this.isCurrentlyPlayingBack) {
             this.isCurrentlyPlayingBack = false;
             if (window.morseGameState && window.morseGameState.status === GameStatus.PLAYING_BACK) {
                  window.morseGameState.status = GameStatus.PLAYBACK_INPUT;
              }
             console.log("Playback stopped manually.");
         }
    }

    // --- Feedback Sounds ---

    /** Stops any currently playing feedback sounds immediately. */
    stopFeedbackSounds() {
         if (this.feedbackNodes.length > 0 && this.audioContext) {
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
                          setTimeout(() => { try { osc.disconnect(); gain?.disconnect(); } catch(e){} }, this.rampTime * 1000 + 20);
                     }
                 } catch (e) {
                     console.warn("Error stopping feedback audio node:", e);
                     try { osc?.disconnect(); gain?.disconnect(); } catch(e2){}
                 }
             });
             this.feedbackNodes = [];
         }
     }

    /** Plays a short, higher-pitched sound for correct feedback. (DEACTIVATED) */
    playCorrectSound() {
        return; // Do nothing
    }

    /** Plays a slightly longer, lower-pitched sound for incorrect feedback. */
    playIncorrectSound() {
        if (this.inputToneNode || this.isCurrentlyPlayingBack) {
            // console.warn("Cannot play incorrect sound while another sound is active.");
            return; // Silently ignore if other sounds playing
        }
        this._playFeedbackSound(this.toneFrequency * 0.7, 0.1);
    }

    /**
     * Internal helper to play simple feedback sounds. Ensures only one feedback sound plays at a time.
     * @param {number} frequency - The frequency of the feedback tone. Must be > 0.
     * @param {number} durationSeconds - The duration of the feedback tone.
     * @private
     */
    _playFeedbackSound(frequency, durationSeconds) {
        if (!this.isSoundEnabled || !this.initializeAudioContext() || !this.masterGainNode || frequency <= 0) {
            return;
        }
        this.stopFeedbackSounds(); // Stop existing feedback first

        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(frequency, now);

            const feedbackGainLevel = 0.5;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(feedbackGainLevel, now + this.rampTime);
            gain.gain.setValueAtTime(feedbackGainLevel, now + durationSeconds - this.rampTime);
            gain.gain.linearRampToValueAtTime(0, now + durationSeconds);

            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.start(now);
            osc.stop(now + durationSeconds + this.rampTime + 0.01);

            const nodeRef = { osc, gain };
            this.feedbackNodes.push(nodeRef);

            osc.onended = () => {
                this.feedbackNodes = this.feedbackNodes.filter(n => n !== nodeRef);
                try { osc.disconnect(); gain.disconnect(); } catch(e){}
            };
        } catch (error) {
            console.error("Error playing feedback sound:", error);
        }
    }
}

// Create global instance
window.morseAudioPlayer = new AudioPlayer();
/**
 * js/audioPlayer.js
 * -----------------
 * Handles audio feedback and Morse sequence playback using the Web Audio API.
 * Allows adjustment of WPM and tone frequency. Includes fixes for feedback sounds.
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
        this.toneFrequency = MorseConfig.AUDIO_DEFAULT_TONE_FREQUENCY; // Use default from config
        this.rampTime = MorseConfig.AUDIO_RAMP_TIME;

        // Timing (derived from WPM)
        this.ditDurationSec = 0;
        this.dahDurationSec = 0;
        this.intraCharGapSec = 0;
        this.interCharGapSec = 0;
        this.wordGapSec = 0;

        // Playback state
        this.playbackNodes = []; // Stores { osc, gain } for sequence playback
        this.feedbackNodes = []; // Stores { osc, gain } for feedback sounds
        this.playbackCompletionTimeoutId = null;
        this.isCurrentlyPlayingBack = false;

        this._calculateTimings(); // Initial calculation based on default WPM
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
        this.intraCharGapSec = (ditMs * MorseConfig.INTRA_CHARACTER_GAP_UNITS) / 1000;
        this.interCharGapSec = (ditMs * MorseConfig.INTER_CHARACTER_GAP_UNITS) / 1000;
        this.wordGapSec = (ditMs * MorseConfig.WORD_GAP_UNITS) / 1000;
        // console.log(`Audio Timings Updated (WPM: ${this.wpm})`); // Debug
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
                // Log state changes for debugging
                this.audioContext.onstatechange = () => console.log("AudioContext state:", this.audioContext.state);
            } catch (e) {
                console.error("Web Audio API initialization failed.", e);
                this.isSoundEnabled = false; // Disable sound if context fails
                return false;
            }
        }
        // Attempt to resume if suspended (common in browsers after page load)
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
            // Optional: Warn if changing WPM during active playback
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
            // Note: This doesn't change currently playing tones, only future ones.
        }
    }


    /**
     * Enables or disables sound output globally.
     * @param {boolean} enabled - True to enable sound, false to disable.
     */
    setSoundEnabled(enabled) {
        this.isSoundEnabled = enabled;
        if (this.masterGainNode && this.audioContext) {
             // Smoothly ramp gain to 0 or 1
             this.masterGainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
             this.masterGainNode.gain.linearRampToValueAtTime(this.isSoundEnabled ? 1 : 0, this.audioContext.currentTime + this.rampTime * 2);
        }
        // Stop any ongoing playback and feedback if sound is disabled
        if (!enabled) {
            this.stopPlayback();
            this.stopFeedbackSounds(); // Also stop feedback sounds
        }
    }

    /**
     * Plays a single Morse tone (dit or dah) immediately.
     * Used for direct input feedback in the game/sandbox.
     * @param {'dit' | 'dah'} type - The type of tone to play.
     */
    playTone(type) {
        if (!this.isSoundEnabled || !this.initializeAudioContext()) return;
        const duration = type === 'dah' ? this.dahDurationSec : this.ditDurationSec;
        const startTime = this.audioContext.currentTime;
        this._scheduleTone(startTime, duration, this.toneFrequency, false); // false = not part of sequence playback
    }

    /**
     * Internal helper to schedule a single oscillator tone.
     * @param {number} startTime - The audioContext time when the tone should start.
     * @param {number} duration - The duration of the tone in seconds.
     * @param {number} frequency - The frequency of the tone in Hz.
     * @param {boolean} isSequencePlayback - If true, tracks the node for sequence cancellation.
     * @private
     */
    _scheduleTone(startTime, duration, frequency, isSequencePlayback) {
        if (!this.audioContext || !this.masterGainNode) return;
        try {
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.type = 'sine'; // Standard Morse tone type
            osc.frequency.setValueAtTime(frequency, startTime);

            // Apply gain envelope (ramps for smooth start/stop)
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(1, startTime + this.rampTime); // Ramp up
            gain.gain.setValueAtTime(1, startTime + duration - this.rampTime); // Hold volume
            gain.gain.linearRampToValueAtTime(0, startTime + duration); // Ramp down

            osc.start(startTime);
            // Stop slightly after gain ramp finishes to ensure silence
            osc.stop(startTime + duration + this.rampTime);

             if (isSequencePlayback) {
                // Track nodes used in sequence playback for potential cancellation
                this.playbackNodes.push({ osc, gain });
                osc.onended = () => {
                    // Auto-remove from tracking and disconnect when done
                    this.playbackNodes = this.playbackNodes.filter(n => n.osc !== osc);
                    try { osc.disconnect(); gain.disconnect(); } catch(e){}
                };
             } else {
                 // For immediate tones (game input), clean up immediately after playing
                osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
             }
        } catch (error) {
            console.error("AudioPlayer: Error scheduling tone:", error);
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
        this.isCurrentlyPlayingBack = true;
        console.log("Starting Morse sequence playback...");
        // Update game state if applicable (e.g., prevent input during playback)
        if (window.morseGameState) window.morseGameState.status = GameStatus.PLAYING_BACK;

        let scheduledTime = this.audioContext.currentTime; // Start scheduling from now
        const elements = morseString.split(/(\s+|\/|\|)/); // Split by elements and separators

        elements.forEach(element => {
            if (!element) return; // Skip empty strings from split
            element = element.trim();
            let currentDuration = 0; // Duration of the sound element itself
            let gapDuration = this.intraCharGapSec; // Default gap follows the element

            if (element === '.') {
                currentDuration = this.ditDurationSec;
                this._scheduleTone(scheduledTime, currentDuration, this.toneFrequency, true); // True = part of sequence
            } else if (element === '-') {
                currentDuration = this.dahDurationSec;
                this._scheduleTone(scheduledTime, currentDuration, this.toneFrequency, true);
            } else if (element === '/') { // Inter-character gap marker
                currentDuration = 0; // No sound for the marker itself
                gapDuration = this.interCharGapSec; // Use the longer gap *after* this point
            } else if (element === '|') { // Word gap marker
                currentDuration = 0;
                gapDuration = this.wordGapSec; // Use the word gap *after* this point
            } else if (element === ' ') { // Space between dits/dahs within a character
                 currentDuration = 0; // No sound
                 gapDuration = this.intraCharGapSec; // Default intra-character gap
            } else {
                 // Skip unknown elements (shouldn't happen with valid Morse string)
                 return;
            }

            // Advance the schedule time by the duration of the sound (if any)
            // plus the duration of the gap that *follows* it.
            scheduledTime += currentDuration + gapDuration;
        });

        // Schedule the completion callback slightly after the last sound/gap is expected to finish
        const totalDurationMs = (scheduledTime - this.audioContext.currentTime) * 1000;
        this.playbackCompletionTimeoutId = setTimeout(() => {
            this.isCurrentlyPlayingBack = false;
            this.playbackNodes = []; // Clear tracked nodes
            this.playbackCompletionTimeoutId = null;
            console.log("Morse sequence playback finished naturally.");
            // Update game state if it was in playback mode
            if (window.morseGameState && window.morseGameState.status === GameStatus.PLAYING_BACK) {
                 window.morseGameState.status = GameStatus.PLAYBACK_INPUT; // Return to input state
             }
            if (onComplete) onComplete(); // Execute the provided callback
        }, totalDurationMs + 100); // Add a small buffer (100ms)
    }

    /**
     * Stops any currently playing Morse sequence playback immediately.
     * Cleans up audio nodes and cancels the completion callback.
     */
    stopPlayback() {
        // Cancel the scheduled completion callback
        if (this.playbackCompletionTimeoutId) {
            clearTimeout(this.playbackCompletionTimeoutId);
            this.playbackCompletionTimeoutId = null;
        }

        // Stop and disconnect all tracked audio nodes for the sequence
        if (this.playbackNodes.length > 0 && this.audioContext) {
            console.log(`Stopping playback. ${this.playbackNodes.length} nodes active.`);
            const now = this.audioContext.currentTime;
            this.playbackNodes.forEach(({ osc, gain }) => {
                try {
                    // Ramp down gain quickly and stop oscillator
                    if (gain?.gain) {
                        gain.gain.cancelScheduledValues(now);
                        // Use setValueAtTime for immediate silence, then ramp (prevents lingering tone if stopped mid-ramp)
                        gain.gain.setValueAtTime(gain.gain.value, now);
                        gain.gain.linearRampToValueAtTime(0, now + this.rampTime);
                    }
                    if (osc) {
                        osc.stop(now + this.rampTime + 0.01); // Stop slightly after gain hits zero
                        // Ensure cleanup happens even if stopped early
                        osc.onended = () => { try { osc.disconnect(); gain?.disconnect(); } catch(e){} };
                    }
                } catch (e) {
                    console.warn("Error stopping audio node during playback cancellation:", e);
                    // Attempt cleanup anyway
                    try { osc?.disconnect(); gain?.disconnect(); } catch(e2){}
                }
            });
            this.playbackNodes = []; // Clear the array
        }

        // Update internal and potentially global state
         if (this.isCurrentlyPlayingBack) {
             this.isCurrentlyPlayingBack = false;
             if (window.morseGameState && window.morseGameState.status === GameStatus.PLAYING_BACK) {
                  window.morseGameState.status = GameStatus.PLAYBACK_INPUT; // Go back to input state
              }
             console.log("Playback stopped manually.");
         }
    }

    // --- Feedback Sounds ---

    /** Stops any currently playing feedback sounds immediately. */
    stopFeedbackSounds() {
         if (this.feedbackNodes.length > 0 && this.audioContext) {
             console.log(`Stopping ${this.feedbackNodes.length} active feedback sounds.`);
             const now = this.audioContext.currentTime;
             this.feedbackNodes.forEach(({ osc, gain }) => {
                 try {
                     if (gain?.gain) {
                        gain.gain.cancelScheduledValues(now);
                        gain.gain.setValueAtTime(gain.gain.value, now); // Set current value
                        gain.gain.linearRampToValueAtTime(0, now + this.rampTime); // Ramp down quickly
                     }
                     if (osc) {
                         osc.stop(now + this.rampTime + 0.01);
                         osc.onended = () => { try { osc.disconnect(); gain?.disconnect(); } catch(e){} };
                     }
                 } catch (e) {
                     console.warn("Error stopping feedback audio node:", e);
                     try { osc?.disconnect(); gain?.disconnect(); } catch(e2){}
                 }
             });
             this.feedbackNodes = []; // Clear the array
         }
     }

    /** Plays a short, higher-pitched sound for correct feedback. */
    playCorrectSound() {
        // Corrected: Use a frequency slightly higher than the base tone, not 0 Hz.
        this._playFeedbackSound(this.toneFrequency * 1.5, 0.05); // Example: 1.5x base freq, 50ms duration
    }

    /** Plays a slightly longer, lower-pitched sound for incorrect feedback. */
    playIncorrectSound() {
        this._playFeedbackSound(this.toneFrequency * 0.7, 0.1); // Example: 0.7x base freq, 100ms duration
    }

    /**
     * Internal helper to play simple feedback sounds.
     * @param {number} frequency - The frequency of the feedback tone. Must be > 0.
     * @param {number} durationSeconds - The duration of the feedback tone.
     * @private
     */
    _playFeedbackSound(frequency, durationSeconds) {
        if (!this.isSoundEnabled || !this.initializeAudioContext() || !this.masterGainNode || frequency <= 0) {
            if (frequency <= 0) console.warn("Attempted to play feedback sound with frequency <= 0 Hz.");
            return;
        }

        this.stopFeedbackSounds(); // Stop any previous feedback sounds first

        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'triangle'; // Use a slightly different waveform for feedback
            osc.frequency.setValueAtTime(frequency, now);

            // Simple gain envelope for feedback
            const feedbackGainLevel = 0.5; // Quieter than Morse tone
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(feedbackGainLevel, now + this.rampTime);
            gain.gain.setValueAtTime(feedbackGainLevel, now + durationSeconds - this.rampTime);
            gain.gain.linearRampToValueAtTime(0, now + durationSeconds);

            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.start(now);
            osc.stop(now + durationSeconds + this.rampTime + 0.01); // Stop after ramp down

            // Track this feedback sound node
            const nodeRef = { osc, gain };
            this.feedbackNodes.push(nodeRef);

            // Auto-cleanup and removal from tracking
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
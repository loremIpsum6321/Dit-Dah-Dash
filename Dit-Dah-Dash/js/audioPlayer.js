/**
 * js/audioPlayer.js
 * -----------------
 * Handles audio feedback and Morse sequence playback using the Web Audio API.
 * Allows adjustment of WPM and tone frequency.
 */

class AudioPlayer {
    /**
     * Manages audio playback for Morse code tones and feedback sounds.
     *
     * @constructor
     * @property {AudioContext | null} audioContext - The Web Audio API context.
     * @property {GainNode | null} masterGainNode - The main gain node for volume control.
     * @property {boolean} isSoundEnabled - Flag indicating if sound is globally enabled.
     * @property {number} wpm - Current Words Per Minute setting.
     * @property {number} toneFrequency - Base frequency for Morse tones (Hz).
     * @property {number} rampTime - Fade in/out time for tones (seconds).
     * @property {number} ditDurationSec - Calculated duration of a dit in seconds.
     * @property {number} dahDurationSec - Calculated duration of a dah in seconds.
     * @property {number} intraCharGapSec - Calculated duration of gap between elements within a character.
     * @property {number} interCharGapSec - Calculated duration of gap between characters.
     * @property {number} wordGapSec - Calculated duration of gap between words.
     * @property {Array<object>} playbackNodes - Stores { osc, gain } for active sequence playback nodes.
     * @property {number | null} playbackCompletionTimeoutId - Timeout ID for sequence completion callback.
     * @property {boolean} isCurrentlyPlayingBack - Flag indicating if a sequence is actively playing.
     */
    constructor() {
        /** Initializes audio properties and calculates initial timings. */
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
        this.playbackCompletionTimeoutId = null;
        this.isCurrentlyPlayingBack = False;

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
        // Stop any ongoing playback if sound is disabled
        if (!enabled) {
            this.stopPlayback();
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
        // Split by elements and capture separators (Improved regex)
        const elements = morseString.split(/(\.|\-|\/|\|| )/);

        elements.forEach(element => {
            if (!element || element === ' ') return; // Skip empty strings and simple spaces (handled by gaps)
            element = element.trim(); // Should already be trimmed by split, but good practice

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
                // Calculate gap duration *relative* to the default intra-char gap already assumed
                gapDuration = this.interCharGapSec - this.intraCharGapSec;
            } else if (element === '|') { // Word gap marker
                currentDuration = 0;
                 // Calculate gap duration *relative* to the default intra-char gap already assumed
                gapDuration = this.wordGapSec - this.intraCharGapSec;
            } else {
                 // Skip unknown elements
                 return;
            }

            // Advance the schedule time by the duration of the sound (if any)
            // plus the duration of the gap that *follows* it.
            // Ensure gapDuration is not negative if timing constants are unusual
            scheduledTime += currentDuration + Math.max(0, gapDuration);
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
                        gain.gain.linearRampToValueAtTime(0, now + this.rampTime * 2);
                    }
                    if (osc) {
                        osc.stop(now + this.rampTime * 2 + 0.01); // Stop slightly after gain hits zero
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

    // --- Optional Feedback Sounds ---

    /** Plays a sound for correct feedback (currently silent). */
    playCorrectSound() {
        this._playFeedbackSound(this.toneFrequency * 0, 0); // Frequency 0 = silent
    }

    /** Plays a sound for incorrect feedback (now silent). */
    playIncorrectSound() {
        // Changed frequency multiplier from 0.5 to 0 to silence it
        this._playFeedbackSound(this.toneFrequency * 0, 0.2); // Frequency 0 = silent
    }

    /**
     * Internal helper to play simple feedback sounds.
     * @param {number} frequency - The frequency of the feedback tone.
     * @param {number} durationSeconds - The duration of the feedback tone.
     * @private
     */
    _playFeedbackSound(frequency, durationSeconds) {
        // If frequency is 0 or duration is 0, don't bother creating nodes
        if (frequency <= 0 || durationSeconds <=0) return;

        if (!this.isSoundEnabled || !this.initializeAudioContext() || !this.masterGainNode) return;
        try {
            const now = this.audioContext.currentTime;
            const osc = this.audioContext.createOscillator();
            const gain = this.audioContext.createGain();
            osc.type = 'triangle'; // Use a slightly different waveform for feedback
            osc.frequency.setValueAtTime(frequency, now);

            // Simple gain envelope for feedback
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.5, now + this.rampTime); // Quieter than Morse tone
            gain.gain.setValueAtTime(0.5, now + durationSeconds - this.rampTime);
            gain.gain.linearRampToValueAtTime(0, now + durationSeconds);

            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.start(now);
            osc.stop(now + durationSeconds + 0.01);
            // Auto-cleanup
            osc.onended = () => { try { osc.disconnect(); gain.disconnect(); } catch(e){} };
        } catch (error) {
            console.error("Error playing feedback sound:", error);
        }
    }
}

// Create global instance
window.morseAudioPlayer = new AudioPlayer();
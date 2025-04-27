/**
 * js/morseDecoder.js
 * ------------------
 * Handles decoding Morse sequences to characters and encoding sentences
 * into playable Morse sequences with timing markers. Uses mappings from config.js.
 */

class MorseDecoder {
    constructor() {
        this.morseMap = MorseConfig.MORSE_MAP;
        this.reverseMorseMap = Object.fromEntries(
            Object.entries(this.morseMap).map(([key, value]) => [value, key])
        );
        this.currentWpm = MorseConfig.DEFAULT_WPM;
        this.ditDuration = 0; // Calculated in updateWpm
        this.interCharGapThreshold = 0; // Calculated in updateWpm

        this.decodeTimeoutId = null;
        this.updateWpm(this.currentWpm); // Initial calculation
    }

    /**
     * Updates the WPM and recalculates timing thresholds.
     * @param {number} wpm - The new Words Per Minute setting.
     */
    updateWpm(wpm) {
        if (wpm <= 0) return;
        this.currentWpm = wpm;
        this.ditDuration = 1200 / wpm; // ms per dit
        // Inter-character gap for input detection timeout
        this.interCharGapThreshold = this.ditDuration * MorseConfig.INTER_CHARACTER_GAP_UNITS * MorseConfig.CHARACTER_INPUT_TIMEOUT_MULTIPLIER;
        console.log(`Decoder timings updated for ${wpm} WPM: Dit=${this.ditDuration.toFixed(0)}ms, Decode Timeout >= ${this.interCharGapThreshold.toFixed(0)}ms`);
    }

    /**
     * Decodes a given Morse code sequence.
     * @param {string} sequence - The sequence of '.' and '-' (e.g., '.-').
     * @returns {string | null} The decoded character (uppercase) or null if invalid.
     */
    decodeSequence(sequence) {
        if (!sequence) return null;
        const decodedChar = this.morseMap[sequence];
        return decodedChar !== undefined ? decodedChar : null;
    }

    /**
     * Starts a timer to trigger the decoding process after a pause (GAME mode).
     * @param {function} decodeCallback - The function to call when the timer expires.
     */
    scheduleDecode(decodeCallback) {
        this.cancelScheduledDecode();
        this.decodeTimeoutId = setTimeout(() => {
             // console.log("Inter-character gap detected. Triggering decode."); // Debug
             if (window.morseGameState && window.morseGameState.currentMode === AppMode.GAME) {
                 const previousState = window.morseGameState.status;
                 if(window.morseGameState.isPlaying()) {
                     window.morseGameState.status = GameStatus.DECODING;
                 }
                 decodeCallback();
                 this.decodeTimeoutId = null;
                 if (window.morseGameState.status === GameStatus.DECODING && previousState !== GameStatus.FINISHED) {
                     window.morseGameState.status = GameStatus.LISTENING;
                 }
             } else {
                decodeCallback(); // Execute anyway? Or guard further?
                this.decodeTimeoutId = null;
             }
        }, this.interCharGapThreshold);

         if (window.morseGameState) {
             window.morseGameState.setCharacterTimeout(this.decodeTimeoutId);
         }
    }

    /** Cancels any pending scheduled decode timer. */
    cancelScheduledDecode() {
        if (this.decodeTimeoutId) {
            clearTimeout(this.decodeTimeoutId);
            this.decodeTimeoutId = null;
             if (window.morseGameState) {
                 window.morseGameState.setCharacterTimeout(null);
             }
        }
    }

    /**
     * Gets the Morse code sequence for a single character.
     * Returns null for unmappable characters, "" for space (handled by encodeSentence).
     * @param {string} character - The character to encode (case-insensitive).
     * @returns {string | null} The Morse sequence (e.g., ".-") or null.
     */
     encodeCharacter(character) {
        if (character === ' ') return ""; // Space is handled as a gap in encodeSentence
        const upperChar = character.toUpperCase();
        const sequence = this.reverseMorseMap[upperChar];
        return sequence !== undefined ? sequence : null; // Return null if character not in map
    }

    /**
     * Encodes a full sentence into a Morse sequence string with timing markers.
     * '.'/' ' = Dit/Dah elements
     * ' ' = Gap between elements (intra-character)
     * '/' = Gap between characters (inter-character)
     * '|' = Gap between words (word gap) - Using '|' instead of '//' for simplicity
     * Unknown characters are skipped.
     * @param {string} sentence - The sentence to encode.
     * @returns {string} The encoded Morse string with timing markers, or empty string if input is empty/invalid.
     */
    encodeSentence(sentence) {
        if (!sentence || typeof sentence !== 'string') return "";

        let morseString = "";
        const words = sentence.trim().toUpperCase().split(/\s+/); // Split into words

        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            for (let j = 0; j < word.length; j++) {
                const char = word[j];
                const sequence = this.encodeCharacter(char); // Gets sequence like ".-." or null

                if (sequence !== null) { // Only process known characters
                     morseString += sequence.split('').join(' '); // Add space between elements (e.g., ".-." -> ". - .")
                     if (j < word.length - 1) {
                         morseString += " / "; // Add inter-character gap marker
                     }
                } else {
                     console.warn(`Skipping unknown character during encoding: ${char}`);
                 }
            }
            // Add word gap marker if not the last word
            if (i < words.length - 1) {
                morseString += " | "; // Add word gap marker
            }
        }
        // Trim any trailing separators that might occur
        morseString = morseString.replace(/(\s*[\/\|]\s*)+$/, '').trim();

        console.log(`Encoded "${sentence}" to: "${morseString}"`); // Debug
        return morseString;
    }

}

// Create a single instance for the game
window.morseDecoder = new MorseDecoder();
// Initialize WPM after UIManager instance exists (if possible)
document.addEventListener('DOMContentLoaded', () => {
    if (window.morseUIManager) {
        window.morseDecoder.updateWpm(window.morseUIManager.getInitialWpm());
    }
});
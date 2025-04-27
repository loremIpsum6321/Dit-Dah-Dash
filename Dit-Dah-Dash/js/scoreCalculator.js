/**
 * js/scoreCalculator.js
 * ---------------------
 * Calculates scoring metrics like WPM and Accuracy based on game state data.
 */

class ScoreCalculator {
    constructor() {
        // Constants can be defined here or pulled from config
        this.parisWordLength = MorseConfig.PARIS_STANDARD_WORD_LENGTH;
        this.penalty = MorseConfig.INCORRECT_ATTEMPT_PENALTY;
    }

    /**
     * Calculates all relevant scores based on the finished game state.
     * @param {GameState} gameState - The completed game state object.
     * @returns {object} An object containing calculated scores:
     * { netWpm, grossWpm, accuracy, elapsedTimeSeconds, totalChars }
     */
    calculateScores(gameState) {
        if (gameState.status !== GameStatus.FINISHED) {
            console.warn("Attempted to calculate scores before game finished.");
            return { netWpm: 0, grossWpm: 0, accuracy: 0, elapsedTimeSeconds: 0, totalChars: 0 };
        }

        const elapsedTimeSeconds = gameState.elapsedTime / 1000;
        const totalNonSpaceChars = gameState.totalCharsInSentence; // Use pre-calculated non-space chars

        if (elapsedTimeSeconds <= 0 || totalNonSpaceChars === 0) {
            return { netWpm: 0, grossWpm: 0, accuracy: 100, elapsedTimeSeconds: 0, totalChars: totalNonSpaceChars };
        }

        // --- Gross WPM ---
        // (Number of characters / Standard word length) / (Time in minutes)
        const grossWpm = (totalNonSpaceChars / this.parisWordLength) / (elapsedTimeSeconds / 60);

        // --- Accuracy ---
        // (Correct Characters / (Correct Characters + Incorrect Attempts * Penalty)) * 100
        // Using totalCharsInSentence as the baseline for correct characters if completed successfully.
        // A higher penalty makes each error count more towards reducing accuracy.
        const effectiveAttempts = totalNonSpaceChars + (gameState.incorrectAttempts * this.penalty);
        let accuracy = 100; // Default to 100 if no incorrect attempts
        if (effectiveAttempts > 0 && totalNonSpaceChars > 0) {
             // Ensure accuracy doesn't exceed 100 or go below 0 due to penalties
             accuracy = Math.max(0, Math.min(100, (totalNonSpaceChars / effectiveAttempts) * 100));
        }
        // Alternative simpler accuracy:
        // const simplerAccuracy = (totalNonSpaceChars / (totalNonSpaceChars + gameState.incorrectAttempts)) * 100;


        // --- Net WPM ---
        // Gross WPM adjusted by accuracy
        const netWpm = grossWpm * (accuracy / 100);

        // console.log(`Score Calculation: Time=${elapsedTimeSeconds.toFixed(2)}s, Chars=${totalNonSpaceChars}, Incorrect=${gameState.incorrectAttempts}`);
        // console.log(`Scores: Gross WPM=${grossWpm.toFixed(1)}, Accuracy=${accuracy.toFixed(1)}%, Net WPM=${netWpm.toFixed(1)}`);

        return {
            netWpm: Math.max(0, parseFloat(netWpm.toFixed(1))), // Ensure non-negative and format
            grossWpm: Math.max(0, parseFloat(grossWpm.toFixed(1))),
            accuracy: parseFloat(accuracy.toFixed(1)),
            elapsedTimeSeconds: parseFloat(elapsedTimeSeconds.toFixed(1)),
            totalChars: totalNonSpaceChars,
            incorrectAttempts: gameState.incorrectAttempts
        };
    }
}

// Create a single instance for the game
window.morseScoreCalculator = new ScoreCalculator();
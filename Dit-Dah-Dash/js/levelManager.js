/**
 * js/levelManager.js
 * ------------------
 * Manages game levels, sentences, high scores, and unlocking progression.
 * Uses localStorage for persistence.
 */

class LevelManager {
    constructor() {
        this.levels = MorseConfig.LEVELS_DATA;
        this.highScores = this._loadHighScores();      // { levelId: { score, accuracy, time }, ... }
        this.unlockedLevels = this._loadUnlockedLevels(); // Set of unlocked level IDs

        // Ensure level 1 is always unlocked
        this.unlockedLevels.add(this.levels[0].id);
        this._saveUnlockedLevels(); // Save immediately if it wasn't present
    }

    /**
     * Loads high scores from localStorage.
     * @returns {object} The high scores object.
     */
    _loadHighScores() {
        try {
            const storedScores = localStorage.getItem(MorseConfig.STORAGE_KEY_HIGH_SCORES);
            return storedScores ? JSON.parse(storedScores) : {};
        } catch (e) {
            console.error("Error loading high scores from localStorage:", e);
            return {};
        }
    }

    /**
     * Saves high scores to localStorage.
     */
    _saveHighScores() {
        try {
            localStorage.setItem(MorseConfig.STORAGE_KEY_HIGH_SCORES, JSON.stringify(this.highScores));
        } catch (e) {
            console.error("Error saving high scores to localStorage:", e);
        }
    }

    /**
     * Loads the set of unlocked level IDs from localStorage.
     * @returns {Set<number>} A Set containing the IDs of unlocked levels.
     */
    _loadUnlockedLevels() {
        try {
            const storedLevels = localStorage.getItem(MorseConfig.STORAGE_KEY_UNLOCKED_LEVELS);
            if (storedLevels) {
                return new Set(JSON.parse(storedLevels));
            } else {
                // Default: Only level 1 is unlocked
                return new Set([this.levels[0].id]);
            }
        } catch (e) {
            console.error("Error loading unlocked levels from localStorage:", e);
            // Default on error
            return new Set([this.levels[0].id]);
        }
    }

    /**
     * Saves the set of unlocked level IDs to localStorage.
     */
    _saveUnlockedLevels() {
        try {
            localStorage.setItem(MorseConfig.STORAGE_KEY_UNLOCKED_LEVELS, JSON.stringify([...this.unlockedLevels]));
        } catch (e) {
            console.error("Error saving unlocked levels to localStorage:", e);
        }
    }

    /**
     * Gets the data for a specific level.
     * @param {number} levelId - The ID of the level.
     * @returns {object | undefined} The level data object or undefined if not found.
     */
    getLevelData(levelId) {
        return this.levels.find(level => level.id === levelId);
    }

    /**
     * Gets the next sentence for the current level or moves to the next level.
     * @param {GameState} gameState - The current game state.
     * @returns {{levelId: number, sentenceIndex: number, sentenceText: string} | null} Info for the next sentence or null if no more levels/sentences.
     */
    getNextSentence(gameState) {
        const currentLevelData = this.getLevelData(gameState.currentLevelId);
        if (!currentLevelData) return null; // Should not happen

        const nextSentenceIndex = gameState.currentSentenceIndex + 1;

        if (nextSentenceIndex < currentLevelData.sentences.length) {
            // Still sentences left in the current level
            return {
                levelId: gameState.currentLevelId,
                sentenceIndex: nextSentenceIndex,
                sentenceText: currentLevelData.sentences[nextSentenceIndex]
            };
        } else {
            // End of current level's sentences, try to find the next unlocked level
            const nextLevel = this.findNextLevel(gameState.currentLevelId);
            if (nextLevel && this.isLevelUnlocked(nextLevel.id)) {
                 return {
                    levelId: nextLevel.id,
                    sentenceIndex: 0, // Start from the first sentence of the next level
                    sentenceText: nextLevel.sentences[0]
                };
            } else {
                 return null; // No more unlocked levels or sentences
            }
        }
    }

     /**
     * Finds the level data for the level immediately following the given ID.
     * @param {number} currentLevelId - The ID of the current level.
     * @returns {object | undefined} The data for the next level, or undefined if it's the last level.
     */
    findNextLevel(currentLevelId) {
        const currentIndex = this.levels.findIndex(level => level.id === currentLevelId);
        if (currentIndex !== -1 && currentIndex < this.levels.length - 1) {
            return this.levels[currentIndex + 1];
        }
        return undefined; // No next level found
    }


    /**
     * Gets the sentence for a specific level and sentence index.
     * @param {number} levelId - The ID of the level.
     * @param {number} sentenceIndex - The index of the sentence within the level.
     * @returns {string | null} The sentence text or null if invalid indices.
     */
    getSpecificSentence(levelId, sentenceIndex) {
        const levelData = this.getLevelData(levelId);
        if (levelData && sentenceIndex >= 0 && sentenceIndex < levelData.sentences.length) {
            return levelData.sentences[sentenceIndex];
        }
        return null;
    }

    /**
     * Records the score for a completed level/sentence if it's a high score.
     * Also checks if the next level should be unlocked.
     * @param {number} levelId - The ID of the completed level.
     * @param {object} scores - The calculated scores object { netWpm, accuracy, elapsedTimeSeconds }.
     * @returns {{isNewHighScore: boolean, unlockedNextLevelId: number | null}} Information about the result.
     */
    recordScoreAndCheckUnlocks(levelId, scores) {
        let isNewHighScore = false;
        let unlockedNextLevelId = null;

        const currentHighScore = this.highScores[levelId];

        // Check for new high score (prioritize higher Net WPM, then better accuracy, then faster time)
        if (!currentHighScore ||
            scores.netWpm > currentHighScore.score ||
            (scores.netWpm === currentHighScore.score && scores.accuracy > currentHighScore.accuracy) ||
            (scores.netWpm === currentHighScore.score && scores.accuracy === currentHighScore.accuracy && scores.elapsedTimeSeconds < currentHighScore.time))
        {
            this.highScores[levelId] = {
                score: scores.netWpm,
                accuracy: scores.accuracy,
                time: scores.elapsedTimeSeconds
            };
            this._saveHighScores();
            isNewHighScore = true;
            console.log(`New high score recorded for Level ${levelId}: WPM=${scores.netWpm}, Acc=${scores.accuracy}%`);
        }

        // Check if the performance meets the criteria to unlock the next level
        const nextLevel = this.findNextLevel(levelId);
        if (nextLevel && !this.isLevelUnlocked(nextLevel.id)) {
            const criteria = nextLevel.unlock_criteria;
            if (scores.netWpm >= criteria.min_wpm && scores.accuracy >= criteria.min_accuracy) {
                this.unlockedLevels.add(nextLevel.id);
                this._saveUnlockedLevels();
                unlockedNextLevelId = nextLevel.id;
                console.log(`Level ${nextLevel.id} unlocked!`);
            }
        }

        return { isNewHighScore, unlockedNextLevelId };
    }

    /**
     * Checks if a specific level is unlocked.
     * @param {number} levelId - The ID of the level to check.
     * @returns {boolean} True if the level is unlocked, false otherwise.
     */
    isLevelUnlocked(levelId) {
        return this.unlockedLevels.has(levelId);
    }

    /**
     * Gets the high score for a specific level.
     * @param {number} levelId - The ID of the level.
     * @returns {object | null} The high score object { score, accuracy, time } or null if none exists.
     */
    getHighScore(levelId) {
        return this.highScores[levelId] || null;
    }

    /**
     * Gets all levels data along with their unlock status and high scores.
     * Useful for building the level selection screen.
     * @returns {Array<object>} Array of level objects with added status info.
     */
    getAllLevelsWithStatus() {
        return this.levels.map(level => ({
            ...level,
            isUnlocked: this.isLevelUnlocked(level.id),
            highScore: this.getHighScore(level.id)
        }));
    }

    /**
     * Resets all high scores and unlocked levels (except level 1).
     */
    resetProgress() {
        this.highScores = {};
        this.unlockedLevels = new Set([this.levels[0].id]); // Reset to only level 1 unlocked
        this._saveHighScores();
        this._saveUnlockedLevels();
        console.log("Game progress reset.");
    }
}

// Create a single instance for the game
window.morseLevelManager = new LevelManager();
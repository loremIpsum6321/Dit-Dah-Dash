/**
 * js/config.js
 * --------------
 * Global configuration settings for the Dit-Dah-Dash game.
 * Includes Morse code mappings, level data, timing defaults, audio defaults, storage keys, and UI settings.
 */

// --- Morse Code Mapping ---
const MORSE_MAP = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z',
    '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
    '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
    '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'", '-.-.--': '!',
    '-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&', '---...': ':',
    '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_',
    '.-..-.': '"', '...-..-': '$', '.--.-.': '@'
};

// --- Timing Configuration ---
const DEFAULT_WPM = 20;
const PARIS_STANDARD_WORD_LENGTH = 5;
const DIT_DURATION_UNITS = 1;
const DAH_DURATION_UNITS = 3;
const INTRA_CHARACTER_GAP_UNITS = 1;
const INTER_CHARACTER_GAP_UNITS = 3;
const WORD_GAP_UNITS = 7;
const INTRA_CHAR_GAP_MULTIPLIER = 0.8;
const CHARACTER_INPUT_TIMEOUT_MULTIPLIER = 1.5;

// --- Level Data ---
const LEVELS_DATA = [
    { id: 1, name: "Basics 1", sentences: ["E T", "I S H", "A N D", "E T A", "HI HI"], unlock_criteria: { min_wpm: 0, min_accuracy: 0 } },
    { id: 2, name: "Basics 2", sentences: ["M O R S E", "C O D E", "HELLO WORLD", "SOS SOS", "GOOD DAY"], unlock_criteria: { min_wpm: 8, min_accuracy: 85 } },
    { id: 3, name: "Common Words", sentences: ["THE QUICK BROWN FOX", "JUMPS OVER THE LAZY DOG", "THIS IS A TEST", "PRACTICE MAKES PERFECT", "MORSE CODE IS FUN"], unlock_criteria: { min_wpm: 12, min_accuracy: 90 } },
    { id: 4, name: "Numbers & Punctuation", sentences: ["CALL 123 456 NOW", "MEET AT 0800 HOURS", "PRICE IS $19.99?", "EMAIL ME AT TEST@EXAMPLE.COM", "FINISHED!"], unlock_criteria: { min_wpm: 15, min_accuracy: 92 } },
];

// --- Audio Configuration ---
const AUDIO_DEFAULT_TONE_FREQUENCY = 600; // Default frequency in Hz
const AUDIO_RAMP_TIME = 0.005; // Fade in/out time for tones (seconds)
const AUDIO_MIN_FREQUENCY = 400; // Minimum adjustable frequency
const AUDIO_MAX_FREQUENCY = 1000; // Maximum adjustable frequency

// --- Scoring ---
const INCORRECT_ATTEMPT_PENALTY = 0.1;

// --- Default Keybindings ---
// Note: Keybinding customization is not implemented in this version
const DEFAULT_DIT_KEY = '.';
const DEFAULT_DAH_KEY = '-';
const FALLBACK_DIT_KEY = 'e';
const FALLBACK_DAH_KEY = 't';


// --- Local Storage Keys ---
const STORAGE_KEY_PREFIX = 'ditDahDash_';
const STORAGE_KEY_HIGH_SCORES = `${STORAGE_KEY_PREFIX}highScores`;
const STORAGE_KEY_UNLOCKED_LEVELS = `${STORAGE_KEY_PREFIX}unlockedLevels`;
const STORAGE_KEY_SETTINGS_WPM = `${STORAGE_KEY_PREFIX}settingsWpm`;
const STORAGE_KEY_SETTINGS_SOUND = `${STORAGE_KEY_PREFIX}settingsSound`;
const STORAGE_KEY_SETTINGS_DARK_MODE = `${STORAGE_KEY_PREFIX}settingsDarkMode`;
const STORAGE_KEY_SETTINGS_FREQUENCY = `${STORAGE_KEY_PREFIX}settingsFrequency`;
const STORAGE_KEY_SETTINGS_DIT_KEY = `${STORAGE_KEY_PREFIX}settingsDitKey`; // Not currently used for customization
const STORAGE_KEY_SETTINGS_DAH_KEY = `${STORAGE_KEY_PREFIX}settingsDahKey`; // Not currently used for customization
const STORAGE_KEY_SETTINGS_HINT_VISIBLE = `${STORAGE_KEY_PREFIX}settingsHintVisible`; // Used for hint toggle

// --- UI ---
const INCORRECT_FLASH_DURATION = 300; // ms for incorrect feedback flash
const KEYBIND_DISPLAY_MAP = { // Not currently used
    ' ': 'Space', '.': '.', '-': '-', 'Enter': 'Enter', 'Shift': 'Shift',
    'Control': 'Ctrl', 'Alt': 'Alt', 'Meta': 'Cmd/Win',
    'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
};
const HINT_DEFAULT_VISIBLE = false; // Hint is hidden by default

// --- Make config globally accessible ---
// Grouping related constants for clarity
window.MorseConfig = {
    // Morse Mapping
    MORSE_MAP,

    // Timing
    DEFAULT_WPM, PARIS_STANDARD_WORD_LENGTH,
    INTRA_CHAR_GAP_MULTIPLIER, CHARACTER_INPUT_TIMEOUT_MULTIPLIER,
    DIT_DURATION_UNITS, DAH_DURATION_UNITS, INTRA_CHARACTER_GAP_UNITS,
    INTER_CHARACTER_GAP_UNITS, WORD_GAP_UNITS,

    // Levels
    LEVELS_DATA,

    // Audio
    AUDIO_DEFAULT_TONE_FREQUENCY, AUDIO_RAMP_TIME,
    AUDIO_MIN_FREQUENCY, AUDIO_MAX_FREQUENCY,

    // Scoring
    INCORRECT_ATTEMPT_PENALTY,

    // Keybindings (Defaults only)
    DEFAULT_DIT_KEY, DEFAULT_DAH_KEY,
    FALLBACK_DIT_KEY, FALLBACK_DAH_KEY,

    // Storage Keys
    STORAGE_KEY_HIGH_SCORES, STORAGE_KEY_UNLOCKED_LEVELS,
    STORAGE_KEY_SETTINGS_WPM, STORAGE_KEY_SETTINGS_SOUND,
    STORAGE_KEY_SETTINGS_DARK_MODE, STORAGE_KEY_SETTINGS_FREQUENCY,
    STORAGE_KEY_SETTINGS_DIT_KEY, STORAGE_KEY_SETTINGS_DAH_KEY,
    STORAGE_KEY_SETTINGS_HINT_VISIBLE,

    // UI Feedback & Defaults
    INCORRECT_FLASH_DURATION, KEYBIND_DISPLAY_MAP,
    HINT_DEFAULT_VISIBLE,
};
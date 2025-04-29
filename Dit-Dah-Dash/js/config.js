/* Dit-Dah-Dash/js/config.js */
/**
 * js/config.js
 * --------------
 * Global configuration settings for the Dit-Dah-Dash game.
 * Includes Morse code mappings, level data, timing defaults, audio defaults, storage keys, and UI settings.
 * Removed hardcoded default keybindings; these will be managed dynamically via settings.
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
const INTRA_CHAR_GAP_MULTIPLIER = 0.8; // Affects how long decoder waits
const CHARACTER_INPUT_TIMEOUT_MULTIPLIER = 0.8; // Affects how long decoder waits

// --- Level Data ---
const LEVELS_DATA = [
    // --- Phase 1: E, T ---
    {
        id: 1,
        name: "Intro: E T",
        sentences: ["E E E", "T T T", "E T E", "T E T", "ET TE ET TE"],
        unlock_criteria: { min_wpm: 0, min_accuracy: 0 } // Starting level
    },
    {
        id: 2,
        name: "Practice: E T",
        sentences: [
            "EAT THE TEA TEE EAT TEE",
            "TEE TEE EAT EAT TEA TEA",
            "ET TE ET TE ET TE ET",
            "TETE EAT EAT TEE TETE TEE",
            "E T E T E T E T"
        ],
        unlock_criteria: { min_wpm: 5, min_accuracy: 80 }
    },

    // --- Phase 2: Add I, M, S, O ---
    {
        id: 3,
        name: "Intro: I M S O",
        sentences: ["I I I", "M M M", "S S S", "O O O", "IS IT SO", "MOM SIS TOO", "TIME SITE"],
        unlock_criteria: { min_wpm: 5, min_accuracy: 95 } // High accuracy for new letters
    },
    {
        id: 4,
        name: "Practice: E T I M S O",
        sentences: [
            "IT IS ME SEE ME EAT",
            "SOME SITE IS SITE SITE SO",
            "MOST ITEMS MEET SITE NEEDS TOO",
            "SEE ME MEET TOM SITE SOON",
            "MOSS IS SET OMITS TIES SITE",
            "SIT TIGHT SEE ME MEET TOM",
            "TIME IS SITE TEST TO SEE",
            "MISS MITT MOST TIMES SO MESSY",
            "ITEM IS TO MEET SITE TOM",
            "OMIT MOST TIES SEE IT MESS"
        ],
        unlock_criteria: { min_wpm: 7, min_accuracy: 85 }
    },

    // --- Phase 3: Add A, N ---
    {
        id: 5,
        name: "Intro: A N",
        sentences: ["A A A", "N N N", "ANNA", "MAN", "NAN", "ANT", "TEN TAN MEN", "NAME SAME ANNA"],
        unlock_criteria: { min_wpm: 5, min_accuracy: 95 }
    },
    {
        id: 6,
        name: "Practice: E T I M S O A N",
        sentences: [
            "A MAN SENT ME TEN NOTES",
            "ANNA AND SAM ATE NUTS MAN",
            "ANT MANATEE SENT ME ANNA SANE",
            "SAME SITE SAME TIME NEXT MEAN", // Adjusted slightly
            "MEN SET NETS NEAR TAN SAND",
            "TEN ANTS ATE NINE TASTY MINT",
            "MEAN MAN SENT ANNA TEN MATS",
            "NAME THAT SAINT ANNA SENT ME",
            "STEAM TRAIN SENT SMOKE TO EAST",
            "NEAT SENTIMENTS MEAN SOMETHING TO ANNA"
        ],
        unlock_criteria: { min_wpm: 8, min_accuracy: 85 }
    },

    // --- Phase 4: Add U, D, R ---
    {
        id: 7,
        name: "Intro: U D R",
        sentences: ["U U U", "D D D", "R R R", "DUD", "RUN", "RED", "RUDDER", "UNDER TRUE RED", "READ DAD RUN"],
        unlock_criteria: { min_wpm: 6, min_accuracy: 95 }
    },
    {
        id: 8,
        name: "Practice: E T I M S O A N U D R",
        sentences: [
            "DUDES RUN UNDER DARK RED RUGS",
            "TRUE READERS DATE RARE UNDERUSED DATES",
            "OUR MAIDS DARE RUDE MAD MEN",
            "READERS MUST RETURN RARE USED TEXTS",
            "SEND MORE URGENT MESSAGES UNDER ROUTE",
            "RED DRESSES AND RED ROSES NEAR",
            "TURN AROUND AND SEE TRUE NORTH",
            "DRUMS SOUND UNDER THE STAR DUST",
            "RATS AND MICE RUN UNDER DOORS",
            "URGENT DEMAND SENT DURING DARK RAIN"
        ],
        unlock_criteria: { min_wpm: 10, min_accuracy: 88 }
    },

    // --- Phase 5: Add K, G, W ---
    {
        id: 9,
        name: "Intro: K G W",
        sentences: ["K K K", "G G G", "W W W", "KING", "WAG", "GROW", "WORK KNOW GO", "WE GO WAG"],
        unlock_criteria: { min_wpm: 6, min_accuracy: 95 }
    },
    {
        id: 10,
        name: "Practice: E T I M S O A N U D R K G W",
        sentences: [
            "WE KNOW GOOD WORKERS GROW KALE",
            "KING KONG WAGS WIDE GREEN WINGS",
            "GEESE WALK DARK WET GRASS KNOWINGLY",
            "WORKERS KNOW KINGS GRANT WIDE RANGE",
            "GREG KNEW WATER GOES DOWN WEST",
            "WE GROW DARK GREEN KALE WEEKLY",
            "TAKE WARM GOWNS DURING WINTER NIGHTS",
            "WORK GROUPS KNOW WAGES GROWING WEEKLY",
            "STRONG WINDS WOKE KING GREGORY KNOWING",
            "GOATS KNOW GREEN GRASS GROWS WESTWARD"
        ],
        unlock_criteria: { min_wpm: 11, min_accuracy: 90 }
    },

    // --- Phase 6: Add B, H, V ---
    {
        id: 11,
        name: "Intro: B H V",
        sentences: ["B B B", "H H H", "V V V", "BOB", "HAVE", "VAN", "BEHAVE VERY", "BIG HUB BOUGHT"],
        unlock_criteria: { min_wpm: 7, min_accuracy: 95 }
    },
    {
        id: 12,
        name: "Practice: E T I M S O A N U D R K G W B H V",
        sentences: [
            "BRAVE HUBBY BOUGHT VERY HEAVY BOOTS",
            "HAVE BOTH BOYS VISITED BIG VANS", // Corrected typo
            "BEHAVE BETTER BOYS HAVE VERY HIGH",
            "HER BROTHER HAS VISITED BIG BEN",
            "BRAVE MEN HAVE VERY HIGH HOPES",
            "HEAVY VIBRATIONS SHOOK BOTH BLUE BOATS",
            "BOB VISITED HIS BRAVE BROTHER THRICE",
            "HAVE THEM BRING BOTH HEAVY VASES",
            "HER BEST HABIT INVOLVES BRIGHT BEHAVIOR",
            "BOTH VANS HAVE VERY BIG BRAKES"
        ],
        unlock_criteria: { min_wpm: 12, min_accuracy: 90 }
    },

    // --- Phase 7: Add F, L, P ---
    {
        id: 13,
        name: "Intro: F L P",
        sentences: ["F F F", "L L L", "P P P", "FILL", "LAP", "POP", "FULL FLAP PULL", "PEOPLE LEFT FIELD"],
        unlock_criteria: { min_wpm: 7, min_accuracy: 95 }
    },
    {
        id: 14,
        name: "Practice: E T I M S O A N U D R K G W B H V F L P",
        sentences: [
            "FEW PEOPLE FOLLOW PLANS FOR FULL",
            "FLUFFY LAP DOGS LAPPED PLENTY FLUID",
            "PLEASE FILL LARGE FLAPS FOR PEOPLE",
            "FLYING FISH FLOPPED FREELY PAST PIER",
            "FATHER LEFT FIELD TRIP PLANS FALL",
            "FILL PAPER PAILS FULL FOR PLANTING",
            "FLUFFY PILLOWS HELP PEOPLE FALL FAST",
            "FRANK FOUND FOUR LARGE PURPLE FLOWERS",
            "PEOPLE OFTEN FEEL FULL FOLLOWING LUNCH",
            "PHILIP LEFT FLASHLIGHT PLUS FULL PACK"
        ],
        unlock_criteria: { min_wpm: 13, min_accuracy: 92 }
    },

    // --- Phase 8: Add J, Q, X, Y, Z ---
    {
        id: 15,
        name: "Intro: J Q X Y Z",
        sentences: ["J J J", "Q Q Q", "X X X", "Y Y Y", "Z Z Z", "JAZZ QUIZ", "XYLO ZOO", "JUMP QUICKLY"],
        unlock_criteria: { min_wpm: 7, min_accuracy: 95 }
    },
    {
        id: 16,
        name: "Practice: All Letters",
        sentences: [
            "JAZZY QUILTS EXCITED MY PLUCKY ZEBRA",
            "QUICK JAB FOX JUMPS OVER LAZY",
            "ZEBRAS JOG EXACTLY BY MY QUIET",
            "JULY JOYFULLY BRINGS EXTRA JAZZY QUIZZES",
            "FIX MY ZIPPERS QUICKLY JUST YESTERDAY",
            "QUEEN JAYNE EXPLORED SIXTY HAZY VALLEYS",
            "BOX JELLYFISH MAY JOLT YOUR QUIET",
            "EXPECT MAJOR QUIZZES BY JULY NEXT",
            "WHY DID JAY FIX SIXTY QUAIL?",
            "CRAZY FOXES JUMP QUICKLY BY ZOO"
        ],
        unlock_criteria: { min_wpm: 14, min_accuracy: 92 }
    },
    {
        id: 17,
        name: "Consolidation: Full Alphabet",
        sentences: [
            "THE QUICK BROWN FOX JUMPS OVER",
            "FIVE BOXING WIZARDS JUMP QUICKLY TODAY",
            "PACK MY BOX WITH FIVE DOZEN",
            "JACKDAWS LOVE MY BIG SPHINX OF", // Standard pangrams
            "HOW QUICKLY DAFT JUMPING ZEBRAS VEX",
            "BRIGHT VIXENS JUMP FOR JOYFUL ZEBRAS",
            "MY EXTREMELY PLUCKY ZEBRA JUST QUIT",
            "WALTZ NYMPH FOR QUICK JIGS VEX BED", // Adjusted pangram
            "QUIETLY EXPLORE JUNGLE BY HAZY FJORDS",
            "VOX QUIZ JUMPED FORTH BY WACKY" // Adjusted
        ],
        unlock_criteria: { min_wpm: 15, min_accuracy: 93 }
    },

    // --- Phase 9: Add Numbers ---
    {
        id: 18,
        name: "Intro: Numbers 0-9",
        sentences: ["0 0", "1 1", "2 2", "3 3", "4 4", "5 5", "6 6", "7 7", "8 8", "9 9", "123 456 7890"],
        unlock_criteria: { min_wpm: 8, min_accuracy: 95 }
    },
    {
        id: 19,
        name: "Practice: Letters & Numbers",
        sentences: [
            "BUY 10 APPLES AND 25 PEARS",
            "FLIGHT 370 ARRIVES AT GATE 9",
            "SEND 100 OR 200 UNITS NOW",
            "MY PHONE NUMBER IS 555 1234",
            "WE NEED 6 BOARDS 8 FEET LONG", // Added word
            "ORDER 7 PIZZAS FOR 45 PEOPLE",
            "THE YEAR IS 2025 RIGHT NOW", // Updated year
            "MEET AT 1600 HOURS AT POINT 7",
            "SHIPMENT 987 HAS JUST LEFT PORT",
            "COUNT FROM 0 TO 9 VERY SLOWLY"
        ],
        unlock_criteria: { min_wpm: 15, min_accuracy: 94 }
    },

    // --- Phase 10: Add Punctuation ---
    {
        id: 20,
        name: "Intro: Punctuation . , ?",
        sentences: [". . .", ", , ,", "? ? ?", "STOP .", "WAIT , WAIT", "REALLY ?", "OK. YES, REALLY?"],
        unlock_criteria: { min_wpm: 8, min_accuracy: 95 }
    },
    {
        id: 21,
        name: "Practice: All Characters",
        sentences: [
            "IS THE TIME 1430 HOURS YET?",
            "STOP . SEND HELP VIA ROUTE 66 .", // Added period
            "YES , WE HAVE THE PLANS , OKAY?",
            "RAIN IS EXPECTED . BRING JACKETS , HATS .",
            "WHAT IS YOUR NAME , RANK , NUMBER?",
            "ORDER CONFIRMED . REF 123A , DUE TUE .",
            "QUERY RECEIVED , REPLY PENDING . CODE 4?",
            "CALL ME AT 555 0199 , EXT 40 . URGENT?",
            "PRICE IS 99 . 50 , TAX 7 . 25 . OK?", // Simple price format
            "FINAL LEVEL COMPLETE . WELL DONE , OPERATOR ?"
        ],
        unlock_criteria: { min_wpm: 16, min_accuracy: 95 } // Final level goal
    }
];

// --- Audio Configuration ---
const AUDIO_DEFAULT_TONE_FREQUENCY = 400; // Default frequency in Hz
const AUDIO_RAMP_TIME = 0.005; // Fade in/out time for tones (seconds)
const AUDIO_MIN_FREQUENCY = 200; // Minimum adjustable frequency
const AUDIO_MAX_FREQUENCY = 1000; // Maximum adjustable frequency
const AUDIO_DEFAULT_VOLUME = 1.0; // Default volume (0.0 to 1.0)

// --- Scoring ---
const INCORRECT_ATTEMPT_PENALTY = 0.1;

// --- Keybindings ---
// Default keys if not found in localStorage or on reset
const KEYBINDING_DEFAULTS = {
    dit: '.',
    dah: '-'
};

// Key display mapping for settings UI
const KEYBIND_DISPLAY_MAP = {
    ' ': 'Space', '.': '.', '-': '-', 'Enter': 'Enter', 'Shift': 'Shift',
    'Control': 'Ctrl', 'Alt': 'Alt', 'Meta': 'Cmd/Win',
    'ArrowUp': '↑', 'ArrowDown': '↓', 'ArrowLeft': '←', 'ArrowRight': '→',
    // Add more mappings as needed
};
// Function to get displayable key name
const getKeyDisplay = (key) => {
    if (!key) return '';
    return KEYBIND_DISPLAY_MAP[key] || key.toUpperCase();
};


// --- Local Storage Keys ---
const STORAGE_KEY_PREFIX = 'ditDahDash_';
const STORAGE_KEY_HIGH_SCORES = `${STORAGE_KEY_PREFIX}highScores`;
const STORAGE_KEY_UNLOCKED_LEVELS = `${STORAGE_KEY_PREFIX}unlockedLevels`;
const STORAGE_KEY_SETTINGS_WPM = `${STORAGE_KEY_PREFIX}settingsWpm`;
const STORAGE_KEY_SETTINGS_SOUND = `${STORAGE_KEY_PREFIX}settingsSound`;
const STORAGE_KEY_SETTINGS_DARK_MODE = `${STORAGE_KEY_PREFIX}settingsDarkMode`;
const STORAGE_KEY_SETTINGS_FREQUENCY = `${STORAGE_KEY_PREFIX}settingsFrequency`;
const STORAGE_KEY_SETTINGS_VOLUME = `${STORAGE_KEY_PREFIX}settingsVolume`;
const STORAGE_KEY_SETTINGS_DIT_KEY = `${STORAGE_KEY_PREFIX}settingsDitKey`; // New key for Dit binding
const STORAGE_KEY_SETTINGS_DAH_KEY = `${STORAGE_KEY_PREFIX}settingsDahKey`; // New key for Dah binding
const STORAGE_KEY_SETTINGS_HINT_VISIBLE = `${STORAGE_KEY_PREFIX}settingsHintVisible`;
const STORAGE_KEY_PADDLE_TEXTURES = `${STORAGE_KEY_PREFIX}paddleTextures`;


// --- UI ---
const INCORRECT_FLASH_DURATION = 300; // ms for incorrect feedback flash
const HINT_DEFAULT_VISIBLE = true; // Hint is visible by default for new users

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
    AUDIO_DEFAULT_VOLUME,

    // Scoring
    INCORRECT_ATTEMPT_PENALTY,

    // Keybindings
    KEYBINDING_DEFAULTS,
    KEYBIND_DISPLAY_MAP,
    getKeyDisplay,

    // Storage Keys
    STORAGE_KEY_PREFIX, // Export prefix for potential other uses
    STORAGE_KEY_HIGH_SCORES, STORAGE_KEY_UNLOCKED_LEVELS,
    STORAGE_KEY_SETTINGS_WPM, STORAGE_KEY_SETTINGS_SOUND,
    STORAGE_KEY_SETTINGS_DARK_MODE, STORAGE_KEY_SETTINGS_FREQUENCY,
    STORAGE_KEY_SETTINGS_VOLUME,
    STORAGE_KEY_SETTINGS_DIT_KEY, STORAGE_KEY_SETTINGS_DAH_KEY,
    STORAGE_KEY_SETTINGS_HINT_VISIBLE,
    STORAGE_KEY_PADDLE_TEXTURES,

    // UI Feedback & Defaults
    INCORRECT_FLASH_DURATION,
    HINT_DEFAULT_VISIBLE,
};

// Function to get the current keybindings, checking localStorage or using defaults
window.getCurrentKeybindings = () => {
    let ditKey = localStorage.getItem(window.MorseConfig.STORAGE_KEY_SETTINGS_DIT_KEY);
    let dahKey = localStorage.getItem(window.MorseConfig.STORAGE_KEY_SETTINGS_DAH_KEY);

    // Use defaults if localStorage values are null, empty, or invalid (e.g., space)
    if (!ditKey || ditKey.trim() === '') {
        ditKey = window.MorseConfig.KEYBINDING_DEFAULTS.dit;
    }
    if (!dahKey || dahKey.trim() === '') {
        dahKey = window.MorseConfig.KEYBINDING_DEFAULTS.dah;
    }

    return { dit: ditKey, dah: dahKey };
};
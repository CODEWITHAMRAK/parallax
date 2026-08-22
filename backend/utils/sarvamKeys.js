let currentIndex = 0;

/**
 * Returns a Sarvam API key using a round-robin approach.
 * Reads from the SARVAM_API_KEYS environment variable, which should be a comma-separated list of keys.
 * 
 * @returns {string} The next Sarvam API key
 * @throws {Error} If SARVAM_API_KEYS is not set or empty
 */
export const getSarvamApiKey = () => {
    const keysString = process.env.SARVAM_API_KEYS;
    if (!keysString) {
        throw new Error("SARVAM_API_KEYS environment variable is not set.");
    }

    const keys = keysString.split(',').map(key => key.trim()).filter(key => key.length > 0);
    
    if (keys.length === 0) {
        throw new Error("No valid Sarvam API keys found in SARVAM_API_KEYS.");
    }

    const key = keys[currentIndex];
    currentIndex = (currentIndex + 1) % keys.length;
    return key;
};



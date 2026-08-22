export class DocumentVerifier {
  /**
   * Verifies if the captured document matches expectations and is readable.
   * @param {Object} ocrData - The data returned by Tesseract.js
   * @param {Object} qualityMetrics - { sharpness, brightness } from ImageProcessor
   * @param {string} expectedType - e.g., "income_certificate"
   * @returns {Object} VerificationResult
   */
  verify(ocrData, qualityMetrics, expectedType) {
    const text = ocrData.text.toLowerCase();
    
    // 1. Readability Check
    // Sharpness threshold (Variance of Laplacian)
    // Tweak this based on real-world camera testing. Usually < 100 is very blurry.
    const SHARPNESS_THRESHOLD = 50; 
    
    // Brightness threshold (0-1)
    const MIN_BRIGHTNESS = 0.2;
    const MAX_BRIGHTNESS = 0.9; // To avoid blown-out glare

    const isSharp = qualityMetrics.sharpness > SHARPNESS_THRESHOLD;
    const isWellLit = qualityMetrics.brightness > MIN_BRIGHTNESS && qualityMetrics.brightness < MAX_BRIGHTNESS;
    
    // OCR Confidence Check
    const avgConfidence = ocrData.confidence || 0;
    const hasSufficientText = text.trim().length > 20;

    const readable = isSharp && isWellLit && (avgConfidence > 60 || hasSufficientText);
    
    let reason = [];
    if (!isSharp) reason.push("The document is too blurry to read.");
    if (!isWellLit) reason.push("The document lighting is poor. Try a brighter area.");

    // 2. Document Type Check
    // Very rudimentary keyword matching. In a real system, you'd use a more robust
    // template matcher or fuzzy string search.
    const keywords = this._getKeywordsForType(expectedType);
    let matchCount = 0;
    
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        matchCount++;
      }
    }

    // We consider it a match if at least some keywords are found, 
    // or if the OCR failed entirely (we might still want to accept manual override)
    // For MVP, we demand at least 1 keyword match if we expect a specific type
    const documentMatch = keywords.length === 0 || matchCount > 0;

    if (!documentMatch) {
      reason.push("This does not appear to be the correct document.");
    }

    return {
      documentMatch,
      documentConfidence: matchCount / Math.max(1, keywords.length),
      readable,
      readabilityConfidence: avgConfidence / 100.0,
      quality: {
        sharpness: qualityMetrics.sharpness,
        brightness: qualityMetrics.brightness,
        contrast: 0, // Placeholder
        cropQuality: 1, // Placeholder
        perspectiveQuality: 1 // Placeholder
      },
      reason: reason.join(" ")
    };
  }

  _getKeywordsForType(type) {
    switch (type) {
      case "income_certificate":
      case "income_document":
        return ["income", "annual", "certificate", "tahsildar", "revenue", "rupees"];
      case "caste_document":
      case "caste_certificate":
        return ["caste", "tribe", "backward", "schedule", "certificate"];
      case "marksheet_document":
      case "marksheet":
        return ["marks", "grade", "board", "university", "examination", "passing"];
      default:
        return [];
    }
  }
}

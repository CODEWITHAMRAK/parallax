export class OCRService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.currentLang = null;
  }

  async init(languageCode = "eng") {
    // Check if script is loaded
    if (!window.Tesseract) {
      await this.loadTesseractScript();
    }

    // Tesseract expects "eng", "hin", "kan", etc.
    const tessLang = this.mapLanguageCode(languageCode);

    if (this.worker && this.currentLang === tessLang) {
      return; // Already initialized for this language
    }

    try {
      if (this.worker) {
        await this.worker.terminate();
      }
      
      this.worker = await window.Tesseract.createWorker(tessLang);
      this.currentLang = tessLang;
      this.isReady = true;
      console.log(`[OCRService] Worker ready for language: ${tessLang}`);
    } catch (err) {
      console.error("[OCRService] Init error:", err);
      throw new Error("Failed to initialize OCR.");
    }
  }

  async recognize(imageSrc) {
    if (!this.isReady || !this.worker) {
      throw new Error("OCR Worker not initialized. Call init() first.");
    }

    try {
      const { data } = await this.worker.recognize(imageSrc);
      return data;
    } catch (err) {
      console.error("[OCRService] Recognize error:", err);
      throw err;
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }

  mapLanguageCode(lang) {
    // Map application language codes to Tesseract codes
    switch (lang) {
      case "en-IN":
      case "en":
        return "eng";
      case "kn-IN":
      case "kn":
        return "kan";
      default:
        return "eng"; // Fallback
    }
  }

  loadTesseractScript() {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
}

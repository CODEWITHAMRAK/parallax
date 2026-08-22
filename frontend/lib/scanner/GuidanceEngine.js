export class GuidanceEngine {
  constructor() {
    this.lastInstructionTime = 0;
    this.debounceMs = 2500; // Do not speak more often than every 2.5s
    this.lastInstruction = "";
    this.stabilityFrames = 0;
  }

  /**
   * Generates guidance instructions based on detected geometry.
   * @param {Object} geometry - The detected document geometry {center, areaRatio, angle, processWidth, processHeight}
   * @param {Function} speakCallback - Function to call to announce instruction
   * @returns {Object} { instructionText, isStable }
   */
  process(geometry, speakCallback) {
    if (!geometry) {
      this.stabilityFrames = 0;
      return this._debounceInstruction("Document lost. Find the document.", speakCallback);
    }

    const { center, areaRatio, angle, processWidth, processHeight } = geometry;
    const centerX = processWidth / 2;
    const centerY = processHeight / 2;
    
    // Configurable thresholds
    const HORIZONTAL_MARGIN = processWidth * 0.15; // 15% tolerance
    const VERTICAL_MARGIN = processHeight * 0.15;
    const MIN_AREA = 0.3; // Document should take up at least 30% of frame
    const MAX_AREA = 0.85; // Document should take up at most 85% of frame
    const MAX_ANGLE = 5; // Degrees of tilt allowed

    let instruction = null;
    let isStable = false;

    // Horizontal check
    if (center.x < centerX - HORIZONTAL_MARGIN) {
      instruction = "Move slightly left.";
    } else if (center.x > centerX + HORIZONTAL_MARGIN) {
      instruction = "Move slightly right.";
    }
    // Vertical check
    else if (center.y < centerY - VERTICAL_MARGIN) {
      instruction = "Move slightly up.";
    } else if (center.y > centerY + VERTICAL_MARGIN) {
      instruction = "Move slightly down.";
    }
    // Distance check
    else if (areaRatio < MIN_AREA) {
      instruction = "Move closer.";
    } else if (areaRatio > MAX_AREA) {
      instruction = "Move slightly back.";
    }
    // Rotation check
    else if (Math.abs(angle) > MAX_ANGLE) {
      instruction = "Tilt your phone slightly.";
    } 
    // All good
    else {
      instruction = "Hold still.";
      isStable = true;
    }

    if (isStable) {
      this.stabilityFrames++;
    } else {
      this.stabilityFrames = 0;
    }

    // Only return true for stable if we've held it for a few frames
    const stableEnoughForCapture = this.stabilityFrames > 10;

    return {
      ...this._debounceInstruction(instruction, speakCallback),
      isStable: stableEnoughForCapture,
      currentInstruction: instruction // Un-debounced instruction for UI updates
    };
  }

  _debounceInstruction(instruction, speakCallback) {
    const now = Date.now();
    
    // If the instruction hasn't changed and we recently said it, don't repeat
    if (instruction === this.lastInstruction && (now - this.lastInstructionTime) < this.debounceMs) {
      return { instructionText: null }; 
    }
    
    // If instruction changed, or it's been a while, speak it
    this.lastInstruction = instruction;
    this.lastInstructionTime = now;
    
    if (speakCallback) {
      speakCallback(instruction);
    }
    
    return { instructionText: instruction };
  }
}

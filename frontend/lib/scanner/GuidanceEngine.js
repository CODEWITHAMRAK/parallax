/**
 * GuidanceEngine — Analyses document geometry and produces guidance instructions.
 *
 * Coordinates are in PROCESS-SPACE (the full uncropped video frame).
 * The user sees a CROPPED view (object-fit:cover). We map the document
 * center into the user's visible viewport before deciding directions.
 *
 * DIRECTION RULE (camera = mirror):
 *   Document at TOP of frame    → camera aimed too HIGH  → "Point camera down"
 *   Document at BOTTOM of frame → camera aimed too LOW   → "Point camera up"
 *   Document at LEFT of frame   → camera aimed too LEFT  → "Point camera right"
 *   Document at RIGHT of frame  → camera aimed too RIGHT → "Point camera left"
 *
 * INSTRUCTION VOCABULARY (matches pre-saved audio files):
 *   - "Move back a little."          → move_back.wav
 *   - "Move closer to the document." → move_closer.wav
 *   - "Point camera up a little."    → move_up.wav
 *   - "Point camera down a little."  → move_down.wav
 *   - "Point camera left a little."  → move_left.wav
 *   - "Point camera right a little." → move_right.wav
 *   - "Straighten the document."     → tilt_phone.wav
 *   - "Hold still."                  → hold_still.wav
 *   - "Point your camera at the document." → document_lost.wav
 */
export class GuidanceEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.lastInstruction     = '';
    this.lastInstructionTime = 0;
    this.currentDisplayedInstruction = '';
    this.stabilityFrames     = 0;
    this.lostFrames          = 0;
    this.debounceMs          = 3500;   // min gap before speaking a NEW instruction
    this.reminderMs          = 6000;   // min gap before repeating the SAME instruction
    this.stabilityTarget     = 5;      // frames of "Hold still" before auto-capture
    this.lostFrameThreshold  = 12;     // frames without detection before "lost" warning

    this.pendingInstruction  = null;
    this.pendingCount        = 0;
    this.pendingThreshold    = 4;      // frames of agreement before switching
  }

  /**
   * @param {Object|null} geometry — from DocumentDetector (process-space)
   * @param {Function}    speakCb  — plays/speaks the instruction
   * @param {Object}      viewport — { displayWidth, displayHeight, videoWidth, videoHeight }
   */
  process(geometry, speakCb, viewport) {
    if (!geometry) {
      return this._handleNoDocument(speakCb);
    }
    this.lostFrames = 0;
    return this._analyseDocument(geometry, speakCb, viewport);
  }

  // ─── No document visible ──────────────────────────────────────────

  _handleNoDocument(speakCb) {
    this.stabilityFrames = 0;
    this.lostFrames++;

    if (this.lostFrames > this.lostFrameThreshold) {
      return this._emit('Point your camera at the document.', speakCb, false);
    }

    return {
      instructionText:    null,
      currentInstruction: this.lastInstruction || 'Point your camera at the document.',
      isStable:           false,
    };
  }

  // ─── Document visible — decide what to tell the user ──────────────

  _analyseDocument(geometry, speakCb, viewport) {
    const {
      center, areaRatio, angle,
      isCroppedTop, isCroppedBottom, isCroppedLeft, isCroppedRight,
      processWidth, processHeight,
    } = geometry;

    // ── Compute the visible viewport in process-space ──────────────
    // The <video> uses object-fit:cover which crops the native video.
    let visibleRegion = { x: 0, y: 0, w: processWidth, h: processHeight };

    if (viewport && viewport.videoWidth && viewport.videoHeight) {
      const { displayWidth, displayHeight, videoWidth, videoHeight } = viewport;
      const videoAR  = videoWidth / videoHeight;
      const screenAR = displayWidth / displayHeight;

      if (screenAR > videoAR) {
        // Screen wider than video → top/bottom cropped
        const visH  = videoWidth / screenAR;
        const cropY = (videoHeight - visH) / 2;
        const scale = processWidth / videoWidth;
        visibleRegion = { x: 0, y: cropY * scale, w: processWidth, h: visH * scale };
      } else {
        // Screen taller than video → left/right cropped
        const visW  = videoHeight * screenAR;
        const cropX = (videoWidth - visW) / 2;
        const scale = processHeight / videoHeight;
        visibleRegion = { x: cropX * scale, y: 0, w: visW * scale, h: processHeight };
      }
    }

    const visCenterX = visibleRegion.x + visibleRegion.w / 2;
    const visCenterY = visibleRegion.y + visibleRegion.h / 2;

    // ── Hysteresis (wider tolerance once stable to prevent jitter) ──
    const isCurrentlyStable = (this.currentDisplayedInstruction === 'Hold still.');
    const tol = isCurrentlyStable ? 1.3 : 1.0;

    const H_MARGIN  = visibleRegion.w * 0.25 * tol;
    const V_MARGIN  = visibleRegion.h * 0.25 * tol;
    
    const visibleAreaRatio = (visibleRegion.w * visibleRegion.h) / (processWidth * processHeight);
    const docVisibleRatio = areaRatio / visibleAreaRatio;
    const MIN_DOC_VISIBLE_RATIO = isCurrentlyStable ? 0.15 : 0.20;
    const MAX_ANGLE = isCurrentlyStable ? 18 : 12;

    let instruction = null;
    let isStable    = false;

    // ── Priority 1: Edge cropping ──────────────────────────────────
    // If the document is taking up a lot of the screen and touches ANY edge,
    // they are likely too close or trying to pan when they shouldn't.
    const isCropped = isCroppedTop || isCroppedBottom || isCroppedLeft || isCroppedRight;

    if (isCropped && docVisibleRatio > 0.60) {
      instruction = 'Move back a little.';
    }
    // Single-edge crop = camera aimed too far in that direction.
    else if (isCroppedTop) {
      instruction = 'Point camera up a little.';
    }
    else if (isCroppedBottom) {
      instruction = 'Point camera down a little.';
    }
    else if (isCroppedLeft) {
      instruction = 'Point camera left a little.';
    }
    else if (isCroppedRight) {
      instruction = 'Point camera right a little.';
    }
    // ── Priority 2: Too far away ───────────────────────────────────
    else if (docVisibleRatio < MIN_DOC_VISIBLE_RATIO) {
      instruction = 'Move closer to the document.';
    }
    // ── Priority 3: Off-center position ────────────────────────────
    else if (center.x < visCenterX - H_MARGIN) {
      instruction = 'Point camera left a little.';
    }
    else if (center.x > visCenterX + H_MARGIN) {
      instruction = 'Point camera right a little.';
    }
    else if (center.y < visCenterY - V_MARGIN) {
      instruction = 'Point camera up a little.';
    }
    else if (center.y > visCenterY + V_MARGIN) {
      instruction = 'Point camera down a little.';
    }
    // ── Priority 4: Tilt / rotation ────────────────────────────────
    else if (Math.abs(angle) > MAX_ANGLE) {
      instruction = 'Straighten the document.';
    }
    // ── Priority 5: All good ───────────────────────────────────────
    else {
      instruction = 'Hold still.';
      isStable    = true;
    }

    // Track stability streak
    if (isStable) {
      this.stabilityFrames++;
    } else {
      this.stabilityFrames = 0;
    }

    const stableEnough   = this.stabilityFrames >= this.stabilityTarget;
    
    // ── Instruction Stability Gate (Visual) ──
    let finalInstruction = this.currentDisplayedInstruction || instruction;
    
    // "Hold still" bypasses the gate
    if (isStable) {
      finalInstruction = instruction;
      this.pendingInstruction = null;
      this.pendingCount = 0;
    } else if (instruction === this.currentDisplayedInstruction) {
      this.pendingInstruction = null;
      this.pendingCount = 0;
    } else {
      if (instruction === this.pendingInstruction) {
        this.pendingCount++;
        if (this.pendingCount >= this.pendingThreshold) {
          finalInstruction = instruction;
        }
      } else {
        this.pendingInstruction = instruction;
        this.pendingCount = 1;
      }
    }
    
    this.currentDisplayedInstruction = finalInstruction;

    const debounceResult = this._emit(finalInstruction, speakCb, isStable);

    return {
      ...debounceResult,
      currentInstruction: finalInstruction,
      isStable:           stableEnough,
    };
  }

  // ─── Debounce / emit logic ────────────────────────────────────────

  _emit(instruction, speakCb, isHighPriority) {
    const now = Date.now();

    if (isHighPriority) {
      // "Hold still" — speak once when transitioning into stable state
      if (instruction !== this.lastInstruction) {
        this.lastInstruction     = instruction;
        this.lastInstructionTime = now;
        if (speakCb) speakCb(instruction);
        return { instructionText: instruction };
      }
      return { instructionText: null };
    }

    // Normal instruction: new instruction after debounce, repeat after reminder
    const isSame   = (instruction === this.lastInstruction);
    const cooldown = isSame ? this.reminderMs : this.debounceMs;

    if ((now - this.lastInstructionTime) >= cooldown) {
      this.lastInstruction     = instruction;
      this.lastInstructionTime = now;
      if (speakCb) speakCb(instruction);
      return { instructionText: instruction };
    }

    return { instructionText: null };
  }
}

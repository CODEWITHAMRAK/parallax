/**
 * DocumentDetector — OpenCV.js document edge detection.
 *
 * All OpenCV Mats are created and deleted within each detect() call.
 * This avoids "deleted object" errors from React Strict Mode double-mounting.
 *
 * Algorithm:
 * 1. Greyscale + Gaussian blur
 * 2. Adaptive threshold (handles uneven / low lighting)
 * 3. Morphological close (fills small holes in mask)
 * 4. RETR_EXTERNAL contour search
 * 5. ConvexHull + approxPolyDP with epsilon sweep → 4-corner polygon
 * 6. Bounding-rect fallback so the outline always appears
 * 7. 5-frame majority-vote temporal smoothing
 */
export class DocumentDetector {
  constructor(cv) {
    this.cv = cv;

    this.processWidth  = 640;
    this.processHeight = 0; // computed on first frame

    // Temporal smoothing
    this.historySize      = 5;
    this.geometryHistory  = [];
    this.lastGoodGeometry = null;
  }

  /** No-op — nothing to clean up since all Mats are local to detect(). */
  cleanup() {}

  /**
   * Detect the largest document-like quadrilateral in the video frame.
   * @param {HTMLVideoElement}  videoEl
   * @param {HTMLCanvasElement} canvasEl  — hidden scratch canvas
   * @returns {{ corners, center, areaRatio, angle, processWidth, processHeight } | null}
   */
  detect(videoEl, canvasEl) {
    const cv = this.cv;
    if (!cv || !videoEl || videoEl.videoWidth === 0) return null;

    // ── Initialise processing resolution on first frame ───────────────────
    if (this.processHeight === 0) {
      this.processHeight = Math.round(
        videoEl.videoHeight * (this.processWidth / videoEl.videoWidth)
      );
    }
    const W = this.processWidth;
    const H = this.processHeight;

    // Size the hidden canvas once
    if (canvasEl.width  !== W) canvasEl.width  = W;
    if (canvasEl.height !== H) canvasEl.height = H;

    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(videoEl, 0, 0, W, H);

    // ── All Mats are local so they can't become stale across unmounts ─────
    let src       = null;
    let gray      = null;
    let blurred   = null;
    let thresh    = null;
    let morphed   = null;
    let kernel    = null;
    let contours  = null;
    let hierarchy = null;

    let result = null;

    try {
      const imageData = ctx.getImageData(0, 0, W, H);

      // 1. Read pixels into a Mat
      src = cv.matFromImageData(imageData);

      // 2. Greyscale + Gaussian blur
      gray    = new cv.Mat();
      blurred = new cv.Mat();
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      // 3. Adaptive threshold — works in variable / low lighting
      thresh = new cv.Mat();
      cv.adaptiveThreshold(
        blurred, thresh,
        255,
        cv.ADAPTIVE_THRESH_MEAN_C,
        cv.THRESH_BINARY_INV,
        15,  // block size (must be odd)
        4    // constant subtracted from mean
      );

      // 4. Morphological close — fills gaps in the mask
      morphed = new cv.Mat();
      kernel  = cv.Mat.ones(5, 5, cv.CV_8U);
      cv.morphologyEx(thresh, morphed, cv.MORPH_CLOSE, kernel);

      // 5. Find external contours only
      contours  = new cv.MatVector();
      hierarchy = new cv.Mat();
      cv.findContours(
        morphed, contours, hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
      );

      // 6. Find the best document candidate
      const frameArea = W * H;
      const minArea   = frameArea * 0.06;

      let maxArea     = 0;
      let bestCorners = null;
      let fallbackRect = null;

      for (let i = 0; i < contours.size(); i++) {
        const cnt  = contours.get(i);
        const area = cv.contourArea(cnt);

        if (area > minArea && area > maxArea) {
          maxArea = area;

          // Store bounding rect for fallback
          fallbackRect = cv.boundingRect(cnt);

          // ConvexHull removes concavities (crumpled paper, fingers, etc.)
          const hull  = new cv.Mat();
          cv.convexHull(cnt, hull, false, true);

          const peri   = cv.arcLength(hull, true);
          const approx = new cv.Mat();
          let   found4 = false;

          // Sweep epsilon until exactly 4 corners are found
          for (let eps = 0.02; eps <= 0.12; eps += 0.01) {
            cv.approxPolyDP(hull, approx, eps * peri, true);
            if (approx.rows === 4) { found4 = true; break; }
          }

          hull.delete();

          if (found4) {
            const corners = [];
            for (let j = 0; j < 4; j++) {
              corners.push({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1],
              });
            }
            bestCorners = corners;
          }
          approx.delete();
        }
        cnt.delete();
      }

      // 7. Build result from 4-corner polygon, or fall back to bounding rect
      if (bestCorners) {
        result = this._buildResult(bestCorners, maxArea);
      } else if (fallbackRect) {
        const r = fallbackRect;
        const corners = [
          { x: r.x,          y: r.y          },
          { x: r.x + r.width, y: r.y          },
          { x: r.x + r.width, y: r.y + r.height },
          { x: r.x,          y: r.y + r.height },
        ];
        result = this._buildResult(corners, r.width * r.height);
      }

    } catch (err) {
      console.error('[DocumentDetector] error:', err);
    } finally {
      // Always free every Mat created in this call
      const del = (m) => { try { if (m && !m.isDeleted()) m.delete(); } catch(e){} };
      del(src); del(gray); del(blurred); del(thresh);
      del(morphed); del(kernel); del(contours); del(hierarchy);
    }

    // ── 8. Temporal smoothing (5-frame majority vote) ─────────────────────
    this.geometryHistory.push(result !== null);
    if (this.geometryHistory.length > this.historySize) this.geometryHistory.shift();

    if (result !== null) this.lastGoodGeometry = result;

    const positives = this.geometryHistory.filter(Boolean).length;
    if (positives >= Math.ceil(this.historySize / 2)) {
      return this.lastGoodGeometry;
    }
    return null;
  }

  /** Compute centre, areaRatio, and angle from 4 corners + area. */
  _buildResult(corners, area) {
    const center = corners.reduce(
      (acc, c) => ({ x: acc.x + c.x, y: acc.y + c.y }),
      { x: 0, y: 0 }
    );
    center.x /= 4;
    center.y /= 4;

    const frameArea = this.processWidth * this.processHeight;
    const areaRatio = area / frameArea;

    // Use the longest edge to determine the primary orientation angle
    let maxDist = 0;
    let angle   = 0;
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > maxDist) {
        maxDist = d;
        angle   = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
      }
    }
    // Normalise to [-45, 45] so portrait & landscape both read near 0 when straight
    angle = ((angle % 90) + 90) % 90;
    if (angle > 45) angle -= 90;

    return {
      corners,
      center,
      areaRatio,
      angle,
      processWidth:  this.processWidth,
      processHeight: this.processHeight,
    };
  }
}

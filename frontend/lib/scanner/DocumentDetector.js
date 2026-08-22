/**
 * DocumentDetector — OpenCV.js document edge detection.
 *
 * Design:
 *  1. The caller passes in the video element and a hidden canvas.
 *  2. We draw the video onto the canvas at a fixed processing width (480px)
 *     keeping the video's native aspect ratio — NO cropping.
 *  3. We return corners in process-space. The caller (drawOverlay) maps them
 *     to display-space using the same object-fit:cover math the browser uses.
 *
 * KEY INSIGHT: We do NOT try to pre-crop the video to match the screen here.
 * That was causing all the bugs. Instead:
 *  - We process the FULL video frame (uncropped).
 *  - We return the detection result in process-space.
 *  - The GuidanceEngine works in process-space (which matches the video).
 *  - drawOverlay maps process-space → display-space for rendering.
 *
 * All Mats are created and deleted locally so React Strict Mode is safe.
 */
export class DocumentDetector {
  constructor(cv) {
    this.cv = cv;
    this.processWidth  = 320;  // lower res = faster processing
    this.processHeight = 0;    // computed from video aspect ratio

    // Temporal smoothing — require 2 of 3 frames to agree
    this.historySize      = 3;
    this.geometryHistory  = [];
    this.lastGoodGeometry = null;
  }

  cleanup() {}

  /**
   * @param {HTMLVideoElement} videoEl
   * @param {HTMLCanvasElement} canvasEl  — hidden offscreen canvas for processing
   * @returns {Object|null} geometry result with corners in process-space
   */
  detect(videoEl, canvasEl) {
    const cv = this.cv;
    if (!cv || !videoEl || videoEl.videoWidth === 0) return null;

    // Compute process dimensions from NATIVE video aspect ratio (no cropping)
    if (this.processHeight === 0) {
      this.processHeight = Math.round(
        videoEl.videoHeight * (this.processWidth / videoEl.videoWidth)
      );
    }
    const W = this.processWidth;
    const H = this.processHeight;

    // Resize hidden canvas only when needed
    if (canvasEl.width !== W) canvasEl.width = W;
    if (canvasEl.height !== H) canvasEl.height = H;

    const ctx = canvasEl.getContext('2d', { willReadFrequently: true });
    // Draw the FULL video frame (no cropping) scaled down to process resolution
    ctx.drawImage(videoEl, 0, 0, W, H);

    let result   = null;
    const locals = [];
    const mat    = (m) => { locals.push(m); return m; };

    try {
      // ── 1. Greyscale ──────────────────────────────────────────────
      const src  = mat(cv.matFromImageData(ctx.getImageData(0, 0, W, H)));
      const gray = mat(new cv.Mat());
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

      // ── 2. Blur ───────────────────────────────────────────────────
      const blurred = mat(new cv.Mat());
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

      // ── 3. Canny with Otsu-guided thresholds ──────────────────────
      const otsuBin  = mat(new cv.Mat());
      const otsuVal  = cv.threshold(blurred, otsuBin, 0, 255,
                        cv.THRESH_BINARY | cv.THRESH_OTSU);
      const hi = Math.max(30, Math.min(otsuVal, 200));
      const lo = hi * 0.4;

      const edges = mat(new cv.Mat());
      cv.Canny(blurred, edges, lo, hi, 3);

      // ── 4. Dilate to close gaps ───────────────────────────────────
      const kernel = mat(cv.Mat.ones(3, 3, cv.CV_8U));
      cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 1);

      // ── 5. Find all contours ──────────────────────────────────────
      const contours  = mat(new cv.MatVector());
      const hierarchy = mat(new cv.Mat());
      cv.findContours(edges, contours, hierarchy,
                      cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      // ── 6. Find the best quadrilateral ────────────────────────────
      const frameArea = W * H;
      const minArea   = frameArea * 0.03;

      let maxQuadArea = 0;
      let bestCorners = null;
      
      let maxBlobArea = 0;
      let fallbackRect = null;

      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        
        const hull = mat(new cv.Mat());
        cv.convexHull(cnt, hull, false, true);
        const hullArea = cv.contourArea(hull);

        // We filter by hullArea so open U-shapes (partial documents) are allowed to pass!
        if (hullArea < minArea || hullArea > frameArea * 0.95) { cnt.delete(); continue; }

        const hullPeri = cv.arcLength(hull, true);
        const cntPeri  = cv.arcLength(cnt, true); // true here handles U-shapes robustly
        
        // Complexity check: A clean document (or partial document) has a simple contour.
        // A messy background web (bedsheet) will have a massive perimeter compared to its hull.
        if (cntPeri > hullPeri * 1.5) { cnt.delete(); continue; }

        // Approximate the hull to a quadrilateral
        const approx = mat(new cv.Mat());
        let found4 = false;
        let corners = null;

        for (let eps = 0.02; eps <= 0.08; eps += 0.01) {
          cv.approxPolyDP(hull, approx, eps * hullPeri, true);
          if (approx.rows === 4) { 
             found4 = true; 
             corners = [];
             for (let j = 0; j < 4; j++) {
               corners.push({
                 x: Math.max(0, Math.min(W - 1, approx.data32S[j * 2])),
                 y: Math.max(0, Math.min(H - 1, approx.data32S[j * 2 + 1])),
               });
             }
             break; 
          }
        }

        if (found4) {
          // Valid quad (document or partial document) ALWAYS wins if it's the largest quad
          if (hullArea > maxQuadArea) {
             maxQuadArea = hullArea;
             bestCorners = corners;
          }
        } else {
          // Not a quad, but could be a valid fallback blob
          if (hullArea > maxBlobArea) {
             maxBlobArea = hullArea;
             fallbackRect = cv.boundingRect(hull);
          }
        }
        
        cnt.delete();
      }

      // ── 7. Build result ───────────────────────────────────────────
      // A valid quad always wins over a blob, even if the blob is larger.
      if (bestCorners) {
        result = this._buildResult(bestCorners, W, H);
      } else if (fallbackRect) {
        const r = fallbackRect;
        const corners = [
          { x: r.x,           y: r.y },
          { x: r.x + r.width, y: r.y },
          { x: r.x + r.width, y: r.y + r.height },
          { x: r.x,           y: r.y + r.height },
        ];
        result = this._buildResult(corners, W, H);
      }

    } catch (err) {
      console.error('[DocumentDetector]', err);
    } finally {
      locals.forEach(m => { try { if (!m.isDeleted()) m.delete(); } catch(e){} });
    }

    // ── 8. Temporal smoothing ───────────────────────────────────────
    this.geometryHistory.push(result !== null);
    if (this.geometryHistory.length > this.historySize) this.geometryHistory.shift();
    if (result !== null) this.lastGoodGeometry = result;

    const positives = this.geometryHistory.filter(Boolean).length;
    return positives >= Math.ceil(this.historySize / 2)
      ? this.lastGoodGeometry
      : null;
  }

  /**
   * Build a standardised geometry result from 4 corners.
   * All values are in process-space (480 × H pixels).
   */
  _buildResult(corners, W, H) {
    // ── Center of the quadrilateral ────────────────────────────────
    const center = { x: 0, y: 0 };
    for (const c of corners) { center.x += c.x; center.y += c.y; }
    center.x /= 4;
    center.y /= 4;

    // ── Quadrilateral area via Shoelace ────────────────────────────
    let quadArea = 0;
    for (let i = 0; i < 4; i++) {
      const p1 = corners[i], p2 = corners[(i + 1) % 4];
      quadArea += (p1.x * p2.y - p2.x * p1.y);
    }
    quadArea = Math.abs(quadArea / 2);
    const areaRatio = Math.min(quadArea / (W * H), 1.0);

    // ── Edge crop flags ─────────────────────────────────────────────
    // A corner is "cropped" only if it's within 3px of the frame edge.
    // Corners that extend beyond the frame get clamped to 0 or W-1 by
    // the detector, so a truly clipped corner will be at 0/1/2.
    // The old percentage margin (7+ px) was catching normal corners
    // that happened to be near the edge, causing false "Move back."
    const margin = 5;
    const isCroppedLeft   = Math.min(...corners.map(c => c.x)) <= margin;
    const isCroppedRight  = Math.max(...corners.map(c => c.x)) >= W - margin;
    const isCroppedTop    = Math.min(...corners.map(c => c.y)) <= margin;
    const isCroppedBottom = Math.max(...corners.map(c => c.y)) >= H - margin;

    // ── Tilt angle (longest edge) ─────────────────────────────────
    let maxDist = 0, angle = 0;
    for (let i = 0; i < 4; i++) {
      const a = corners[i], b = corners[(i + 1) % 4];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      if (d > maxDist) {
        maxDist = d;
        angle = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
      }
    }
    angle = ((angle % 90) + 90) % 90;
    if (angle > 45) angle -= 90;

    return {
      corners, center, areaRatio, angle,
      isCroppedTop, isCroppedBottom, isCroppedLeft, isCroppedRight,
      processWidth: W, processHeight: H,
    };
  }
}

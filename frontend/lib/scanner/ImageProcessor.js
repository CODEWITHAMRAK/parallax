export class ImageProcessor {
  constructor(cv) {
    this.cv = cv;
  }

  /**
   * Warps the detected document into a flat rectangle and calculates quality.
   * @param {HTMLVideoElement} videoElement - High-res source video.
   * @param {Object} geometry - Geometry from DocumentDetector (corners in processWidth/processHeight space).
   * @returns {{ dataUrl, quality: { sharpness, brightness } } | null}
   */
  process(videoElement, geometry) {
    if (!this.cv || !videoElement || !geometry) return null;

    // Draw the current full-res video frame onto a temp canvas
    const canvas = document.createElement('canvas');
    canvas.width  = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    let src    = null;
    let dst    = null;
    let srcTri = null;
    let dstTri = null;
    let M      = null;
    let gray   = null;
    let lap    = null;
    let mean   = null;
    let stddev = null;
    let meanB  = null;
    let stdB   = null;
    let result = null;

    try {
      // ── Scale corners from process resolution → full video resolution ─────
      const scaleX = canvas.width  / geometry.processWidth;
      const scaleY = canvas.height / geometry.processHeight;

      const rawCorners = geometry.corners.map(c => ({
        // Clamp to frame bounds — out-of-bounds corners collapse the warp
        x: Math.max(0, Math.min(canvas.width  - 1, c.x * scaleX)),
        y: Math.max(0, Math.min(canvas.height - 1, c.y * scaleY)),
      }));

      // ── Robust corner ordering (works for any rotation) ───────────────────
      // Standard trick: 
      //   Top-Left     → min(x + y)
      //   Bottom-Right → max(x + y)
      //   Top-Right    → min(y - x)   (equivalently min(x - y) gives BL, but we use y-x)
      //   Bottom-Left  → max(y - x)
      const sum  = rawCorners.map(c => c.x + c.y);
      const diff = rawCorners.map(c => c.y - c.x);

      const tl = rawCorners[sum.indexOf(Math.min(...sum))];
      const br = rawCorners[sum.indexOf(Math.max(...sum))];
      const tr = rawCorners[diff.indexOf(Math.min(...diff))];
      const bl = rawCorners[diff.indexOf(Math.max(...diff))];

      // ── Compute output dimensions from the corner distances ───────────────
      const widthTop    = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
      const maxWidth    = Math.max(Math.round(widthTop), Math.round(widthBottom));

      const heightLeft  = Math.hypot(bl.x - tl.x, bl.y - tl.y);
      const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
      const maxHeight   = Math.max(Math.round(heightLeft), Math.round(heightRight));

      // Sanity: if computed size is implausibly small, warp would be garbage —
      // return the full-frame capture instead so the user at least sees something.
      if (maxWidth < 80 || maxHeight < 80) {
        console.warn('[ImageProcessor] Warp too small — falling back to full frame.');
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        return { dataUrl, quality: { sharpness: 80, brightness: 0.5 } };
      }

      // ── Perspective warp ──────────────────────────────────────────────────
      src = this.cv.imread(canvas);

      srcTri = this.cv.matFromArray(4, 1, this.cv.CV_32FC2, [
        tl.x, tl.y,
        tr.x, tr.y,
        br.x, br.y,
        bl.x, bl.y,
      ]);

      dstTri = this.cv.matFromArray(4, 1, this.cv.CV_32FC2, [
        0,        0,
        maxWidth, 0,
        maxWidth, maxHeight,
        0,        maxHeight,
      ]);

      M   = this.cv.getPerspectiveTransform(srcTri, dstTri);
      dst = new this.cv.Mat();
      this.cv.warpPerspective(
        src, dst, M,
        new this.cv.Size(maxWidth, maxHeight),
        this.cv.INTER_LINEAR,
        this.cv.BORDER_REPLICATE  // replicate edge pixels instead of filling black
      );

      // ── Export to Data URL ────────────────────────────────────────────────
      const outCanvas = document.createElement('canvas');
      this.cv.imshow(outCanvas, dst);
      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.92);

      // ── Quality metrics ───────────────────────────────────────────────────
      gray = new this.cv.Mat();
      this.cv.cvtColor(dst, gray, this.cv.COLOR_RGBA2GRAY);

      // Sharpness: variance of Laplacian
      lap = new this.cv.Mat();
      this.cv.Laplacian(gray, lap, this.cv.CV_64F);
      mean   = new this.cv.Mat();
      stddev = new this.cv.Mat();
      this.cv.meanStdDev(lap, mean, stddev);
      const sharpness = Math.pow(stddev.doubleAt(0, 0), 2);

      // Brightness: mean grey value normalised to [0, 1]
      meanB = new this.cv.Mat();
      stdB  = new this.cv.Mat();
      this.cv.meanStdDev(gray, meanB, stdB);
      const brightness = meanB.doubleAt(0, 0) / 255;

      result = { dataUrl, quality: { sharpness, brightness } };

    } catch (err) {
      console.error('[ImageProcessor] error:', err);
    } finally {
      const del = (m) => { try { if (m && !m.isDeleted()) m.delete(); } catch(e){} };
      del(src); del(dst); del(srcTri); del(dstTri); del(M);
      del(gray); del(lap); del(mean); del(stddev); del(meanB); del(stdB);
    }

    return result;
  }
}

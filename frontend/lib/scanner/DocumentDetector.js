export class DocumentDetector {
  constructor(cv) {
    this.cv = cv;
    this.processWidth = 640;
    this.processHeight = 0; 
    
    this.src = new cv.Mat();
    this.gray = new cv.Mat();
    this.blur = new cv.Mat();
    this.edges = new cv.Mat();
    this.hull = new cv.Mat();
    this.approx = new cv.Mat();
    this.bestApprox = new cv.Mat();
    this.ksize = new cv.Size(5, 5);

    // Temporal smoothing: keep a small ring buffer of recent detections
    // to avoid flickering when the contour is borderline.
    this.historySize = 5;
    this.geometryHistory = [];
    this.lastGoodGeometry = null;
  }

  // Add cleanup method to be called on unmount
  cleanup() {
    const safeDelete = (mat) => {
      if (mat && !mat.isDeleted) {
        try { mat.delete(); } catch(e) {}
      }
    };
    safeDelete(this.src);
    safeDelete(this.gray);
    safeDelete(this.blur);
    safeDelete(this.edges);
    safeDelete(this.hull); // ADDED HULL
    safeDelete(this.approx);
    safeDelete(this.bestApprox);
  }

  /**
   * Processes a video frame to find the largest document-like quadrilateral.
   * @param {HTMLVideoElement} videoElement - The source video element.
   * @param {HTMLCanvasElement} canvasElement - A hidden canvas to use for drawing/processing.
   * @returns {Object|null} The detected geometry or null if not found.
   */
  detect(videoElement, canvasElement) {
    console.count("DETECT");
    if (!this.cv || !videoElement || videoElement.videoWidth === 0) return null;

    const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
    
    if (this.processHeight === 0) {
      this.processHeight = Math.floor(videoElement.videoHeight * (this.processWidth / videoElement.videoWidth));
      this.src.create(this.processHeight, this.processWidth, this.cv.CV_8UC4);
    }
    
    // Only set canvas dimensions if they changed to prevent backing store reallocation
    if (canvasElement.width !== this.processWidth) {
      canvasElement.width = this.processWidth;
    }
    if (canvasElement.height !== this.processHeight) {
      canvasElement.height = this.processHeight;
    }
    
    ctx.drawImage(videoElement, 0, 0, this.processWidth, this.processHeight);

    let result = null;
    
    // MatVector and hierarchy are known to leak if reused across findContours in OpenCV.js,
    // so we create and delete them locally every frame.
    let contours = new this.cv.MatVector();
    let hierarchy = new this.cv.Mat();

    try {
      // Copy pixel data directly into pre-allocated src Mat
      let imageData = ctx.getImageData(0, 0, this.processWidth, this.processHeight);
      this.src.data.set(imageData.data);

      this.cv.cvtColor(this.src, this.gray, this.cv.COLOR_RGBA2GRAY);
      this.cv.GaussianBlur(this.gray, this.blur, this.ksize, 0, 0, this.cv.BORDER_DEFAULT);
      
      // Lower Canny thresholds for darker environments
      this.cv.Canny(this.blur, this.edges, 40, 120, 3, false);
      
      // DILATE edges: This is a crucial trick for document scanners. It closes small gaps 
      // in the edge map so findContours can form a complete closed polygon even if the paper is textured or lighting is bad.
      let M = this.cv.Mat.ones(3, 3, this.cv.CV_8U);
      this.cv.dilate(this.edges, this.edges, M, new this.cv.Point(-1, -1), 1, this.cv.BORDER_CONSTANT, this.cv.morphologyDefaultBorderValue());
      M.delete();

      this.cv.findContours(this.edges, contours, hierarchy, this.cv.RETR_LIST, this.cv.CHAIN_APPROX_SIMPLE);

      let maxArea = 0;
      const minArea = (this.processWidth * this.processHeight) * 0.05;
      let bestApprox = null; // local per-frame, not reused

      for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = this.cv.contourArea(cnt);

        if (area > minArea && area > maxArea) {
          // Stretch a "rubber band" around the contour to ignore torn edges
          let hull = new this.cv.Mat();
          this.cv.convexHull(cnt, hull, false, true);

          // Approximate the convex hull to a polygon
          let approx = new this.cv.Mat();
          let peri = this.cv.arcLength(hull, true);
          this.cv.approxPolyDP(hull, approx, 0.05 * peri, true);

          hull.delete(); // hull no longer needed

          if (approx.rows === 4) {
            maxArea = area;
            if (bestApprox) bestApprox.delete(); // free previous best
            bestApprox = approx; // take ownership
          } else {
            approx.delete();
          }
        }
        cnt.delete();
      }

      if (bestApprox && bestApprox.rows === 4) {
        // Extract corners from the 4-row approx mat
        const corners = [];
        for (let i = 0; i < 4; i++) {
          corners.push({
            x: bestApprox.data32S[i * 2],
            y: bestApprox.data32S[i * 2 + 1]
          });
        }
        bestApprox.delete();
        
        const center = corners.reduce((acc, val) => ({ x: acc.x + val.x, y: acc.y + val.y }), { x: 0, y: 0 });
        center.x /= 4;
        center.y /= 4;

        const frameArea = this.processWidth * this.processHeight;
        const areaRatio = maxArea / frameArea;
        
        const dx = corners[1].x - corners[0].x;
        const dy = corners[1].y - corners[0].y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        result = {
          corners,
          center,
          areaRatio,
          angle,
          processWidth: this.processWidth,
          processHeight: this.processHeight
        };
      }

      // --- Temporal smoothing ---
      // Push raw result into history buffer
      this.geometryHistory.push(result !== null);
      if (this.geometryHistory.length > this.historySize) {
        this.geometryHistory.shift();
      }

      // Count how many of the last N frames had a positive detection
      const positives = this.geometryHistory.filter(Boolean).length;

      if (result !== null) {
        this.lastGoodGeometry = result; // Always keep the latest good geometry
      }

      // Only report detection if majority of recent frames were positive
      // This stops the teal box from flickering
      if (positives >= Math.ceil(this.historySize / 2)) {
        return this.lastGoodGeometry;
      }

      return null;

    } catch (err) {
      console.error("OpenCV detection error:", err);
    } finally {
      const safeDelete = (mat) => {
        if (mat && !mat.isDeleted) {
          try { mat.delete(); } catch(e) {}
        }
      };
      safeDelete(contours);
      safeDelete(hierarchy);
    }

    return null;
  }
}

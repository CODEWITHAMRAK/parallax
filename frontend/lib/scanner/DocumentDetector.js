export class DocumentDetector {
  constructor(cv) {
    this.cv = cv;
    this.processWidth = 640; // Increased resolution for much better edge detection
    this.processHeight = 0; 
    
    // We only pre-allocate the source matrix to avoid copying image data heavily
    this.src = new cv.Mat();
    this.gray = new cv.Mat();
    this.blur = new cv.Mat();
    this.edges = new cv.Mat();
    this.approx = new cv.Mat();
    this.bestApprox = new cv.Mat();
    this.ksize = new cv.Size(5, 5);
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
      let bestCorners = null;

      for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = this.cv.contourArea(cnt);

        if (area > minArea && area > maxArea) {
          let rect = this.cv.minAreaRect(cnt);
          let rectArea = rect.size.width * rect.size.height;
          
          // Ensure the contour actually fills most of its bounding box (filters out hands/wires)
          if (rectArea > 0 && (area / rectArea) > 0.4) {
            maxArea = area;
            
            // Manually calculate 4 corners of the RotatedRect (cv.RotatedRect.points is missing in JS bindings)
            let cx = rect.center.x;
            let cy = rect.center.y;
            let w = rect.size.width / 2;
            let h = rect.size.height / 2;
            let angle = (rect.angle * Math.PI) / 180.0;
            let cosA = Math.cos(angle);
            let sinA = Math.sin(angle);

            bestCorners = [
              { x: cx + (-w)*cosA - (-h)*sinA, y: cy + (-w)*sinA + (-h)*cosA },
              { x: cx + (w)*cosA - (-h)*sinA,  y: cy + (w)*sinA + (-h)*cosA },
              { x: cx + (w)*cosA - (h)*sinA,   y: cy + (w)*sinA + (h)*cosA },
              { x: cx + (-w)*cosA - (h)*sinA,  y: cy + (-w)*sinA + (h)*cosA }
            ];
          }
        }
        cnt.delete();
      }

      if (bestCorners) {
        const corners = bestCorners;
        
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

    } catch (err) {
      console.error("OpenCV detection error:", err);
    } finally {
      // GUARANTEED CLEANUP to prevent WASM memory leaks for frame-specific mats
      const safeDelete = (mat) => {
        if (mat && !mat.isDeleted) {
          try { mat.delete(); } catch(e) {}
        }
      };
      safeDelete(contours);
      safeDelete(hierarchy);
    }

    return result;
  }
}

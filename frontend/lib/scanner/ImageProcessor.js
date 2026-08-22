export class ImageProcessor {
  constructor(cv) {
    this.cv = cv;
  }

  /**
   * Warps the document into a flat rectangle and calculates quality metrics.
   * @param {HTMLVideoElement} videoElement - The high-res source video.
   * @param {Object} geometry - The geometry from DocumentDetector.
   * @returns {Object} { dataUrl, quality: { sharpness, brightness } }
   */
  process(videoElement, geometry) {
    if (!this.cv || !videoElement || !geometry) return null;

    // Create a temporary canvas for the full resolution frame
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    let src = this.cv.imread(canvas);
    let dst = new this.cv.Mat();
    let result = null;

    try {
      // Scale geometry corners from process resolution to full resolution
      const scaleX = canvas.width / geometry.processWidth;
      const scaleY = canvas.height / geometry.processHeight;

      const corners = geometry.corners.map(c => ({
        x: c.x * scaleX,
        y: c.y * scaleY
      }));

      // Order corners: top-left, top-right, bottom-right, bottom-left
      // A simple sorting approach based on x+y and x-y
      corners.sort((a, b) => (a.y + a.x) - (b.y + b.x));
      const tl = corners[0];
      const br = corners[3];
      const remaining = [corners[1], corners[2]].sort((a, b) => a.x - b.x);
      const tr = remaining[1];
      const bl = remaining[0];

      // Calculate width and height of the new document
      const widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
      const widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
      const maxWidth = Math.max(Math.floor(widthA), Math.floor(widthB));

      const heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
      const heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
      const maxHeight = Math.max(Math.floor(heightA), Math.floor(heightB));

      let srcTri = this.cv.matFromArray(4, 1, this.cv.CV_32FC2, [
        tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
      ]);
      
      let dstTri = this.cv.matFromArray(4, 1, this.cv.CV_32FC2, [
        0, 0, maxWidth, 0, maxWidth, maxHeight, 0, maxHeight
      ]);

      let M = this.cv.getPerspectiveTransform(srcTri, dstTri);
      let dsize = new this.cv.Size(maxWidth, maxHeight);
      
      this.cv.warpPerspective(src, dst, M, dsize, this.cv.INTER_LINEAR, this.cv.BORDER_CONSTANT, new this.cv.Scalar());

      // Draw the flattened document to a new canvas to get Data URL
      const outCanvas = document.createElement('canvas');
      this.cv.imshow(outCanvas, dst);
      const dataUrl = outCanvas.toDataURL('image/jpeg', 0.9);

      // --- Quality Metrics ---
      // 1. Sharpness (Variance of Laplacian)
      let gray = new this.cv.Mat();
      this.cv.cvtColor(dst, gray, this.cv.COLOR_RGBA2GRAY);
      
      let laplacian = new this.cv.Mat();
      this.cv.Laplacian(gray, laplacian, this.cv.CV_64F, 1, 1, 0, this.cv.BORDER_DEFAULT);
      
      let mean = new this.cv.Mat();
      let stddev = new this.cv.Mat();
      this.cv.meanStdDev(laplacian, mean, stddev);
      
      const sharpness = Math.pow(stddev.doubleAt(0, 0), 2);
      
      // 2. Brightness (Mean pixel value)
      let meanBrightness = new this.cv.Mat();
      let stddevBrightness = new this.cv.Mat();
      this.cv.meanStdDev(gray, meanBrightness, stddevBrightness);
      const brightness = meanBrightness.doubleAt(0, 0) / 255.0; // Normalized 0-1

      result = {
        dataUrl,
        quality: {
          sharpness,
          brightness
        }
      };

      // Cleanup
      srcTri.delete();
      dstTri.delete();
      M.delete();
      gray.delete();
      laplacian.delete();
      mean.delete();
      stddev.delete();
      meanBrightness.delete();
      stddevBrightness.delete();

    } catch (err) {
      console.error("OpenCV ImageProcessing error:", err);
    } finally {
      src.delete();
      dst.delete();
    }

    return result;
  }
}

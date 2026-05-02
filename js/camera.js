/**
 * camera.js
 * WebRTC camera management module.
 */

const CameraModule = (() => {
  let stream = null;

  /** Start camera stream and attach to video element */
  async function start(videoEl) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play();
      return true;
    } catch (err) {
      // Fallback to any camera
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoEl.srcObject = stream;
        await videoEl.play();
        return true;
      } catch (e) {
        console.error('Camera error:', e);
        return false;
      }
    }
  }

  /** Stop all camera tracks */
  function stop() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  /**
   * Capture current video frame to a canvas.
   * Returns the canvas element.
   */
  function capture(videoEl, outputCanvas) {
    outputCanvas.width  = videoEl.videoWidth  || 640;
    outputCanvas.height = videoEl.videoHeight || 480;
    const ctx = outputCanvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, outputCanvas.width, outputCanvas.height);
    return outputCanvas;
  }

  function isActive() { return stream !== null; }

  return { start, stop, capture, isActive };
})();

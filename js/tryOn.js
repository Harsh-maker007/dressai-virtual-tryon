/**
 * tryOn.js — Browser-native AI Try-On
 * Uses @gradio/client directly from the browser to call HuggingFace IDM-VTON.
 * No backend server needed — fully deployable to Vercel.
 */

const TryOnEngine = (() => {

  const HF_SPACES = [
    "Nymbo/Virtual-Try-On",
    "yisol/IDM-VTON",
  ];

  /* ─── helpers ─────────────────────────────────────────── */

  function drawFit(imgEl, canvas) {
    const aspect = imgEl.naturalWidth / imgEl.naturalHeight;
    const W = canvas.width, H = canvas.height;
    let dw = W, dh = H;
    if (aspect > W / H) dh = W / aspect; else dw = H * aspect;
    const dx = (W - dw) / 2, dy = (H - dh) / 2;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(imgEl, dx, dy, dw, dh);
  }

  function canvasToBlob(canvas, quality = 0.92) {
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
  }

  function imageElToCanvas(imgEl) {
    const c = document.createElement('canvas');
    c.width = imgEl.naturalWidth || 512;
    c.height = imgEl.naturalHeight || 512;
    c.getContext('2d').drawImage(imgEl, 0, 0);
    return c;
  }

  function resizeCanvas(src, targetH = 768) {
    const ratio = targetH / src.height;
    const dst = document.createElement('canvas');
    dst.width = Math.round(src.width * ratio);
    dst.height = targetH;
    dst.getContext('2d').drawImage(src, 0, 0, dst.width, dst.height);
    return dst;
  }

  function loadImageFromUrl(url) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = url;
    });
  }

  /* ─── AI via Gradio JS client (browser-native) ────────── */

  async function callGradio(personBlob, dressBlob, onStatus) {
    // Dynamically import @gradio/client (ES module from CDN)
    let Client;
    try {
      const mod = await import("https://esm.run/@gradio/client");
      Client = mod.Client;
    } catch (e) {
      throw new Error("Could not load Gradio client: " + e.message);
    }

    let lastErr;
    for (const space of HF_SPACES) {
      try {
        if (onStatus) onStatus(`Connecting to HuggingFace: ${space}…`);
        const client = await Client.connect(space);

        if (onStatus) onStatus('🤖 AI is generating your try-on… (30–90s)');
        const result = await client.predict("/tryon", {
          dict: { background: personBlob, layers: [], composite: null },
          garm_img: dressBlob,
          garment_des: "dress",
          is_checked: true,
          is_checked_crop: false,
          denoise_steps: 30,
          seed: 42,
        });

        // result.data[0] is the output image URL
        const outputUrl = result.data[0]?.url || result.data[0];
        console.log("[TryOn] AI result URL:", outputUrl);
        return outputUrl;

      } catch (e) {
        console.warn(`[TryOn] ${space} failed:`, e);
        lastErr = e;
        if (onStatus) onStatus(`Space busy, trying next…`);
      }
    }
    throw new Error("All HF spaces failed: " + lastErr?.message);
  }

  /* ─── canvas fallback ──────────────────────────────────── */

  function hexToRgb(hex) {
    return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
  }

  function applyCanvasFallback(userImg, dressHex, dressCanvas, outputCanvas) {
    const W = outputCanvas.width, H = outputCanvas.height;
    const ctx = outputCanvas.getContext('2d');
    drawFit(userImg, outputCanvas);

    const tx = W * 0.2, ty = H * 0.24, tw = W * 0.6, th = H * 0.42;

    // Clip to torso shape
    const ov = document.createElement('canvas');
    ov.width = W; ov.height = H;
    const oc = ov.getContext('2d');
    oc.save();
    oc.beginPath();
    oc.moveTo(tx + tw*.1, ty);
    oc.lineTo(tx + tw*.9, ty);
    oc.quadraticCurveTo(tx+tw, ty, tx+tw, ty+th*.1);
    oc.lineTo(tx+tw, ty+th*.85);
    oc.quadraticCurveTo(tx+tw, ty+th, tx+tw*.85, ty+th);
    oc.lineTo(tx+tw*.15, ty+th);
    oc.quadraticCurveTo(tx, ty+th, tx, ty+th*.85);
    oc.lineTo(tx, ty+th*.1);
    oc.quadraticCurveTo(tx, ty, tx+tw*.1, ty);
    oc.closePath();
    oc.clip();
    if (dressCanvas?.width > 0) {
      oc.globalAlpha = 0.80;
      oc.drawImage(dressCanvas, tx, ty, tw, th);
    } else {
      const {r,g,b} = hexToRgb(dressHex);
      oc.fillStyle = `rgba(${r},${g},${b},0.8)`;
      oc.fillRect(tx, ty, tw, th);
    }
    oc.restore();

    // Blend
    const od = oc.getImageData(0,0,W,H);
    const md = ctx.getImageData(0,0,W,H);
    const out = ctx.createImageData(W,H);
    const {r:dr,g:dg,b:db} = hexToRgb(dressHex);
    for (let i=0;i<md.data.length;i+=4) {
      const a = od.data[i+3]; const oa = 1 - (a/255)*0.75;
      out.data[i]   = a<10 ? md.data[i]   : Math.round(md.data[i]  *oa + (od.data[i]  *.55+dr*.45)*(1-oa));
      out.data[i+1] = a<10 ? md.data[i+1] : Math.round(md.data[i+1]*oa + (od.data[i+1]*.55+dg*.45)*(1-oa));
      out.data[i+2] = a<10 ? md.data[i+2] : Math.round(md.data[i+2]*oa + (od.data[i+2]*.55+db*.45)*(1-oa));
      out.data[i+3] = md.data[i+3];
    }
    ctx.putImageData(out, 0, 0);
  }

  /* ─── public API ───────────────────────────────────────── */

  async function applyTryOn(userImg, dressHex, dressCanvas, outputCanvas, onStatus) {
    const W = outputCanvas.width, H = outputCanvas.height;
    const ctx = outputCanvas.getContext('2d');

    try {
      // Prepare person canvas (resized for speed)
      const personCanvas = resizeCanvas(imageElToCanvas(userImg), 768);
      const dressResized = resizeCanvas(dressCanvas, 768);

      const personBlob = await canvasToBlob(personCanvas);
      const dressBlob  = await canvasToBlob(dressResized);

      const resultUrl = await callGradio(personBlob, dressBlob, onStatus);

      if (onStatus) onStatus('Loading result image…');
      const resultImg = await loadImageFromUrl(resultUrl);

      // Draw AI result
      ctx.clearRect(0, 0, W, H);
      const a = resultImg.naturalWidth / resultImg.naturalHeight;
      let dw = W, dh = H;
      if (a > W/H) dh = W/a; else dw = H*a;
      ctx.drawImage(resultImg, (W-dw)/2, (H-dh)/2, dw, dh);
      return 'ai';

    } catch (err) {
      console.warn('[TryOn] AI failed, using canvas fallback:', err.message);
      if (onStatus) onStatus('Using quick preview…');
      drawFit(userImg, outputCanvas);
      applyCanvasFallback(userImg, dressHex, dressCanvas, outputCanvas);
      return 'canvas';
    }
  }

  function drawOriginal(userImg, canvas) {
    drawFit(userImg, canvas);
  }

  return { applyTryOn, drawOriginal };
})();

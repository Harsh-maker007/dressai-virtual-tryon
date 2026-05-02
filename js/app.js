/**
 * app.js
 * Main application orchestrator for DressAI Virtual Try-On Studio.
 */

// ===================== STATE =====================
const State = {
  userImg: null,          // HTMLImageElement of uploaded photo
  skinData: null,         // { hex, toneName, undertone, bestColors, avoidColors }
  dressCanvas: null,      // Canvas with captured dress frame
  dressColor: null,       // { hex, name, rgb, palette }
  recommendation: null,   // Full recommendation object
  currentStep: 1,
};

// ===================== NAVIGATION =====================
function scrollToApp() {
  document.getElementById('app-section').scrollIntoView({ behavior: 'smooth' });
}

function goToStep(n) {
  if (n === 2 && !State.userImg) { showToast('Please upload your photo first'); return; }
  if (n === 3 && !State.dressCanvas) { showToast('Please capture a dress first'); return; }
  if (n === 4 && !State.recommendation) { showToast('Please generate the try-on first'); return; }

  // Update panels
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${n}`).classList.add('active');

  // Update step indicators
  document.querySelectorAll('.step-item').forEach((si, idx) => {
    si.classList.remove('active', 'done');
    if (idx + 1 < n) si.classList.add('done');
    if (idx + 1 === n) si.classList.add('active');
  });
  document.querySelectorAll('.step-line').forEach((sl, idx) => {
    sl.classList.toggle('done', idx + 1 < n);
  });

  State.currentStep = n;
  window.scrollTo({ top: document.getElementById('app-section').offsetTop - 80, behavior: 'smooth' });
}

// ===================== STEP 1: PHOTO UPLOAD =====================
function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('upload-zone').style.borderColor = 'var(--accent)';
}

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('upload-zone').style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadPhoto(file);
}

function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (file) loadPhoto(file);
}

function loadPhoto(file) {
  if (file.size > 10 * 1024 * 1024) { showToast('File too large. Max 10MB.'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      State.userImg = img;
      renderPhotoPreview(img);
      analyzeSkin(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderPhotoPreview(img) {
  const canvas = document.getElementById('photo-preview-canvas');
  const zone = document.getElementById('upload-zone');
  const idle = document.getElementById('upload-idle');

  // Fit image into upload zone
  const maxW = zone.clientWidth || 400;
  const maxH = 320;
  const aspect = img.naturalWidth / img.naturalHeight;
  let w = maxW, h = maxW / aspect;
  if (h > maxH) { h = maxH; w = h * aspect; }

  canvas.width = Math.round(w);
  canvas.height = Math.round(h);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  canvas.classList.remove('hidden');
  idle.style.display = 'none';
}

function analyzeSkin(img) {
  // Show loading state
  document.getElementById('analysis-placeholder').innerHTML =
    '<div class="loading-spinner" style="width:36px;height:36px;margin:1rem auto"></div><p>Analyzing skin tone…</p>';

  setTimeout(() => {
    try {
      State.skinData = ColorAnalyzer.analyzeSkinTone(img);
      renderSkinResult(State.skinData);
      document.getElementById('btn-step1-next').disabled = false;
    } catch(e) {
      document.getElementById('analysis-placeholder').innerHTML =
        '<div class="placeholder-emoji">⚠️</div><p>Could not analyze — using defaults</p>';
      // Use a default
      State.skinData = {
        hex: '#C68642', toneName: 'Medium', undertone: 'Warm',
        bestColors: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#8b4513','#d4ac0d'],
        avoidColors: ['#3498db','#9b59b6','#1a237e'],
      };
      renderSkinResult(State.skinData);
      document.getElementById('btn-step1-next').disabled = false;
    }
  }, 600);
}

function renderSkinResult(data) {
  document.getElementById('analysis-placeholder').classList.add('hidden');
  const result = document.getElementById('skin-result');
  result.classList.remove('hidden');

  document.getElementById('skin-swatch').style.background = data.hex;
  document.getElementById('skin-tone-name').textContent = data.toneName + ' Skin Tone';
  document.getElementById('skin-undertone').textContent = 'Undertone: ' + data.undertone;

  renderPalette('best-palette', data.bestColors);
  renderPalette('avoid-palette', data.avoidColors);
}

// ===================== STEP 2: CAMERA =====================
async function startCamera() {
  const videoEl = document.getElementById('camera-feed');
  const ok = await CameraModule.start(videoEl);
  if (ok) {
    document.getElementById('camera-off').style.display = 'none';
    document.getElementById('camera-live').style.display = 'block';
    document.getElementById('camera-btn-row').style.display = 'flex';
  } else {
    showToast('Could not access camera. Please allow camera permissions.');
  }
}

function stopCamera() {
  CameraModule.stop();
  document.getElementById('camera-live').style.display = 'none';
  document.getElementById('camera-off').style.display = 'flex';
  document.getElementById('camera-btn-row').style.display = 'none';
}

function captureDress() {
  if (!CameraModule.isActive()) { showToast('Enable camera first'); return; }

  const videoEl = document.getElementById('camera-feed');
  const buffer  = document.getElementById('capture-buffer');
  CameraModule.capture(videoEl, buffer);

  // Flash animation
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:white;opacity:0.5;z-index:9999;pointer-events:none;transition:opacity .4s';
  document.body.appendChild(flash);
  setTimeout(() => { flash.style.opacity = '0'; setTimeout(() => flash.remove(), 400); }, 100);

  // Extract dress color
  State.dressCanvas = buffer;
  State.dressColor  = ColorAnalyzer.extractDressColor(buffer);

  renderDressCapture(buffer, State.dressColor);
  stopCamera();
  document.getElementById('btn-step2-next').disabled = false;
  showToast('Dress captured! 👗');
}

function renderDressCapture(canvas, colorData) {
  document.getElementById('dress-placeholder').classList.add('hidden');
  const result = document.getElementById('capture-result');
  result.classList.remove('hidden');

  // Draw thumbnail
  const thumb = document.getElementById('dress-thumb-canvas');
  const maxW = 280, aspect = canvas.width / canvas.height;
  thumb.width = maxW;
  thumb.height = Math.round(maxW / aspect);
  thumb.getContext('2d').drawImage(canvas, 0, 0, thumb.width, thumb.height);

  document.getElementById('dress-color-swatch').style.background = colorData.hex;
  document.getElementById('dress-color-name').textContent = colorData.name;
  document.getElementById('dress-color-hex').textContent = colorData.hex.toUpperCase();

  renderPalette('dress-palette-dots', colorData.palette);
}

function retakeCapture() {
  State.dressCanvas = null;
  State.dressColor  = null;
  document.getElementById('capture-result').classList.add('hidden');
  document.getElementById('dress-placeholder').classList.remove('hidden');
  document.getElementById('btn-step2-next').disabled = true;
  startCamera();
}

// ===================== STEP 3: TRY-ON =====================
async function generateTryOn() {
  if (!State.userImg || !State.dressCanvas) return;
  goToStep(3);

  const origCanvas   = document.getElementById('original-canvas');
  const resultCanvas = document.getElementById('result-canvas');
  const loading      = document.getElementById('tryon-loading');
  const statusEl     = document.getElementById('tryon-status');

  const H = 512;
  const W = Math.round(H * (State.userImg.naturalWidth / State.userImg.naturalHeight));
  origCanvas.width   = resultCanvas.width  = Math.max(W, 360);
  origCanvas.height  = resultCanvas.height = H;

  loading.classList.remove('hidden');
  TryOnEngine.drawOriginal(State.userImg, origCanvas);

  const mode = await TryOnEngine.applyTryOn(
    State.userImg,
    State.dressColor.hex,
    State.dressCanvas,
    resultCanvas,
    (msg) => { if (statusEl) statusEl.textContent = msg; }
  );

  loading.classList.add('hidden');

  // Show badge under the result
  const wrap = document.querySelector('.tryon-card.tryon-featured');
  const oldBadge = wrap && wrap.querySelector('.ai-badge, .fallback-badge');
  if (oldBadge) oldBadge.remove();
  if (wrap) {
    const badge = document.createElement('div');
    if (mode === 'ai') {
      badge.className = 'ai-badge';
      badge.innerHTML = '✅ Real AI Try-On — IDM-VTON';
      showToast('✨ AI Try-On complete! This is you in the dress.');
    } else {
      badge.className = 'fallback-badge';
      badge.innerHTML = '⚠️ Preview mode — <strong>start server.py</strong> for real AI';
      showToast('⚠️ AI server offline — start server.py for real try-on.');
    }
    wrap.appendChild(badge);
  }

  State.recommendation = Recommender.recommend(
    State.skinData.hex,
    State.skinData.undertone,
    State.dressColor.hex,
    State.dressColor.name,
  );

  const verdict = State.recommendation.verdict;
  document.getElementById('qs-score-val').textContent   = State.recommendation.score + '%';
  document.getElementById('qs-tone-val').textContent    = State.skinData.undertone;
  document.getElementById('qs-verdict-val').textContent = verdict.text;
}

// ===================== STEP 4: RECOMMENDATIONS =====================
function renderRecommendations() {
  if (!State.recommendation) return;
  const rec = State.recommendation;

  // Animate score ring
  const arc = document.getElementById('score-arc');
  const circumference = 314;
  const offset = circumference - (rec.score / 100) * circumference;
  arc.style.transition = 'stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)';
  arc.style.strokeDashoffset = offset;
  document.getElementById('rec-score-num').textContent = rec.score;

  // Verdict badge
  const badge = document.getElementById('verdict-badge');
  badge.textContent = rec.verdict.text;
  badge.className = 'verdict-badge ' + rec.verdict.cls;

  // Skin & dress swatches
  document.getElementById('rec-skin-swatch').style.background = State.skinData.hex;
  document.getElementById('rec-skin-name').textContent = State.skinData.toneName;
  document.getElementById('rec-undertone-text').textContent = 'Undertone: ' + State.skinData.undertone;

  document.getElementById('rec-dress-swatch').style.background = State.dressColor.hex;
  document.getElementById('rec-dress-color-name').textContent = State.dressColor.name;
  document.getElementById('rec-dress-hex').textContent = State.dressColor.hex.toUpperCase();

  // Texts
  document.getElementById('rec-harmony-text').textContent = rec.harmony;
  document.getElementById('rec-advice-text').textContent  = rec.advice;

  // Palettes
  renderPalette('rec-best-palette', rec.bestColors);
  renderPalette('rec-avoid-palette', rec.avoidColors);
}

// Override goToStep to trigger rec rendering on step 4
const _origGoToStep = goToStep;
window.goToStep = function(n) {
  _origGoToStep(n);
  if (n === 4) setTimeout(renderRecommendations, 100);
};

// ===================== UTILITIES =====================
function renderPalette(containerId, colors) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  (colors || []).forEach(hex => {
    const dot = document.createElement('div');
    dot.className = 'palette-dot';
    dot.style.background = hex;
    dot.title = ColorAnalyzer.getColorName(...Object.values(ColorAnalyzer.hexToRgb(hex)));
    el.appendChild(dot);
  });
}

function showToast(msg) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
    background:rgba(20,20,50,0.95);border:1px solid rgba(255,255,255,0.12);
    color:#fff;border-radius:50px;padding:.65rem 1.5rem;font-size:.9rem;
    z-index:9999;animation:fadeIn .3s ease;backdrop-filter:blur(16px);
    box-shadow:0 8px 24px rgba(0,0,0,0.4);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadResult() {
  const canvas = document.getElementById('result-canvas');
  if (!canvas || canvas.width === 0) { showToast('No result to download yet'); return; }
  const link = document.createElement('a');
  link.download = 'dressai-tryon.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function resetAll() {
  State.userImg = State.skinData = State.dressCanvas = State.dressColor = State.recommendation = null;

  // Reset upload zone
  document.getElementById('photo-preview-canvas').classList.add('hidden');
  document.getElementById('upload-idle').style.display = 'flex';
  document.getElementById('photo-input').value = '';
  document.getElementById('skin-result').classList.add('hidden');
  document.getElementById('analysis-placeholder').classList.remove('hidden');
  document.getElementById('analysis-placeholder').innerHTML =
    '<div class="placeholder-emoji">👤</div><p>Upload your photo to detect skin tone</p>';
  document.getElementById('btn-step1-next').disabled = true;

  // Reset dress
  document.getElementById('capture-result').classList.add('hidden');
  document.getElementById('dress-placeholder').classList.remove('hidden');
  document.getElementById('btn-step2-next').disabled = true;

  // Reset score arc
  const arc = document.getElementById('score-arc');
  if (arc) { arc.style.transition = 'none'; arc.style.strokeDashoffset = 314; }

  stopCamera();
  goToStep(1);
  showToast('Ready for a new try-on! 🎭');
}

// ===================== NAV SCROLL EFFECT =====================
window.addEventListener('scroll', () => {
  const nav = document.getElementById('main-nav');
  nav.style.background = window.scrollY > 40
    ? 'rgba(8,8,26,0.92)'
    : 'rgba(8,8,26,0.7)';
});

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
  // Stagger how-cards entrance
  const cards = document.querySelectorAll('.how-card');
  cards.forEach((c, i) => {
    c.style.opacity = '0';
    c.style.transform = 'translateY(24px)';
    c.style.transition = `opacity .5s ${i*0.15}s, transform .5s ${i*0.15}s`;
  });
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
      }
    });
  }, { threshold: 0.2 });
  cards.forEach(c => io.observe(c));
});

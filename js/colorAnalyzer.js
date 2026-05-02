/**
 * colorAnalyzer.js
 * Extracts dominant colors from images/canvas frames.
 * Detects skin tone and undertone from a photo.
 */

const ColorAnalyzer = (() => {

  // Named colors for mapping hex → name
  const COLOR_NAMES = [
    { name: 'Red', hex: '#e74c3c', h: [0,15] },
    { name: 'Crimson', hex: '#c0392b', h: [350,360] },
    { name: 'Orange', hex: '#e67e22', h: [20,40] },
    { name: 'Yellow', hex: '#f1c40f', h: [45,65] },
    { name: 'Yellow-Green', hex: '#d4ac0d', h: [65,80] },
    { name: 'Green', hex: '#2ecc71', h: [100,150] },
    { name: 'Teal', hex: '#1abc9c', h: [160,185] },
    { name: 'Cyan', hex: '#3498db', h: [185,210] },
    { name: 'Blue', hex: '#2980b9', h: [210,250] },
    { name: 'Indigo', hex: '#5b2c8e', h: [250,270] },
    { name: 'Purple', hex: '#9b59b6', h: [270,300] },
    { name: 'Magenta', hex: '#e91e8c', h: [300,330] },
    { name: 'Pink', hex: '#e84393', h: [330,350] },
    { name: 'White', hex: '#f0f0f0', s: [0,15], l: [85,100] },
    { name: 'Light Gray', hex: '#bdc3c7', s: [0,20], l: [65,85] },
    { name: 'Gray', hex: '#7f8c8d', s: [0,20], l: [40,65] },
    { name: 'Dark Gray', hex: '#2c3e50', s: [0,25], l: [15,40] },
    { name: 'Black', hex: '#1a1a2e', s: [0,30], l: [0,15] },
    { name: 'Beige', hex: '#f5cba7', h: [25,45], s: [50,90], l: [70,90] },
    { name: 'Brown', hex: '#8b4513', h: [15,35], s: [50,90], l: [15,40] },
    { name: 'Navy', hex: '#1a237e', h: [220,250], s: [50,100], l: [10,30] },
    { name: 'Maroon', hex: '#800000', h: [0,15], s: [70,100], l: [10,30] },
    { name: 'Olive', hex: '#808000', h: [55,75], s: [50,100], l: [15,40] },
  ];

  // Skin tone database
  const SKIN_TONES = [
    { name: 'Fair', undertone: 'Cool/Pink', hex: '#FDDBB4', rRange: [240,255], gRange: [190,220], bRange: [160,190] },
    { name: 'Fair', undertone: 'Warm/Peach', hex: '#FFCBA4', rRange: [240,255], gRange: [190,215], bRange: [140,170] },
    { name: 'Light', undertone: 'Neutral', hex: '#F5C5A3', rRange: [225,245], gRange: [175,200], bRange: [130,160] },
    { name: 'Light-Medium', undertone: 'Warm/Olive', hex: '#E8B88A', rRange: [210,235], gRange: [155,185], bRange: [100,140] },
    { name: 'Medium', undertone: 'Neutral-Warm', hex: '#D4956A', rRange: [190,220], gRange: [130,160], bRange: [80,110] },
    { name: 'Medium-Dark', undertone: 'Warm', hex: '#C68642', rRange: [170,205], gRange: [105,145], bRange: [40,80] },
    { name: 'Dark', undertone: 'Warm/Golden', hex: '#A0522D', rRange: [130,175], gRange: [65,110], bRange: [20,60] },
    { name: 'Deep', undertone: 'Neutral-Cool', hex: '#6B3A2A', rRange: [80,130], gRange: [35,75], bRange: [15,50] },
    { name: 'Very Deep', undertone: 'Cool', hex: '#3D1F14', rRange: [40,90], gRange: [15,50], bRange: [5,30] },
  ];

  // Best/avoid palettes per undertone
  const UNDERTONE_PALETTES = {
    'Cool/Pink': {
      best: ['#5b2c8e','#3498db','#1abc9c','#e91e8c','#2c3e50','#c0392b'],
      avoid: ['#e67e22','#f1c40f','#8b4513','#808000'],
    },
    'Warm/Peach': {
      best: ['#e67e22','#e74c3c','#f1c40f','#2ecc71','#8b4513','#d4ac0d'],
      avoid: ['#3498db','#9b59b6','#5b2c8e','#bdc3c7'],
    },
    'Neutral': {
      best: ['#2c3e50','#e74c3c','#2ecc71','#9b59b6','#e67e22','#3498db'],
      avoid: ['#f0f0f0','#7f8c8d'],
    },
    'Warm/Olive': {
      best: ['#2ecc71','#e74c3c','#f1c40f','#8b4513','#1abc9c','#e67e22'],
      avoid: ['#e91e8c','#9b59b6','#bdc3c7'],
    },
    'Neutral-Warm': {
      best: ['#e74c3c','#2ecc71','#e67e22','#3498db','#9b59b6','#2c3e50'],
      avoid: ['#f0f0f0','#7f8c8d'],
    },
    'Warm': {
      best: ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#8b4513','#d4ac0d'],
      avoid: ['#3498db','#9b59b6','#1a237e'],
    },
    'Warm/Golden': {
      best: ['#f1c40f','#e67e22','#e74c3c','#2ecc71','#d4ac0d','#8b4513'],
      avoid: ['#bdc3c7','#e91e8c','#9b59b6'],
    },
    'Neutral-Cool': {
      best: ['#2c3e50','#3498db','#1abc9c','#9b59b6','#e74c3c','#5b2c8e'],
      avoid: ['#f1c40f','#e67e22'],
    },
    'Cool': {
      best: ['#3498db','#9b59b6','#1abc9c','#e91e8c','#5b2c8e','#2c3e50'],
      avoid: ['#e67e22','#f1c40f','#808000'],
    },
  };

  /** Convert RGB to HSL */
  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h, s, l = (max+min)/2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h = ((g-b)/d + (g<b?6:0))/6; break;
        case g: h = ((b-r)/d + 2)/6; break;
        case b: h = ((r-g)/d + 4)/6; break;
      }
    }
    return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
  }

  /** Convert RGB to hex string */
  function rgbToHex(r, g, b) {
    return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
  }

  /** Sample pixels from canvas imageData, returns array of {r,g,b} */
  function samplePixels(imageData, step = 4) {
    const pixels = [];
    for (let i = 0; i < imageData.data.length; i += 4 * step) {
      const r = imageData.data[i];
      const g = imageData.data[i+1];
      const b = imageData.data[i+2];
      const a = imageData.data[i+3];
      if (a > 128) pixels.push({r, g, b});
    }
    return pixels;
  }

  /** Simple dominant color via averaging (fast) */
  function dominantColorFast(pixels) {
    if (!pixels.length) return {r:128,g:128,b:128};
    let r=0, g=0, b=0;
    pixels.forEach(p => { r+=p.r; g+=p.g; b+=p.b; });
    return { r: Math.round(r/pixels.length), g: Math.round(g/pixels.length), b: Math.round(b/pixels.length) };
  }

  /** k-means dominant color (k=3, returns top cluster) */
  function dominantColorKMeans(pixels, k = 3, iterations = 8) {
    if (pixels.length < k) return dominantColorFast(pixels);
    // Init centers randomly
    let centers = pixels.filter((_,i) => i % Math.floor(pixels.length/k) === 0).slice(0, k);
    if (centers.length < k) centers = pixels.slice(0, k);

    for (let iter = 0; iter < iterations; iter++) {
      const clusters = Array.from({length: k}, () => []);
      pixels.forEach(p => {
        let best = 0, bestDist = Infinity;
        centers.forEach((c, ci) => {
          const d = (p.r-c.r)**2 + (p.g-c.g)**2 + (p.b-c.b)**2;
          if (d < bestDist) { bestDist = d; best = ci; }
        });
        clusters[best].push(p);
      });
      centers = clusters.map(cl => cl.length ? dominantColorFast(cl) : {r:128,g:128,b:128});
    }

    // Return center of largest cluster
    const clusterSizes = centers.map((c, ci) => {
      return pixels.filter(p => {
        let best=0, bestDist=Infinity;
        centers.forEach((cc,cci) => {
          const d=(p.r-cc.r)**2+(p.g-cc.g)**2+(p.b-cc.b)**2;
          if(d<bestDist){bestDist=d;best=cci;}
        });
        return best === ci;
      }).length;
    });
    const bestIdx = clusterSizes.indexOf(Math.max(...clusterSizes));
    return centers[bestIdx];
  }

  /** Get color name from HSL */
  function getColorName(r, g, b) {
    const [h, s, l] = rgbToHsl(r, g, b);
    // Check neutrals first
    if (s < 15) {
      if (l > 85) return 'White';
      if (l > 65) return 'Light Gray';
      if (l > 40) return 'Gray';
      if (l > 15) return 'Dark Gray';
      return 'Black';
    }
    // Check named hue colors
    for (const c of COLOR_NAMES) {
      if (c.h) {
        const [lo,hi] = c.h;
        const inRange = lo <= hi ? (h >= lo && h <= hi) : (h >= lo || h <= hi);
        if (inRange) return c.name;
      }
    }
    return 'Custom';
  }

  /** Detect skin tone from image element */
  function analyzeSkinTone(imgEl) {
    const canvas = document.createElement('canvas');
    const SIZE = 200;
    canvas.width = SIZE; canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgEl, 0, 0, SIZE, SIZE);

    // Sample face region (top-center 40%x40%)
    const x0 = Math.floor(SIZE*0.25), y0 = Math.floor(SIZE*0.05);
    const w = Math.floor(SIZE*0.5), h = Math.floor(SIZE*0.45);
    const imgData = ctx.getImageData(x0, y0, w, h);
    const pixels = samplePixels(imgData, 2);

    // Filter skin-tone-like pixels (heuristic)
    const skinPixels = pixels.filter(p => {
      const [hh, ss, ll] = rgbToHsl(p.r, p.g, p.b);
      return p.r > p.b && p.r > p.g && ss > 10 && ss < 70 && ll > 20 && ll < 90
        && hh >= 0 && hh <= 50;
    });

    const src = skinPixels.length > 20 ? skinPixels : pixels;
    const dominant = dominantColorFast(src);

    // Find closest skin tone
    let best = SKIN_TONES[2];
    let bestDist = Infinity;
    SKIN_TONES.forEach(st => {
      const ref = hexToRgb(st.hex);
      const d = (dominant.r-ref.r)**2+(dominant.g-ref.g)**2+(dominant.b-ref.b)**2;
      if (d < bestDist) { bestDist = d; best = st; }
    });

    const palette = UNDERTONE_PALETTES[best.undertone] || UNDERTONE_PALETTES['Neutral'];
    return {
      hex: rgbToHex(dominant.r, dominant.g, dominant.b),
      toneName: best.name,
      undertone: best.undertone,
      bestColors: palette.best,
      avoidColors: palette.avoid,
    };
  }

  /** Extract dominant color from canvas (for dress capture) */
  function extractDressColor(canvas) {
    const ctx = canvas.getContext('2d');
    // Sample center 60% of frame (where dress is likely)
    const x0 = Math.floor(canvas.width*0.2);
    const y0 = Math.floor(canvas.height*0.1);
    const w = Math.floor(canvas.width*0.6);
    const h = Math.floor(canvas.height*0.8);
    const imgData = ctx.getImageData(x0, y0, w, h);
    const pixels = samplePixels(imgData, 3);

    // Filter out near-white (background store lighting)
    const filtered = pixels.filter(p => {
      const [,, l] = rgbToHsl(p.r, p.g, p.b);
      return l < 85 && l > 10;
    });

    const src = filtered.length > 30 ? filtered : pixels;
    const dominant = dominantColorKMeans(src, 4);

    // Extract top 5 palette colors via k-means
    const paletteColors = [];
    for (let k = 2; k <= 5; k++) {
      const c = dominantColorKMeans(src, k);
      paletteColors.push(rgbToHex(c.r, c.g, c.b));
    }

    const hex = rgbToHex(dominant.r, dominant.g, dominant.b);
    const name = getColorName(dominant.r, dominant.g, dominant.b);
    return { hex, name, rgb: dominant, palette: [...new Set(paletteColors)] };
  }

  /** Helper: hex string to {r,g,b} */
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return {r, g, b};
  }

  /** Compute hue difference (0–180) between two hex colors */
  function hueDiff(hex1, hex2) {
    const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2);
    const [h1] = rgbToHsl(c1.r, c1.g, c1.b);
    const [h2] = rgbToHsl(c2.r, c2.g, c2.b);
    const diff = Math.abs(h1 - h2);
    return Math.min(diff, 360 - diff);
  }

  return { analyzeSkinTone, extractDressColor, hexToRgb, rgbToHex, rgbToHsl, hueDiff, getColorName, UNDERTONE_PALETTES };
})();

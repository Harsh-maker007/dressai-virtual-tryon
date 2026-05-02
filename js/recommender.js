/**
 * recommender.js
 * Generates dress recommendations based on color harmony and skin tone analysis.
 */

const Recommender = (() => {

  /**
   * Calculate overall match score between skin tone and dress color.
   * Returns score 0–100.
   */
  function computeMatchScore(skinHex, dressHex) {
    const diff = ColorAnalyzer.hueDiff(skinHex, dressHex);
    const skinRgb = ColorAnalyzer.hexToRgb(skinHex);
    const dressRgb = ColorAnalyzer.hexToRgb(dressHex);
    const [, skinS, skinL] = ColorAnalyzer.rgbToHsl(skinRgb.r, skinRgb.g, skinRgb.b);
    const [, dressS, dressL] = ColorAnalyzer.rgbToHsl(dressRgb.r, dressRgb.g, dressRgb.b);

    // Harmony score based on hue relationship
    let harmonyScore;
    if (diff < 20)       harmonyScore = 55;  // too similar / monochromatic — okay
    else if (diff < 45)  harmonyScore = 70;  // analogous — good
    else if (diff < 80)  harmonyScore = 80;  // split complementary — very good
    else if (diff < 100) harmonyScore = 90;  // complementary — excellent
    else if (diff < 140) harmonyScore = 85;  // triadic — great
    else                 harmonyScore = 75;  // far apart — decent

    // Boost for high contrast (light dress on dark skin or vice versa)
    const contrast = Math.abs(skinL - dressL);
    const contrastBoost = contrast > 40 ? 8 : contrast > 25 ? 4 : 0;

    // Penalty for washed-out (very low saturation dress)
    const satPenalty = dressS < 15 ? -5 : 0;

    return Math.min(100, Math.max(0, harmonyScore + contrastBoost + satPenalty));
  }

  /** Get color harmony type name */
  function getHarmonyType(skinHex, dressHex) {
    const diff = ColorAnalyzer.hueDiff(skinHex, dressHex);
    if (diff < 20)       return { type: 'Monochromatic', desc: 'Same hue family — subtle and elegant.' };
    if (diff < 45)       return { type: 'Analogous', desc: 'Neighboring hues — harmonious and natural-looking.' };
    if (diff < 80)       return { type: 'Split-Complementary', desc: 'Near-opposite hues — balanced with visual interest.' };
    if (diff < 110)      return { type: 'Complementary', desc: 'Opposite hues — high contrast, bold and striking.' };
    if (diff < 140)      return { type: 'Triadic', desc: 'Three-way balance — vibrant and eye-catching.' };
    return               { type: 'Discordant', desc: 'High contrast — may clash, consider accessories to bridge colors.' };
  }

  /** Get verdict badge text + class */
  function getVerdict(score) {
    if (score >= 82) return { text: '🟢 Great Match!', cls: 'great' };
    if (score >= 65) return { text: '🟡 Good Match', cls: 'good' };
    return               { text: '🔴 Consider Others', cls: 'avoid' };
  }

  /** Get plain-English advice */
  function getAdvice(score, undertone, dressColorName, harmonyType) {
    const isGreat = score >= 82;
    const isGood  = score >= 65;

    const toneAdvice = {
      'Cool/Pink':    'Your cool-pink undertone pairs beautifully with jewel tones, blues, and purples.',
      'Warm/Peach':   'Your warm-peach undertone glows with earthy tones, warm reds, and corals.',
      'Neutral':      'Your neutral undertone gives you flexibility — most palettes will work well.',
      'Warm/Olive':   'Your warm-olive undertone is complemented by rich greens, burnt oranges, and deep reds.',
      'Neutral-Warm': 'Your neutral-warm undertone suits a wide range of warm and earthy hues.',
      'Warm':         'Your warm undertone looks radiant with gold-adjacent colors and rich earth tones.',
      'Warm/Golden':  'Your warm-golden undertone shines with mustard, terracotta, and warm browns.',
      'Neutral-Cool': 'Your neutral-cool undertone is versatile — cool blues, greens, and plums are flattering.',
      'Cool':         'Your cool undertone is enhanced by icy blues, lavenders, and stark whites.',
    };

    const harmonySentence = isGreat
      ? `This ${dressColorName} dress creates a ${harmonyType} color relationship with your complexion — a stunning combination.`
      : isGood
      ? `This ${dressColorName} dress has a ${harmonyType} relationship with your skin — works well overall.`
      : `This ${dressColorName} dress may not be the strongest match for your tone. Try a different color for better harmony.`;

    const toneSentence = toneAdvice[undertone] || 'Your unique undertone has many great options — see the palette below.';

    return `${harmonySentence} ${toneSentence}`;
  }

  /**
   * Main entry point.
   * @param {string} skinHex - Detected skin tone hex
   * @param {string} skinUndertone - e.g. 'Warm/Olive'
   * @param {string} dressHex - Dominant dress color hex
   * @param {string} dressColorName - e.g. 'Blue'
   * @returns {object} Full recommendation report
   */
  function recommend(skinHex, skinUndertone, dressHex, dressColorName) {
    const score    = computeMatchScore(skinHex, dressHex);
    const harmony  = getHarmonyType(skinHex, dressHex);
    const verdict  = getVerdict(score);
    const advice   = getAdvice(score, skinUndertone, dressColorName, harmony.type);
    const palettes = ColorAnalyzer.UNDERTONE_PALETTES[skinUndertone]
                     || ColorAnalyzer.UNDERTONE_PALETTES['Neutral'];

    return {
      score,
      harmony: `${harmony.type} — ${harmony.desc}`,
      verdict,
      advice,
      bestColors: palettes.best,
      avoidColors: palettes.avoid,
    };
  }

  return { recommend, computeMatchScore, getVerdict };
})();

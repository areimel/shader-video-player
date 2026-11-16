// Tube display (main pass): phosphor mask, locked to integer device pixels (gl_FragCoord), never to the curved uv.
// Average transmittance at full strength, white light, every pixel and channel (shared/tube/derive.ts MASK_TRANSMITTANCE):
//   aperture 1/3 (all widths, each channel 1/3) | slot (1/3)(1 - 1/slotHeight) = 1/4 at height 4
//   shadow 1/3 | magenta-green 1/2 | RGBX 1/4.

uniform float d_maskWidth;     // triad width in device pixels: 2, 3, 4 or 6
uniform float p_maskType;      // MASK in params.ts: 0 none, 1 aperture, 2 slot, 3 shadow, 4 magenta-green, 5 RGBX
uniform float p_maskStrength;
uniform float p_slotHeight;    // slot period in pixels; one dark row per period
uniform float p_subpixelOrder; // 1 = display is BGR: swap red and blue

const vec3 MASK_RED = vec3(1.0, 0.0, 0.0);
const vec3 MASK_GREEN = vec3(0.0, 1.0, 0.0);
const vec3 MASK_BLUE = vec3(0.0, 0.0, 1.0);
const vec3 MASK_MAGENTA = vec3(1.0, 0.0, 1.0);

/**
 * One triad of vertical phosphor stripes, `w` pixels wide; each channel averages exactly 1/3 for every width:
 *   w = 3: R G B      w = 6: R R G G B B
 *   w = 2: magenta, green at 2/3 (2/3 keeps each channel at 1/3)
 *   w = 4: the R G B stripes area-sampled onto 4 pixels and scaled by 4/3:
 *          (1,0,0) (1/3,2/3,0) (0,2/3,1/3) (0,0,1)
 */
vec3 maskStripe(int x, int w) {
  int i = x % w;
  if (w == 2) return (i == 0 ? MASK_MAGENTA : MASK_GREEN) * (2.0 / 3.0);
  if (w == 4) {
    if (i == 0) return MASK_RED;
    if (i == 1) return vec3(1.0 / 3.0, 2.0 / 3.0, 0.0);
    if (i == 2) return vec3(0.0, 2.0 / 3.0, 1.0 / 3.0);
    return MASK_BLUE;
  }
  int stripe = (i * 3) / w; // w = 3 or 6
  return stripe == 0 ? MASK_RED : (stripe == 1 ? MASK_GREEN : MASK_BLUE);
}

/** Aperture grille stripes broken by a one-pixel gap every `slotHeight` rows, alternate triads offset by half a slot. */
vec3 slotMask(ivec2 px, int w) {
  int h = max(int(p_slotHeight + 0.5), 2);
  int offset = ((px.x / w) % 2 == 1) ? h / 2 : 0;
  bool gap = (px.y + offset) % h == 0;
  return gap ? vec3(0.0) : maskStripe(px.x, w);
}

/**
 * Dot triads: rows of (w+1)/2 pixels, alternate rows shifted by w/2 pixels (half a triad, rounded down).
 * At w = 2 this is the magenta/green checkerboard; no dark rows, so it stays at 1/3.
 */
vec3 shadowMask(ivec2 px, int w) {
  int rowHeight = (w + 1) / 2;
  int shift = ((px.y / rowHeight) % 2 == 1) ? w / 2 : 0;
  return maskStripe(px.x + shift, w);
}

/** Final mask multiplier, mix(1, pattern, strength). Exactly vec3(1) for "none" or strength 0. */
vec3 phosphorMask(vec2 fragCoord) {
  int kind = int(p_maskType + 0.5);
  if (kind <= 0 || p_maskStrength <= 0.0) return vec3(1.0);
  ivec2 px = ivec2(floor(fragCoord));
  int w = clamp(int(d_maskWidth + 0.5), 2, 12);
  vec3 m;
  if (kind == 1) m = maskStripe(px.x, w);
  else if (kind == 2) m = slotMask(px, w);
  else if (kind == 3) m = shadowMask(px, w);
  else if (kind == 4) m = (px.x % 2 == 0) ? MASK_MAGENTA : MASK_GREEN; // fixed 2-px pattern
  else {
    int i = px.x % 4;                                                   // RGBX: fixed 4-px pattern
    m = i == 0 ? MASK_RED : (i == 1 ? MASK_GREEN : (i == 2 ? MASK_BLUE : vec3(0.0)));
  }
  if (p_subpixelOrder > 0.5) m = m.bgr;
  return mix(vec3(1.0), m, clamp(p_maskStrength, 0.0, 1.0));
}

// On-screen display text for the VHS effect: VCR mode (PLAY triangle, SP/LP/EP, H:MM:SS counter) and
// camcorder mode (date "MMM. DD YYYY" and 12-hour clock "HH:MM:SS AM"), as per-pixel coverage in the
// tape raster. Counter and clock run from uTime (media time, whole seconds); the clock does not roll
// the date over at midnight.
//
// Needs the chunks "osd-font" and "yiq" included before this one.
// The including pass declares: uTime, uOutputSize (= tape raster size, xy used).
// This chunk declares: p_tapeSpeed, p_osdMonth, p_osdDay, p_osdYear, p_osdHour,
//                      d_osdDotW, d_osdDotH, d_osdMarginX, d_osdMarginY.
// It does not read p_osdMode: the pass decides whether to call it; osdBlend with a (0, 0) hit is the identity.
//
// Interface:
//   vec2 osdVcr(vec2 px), osdCamcorder(vec2 px)   px = vUv * uOutputSize.xy (tape pixels, top-left origin);
//                                                 returns (text, shadow), each 0.0 or 1.0
//   vec3 osdBlend(vec3 yiq, vec2 hit, vec3 textRgb)  shadow is black one dot down-right of the text
//
// Written from scratch; no code or glyph data adapted from other implementations.

uniform float p_tapeSpeed;
uniform float p_osdMonth;
uniform float p_osdDay;
uniform float p_osdYear;
uniform float p_osdHour;
uniform float d_osdDotW;
uniform float d_osdDotH;
uniform float d_osdMarginX;
uniform float d_osdMarginY;

const vec3 OSD_VCR_RGB = vec3(0.92);             // VCR character generator: white
const vec3 OSD_CAM_RGB = vec3(1.0, 0.82, 0.3);   // camcorder date stamp: amber

const int OSD_STR_PLAY = 0, OSD_STR_SPEED = 1, OSD_STR_COUNTER = 2, OSD_STR_DATE = 3, OSD_STR_CLOCK = 4;

// Month names in OSD_MONTHS order (JAN .. DEC), three glyphs each.
const int OSD_MONTH_GLYPHS[36] = int[36](
  G_J, G_A, G_N,  G_F, G_E, G_B,  G_M, G_A, G_R,  G_A, G_P, G_R,  G_M, G_A, G_Y,  G_J, G_U, G_N,
  G_J, G_U, G_L,  G_A, G_U, G_G,  G_S, G_E, G_P,  G_O, G_C, G_T,  G_N, G_O, G_V,  G_D, G_E, G_C);

int osdDigit(int n) { return G_0 + n; }  // n in 0..9

// Glyph of character i (0-based) of string `id`.
int osdChar(int id, int i) {
  int s = int(floor(max(uTime, 0.0)));
  if (id == OSD_STR_PLAY) {  // "PLAY" + space + triangle
    int t[6] = int[6](G_P, G_L, G_A, G_Y, G_SPACE, G_PLAY);
    return t[i];
  }
  if (id == OSD_STR_SPEED) {  // SP / LP / EP
    if (i == 1) return G_P;
    int sp = clamp(int(p_tapeSpeed + 0.5), 0, 2);
    return sp == 0 ? G_S : (sp == 1 ? G_L : G_E);
  }
  if (id == OSD_STR_COUNTER) {  // H:MM:SS
    int t[7] = int[7]((s / 3600) % 10, 10, (s / 600) % 6, (s / 60) % 10, 10, (s / 10) % 6, s % 10);
    return t[i] == 10 ? G_COLON : osdDigit(t[i]);
  }
  if (id == OSD_STR_DATE) {  // MMM. DD YYYY
    int m = clamp(int(p_osdMonth + 0.5), 0, 11);
    int d = clamp(int(p_osdDay + 0.5), 1, 31);
    int y = clamp(int(p_osdYear + 0.5), 0, 9999);
    if (i < 3) return OSD_MONTH_GLYPHS[m * 3 + i];
    if (i == 3) return G_PERIOD;
    if (i == 5) return osdDigit(d / 10);
    if (i == 6) return osdDigit(d % 10);
    if (i == 8) return osdDigit(y / 1000);
    if (i == 9) return osdDigit((y / 100) % 10);
    if (i == 10) return osdDigit((y / 10) % 10);
    if (i == 11) return osdDigit(y % 10);
    return G_SPACE;  // 4, 7
  }
  // OSD_STR_CLOCK: "HH:MM:SS AM", hour from p_osdHour + media time
  int c = (clamp(int(p_osdHour + 0.5), 0, 23) * 3600 + s) % 86400;
  int h24 = c / 3600;
  int h12 = h24 % 12 == 0 ? 12 : h24 % 12;
  if (i == 0) return h12 >= 10 ? osdDigit(1) : G_SPACE;
  if (i == 1) return osdDigit(h12 % 10);
  if (i == 2 || i == 5) return G_COLON;
  if (i == 3) return osdDigit((c / 600) % 6);
  if (i == 4) return osdDigit((c / 60) % 10);
  if (i == 6) return osdDigit((c / 10) % 6);
  if (i == 7) return osdDigit(c % 10);
  if (i == 9) return h24 < 12 ? G_A : G_P;
  if (i == 10) return G_M;
  return G_SPACE;  // 8
}

// One dot of string `id` (length len cells of 6 dots, the sixth being the gap) at integer dot position d.
bool osdDot(int id, int len, ivec2 d) {
  if (d.x < 0 || d.y < 0 || d.y > 6) return false;
  int cell = d.x / 6;
  int col = d.x - cell * 6;
  if (cell >= len || col > 4) return false;
  return glyphDot(osdChar(id, cell), col, d.y);
}

// Coverage of one string whose box has top-left o (tape pixels). Returns (text, shadow).
vec2 osdString(vec2 px, vec2 o, int id, int len) {
  vec2 dd = vec2(d_osdDotW, d_osdDotH);
  vec2 f = floor((px - o) / dd);
  // Box grown by one dot down and right to leave room for the shadow.
  if (f.x < 0.0 || f.y < 0.0 || f.x >= float(6 * len) || f.y > 7.0) return vec2(0.0);
  ivec2 d = ivec2(f);
  return vec2(osdDot(id, len, d) ? 1.0 : 0.0, osdDot(id, len, d - ivec2(1)) ? 1.0 : 0.0);
}

vec2 osdVcr(vec2 px) {
  vec2 size = uOutputSize.xy;
  vec2 mg = vec2(d_osdMarginX, d_osdMarginY);
  vec2 dd = vec2(d_osdDotW, d_osdDotH);
  vec2 hit = osdString(px, mg, OSD_STR_PLAY, 6);
  hit = max(hit, osdString(px, vec2(size.x - mg.x - 11.0 * dd.x, mg.y), OSD_STR_SPEED, 2));
  hit = max(hit, osdString(px, vec2(size.x - mg.x - 41.0 * dd.x, size.y - mg.y - 7.0 * dd.y), OSD_STR_COUNTER, 7));
  return hit;
}

vec2 osdCamcorder(vec2 px) {
  vec2 size = uOutputSize.xy;
  vec2 mg = vec2(d_osdMarginX, d_osdMarginY);
  vec2 dd = vec2(d_osdDotW, d_osdDotH);
  vec2 hit = osdString(px, vec2(size.x - mg.x - 71.0 * dd.x, size.y - mg.y - 17.0 * dd.y), OSD_STR_DATE, 12);
  hit = max(hit, osdString(px, vec2(size.x - mg.x - 65.0 * dd.x, size.y - mg.y - 7.0 * dd.y), OSD_STR_CLOCK, 11));
  return hit;
}

vec3 osdBlend(vec3 yiq, vec2 hit, vec3 textRgb) {
  vec3 c = mix(yiq, vec3(0.0), hit.y * (1.0 - hit.x));
  return mix(c, rgb2yiq(textRgb), hit.x);
}

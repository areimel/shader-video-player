// OSD font: a plain 5x7 dot-matrix face (digits, the letters PLAY / SP LP EP / the month names / AM PM
// need, ": . /" and a filled play triangle) packed into int constants. No texture, no uniforms.
//
// Interface:
//   G_0..G_9, G_A.., G_COLON, G_PERIOD, G_SLASH, G_PLAY   glyph ids (index into FONT); G_SPACE = -1
//   bool glyphDot(int glyph, int col, int row)   col 0..4 left to right, row 0..6 top to bottom;
//                                                false outside the cell, for G_SPACE and for unknown ids
// Packing: a row is 5 bits, bit 4 = leftmost column. x = row0 | row1 << 5 | row2 << 10 | row3 << 15,
// y = row4 | row5 << 5 | row6 << 10 (35 bits do not fit one 32-bit int).
//
// Written from scratch; no code or glyph data adapted from other implementations.

const int G_0 = 0, G_1 = 1, G_2 = 2, G_3 = 3, G_4 = 4, G_5 = 5, G_6 = 6, G_7 = 7, G_8 = 8, G_9 = 9;
const int G_A = 10, G_B = 11, G_C = 12, G_D = 13, G_E = 14, G_F = 15, G_G = 16, G_J = 17, G_L = 18, G_M = 19,
          G_N = 20, G_O = 21, G_P = 22, G_R = 23, G_S = 24, G_T = 25, G_U = 26, G_V = 27, G_Y = 28,
          G_COLON = 29, G_PERIOD = 30, G_SLASH = 31, G_PLAY = 32, G_SPACE = -1;
const int GLYPH_COUNT = 33;

const ivec2 FONT[GLYPH_COUNT] = ivec2[GLYPH_COUNT](
  ivec2(0xACE2E, 0x03A39), // 0
  ivec2(0x21184, 0x03884), // 1
  ivec2(0x1062E, 0x07D04), // 2
  ivec2(0x1105F, 0x03A21), // 3
  ivec2(0x928C2, 0x0085F), // 4
  ivec2(0x0FA1F, 0x03A21), // 5
  ivec2(0xF4106, 0x03A31), // 6
  ivec2(0x2083F, 0x02108), // 7
  ivec2(0x7462E, 0x03A31), // 8
  ivec2(0x7C62E, 0x03041), // 9
  ivec2(0xFC62E, 0x04631), // A
  ivec2(0xF463E, 0x07A31), // B
  ivec2(0x8422E, 0x03A30), // C
  ivec2(0x8C65C, 0x07251), // D
  ivec2(0xF421F, 0x07E10), // E
  ivec2(0xF421F, 0x04210), // F
  ivec2(0xBC22E, 0x03E31), // G
  ivec2(0x10847, 0x03242), // J
  ivec2(0x84210, 0x07E10), // L
  ivec2(0xAD771, 0x04631), // M
  ivec2(0xAE731, 0x04673), // N
  ivec2(0x8C62E, 0x03A31), // O
  ivec2(0xF463E, 0x04210), // P
  ivec2(0xF463E, 0x04654), // R
  ivec2(0x7420F, 0x07821), // S
  ivec2(0x2109F, 0x01084), // T
  ivec2(0x8C631, 0x03A31), // U
  ivec2(0x8C631, 0x01151), // V
  ivec2(0x22A31, 0x01084), // Y
  ivec2(0x01080, 0x00084), // :
  ivec2(0x00000, 0x03180), // .
  ivec2(0x20821, 0x04208), // /
  ivec2(0xF7310, 0x0431C)  // play triangle
);

bool glyphDot(int glyph, int col, int row) {
  if (glyph < 0 || glyph >= GLYPH_COUNT || col < 0 || col > 4 || row < 0 || row > 6) return false;
  ivec2 g = FONT[glyph];
  int bits = row < 4 ? g.x : g.y;
  return ((bits >> ((row & 3) * 5 + (4 - col))) & 1) == 1;
}

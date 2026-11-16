// VHS dropouts: hash-placed streaks, two slots per field line, with the dropout compensator's concealment.
// Needs noise.glsl (hash12, hash32) and timebase.glsl (TapeLine). The pass declares uFrame/uTime for timebase.
// Declares d_tapeWidth, d_dropoutProb, d_dropoutLen, d_dropoutTail, d_docDelay, d_dropoutEdge.
// Shared with derive.ts: all lengths are in tape samples; dropoutProb is per slot with 2 slots per field line;
// dropoutProb = 0 never fires (the slot test is strict).
// Model (phys.): an oxide defect drops the FM carrier, the limiter then outputs noise that demodulates near white;
// the VCR's dropout compensator notices after a short delay and substitutes the 1H-delayed line; the demodulator
// needs a few us to recover when the carrier returns (the comet tail). A defect wider than the 58 um track would
// also hit the neighbouring field; that is not modelled.
// Written from the signal maths; no code adapted from other implementations.

uniform float d_tapeWidth;
uniform float d_dropoutProb;
uniform float d_dropoutLen;
uniform float d_dropoutTail;
uniform float d_docDelay;
uniform float d_dropoutEdge;

const float DOC_CONCEAL = 0.85; // share of the dropout the compensator replaces (approx.)

struct Dropout {
  float core;     // 0..1: carrier lost (white noise level)
  float tail;     // 0..1: demodulator recovery after the carrier returns
  float conceal;  // 0..1: weight of the 1H-delayed line substituted by the compensator
  float level;    // the white level the limiter noise sits around
};

// x = sample centre (x + 0.5). Slots combine by max.
Dropout dropoutAt(TapeLine t, float x) {
  Dropout d = Dropout(0.0, 0.0, 0.0, 0.8);
  for (int j = 0; j < 2; j++) {
    vec3 h = hash32(vec2(float(t.fieldLine) + 0.5 + 300.0 * float(j), t.seed * 1.37 + 5.0));
    if (h.x >= d_dropoutProb) continue;
    float len = d_dropoutLen * (0.4 + 1.2 * h.y);
    float x0 = h.z * (d_tapeWidth + len) - len;
    float x1 = x0 + len;
    float e = d_dropoutEdge;
    float core = smoothstep(x0 - e, x0, x) * (1.0 - smoothstep(x1 - e, x1, x));
    float tail = x > x1 ? exp(-(x - x1) / d_dropoutTail) : 0.0;
    float conceal = core * DOC_CONCEAL * smoothstep(x0, x0 + d_docDelay, x);
    d.core = max(d.core, core);
    d.tail = max(d.tail, tail);
    d.conceal = max(d.conceal, conceal);
    d.level = 0.8 + 0.2 * hash12(h.xy * 91.7);
  }
  return d;
}

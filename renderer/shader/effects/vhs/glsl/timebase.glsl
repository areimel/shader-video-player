// VHS time-base model: per-field-line horizontal displacement (jitter, wobble, top skew, head switch, tracking band)
// and the zone/band functions the vertical pass uses to place noise on the same lines.
// Needs sampling.glsl (PI), noise.glsl, tape-noise.glsl (valueNoise1). The pass must declare `uniform int uFrame` and
// `uniform float uTime` BEFORE including this chunk (the functions below read them).
// All shifts are in tape samples, positive = the picture moves right (tapeH samples at x - shift).
// Shared assumptions with derive.ts: FIELD_LINES = TAPE_FIELD_LINES (240); d_fieldStride = tapeSize().stride;
// d_headSwitchShift / d_trackingShift are already in samples; d_headSwitchLines is a whole number of field lines;
// every strength is 0 when its parameter is 0 (so each term below is then exactly 0).
// Written from the signal maths; no code adapted from other implementations.

uniform float d_fieldStride;
uniform float d_jitter;
uniform float d_wobble;
uniform float d_topSkew;
uniform float d_headSwitchLines;
uniform float d_headSwitchShift;
uniform float d_headSwitchNoise;
uniform float d_tracking;
uniform float d_trackingRoll;
uniform float d_trackingShift;

const float FIELD_LINES = 240.0;
const float AFC_TAU_LINES = 8.0; // receiver horizontal AFC time constant in lines (approx.; consumer sets ~5-20)

struct TapeLine {
  int row;
  int fieldLine;
  int parity;
  float fieldPos;
  float seed;
};

TapeLine tapeLine(int row) {
  int stride = int(d_fieldStride + 0.5);
  TapeLine t;
  t.row = row;
  if (stride >= 2) {
    t.fieldLine = row / stride;
    t.parity = row & 1;
  } else {
    t.fieldLine = row;
    t.parity = uFrame & 1;
  }
  t.fieldPos = (float(t.fieldLine) + 0.5) / FIELD_LINES;
  t.seed = float((uFrame % 1024) * 2 + t.parity);
  return t;
}

// Residual time-base error of a deck without a TBC, correlated over a few lines (phys. cause, approx. spectrum).
float jitterShift(TapeLine t) {
  return d_jitter * valueNoise1(float(t.fieldLine) / 3.0, t.seed);
}

// Slow tape-tension / drum-speed variation bending verticals: two travelling sinusoids (approx.).
// Frequencies are whole multiples of 0.01 cycles/s on tau = mod(uTime, 100), so the wrap is seamless.
float wobbleShift(TapeLine t) {
  float tau = mod(uTime, 100.0);
  float a = 0.65 * sin(2.0 * PI * (t.fieldPos + 0.31 * tau));
  float b = 0.35 * sin(2.0 * PI * (2.0 * t.fieldPos - 0.73 * tau + 0.25));
  return d_wobble * (a + b);
}

// Top skew / flagging: the receiver AFC re-locking after the vertical interval, a first-order exponential settle (phys.).
float topSkewShift(TapeLine t) {
  float v = 1.0 + 0.5 * (hash12(vec2(t.seed, 3.7)) - 0.5);
  return d_topSkew * v * exp(-float(t.fieldLine) / AFC_TAU_LINES);
}

// Head-switch zone: the last d_headSwitchLines field lines before vertical sync. 0 everywhere when the amount is 0.
float headSwitchZone(TapeLine t) {
  float u = float(t.fieldLine) - (FIELD_LINES - d_headSwitchLines);
  return (d_headSwitchLines > 0.5 && u >= 0.0) ? 1.0 : 0.0;
}

// The switching line itself is the noisy one: zone * exp(-u).
float headSwitchEdge(TapeLine t) {
  float u = float(t.fieldLine) - (FIELD_LINES - d_headSwitchLines);
  return headSwitchZone(t) * exp(-max(u, 0.0));
}

// The new head's timing differs by delta: the picture jumps and the AFC pulls it back with the same tau. The two heads
// differ slightly (parity term) and the step varies per field with the noise amount; with d_headSwitchNoise = 0 nothing
// in the zone changes between renders (phys. mechanism, approx. magnitudes).
float headSwitchShift(TapeLine t) {
  float u = float(t.fieldLine) - (FIELD_LINES - d_headSwitchLines);
  float delta = d_headSwitchShift * (1.0 + d_headSwitchNoise *
      (0.15 * float(2 * t.parity - 1) + 0.6 * (hash12(vec2(t.seed, 9.1)) - 0.5)));
  return headSwitchZone(t) * delta * exp(-max(u, 0.0) / AFC_TAU_LINES);
}

// Mistracking band: lowers the RF envelope over part of each field; rolls as the control-track phase drifts (phys.
// mechanism, approx. profile). Raised-cosine bump, wraps around the field. 0 when d_tracking = 0.
float trackingBand(TapeLine t) {
  float c = fract(0.3 + d_trackingRoll * uTime);
  float dy = abs(fract(t.fieldPos - c + 0.5) - 0.5);
  float hw = mix(0.05, 0.18, d_tracking);
  float bump = dy < hw ? 0.5 + 0.5 * cos(PI * dy / hw) : 0.0;
  return clamp(1.6 * d_tracking * bump, 0.0, 1.0);
}

// Where the FM carrier is marginal the time base wanders too (approx.).
float trackingShift(TapeLine t) {
  float b = trackingBand(t);
  return d_trackingShift * b * b * valueNoise1(float(t.fieldLine) / 1.5, t.seed + 17.0);
}

float timebaseShift(TapeLine t) {
  return jitterShift(t) + wobbleShift(t) + topSkewShift(t) + headSwitchShift(t) + trackingShift(t);
}

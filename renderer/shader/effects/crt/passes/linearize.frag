#version 300 es
precision highp float;

// Linearize pass: decoded gamma signal -> linear light, plus phosphor persistence.

#include "color"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;  // decoded signal, gamma-encoded RGB
uniform sampler2D uPrev;    // this pass's previous output (linear), black after reset

uniform float uDeltaTime;
uniform float p_crtGamma;
uniform float p_persistence;  // fraction of light remaining after 1/60 s

// Blue phosphor (ZnS:Ag) decays much faster than red/green, so its persistence is scaled down.
const vec3 CHANNEL_PERSISTENCE = vec3(1.0, 1.0, 0.67);

void main() {
  vec3 linearRgb = toLinear(texture(uSource, vUv).rgb, p_crtGamma);

  // Exponential decay: remaining = base^(dt * 60) gives `base` per 1/60 s at any frame rate.
  // pow(0, y) is only defined for y > 0, so dt is floored, and the step() forces exactly
  // zero afterglow when persistence is 0.
  vec3 base = p_persistence * CHANNEL_PERSISTENCE;
  float frames = max(uDeltaTime, 1e-4) * 60.0;
  vec3 decay = pow(max(base, vec3(1e-6)), vec3(frames)) * step(vec3(1e-4), base);

  vec3 prev = texture(uPrev, vUv).rgb;
  fragColor = vec4(max(linearRgb, prev * decay), 1.0);
}

#version 300 es
precision highp float;
#include "blur"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;
uniform vec4 uOutputSize;
uniform vec4 uViewportSize;
uniform float p_glowSigma;  // raster lines
uniform float d_tubeW;
uniform float d_tubeH;

void main() {
  // Sigma is p_glowSigma lines = p_glowSigma / V tube heights (V = source lines).
  // Tube physical aspect A = (tubeW*vpW)/(tubeH*vpH), so the same length is p_glowSigma/(V*A)
  // tube widths, i.e. sigma_x = p_glowSigma * W / (V * A) source texels.
  float aspect = (d_tubeW * uViewportSize.x) / (d_tubeH * uViewportSize.y);
  float sigma = p_glowSigma * uSourceSize.x / (uSourceSize.y * aspect);
  // When the target is narrower than the source, widen slightly so taps do not alias.
  float pitch = uSourceSize.x / uOutputSize.x;
  float extra = 0.5 * max(pitch - 1.0, 0.0);
  sigma = sqrt(sigma * sigma + extra * extra);
  fragColor = vec4(blurSeparable(uSource, vUv, vec2(uSourceSize.z, 0.0), sigma, vec2(0.0)), 1.0);
}

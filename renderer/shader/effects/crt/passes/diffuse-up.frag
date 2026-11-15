#version 300 es
precision highp float;
#include "blur"

in vec2 vUv;
out vec4 fragColor;

// Vertical Gaussian at target resolution (input is diffuseDown, same size).
uniform sampler2D uSource;
uniform vec4 uSourceSize;
uniform float p_diffusionRadius;  // fraction of tube height

void main() {
  // sigma = radius / 2 tube heights = that times target height in texels; 0.7-texel floor.
  float s = 0.5 * p_diffusionRadius * uSourceSize.y;
  float sigma = sqrt(s * s + 0.49);
  fragColor = vec4(blurSeparable(uSource, vUv, vec2(0.0, uSourceSize.w), sigma, vec2(0.0)), 1.0);
}

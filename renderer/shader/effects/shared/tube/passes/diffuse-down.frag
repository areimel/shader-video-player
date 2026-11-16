#version 300 es
precision highp float;
#include "blur"

in vec2 vUv;
out vec4 fragColor;

// Downsample + horizontal Gaussian, evaluated at source resolution. Vertically each tap is
// a 4-tap box one target texel tall (area filter), so a source taller than the target does
// not alias. diffuseUp then blurs vertically.
uniform sampler2D uSource;
uniform vec4 uSourceSize;
uniform vec4 uOutputSize;
uniform vec4 uViewportSize;
uniform float p_diffusionRadius;  // fraction of tube height
uniform float d_tubeW;
uniform float d_tubeH;

void main() {
  float aspect = (d_tubeW * uViewportSize.x) / (d_tubeH * uViewportSize.y);
  // Radius -> sigma = radius / 2, in tube heights (uv units vertically).
  float sigmaY = 0.5 * p_diffusionRadius;
  // Same physical length horizontally: divide by the tube aspect (uv spans the tube width).
  float sigmaX = sigmaY / aspect;
  // Floor of 0.7 target texels so the 1/8-res sampling grid never aliases (no shimmer).
  float floorX = 0.7 * uOutputSize.z;
  float sigmaSrc = sqrt(sigmaX * sigmaX + floorX * floorX) * uSourceSize.x;
  vec2 perp = vec2(0.0, uOutputSize.w);
  fragColor = vec4(blurSeparable(uSource, vUv, vec2(uSourceSize.z, 0.0), sigmaSrc, perp), 1.0);
}

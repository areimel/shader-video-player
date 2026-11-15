#version 300 es
precision highp float;
#include "blur"

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSource;
uniform vec4 uSourceSize;
uniform float p_glowSigma;  // raster lines = source texels vertically (same height as glowH)

void main() {
  fragColor = vec4(blurSeparable(uSource, vUv, vec2(0.0, uSourceSize.w), p_glowSigma, vec2(0.0)), 1.0);
}

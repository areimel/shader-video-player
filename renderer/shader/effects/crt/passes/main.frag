#version 300 es
precision highp float;
precision highp int;

// CRT main pass (screen resolution): draws the tube. The whole display stage (geometry, beam, mask, glow,
// screen finish) is `tubeDisplay` in shared/tube/glsl/display.glsl; the CRT adds nothing of its own to it.

in vec2 vUv;
out vec4 fragColor;

// Uniforms shared by several chunks are declared here, once.
uniform vec4 uViewportSize; // canvas size in device pixels
uniform int uFrame;
uniform int uVideoFrame;

#include "display"

void main() {
  fragColor = tubeDisplay(vUv, gl_FragCoord.xy);
}

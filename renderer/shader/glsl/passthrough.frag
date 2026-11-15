#version 300 es
precision highp float;

in vec2 vUv;
uniform sampler2D uSource;
uniform vec4 uViewportSize;
uniform vec4 uVideoSize;
out vec4 fragColor;

// Letterboxes the video into the canvas; the effect, not CSS, decides the picture rectangle.
void main() {
  float viewAspect = uViewportSize.x / uViewportSize.y;
  float videoAspect = uVideoSize.x / uVideoSize.y;
  vec2 scale = viewAspect > videoAspect ? vec2(viewAspect / videoAspect, 1.0) : vec2(1.0, videoAspect / viewAspect);
  vec2 uv = (vUv - 0.5) * scale + 0.5;
  bool inside = all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)));
  fragColor = inside ? vec4(texture(uSource, uv).rgb, 1.0) : vec4(0.0, 0.0, 0.0, 1.0);
}

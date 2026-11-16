// CRT main pass: tube placement, screen curvature and the rounded picture edge.
// Spaces: viewport uv (0,0 top-left) -> tube t in [0,1] (undistorted face) -> c = 2t-1 in [-1,1]
//         -> curved picture coords s = c * f(c) -> tube uv = s/2 + 1/2, used to sample uSource/uGlow/uDiffuse.
// Needs (declared in main.frag): uViewportSize.

uniform float d_tubeW;        // tube width, fraction of the viewport
uniform float d_tubeH;        // tube height, fraction of the viewport
uniform float p_curvatureX;   // curvature of the glass along X (0 = flat; X only = cylindrical Trinitron)
uniform float p_curvatureY;   // curvature of the glass along Y
uniform float p_cornerRadius; // fraction of the tube height
uniform float p_edgeSoftness; // fraction of the tube height

// Share of each axis' curvature spent on foreshortening (centre magnified, edges compressed).
// The rest bends the other axis (barrel). Neither moves the edge midpoints, so the image never shrinks.
const float CURVE_BULGE = 0.5;

struct TubeGeometry {
  vec2 uv;        // tube-space uv to sample the raster with; (0..1) is the picture
  vec2 centred;   // the same point as curved picture coordinates in [-1,1]
  vec2 face;      // undistorted tube-face coordinates in [-1,1] (glass effects)
  float coverage; // 1 inside the picture, 0 outside, soft at the rounded edge
};

/** Width / height of the tube in device pixels. */
float tubeAspect() {
  return (max(d_tubeW, 1e-4) * uViewportSize.x) / max(d_tubeH * uViewportSize.y, 1.0);
}

/**
 * f(c) - 1 per axis, where curved = c * f(c).
 *  - bend: X curvature scales y by 1 + kx*x^2 (top/bottom edges bow), Y curvature scales x by 1 + ky*y^2.
 *  - bulge: each axis is also foreshortened by 1 - CURVE_BULGE*k*(1 - c^2), which is 1 at the edge.
 * Both factors are exactly 1 on the edge midpoints, so the picture still meets the tube rectangle there.
 * Written as (a + b + a*b) so it is exactly 0 when both curvatures are 0 (exact identity mapping).
 */
vec2 curveFactorMinusOne(vec2 c) {
  vec2 c2 = c * c;
  vec2 bend = vec2(p_curvatureY * c2.y, p_curvatureX * c2.x);
  vec2 bulge = -CURVE_BULGE * vec2(p_curvatureX, p_curvatureY) * (1.0 - c2);
  return bend + bulge + bend * bulge;
}

/** Signed distance to a rounded box centred on the origin (negative inside). */
float roundedBoxSdf(vec2 p, vec2 halfSize, float radius) {
  vec2 q = abs(p) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

TubeGeometry tubeGeometry(vec2 viewUv) {
  TubeGeometry g;
  vec2 t = (viewUv - 0.5) / max(vec2(d_tubeW, d_tubeH), vec2(1e-4)) + 0.5;
  vec2 c = t * 2.0 - 1.0;
  vec2 delta = c * curveFactorMinusOne(c); // 0 when flat
  g.uv = t + 0.5 * delta;
  g.centred = c + delta;
  g.face = c;

  // Rounded corners in an aspect-correct space (units: tube half-heights) so they are circular.
  vec2 halfSize = vec2(tubeAspect(), 1.0);
  float radius = clamp(2.0 * p_cornerRadius, 0.0, 1.0);
  float sdf = roundedBoxSdf(g.centred * halfSize, halfSize, radius);
  float onePixel = 2.0 / max(d_tubeH * uViewportSize.y, 1.0);
  float soft = max(2.0 * p_edgeSoftness, onePixel); // at least one pixel of anti-aliasing
  float inTube = step(0.0, t.x) * step(t.x, 1.0) * step(0.0, t.y) * step(t.y, 1.0);
  g.coverage = (1.0 - smoothstep(-soft, 0.0, sdf)) * inTube;
  return g;
}

// Area-filtered downsampling of a larger texture (e.g. the video) into a smaller raster. The source needs
// mipmaps: set `mipmapInputs` on the pass that reads it.
const int RESAMPLE_TAPS = 4;

// Tent-filtered tap grid over `extent` (source uv, half-width of the tent) around `uv`.
// With N taps at u = (i + 0.5) / N * 2 - 1 and weight 1 - |u|, the grid spacing is
// extent / 2 source texels at the chosen LOD, so every source row/column under the
// footprint contributes and nothing shimmers when the picture scrolls.
vec3 tentSample(sampler2D tex, vec2 uv, vec2 extent, float lod) {
  vec3 sum = vec3(0.0);
  float wsum = 0.0;
  for (int j = 0; j < RESAMPLE_TAPS; j++) {
    float uy = (float(j) + 0.5) / float(RESAMPLE_TAPS) * 2.0 - 1.0;
    for (int i = 0; i < RESAMPLE_TAPS; i++) {
      float ux = (float(i) + 0.5) / float(RESAMPLE_TAPS) * 2.0 - 1.0;
      float w = (1.0 - abs(ux)) * (1.0 - abs(uy));
      sum += w * textureLod(tex, uv + vec2(ux, uy) * extent, lod).rgb;
      wsum += w;
    }
  }
  return sum / wsum;
}

// Source colour for one output texel at source uv `uv`. footUv = that texel's footprint in source uv
// (e.g. scale * uOutputSize.zw); texSize = source size in texels (uSourceSize.xy).
vec3 areaSample(sampler2D tex, vec2 uv, vec2 footUv, vec2 texSize) {
  vec2 footTexels = footUv * texSize;
  float widest = max(footTexels.x, footTexels.y);
  if (widest <= 1.0) return textureLod(tex, uv, 0.0).rgb;  // no larger than the raster: plain bilinear (LOD 0; no implicit derivatives)
  // Mip texels are ~widest/2 source texels wide, matching the tap spacing above.
  float lod = max(0.0, log2(widest) - 1.0);
  return tentSample(tex, uv, footUv, lod);
}

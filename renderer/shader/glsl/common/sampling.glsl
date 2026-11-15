// Filter kernels for resampling. `x` is the distance from the tap in source texels.

const float PI = 3.141592653589793;

float sinc(float x) {
  float a = PI * x;
  return abs(a) < 1e-5 ? 1.0 : sin(a) / a;
}

// Lanczos window with `lobes` lobes (2.0 or 3.0).
float lanczos(float x, float lobes) {
  return abs(x) < lobes ? sinc(x) * sinc(x / lobes) : 0.0;
}

// Windowed-sinc low-pass tap: `cutoff` in cycles per sample (Nyquist = 0.5), Hann window of half-width `radius`.
float lowpassTap(float x, float cutoff, float radius) {
  float window = abs(x) < radius ? 0.5 + 0.5 * cos(PI * x / radius) : 0.0;
  return 2.0 * cutoff * sinc(2.0 * cutoff * x) * window;
}

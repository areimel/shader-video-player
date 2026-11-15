// Unnormalised Gaussian; callers normalise by the sum of their taps.

float gaussian(float x, float sigma) {
  float s = max(sigma, 1e-4);
  return exp(-0.5 * x * x / (s * s));
}

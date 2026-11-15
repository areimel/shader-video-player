// Colour transfer helpers. Signal-domain work stays gamma-encoded; light-domain work is linear.

const vec3 LUMA_709 = vec3(0.2126, 0.7152, 0.0722);

float luma(vec3 linearRgb) { return dot(linearRgb, LUMA_709); }

vec3 toLinear(vec3 encoded, float gamma) { return pow(max(encoded, 0.0), vec3(gamma)); }

vec3 fromLinear(vec3 linearRgb, float gamma) { return pow(max(linearRgb, 0.0), vec3(1.0 / gamma)); }

vec3 srgbEncode(vec3 linearRgb) {
  vec3 c = max(linearRgb, 0.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

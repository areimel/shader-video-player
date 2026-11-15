// NTSC YIQ <-> gamma-encoded RGB (FCC 1953 matrices). Y in [0,1], I in ±0.596, Q in ±0.523.

const mat3 RGB_TO_YIQ = mat3(
  0.299,  0.5959,  0.2115,
  0.587, -0.2746, -0.5227,
  0.114, -0.3213,  0.3112);

const mat3 YIQ_TO_RGB = mat3(
  1.0,     1.0,     1.0,
  0.956,  -0.2720, -1.1060,
  0.6210, -0.6474,  1.7046);

vec3 rgb2yiq(vec3 rgb) { return RGB_TO_YIQ * rgb; }

vec3 yiq2rgb(vec3 yiq) { return YIQ_TO_RGB * yiq; }

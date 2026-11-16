// Tap radius shared by the 33-tap low-pass loops (composite decode, VHS tape pass). Pure.
const int FILTER_RADIUS = 16; // 33 taps

// Hann radius ~2/fc keeps the luma sinc to its first couple of lobes (little inherent ringing).
float lumaRadius(float fc) { return clamp(2.0 / max(fc, 1e-3), 3.0, float(FILTER_RADIUS)); }

import { app } from "electron";

/**
 * Chromium switches for hardware video decode on Linux. Call before app ready.
 * Set SVP_NO_HWDEC=1 to skip all of them (software decode).
 */
export function applyGpuFlags(): void {
  if (process.platform !== "linux" || process.env.SVP_NO_HWDEC === "1") return;

  // AcceleratedVideoDecodeLinuxGL: decode via VA-API on the GL (ANGLE) path.
  // AcceleratedVideoDecodeLinuxZeroCopyGL: hand decoded frames to GL without a CPU copy.
  app.commandLine.appendSwitch(
    "enable-features",
    "AcceleratedVideoDecodeLinuxGL,AcceleratedVideoDecodeLinuxZeroCopyGL",
  );
}

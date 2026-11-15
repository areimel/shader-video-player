/**
 * A request that was replaced by a newer one (a later open, restart or subtitle request) fails with this
 * error. It crosses IPC as plain message text, so it is recognised by its marker rather than by class.
 */
const MARKER = "SVP_SUPERSEDED";

export function supersededError(): Error {
  return new Error(`${MARKER}: request superseded`);
}

export function isSuperseded(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes(MARKER);
}

const MAX_URL_LENGTH = 2048;

/** Validates a user-supplied video URL (http/https, no credentials). Returns the normalised string; throws a readable error. */
export function parseVideoUrl(s: unknown): string {
  if (typeof s !== "string") throw new Error("Enter a video URL");
  const text = s.trim();
  if (!text) throw new Error("Enter a video URL");
  if (text.length > MAX_URL_LENGTH) throw new Error("That URL is too long");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("That is not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http and https links can be downloaded");
  if (url.username || url.password) throw new Error("URLs with a user name or password are not supported");
  return url.href;
}

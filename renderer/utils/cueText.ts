/** Plain-text view of WebVTT cue text: only italics and bold survive, every other tag is dropped. */
export interface CueSpan {
  text: string;
  italic: boolean;
  bold: boolean;
}

export type CueLine = CueSpan[];

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&nbsp;": " ", "&lrm;": "‎", "&rlm;": "‏",
};

function decode(s: string): string {
  return s.replace(/&(?:amp|lt|gt|nbsp|lrm|rlm);/g, (m) => ENTITIES[m]);
}

/** Splits cue text into lines of styled spans. Unknown tags, voices, classes and timestamps are ignored. */
export function parseCueText(raw: string): CueLine[] {
  const lines: CueLine[] = [[]];
  let italic = 0;
  let bold = 0;
  for (const tok of raw.replace(/\r\n?/g, "\n").match(/<[^>]*>|[^<]+|</g) ?? []) {
    if (tok.length > 1 && tok.startsWith("<") && tok.endsWith(">")) {
      const m = /^<(\/?)([a-zA-Z]+)/.exec(tok);
      const name = m?.[2].toLowerCase();
      const delta = m?.[1] ? -1 : 1;
      if (name === "i") italic = Math.max(0, italic + delta);
      else if (name === "b") bold = Math.max(0, bold + delta);
      continue;
    }
    const parts = decode(tok).split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ text: part, italic: italic > 0, bold: bold > 0 });
    });
  }
  return lines.filter((l, i) => l.length > 0 || (i > 0 && i < lines.length - 1));
}

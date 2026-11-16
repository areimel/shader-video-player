import type { Credits } from "./home/types";
import notices from "../../THIRD_PARTY_NOTICES.md?raw";

/** The `## ` heading texts of THIRD_PARTY_NOTICES.md, in order. */
export function noticeTitles(md: string): string[] {
  const titles: string[] = [];
  for (const line of md.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) titles.push(m[1]);
  }
  return titles;
}

export const CREDITS: Credits = {
  version: __APP_VERSION__,
  author: __APP_AUTHOR__,
  thirdParty: noticeTitles(notices),
};

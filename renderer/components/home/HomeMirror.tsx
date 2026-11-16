import { mirrorId } from "../../utils/home/frame";
import type { HomeModel, ZoneId } from "../../utils/home/types";
import { ZONES } from "../../utils/home/types";

export const ZONE_LABELS: Record<ZoneId, string> = { library: "Library", tv: "TV preset", updates: "Latest updates" };

/**
 * Visually hidden copy of the screen for assistive tech and tests: one list per zone, one element per row with
 * a stable id. The canvas is the picture; this is the text.
 */
export function HomeMirror({ model }: { model: HomeModel }) {
  return (
    <div className="visually-hidden">
      {ZONES.map((zone) => (
        <section key={zone} aria-labelledby={`home-h-${zone}`}>
          <h2 id={`home-h-${zone}`}>{ZONE_LABELS[zone]}{zone === "library" && model.libraryStatus ? ` (${model.libraryStatus.toLowerCase()})` : ""}</h2>
          <ul>
            {model.zones[zone].map((row) => (
              <li key={row.id} id={mirrorId(zone, row.id)} aria-current={row.current ? "true" : undefined}>
                {row.cols.filter(Boolean).join(", ")}{row.standby ? " (comes back when the effect is turned on)" : ""}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <section aria-labelledby="home-h-credits">
        <h2 id="home-h-credits">Dev credits</h2>
        <p>{model.credits.author}, version {model.credits.version}</p>
        <ul>{model.credits.thirdParty.map((name) => <li key={name}>{name}</li>)}</ul>
      </section>
    </div>
  );
}

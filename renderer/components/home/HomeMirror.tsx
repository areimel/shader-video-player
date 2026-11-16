import { memo } from "react";
import { mirrorId, MIRROR_ROWS } from "../../utils/home/frame";
import type { HomeModel, HomeRow, ZoneId } from "../../utils/home/types";

export const ZONE_LABELS: Record<ZoneId, string> = { library: "Library", tv: "TV preset", updates: "Latest updates" };

interface Props {
  model: HomeModel;
  /** First mirrored row per zone (mirrorStart): a bounded window that always holds the cursor row. */
  libraryStart: number;
  tvStart: number;
  updatesStart: number;
}

function Zone({ zone, rows, start, status }: { zone: ZoneId; rows: HomeRow[]; start: number; status?: string }) {
  return (
    <section aria-labelledby={`home-h-${zone}`}>
      <h2 id={`home-h-${zone}`}>{ZONE_LABELS[zone]}{status ? ` (${status.toLowerCase()})` : ""}</h2>
      <ul role="listbox" aria-labelledby={`home-h-${zone}`}>
        {rows.slice(start, start + MIRROR_ROWS).map((row, i) => (
          <li
            key={row.id} id={mirrorId(zone, row.id)} role="option"
            aria-disabled={row.action ? undefined : true} aria-current={row.current ? "true" : undefined}
            aria-setsize={rows.length} aria-posinset={start + i + 1}
          >
            {row.cols.filter(Boolean).join(", ")}{row.standby ? " (comes back when the effect is turned on)" : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Visually hidden copy of the screen for assistive tech and tests: one listbox per zone, one option per row with
 * a stable id. Only a window of rows around each cursor is rendered, so a large library keeps the DOM small; the
 * window moves in steps, so most cursor moves do not re-render it (it is memoised on the model and the starts).
 */
export const HomeMirror = memo(function HomeMirror({ model, libraryStart, tvStart, updatesStart }: Props) {
  return (
    <div className="visually-hidden">
      <Zone zone="library" rows={model.zones.library} start={libraryStart} status={model.libraryStatus} />
      <Zone zone="tv" rows={model.zones.tv} start={tvStart} />
      <Zone zone="updates" rows={model.zones.updates} start={updatesStart} />
      <section aria-labelledby="home-h-credits">
        <h2 id="home-h-credits">Dev credits</h2>
        <p>{model.credits.author}, version {model.credits.version}</p>
        <ul>{model.credits.thirdParty.map((name) => <li key={name}>{name}</li>)}</ul>
      </section>
    </div>
  );
});

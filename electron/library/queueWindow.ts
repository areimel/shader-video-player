/**
 * At most `max` consecutive entries of `list` containing `list[index]`, plus that entry's index in the
 * window. The clicked item and what follows are preferred (that is what auto-advance plays); preceding
 * entries fill the rest. Needed because the queue allow-set caps a selection at MAX_QUEUE paths, and a
 * single library directory can hold more.
 */
export function windowAround<T>(list: readonly T[], index: number, max: number): { items: T[]; index: number } {
  if (!Number.isInteger(index) || index < 0 || index >= list.length || max < 1) return { items: [], index: -1 };
  const end = Math.min(list.length, index + max);
  const start = Math.max(0, end - max);
  return { items: list.slice(start, end), index: index - start };
}

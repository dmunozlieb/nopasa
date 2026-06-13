import { startOfDay } from '../shared/date';
import { normalize } from './normalize-text';
import { extractDateCandidates, type DateCandidate } from './extract-dates';
import { EXPIRY_LABELS, keywordToRegExp } from './keywords';

/** Chars after an expiry label within which a date is considered "the label's date".
 *  Wide enough to cover the same line plus the next (labels and values often wrap). */
const LABEL_WINDOW = 40;

/** Picks the due date: among today-or-future candidates, prefer those near an expiry
 *  label; among the chosen pool, take the latest. Returns undefined when no candidate
 *  is today-or-future — we never surface a past date as a deadline.
 *
 *  "Today-or-future" is a CALENDAR comparison (date >= startOfDay(now)), so a deadline
 *  due today survives even though its midnight is < now's time-of-day. */
export function selectDueDate(text: string, { now }: { now: Date }): Date | undefined {
  const norm = normalize(text);
  const minYear = now.getFullYear() - 30;
  const maxYear = now.getFullYear() + 30;
  const today = startOfDay(now).getTime();

  const plausible = extractDateCandidates(norm).filter((c) => {
    const y = c.date.getFullYear();
    return y >= minYear && y <= maxYear;
  });
  const future = plausible.filter((c) => c.date.getTime() >= today);
  if (future.length === 0) return undefined;

  const labelOffsets = findLabelOffsets(norm);
  const labelled = future.filter((c) =>
    labelOffsets.some((l) => c.offset >= l && c.offset - l <= LABEL_WINDOW),
  );
  const pool = labelled.length > 0 ? labelled : future;
  return latest(pool).date;
}

function latest(candidates: DateCandidate[]): DateCandidate {
  return candidates.reduce((a, b) => (b.date.getTime() > a.date.getTime() ? b : a));
}

function findLabelOffsets(norm: string): number[] {
  const offsets: number[] = [];
  for (const label of EXPIRY_LABELS) {
    const re = new RegExp(keywordToRegExp(label).source, 'g');
    for (const m of norm.matchAll(re)) offsets.push(m.index ?? 0);
  }
  return offsets;
}

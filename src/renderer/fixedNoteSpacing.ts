import { Stave } from 'vexflow';
import type { Formatter, Voice as VFVoice } from 'vexflow';

/**
 * Re-positions every tick context at its time-proportional x inside the note
 * area, overriding the formatter's duration-weighted spacing. Runs after
 * `formatToStave` (the same post-format `setX` mechanism the formatter's own
 * tuning uses), so beams, tuplets and modifiers pick the final positions up
 * at draw time. The lattice follows VexFlow's own convention for its first
 * tick: it starts at that context's left-modifier width (`totalLeftPx`), so a
 * grace group or accidental on beat 1 hangs inside the note area instead of
 * over the clef. The proportional span is clamped only by that inset and the
 * LAST context's width — with a spacer voice on the lattice the latter is
 * constant, so the mapping stays a pure function of time and of what hangs
 * left of beat 1.
 */
export function applyFixedNoteSpacing(
  formatter: Formatter,
  voices: VFVoice[],
  stave: Stave
) {
  const contexts = formatter.getTickContexts();
  const lastTickKey = contexts?.list[contexts.list.length - 1];

  if (
    !contexts ||
    voices.length === 0 ||
    lastTickKey === undefined ||
    lastTickKey <= 0
  ) {
    return;
  }

  const totalTicks = voices[0]?.getTotalTicks().value() ?? 0;

  if (!(totalTicks > 0)) {
    return;
  }

  // Tick context keys are ticks × the formatter's resolution multiplier (the
  // lcm that keeps tuplet ticks integral: 3 with triplets, 5 with
  // quintuplets…), while getTotalTicks() is in plain ticks. Compare in plain
  // ticks, or every position scales by the multiplier and the overflow
  // correction below crushes the last tick flush against the note end.
  const multiplier = contexts.resolutionMultiplier || 1;
  const lastTick = lastTickKey / multiplier;

  // Tick context x is relative to noteStartX + the stave's left note padding
  // (see Tickable.getAbsoluteX), so the usable span ends at noteEndX. The
  // padding is derived from Stave statics because the `Metrics` module is not
  // re-exported by every vexflow build.
  const stavePadding = Stave.defaultPadding - Stave.rightPadding;
  const noteAreaWidth =
    stave.getNoteEndX() - stave.getNoteStartX() - stavePadding;
  const firstLeft = contexts.map[contexts.list[0]!]!.getMetrics().totalLeftPx;
  let span = noteAreaWidth - firstLeft;

  const lastContext = contexts.map[lastTickKey]!;
  const lastOverflow =
    firstLeft +
    (lastTick / totalTicks) * span +
    lastContext.getWidth() -
    noteAreaWidth;

  if (lastOverflow > 0) {
    span -= (lastOverflow * totalTicks) / lastTick;
  }

  if (!(span > 0)) {
    return;
  }

  for (const tickKey of contexts.list) {
    contexts.map[tickKey]!.setX(
      firstLeft + (tickKey / multiplier / totalTicks) * span
    );
  }
}

# MusicXML import (`vexflow-native/musicxml`)

`parseMusicXmlToScore(xml, { scoreId? })` converts a `score-partwise`
MusicXML string into a [`Score`](state.md). Unsupported input (a
`score-timewise` document, an unsupported element, a malformed value) throws
`MusicXmlParseError` (`message`, optional `path` naming the offending
element).

## What imports

- **Parts and staves**: every `<part>` becomes one staff per `<staves>`
  (default 1); multi-staff parts get a `grandStaff` brace group. Names come
  from `<part-list>`. A staff without a clef defaults by global staff order
  parity: even → treble, odd → bass.
- **Metadata**: `work-title`, `movement-title`, `<credit>` words (title,
  subtitle, composer fallbacks), the `composer` creator and `<rights>`.
- **Attributes**: `<divisions>`, `<key>` (fifths −7 … 7, `major`/`minor`;
  shown on that measure), `<time>` (shown on that measure), `<clef>` G2, F4,
  C3, C4 and `percussion`.
- **Notes**: `<pitch>` step/octave, `<alter>` or `<accidental>` (double
  flat … double sharp, quarter tones), `<type>` (or inferred from
  `<duration>`), up to three `<dot>`s, `<stem>` up/down, `<chord>` tones
  merged into a `Chord`, `<staff>` (cross-staff items get `targetStaffId`),
  `<notehead parentheses="yes">` → `pitch.parenthesized`.
- **Rests**: `<rest>` → visible rest, `print-object="no"` → hidden.
- **Timing**: `<backup>` and `<forward>`; gaps inside a voice are filled with
  `spacer` rests, and a voice whose gap has no note-length decomposition
  switches to `timingMode: 'soft'`.
- **Notations**: articulations `staccato`, `tenuto`, `accent`,
  `staccatissimo`, `strong-accent` (→ `marcato`), `<fermata>`, technical
  `open`/`stopped` — a chord tone's articulation joins the owner's existing
  attachment via `pitchIndices`; `<tie>` (matched by pitch within a voice),
  `<slur>` (by number), `<tuplet>` with `<time-modification>` (bracket,
  placement).
- **Grace notes**: consecutive `<grace>` notes of a voice become one `grace`
  attachment on the next real note; `slash="yes"` on the first one sets
  `slash`. Grace chord tones keep only their first pitch.
- **Lyrics**: `<lyric>` text with its `number` as `verse`.
- **Directions**: `<words>` → text direction (placement from the
  `<direction>`), `<dynamics>` → a `dynamic` attachment on the staff's next
  note, `<other-dynamics>` → text direction, `<sound tempo>` → tempo
  direction and `defaults.tempo`.
- **Barlines**: `<repeat direction="forward|backward">`, `light-light`
  (double), `light-heavy` (end), `regular`; an `<ending>` without a bar
  style is ignored.

## What is skipped or rejected

- `<print>` elements are skipped.
- `score-timewise` documents, any other measure child (`<harmony>`,
  `<figured-bass>`, …), unknown articulations, clefs, barlines, key modes,
  stem values and more than three dots throw `MusicXmlParseError`.
- `<unpitched>` notes are not supported: a note without `<pitch>` throws
  `Missing <pitch> at note`. Percussion scores need pitched notes (a
  `percussion` clef with `<pitch>` positions) — notehead shapes other than
  parentheses are not imported either.
- `<note>` without `<staff>` or `<voice>` throws (`Missing <staff> at note`
  / `Missing <voice> at note`); grace notes without `<voice>` are dropped.
- Ties and slurs: see [ties and slurs](state.md#structure).

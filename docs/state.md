# Score model (`vexflow-native/state`)

`vexflow-native/state` exports the typed score model consumed by
`ScoreRenderer` and produced by `parseMusicXmlToScore`. It is plain data: no
classes, no methods, ids are strings.

## Structure

```
Score
├─ defaults        meter (required), keySignature, tempo
├─ metadata        title, subtitle, composer, lyricist, arranger, copyright
├─ staves[]        Staff → measures[] → Measure → voices[] → Voice → items[]
├─ staffGroups[]   brace / bracket / line connectors over staffIds
├─ attachments[]   marks, keyed to an item by ownerId
├─ tuplets[]       TupletGroup over itemIds of one voice
├─ ties[] slurs[]  fromNoteId → toNoteId (carried, not drawn)
```

- `Staff`: `defaultClef`, `order`, optional `lines`, `name`/`shortName`.
- `Measure`: `number`, `voices`, optional `state` (clef, meter, key signature,
  tempo overriding the score defaults from this measure on),
  `leftModifiers`/`rightModifiers`, `directions`.
- `Voice`: the renderer draws `voices` in array order — the first voice is
  `voices[0]`; `index` is informational (the MusicXML importer sorts by it).
  `timingMode` (`strict` default, `soft`, `free`) maps to VexFlow's voice
  modes.
- Items are `Note` (`pitch`), `Chord` (`pitches`) or `Rest`; every item has
  a `duration` (`length` + up to three `dots`) and a `voiceId`. Notes and
  chords take `stemDirection` (`up`, `down`, `auto`); `targetStaffId` draws
  the item on another staff of the same group (cross-staff notation).
- `Rest.kind`: `visible` (default), `spacer` (invisible, reserves a fixed
  notehead-based width on its tick) or `hidden` (invisible, no width).
  Neither invisible kind carries marks or reaches the per-item hooks.

## Pitches carry notehead data, attachments carry marks

`Pitch` holds only what VexFlow keys by pitch index and what describes how
the notehead is drawn: `step`, `octave`, `accidental`, `notehead` (`x`,
`circle-x`, `diamond`, `circle`, `square`, `triangle`, `triangle-down`,
`slash`) and `parenthesized` (wraps that notehead in parentheses — a ghost
note). Accidentals include `quarter-flat` and `quarter-sharp`.

Everything else is an attachment in `score.attachments`, keyed to its owner
by `ownerId`. An attachment is engraved once per owner: one attachment is one
glyph, whatever the owner's pitch count. An articulation's `pitchIndices`
records which chord pitches it belongs to without changing how it is drawn
(indices on a `note` owner or out of range are ignored).

The owner may be a note, a chord or a visible rest; a rest accepts every type
but `grace`.

| `type`         | Rendering                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `articulation` | VexFlow articulation glyph (`staccato`, `tenuto`, `accent`, `marcato`, `staccatissimo`, `fermata`, `open`, `stopped`), `placement` `above` (default) or `below`.                                                               |
| `annotation`   | `text` in a bold 10pt sans font, `placement` `below` (default) or `above`, e.g. a sticking letter or a fingering.                                                                                                              |
| `lyric`        | `text` in a regular 10pt sans font, always below; several lyrics stack by `verse` (undefined first).                                                                                                                           |
| `dynamic`      | The SMuFL dynamics glyph (`ppp` … `fff`, `fp`, `sf`, `sfp`, `sfz`, `rf`, `rfz`, `fz`, `n`) in the music font, `placement` `below` (default) or `above`.                                                                        |
| `grace`        | `notes` drawn before the owner (a flam is one slashed grace 8th, a drag two beamed grace 16ths); `slash` adds the acciaccatura slash through the first stem. Grace notes stem up unless the owner's `stemDirection` is `down`. |

Marks on the same side of a note stack outward in a fixed order regardless
of attachment order: articulations nearest the note, then annotations,
dynamics and lyrics.

## Tuplets

`TupletGroup` lists the `itemIds` of one voice, the `ratio` (`num` notes in
the time of `den`), `bracketed` and `placement` (`above` default). A group
with fewer than two resolvable items is skipped.

## Meter and beaming

`defaults.meter` (`beats`, `beatUnit`) is required; a measure's `state.meter`
overrides it from that measure on. Beams follow `meter.beamGroups`
(fractions of a whole note); without them VexFlow's default grouping for
the time signature applies: quarters in 2/4–4/4, dotted quarters in 6/8,
9/8, 12/8, halves in 2/2–4/2; other meters follow VexFlow's rule (numerators
divisible by 3 group in threes, otherwise 2/beatUnit for beat units above a
quarter, else 1/beatUnit). Explicit `stemDirection`s and one-line staves
keep their stem directions through beaming.

## Measure modifiers

`leftModifiers` / `rightModifiers` are tri-state per measure (`true` shows,
`false` hides, `undefined` = default):

| Field              | Default            | Notes                                                                             |
| ------------------ | ------------------ | --------------------------------------------------------------------------------- |
| `showClef`         | first measure only | `false` hides it there too                                                        |
| `showMeter`        | hidden             |                                                                                   |
| `showKeySignature` | hidden             | never drawn on a `percussion` clef                                                |
| `startBarline`     | `'single'`         | renders only `'single'` and `'repeat-begin'`; every other value draws as a single |
| `endBarline`       | `'single'`         | renders every value except `'repeat-begin'` (drawn as a single line)              |

## Directions

`measure.directions` text entries (`type: 'text'`) are drawn on the first
drawn item of the measure's first voice, above by default or `below`, after
that item's own marks; a measure whose first voice holds only spacer or hidden
rests draws none. Tempo directions (`type: 'tempo'`) are not drawn; a tempo
reaches the renderer through `Measure.state.tempo` / `defaults.tempo` only as
data.

## Staff lines

`Staff.lines` accepts 1, 3 or 5 (default 5). Fewer lines hide the outer lines
symmetrically around the middle one; the stave keeps the five-line pitch
geometry, so pitches, clefs and `Rest.staffLine` resolve as on a five-line
staff. Notes meant for the single visible line go on the middle-line pitch:
`ONE_LINE_STAFF_PITCH` (B4) under the `percussion` and `treble` clefs.

## Rest placement

A visible rest sits on the middle line of any clef by default; `staffLine`
moves it (0 = bottom line … 4 = top line of the five-line geometry, resolved
per clef).

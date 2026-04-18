# CODEGUIDE.md

This file describes the current end goal of the library.

## General assumptions

- Rendering code is split across multiple classes to optimize for minimal recomputation between re-renders.
- Planner caches are invalidated from structural fingerprints of planning-relevant score and config inputs.
- Infinite score layout renders adjacent measures with no inter-measure gap.
- Skia render-context paths are built with `PathBuilder` and materialized as immutable paths only when drawn.
- Skia web font loading must finish CanvasKit bootstrap before any typeface APIs are used.
- Native Bravura font resources must not assume `SkFont.getTypeface()` is available and should reuse captured typefaces when present.
- Web text bounds must tolerate Skia web `measureText()` being unavailable by deriving bounds from glyph widths/bounds or font metrics.
- The package offers three rendering modes:

  - infinite score

    - measures are rendered in one line with horizontal scroll

  - document

    - measures are rendered in multiple lines
    - optimization for shortest document horizontally (minimal spacing)
    - fits multiple measures in single line if they fit together, whenever possible
    - measure line should be stretched (using spacing) to full available width

  - even document
    - measures are rendered in multiple lines
    - rendering is optimized for equal-width measures
    - takes the longest measure by minimal required width
    - measure lines should be stretched (using spacing) to full available width, still keeping the equal-width

## Code quality rules

# DESIGN.md

## Data model

One `Item` table represents an audio/transcript pair at any stage of completeness —
audio-only, transcript-only, or fully paired — matched by `originalFileName`
(unique constraint). This avoids a separate "unpaired transcripts" table: pairing
is just an upsert against `originalFileName`, and "unmatched" is simply
`audioPath IS NULL OR originalTranscript IS NULL`.

`AnnotationSpan` is one table for all six span types, with a `type` enum and a
`attributes` JSON column instead of six separate tables. Per-type attribute
shape is validated at the application layer (Zod), not the database. This
trades some DB-level type safety for much less schema/migration overhead
given the time budget.

Span offsets (`startOffset`/`endOffset`) are character offsets into
`correctedTranscript`, not word indices — more standard (matches how editors
like VSCode/Label Studio represent ranges) and robust to the transcript
containing multi-word phrases as a single span.

## Key decisions

- **CRUD is not a span type.** Re-reading 4.5: "CRUD" describes the general
  ability to correct/add/delete tokens in the transcript text (handled by
  `correctedTranscript` being freely editable, 4.4), not a taggable category
  like the other five. The `SpanType` enum has 5 values, not 6.

- **Overlapping spans are disallowed**, enforced at the application layer
  (not the database — Postgres has no simple built-in range-exclusion
  constraint without extensions). Overlaps genuinely occur in this domain
  (e.g. a NUMBER nested inside a MEASUREMENT), but rendering/interacting with
  overlapping highlighted ranges in a plain-text editor is a substantially
  harder UI problem than the annotation logic itself, and was cut given time.
  Adjacent spans (one ends exactly where the next begins) are allowed.

- **Editing the transcript shifts or invalidates existing spans.** Edits are
  tracked as a delta (`position`, `deletedLength`, `insertedLength`, from the
  browser's `beforeinput` event). Spans entirely before or after the edit are
  shifted; spans the edit overlaps are invalidated (deleted) rather than
  attempting a partial/fuzzy recovery. Transcript update + span shifts +
  invalidation deletes run in one DB transaction.

- **Manual pairing/unpairing.** Pairing merges an audio-only and
  transcript-only item into one row, preserving the transcript item's
  original filename (`pairedTranscriptFileName`) so it can be reconstructed.
  Unpairing is only supported for manually-paired items — an item matched
  automatically by identical filename has no second filename to split back
  into, so unpairing it returns 400 rather than guessing. The recreated
  transcript-only item after unpairing gets a **new** id (not its original
  one) — a stale-id risk only if a future frontend deep-links to item ids
  across a pair/unpair cycle.

- **Recording conditions overrides win.** Both `speechRateWpm` and
  `distanceEstimate` store a derived value and an optional override; every
  read (conditions endpoint, export) reports `override ?? derived` as the
  "effective" value, per the brief's requirement that the override is what
  gets exported.

- **Distance estimate is WAV-only.** It's computed from RMS of raw PCM
  samples, which requires decoding; MP3/M4A would need a heavier decoder
  (ffmpeg-based) than the time budget allows. For those formats the field is
  simply `null`. WAV files may also report several different MIME type
  variants (`audio/wav`, `audio/wave`, `audio/vnd.wave`) depending on origin;
  the upload allowlist covers the ones observed during testing.

- **Distance estimate is a heuristic, not a measurement.** RMS thresholds
  (>0.1 close, >0.03 medium, else far) were chosen informally during testing,
  not calibrated against real recordings.

## Frontend

Two views, no router. `App.vue` toggles between a Dashboard and an
AnnotatorWorkspace component based on a single `selectedItemId` ref, rather
than using `vue-router` — justified by the brief's "one annotator, one
machine" scope; a router added complexity with no real benefit at this size.
Pinia was likewise left out; a handful of composables (`useItems`,
`useItemDetail`, `useSpans`, `useAudioPlayer`) each own their own local
reactive state, which is sufficient for two views with no cross-cutting
global state.

- **Annotate vs. Edit Text are separate tabs**, not one combined editable
  surface. Live-editing text (contenteditable/cursor tracking) while also
  rendering interactive colored span highlights and click-to-seek on the
  same surface is a substantially harder browser-editor problem than the
  time budget allows. Annotate is a read-only, word-tokenized view (click a
  word to seek, drag across words to select and tag); Edit Text is a plain
  textarea for corrections, wired to the backend's span-shifting endpoint via
  the `beforeinput` event delta. Switching away from Edit Text auto-saves.

- **Span tagging snaps to whole-word boundaries**, not exact character
  offsets from the browser's Selection API. A drag-selection is rounded to
  the nearest fully-covered words. This sacrifices sub-word span precision
  (can't tag part of a word) in exchange for a much simpler, more reliable
  selection implementation, and unifies the click-to-seek and tag-selection
  interactions on the same word-rendering approach.

- **Click-to-seek timestamps are estimated**, not real. The input data
  format has no per-word timestamps, so word start times are approximated by
  evenly distributing words across the audio's known duration
  (`wordIndex / totalWords * duration`). This is a rough approximation, not
  forced alignment — flagged here as a known limitation, not a bug.

- **Colored text while editing** is implemented via a layered
  textarea-over-backdrop trick (invisible textarea with a visible caret,
  positioned over a `div` rendering the same text with colored span
  backgrounds behind it, scroll-synced), since a native `<textarea>` cannot
  render styled inline text directly. Colors may render approximately
  against stale span offsets in the moment between typing and saving, since
  the backdrop is built from spans fetched at last save, not live-recomputed
  per keystroke.

- **Manual pairing UI** offers two dropdowns (audio-only items,
  transcript-only items) plus a Pair button, and a small list of
  already-manually-paired items each with an Unpair button — a minimal
  direct mapping onto the backend's `/api/pairing/manual` and
  `/api/pairing/unpair` endpoints, no drag-and-drop or fuzzy-match
  suggestions.

- **Keyboard shortcuts**: W/E/R/A/S/D tag the current selection with one of
  the five span types (chosen for left-hand reachability), Esc clears the
  current selection, Tab switches between Annotate and Edit Text, Ctrl/Cmd+S
  saves the transcript while in Edit Text, Shift+Enter jumps to the next
  pending item. All are documented inline in the UI, not just in this file.

## What's cut / would do next

- No HTTP range-request support on audio streaming — the whole file is sent
  on every request. Fine for short demo clips; would matter for longer
  recordings (seeking would feel sluggish without it).
- Span-shift invalidation is all-or-nothing (delete on any overlap) rather
  than attempting to shrink/salvage a partially-overlapped span.
- No pagination on the work queue or export — fine at demo scale, would need
  it for a real hundred-recordings-per-sitting workload.
- Sub-word span selection (tagging part of a single word) is not supported;
  spans always snap to whole-word boundaries.
- Click-to-seek uses estimated, evenly-distributed word timestamps rather
  than real per-word alignment; a future version could run forced alignment
  (e.g. Montreal Forced Aligner) at ingest time to produce real timestamps.
- No visual UI for overlapping/nested spans, consistent with the backend
  decision to disallow them.

## Deviations from the brief

None beyond what's listed above as deliberate, documented trade-offs.

## Extra

- **`.env` files are committed**, not gitignored. Normally these would be
  excluded, but all values here are throwaway local-dev defaults that only
  work inside the isolated `docker compose` network on localhost — there's
  no real secret to protect. Committing them directly guarantees `docker
  compose up` works immediately after `git clone`, with no extra copy-the-
  example step that could be missed or fumbled.
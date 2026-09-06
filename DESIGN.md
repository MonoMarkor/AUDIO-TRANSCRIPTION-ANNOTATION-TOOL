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

## What's cut / would do next

- No HTTP range-request support on audio streaming — the whole file is sent
  on every request. Fine for short demo clips; would matter for longer
  recordings (seeking would feel sluggish without it).
- Span-shift invalidation is all-or-nothing (delete on any overlap) rather
  than attempting to shrink/salvage a partially-overlapped span.
- No pagination on the work queue or export — fine at demo scale, would need
  it for a real hundred-recordings-per-sitting workload.

## Deviations from the brief

None beyond what's listed above as deliberate, documented trade-offs.
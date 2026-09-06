unpairing is only supported for items that went through manual pairing — an item where audio and transcript matched automatically by identical filename has no second filename to split back into, so attempting to unpair it correctly returns a 400 rather than doing nothing.
the recreated transcript-only item after unpairing has a different id than it originally had before pairing

WAV files may report several different MIME type variants depending on origin; allowlist covers the common ones observed during testing

Overlapping spans genuinely occur in this domain (e.g., a NUMBER nested inside a MEASUREMENT). This implementation disallows overlaps at the application layer for simplicity, since rendering and interacting with overlapping highlighted ranges in a plain-text editor is a substantially harder UI problem than the annotation logic itself, and was cut given the time budget.


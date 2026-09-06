unpairing is only supported for items that went through manual pairing — an item where audio and transcript matched automatically by identical filename has no second filename to split back into, so attempting to unpair it correctly returns a 400 rather than doing nothing.
the recreated transcript-only item after unpairing has a different id than it originally had before pairing


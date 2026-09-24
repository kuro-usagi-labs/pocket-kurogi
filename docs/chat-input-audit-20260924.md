# User-reported input audit (24 September 2026)

## Root causes

- Three money parsers multiplied unqualified values below 1,000 by 1,000. The canonical extractor also failed to consume `perak`/`rupiah` suffixes. This invented a magnitude and could turn a Rp500 draft into Rp500,000.
- The canonical ownership gate matched any relationship word, while the existing language safety analyzer already distinguished payer/subject from beneficiary. This blocked expenses for a partner even when the user explicitly owned the money.
- Multiline handling required an income/expense label; natural expense lists could fall into broad whole-message inference. Missing lines must never be silently discarded.
- Safety clarification stored a question but not the original ownership draft, so `uang saya` could become a balance query instead of continuing the transaction. Gemini could then discuss history without a corresponding executable draft.
- Confirmation matching did not cover `iya benar kok` or `catat semua`.

## Fixes

- Bare amounts are literal rupiah throughout canonical, legacy and learned-rule paths. Only explicit suffixes scale the amount. Word amounts with rupiah/perak are normalized; unit words are removed from descriptions.
- Share the contextual ownership check. Explicit third-party payment/funding and reported speech still block; a beneficiary alone does not.
- Preserve every non-empty line in multiline parsing. Unlabelled lines require one amount and one recognized wallet and cannot contain transfer/savings/settings operations. Invalid, negated or incomplete lines block the entire batch.
- Store a real ownership clarification with its original text and resume only an anchored own-money reply inside the existing expiration window. Resume stages a confirmation; it never records immediately.
- Use a shared, full-message confirmation pattern. Never treat added negations, exclusions or corrections as consent. No-draft `catat semua` asks for the list rather than soliciting confirmation through Gemini.

## Scope

No historical transactions or pending amounts are repaired automatically. An existing incorrect draft must be cancelled/re-entered; a committed transaction must be corrected explicitly by its owner. No database schema migration is required.

Regression coverage uses the exact Rp500, gorengan, partner-phone-repair and four-line list examples, plus negative ownership, expiration, incomplete bulk and false-confirmation cases.

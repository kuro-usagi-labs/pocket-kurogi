# Kurogi — white & forest

The shared palette lives in `src/index.css`. Product accents, semantic status colors,
surfaces and borders remain theme-aware. `src/redesign.css` contains the public-site
layout and shared product refinements. Avoid hard-coded white on theme-aware surfaces;
fixed forest promotional panels intentionally keep pale text in both modes.

- Light: white surfaces, #f5f8f5 canvas, #163b2c text, #16734b primary.
- Dark: #0d1913 canvas, #192d22 surfaces, #e9f3ec text, #278656 primary.
- Existing orange utility names are compatibility aliases for the primary palette.
- Red stays reserved for destructive actions and negative states.
- Theme follows the device initially and can be changed with the shared toggle.

## Entry flow

Signed-out `/` displays the Indonesian landing page. `/?page=login` and
`/?page=register` open auth. Verification/reset query parameters take precedence,
and browser back/forward restores the correct public screen. Existing authenticated
sessions open the application. Auth and financial backend contracts are unchanged.

## Visual review

Run the Vite development server, then open `/design-preview.html` for isolated real
ChatView, WalletsView and AnalyticsView components with labeled fixture data. This
entry is not part of the production build and never calls database or Gemini APIs.
Review at desktop and 390px mobile widths, in light and dark modes. Keep reviewing
the real auth page separately; the fixture is not a login/end-to-end backend test.

Regression coverage includes auth callback routing. Existing financial tests remain
unchanged. Chat scroll children cannot shrink, preventing clipped welcome cards.
Public pages own their vertical scrolling, independent of the fixed-height app shell.

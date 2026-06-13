# Debt.Done.Date — Style Guide

This folder contains the design system extracted from the marketing landing page, ready to apply across the existing app.

## Files

| File | Purpose |
|------|---------|
| `STYLE_GUIDE.md` | Brand voice, color rules, type scale, motion, dos & don'ts |
| `tokens.css` | Drop-in CSS custom properties (colors, fonts, spacing, shadows, motion) |
| `components.md` | HTML + CSS snippets for every recurring pattern (button, card, eyebrow, stat, FAQ, etc.) |
| `hero-reference.png` | Visual reference of the landing page hero — use as the canonical example of the brand voice |

## How to apply this to the app

1. **Copy `tokens.css`** into the app and load it before any other stylesheet. Variables are namespaced `--ddd-*` so they won't collide with existing tokens.
2. **Read `STYLE_GUIDE.md`** for the rules — especially Section 9 ("What to keep, what to drop"). The big shifts from a generic SaaS look are:
   - Headlines are 900 weight, always
   - Tabular numerals everywhere money or dates appear
   - One accent color per surface
   - No emoji, no gradient text, no decorative SVG illustrations
3. **Replace components per `components.md`.** Class names match the landing page exactly so styles transfer 1:1. Start with the highest-traffic components (button, page header, card).
4. **Use the hero reference as the canonical example** of voice and visual rhythm.

## When the landing page is finalized

The final `Landing Page.html` will be delivered separately. The style guide is what the app should match; the landing page is one expression of it.

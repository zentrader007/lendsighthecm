# Debt.Done.Date — Style Guide

> A reference for applying the marketing-site visual language across the Debt.Done.Date product. Pair this with `tokens.css` (drop-in CSS variables) and `components.md` (HTML patterns).

---

## 1. Brand Voice

- **Confident, plainspoken, and quantitative.** Headlines name the outcome ("Pay off your debts in 9.") rather than the feature.
- **Money math, not motivation.** Lead with numbers, dates, and dollars saved. Avoid "your journey," "financial freedom," and similar generic uplift language.
- **Two-tier audience.** Same tone for DIY users and advisor-led households — never condescend, never assume sophistication. The product is the working surface advisors use; the marketing is the same surface, simplified.
- **Honest fineprint.** Disclaimers are part of the design, not hidden. Plain English about what the platform is and isn't (informational, not advice).

---

## 2. Color

### Primary palette

| Token              | Hex       | Usage |
|--------------------|-----------|-------|
| `--ddd-primary`    | `#4A7C9B` | Primary buttons, links, eyebrow labels, focus states |
| `--ddd-navy`       | `#1B2A4A` | All headlines, body text, dark-mode surfaces |
| `--ddd-navy-deep`  | `#0F1A2E` | Footer, deepest dark backgrounds |
| `--ddd-bg`         | `#FFFFFF` | Default page background |
| `--ddd-secondary`  | `#F5F6F8` | Section backgrounds, soft surfaces |
| `--ddd-border`     | `#E2E6EC` | Card borders, dividers |
| `--ddd-fg-muted`   | `#5A6A80` | Secondary text, captions |

### Accent palette (use sparingly — one per surface)

| Token          | Hex       | Reserved for |
|----------------|-----------|--------------|
| `--ddd-coral`  | `#E07A5F` | The hero strike-through; alert states |
| `--ddd-green`  | `#5B9F5B` | Positive numbers ("interest saved"), success |
| `--ddd-teal`   | `#2B7A78` | "What's inside" section accent |
| `--ddd-orange` | `#D4854A` | Tertiary highlight (one of three "method" steps) |
| `--ddd-purple` | `#7B6B8D` | FAQ section accent |
| `--ddd-sky`    | `#7BB5D6` | CTA color when used **on navy** backgrounds |

### Rules

- **Never put two accents in the same card.** Pick one accent per visual unit.
- **Numbers are colored, prose is not.** Dollars saved → green. Strike-through → coral. Body copy stays navy.
- **Backgrounds alternate.** White → secondary gray → navy → white. Don't run more than two adjacent same-colored sections.
- **Saturation cap.** Accent backgrounds use 6–10% alpha (e.g. `rgba(91,159,91,0.1)`). Avoid full-saturation backgrounds.

---

## 3. Typography

### Stack

```
Headlines & body:  'DM Sans', system-ui, sans-serif
Monospace numbers: 'DM Mono', ui-monospace, monospace
```

DM Mono is reserved for: step numbers ("01 / INTAKE"), micro-stats, year labels on charts, FAQ "Q." prefix.

### Scale

| Role            | Size                                  | Weight | Tracking   |
|-----------------|---------------------------------------|--------|------------|
| H1 (hero)       | `clamp(2.4rem, 5vw, 4.2rem)`          | 900    | -0.03em    |
| H2 (section)    | `clamp(2rem, 3.6vw, 3rem)`            | 900    | -0.025em   |
| H3 (card)       | 19–28px                               | 800–900| -0.015em   |
| H4 (small)      | 16px                                  | 700    | -0.01em    |
| Body large      | 17–19px                               | 400–500| 0          |
| Body            | 15px                                  | 400    | 0          |
| Caption         | 13px                                  | 500    | 0          |
| Eyebrow label   | 10–11px                               | 700    | **0.18em** uppercase |

### Rules

- **Headlines are 900 weight.** Always. Don't mix in 700 or 600 for "softer" treatments.
- **Eyebrow labels are uppercase + tracked.** They establish the rhythm of the page; don't substitute a regular subhead.
- **Numbers use `font-variant-numeric: tabular-nums`.** Mandatory anywhere a number could change (dates, dollar amounts, percentages).
- **Line-height stays tight at scale.** H1/H2 use 1.04–1.05; bump to 1.5–1.6 only for body.

---

## 4. Spacing & Rhythm

8-point base. Section padding is `96px` top/bottom at the regular density (compact = 64, comfy = 128).

| Context              | Vertical rhythm |
|----------------------|-----------------|
| Section → section    | 96px            |
| Section heading → content | 48px       |
| Card padding         | 24–36px         |
| Hero (top → CTA)     | 80px → 60px     |

Cards within a grid use 20–24px gaps. Avoid tighter than 16px between sibling cards.

---

## 5. Surfaces & Elevation

| Surface       | Background | Border | Radius | Shadow |
|---------------|------------|--------|--------|--------|
| Page          | `#FFFFFF`  | —      | —      | —      |
| Soft section  | `#F5F6F8`  | —      | —      | —      |
| Dark section  | `#1B2A4A`  | —      | —      | —      |
| Card (default)| `#FFFFFF`  | `var(--ddd-border-soft)` | 14–18px | `--ddd-shadow-lg` on hover |
| Hero mock     | `#FFFFFF`  | `rgba(226,230,236,0.7)` | 18px | `--ddd-shadow-2xl` |
| Stat tile     | `#F5F6F8`  | none | 11px | none |
| Pricing (popular) | `#1B2A4A` (navy) | self | 18px | `--ddd-shadow-on-dark` |

**Hover lift.** Cards translate up 3–4px and gain `--ddd-shadow-xl` on hover. Border tints toward `rgba(74,124,155,0.3)`.

---

## 6. Motion

- **Default ease:** `cubic-bezier(0.65, 0.05, 0.36, 1)` — used for the hero strike-through and any deliberate, visible animation.
- **Microinteraction ease:** `ease` (browser default), 0.15s for hovers.
- **The hero strike** is the only "showcase" animation: a 2.4s left-to-right swipe of the coral line through "in 30 years," delayed 0.6s after page load. Don't replicate this pattern elsewhere — it's the brand moment.
- **Pulse dot** (live status indicator): 2s infinite, opacity 1 → 0.4 → 1. Reserved for "Live" states.

---

## 7. Iconography

- Lucide-style stroke icons. 2px stroke weight (2.2px at small sizes), round caps and joins.
- Standard sizes: 14px (`.ic-sm`), 18px (`.ic`), 22px (`.ic-lg`).
- **Color follows context.** Inside a colored "icon tile," icon = the tile's accent color. Inline with text, icon = `currentColor`.
- **No emoji.** Anywhere.

---

## 8. Buttons

Three variants × two sizes. Always `font-weight: 600`, `font-size: 14px` (15px at large).

| Variant       | Background      | Text     | Border         | Use |
|---------------|-----------------|----------|----------------|-----|
| `btn-primary` | `--ddd-primary` | `#fff`   | none           | Main CTAs |
| `btn-navy`    | `--ddd-navy`    | `#fff`   | none           | Pricing card primary action |
| `btn-outline` | `#fff`          | navy     | `--ddd-border` | Secondary CTAs |
| `btn-ghost`   | transparent     | navy     | none           | Nav, low-priority |

Heights: 40px default, 52px large. Radius 9px (10px at large). Always include a trailing arrow icon on forward CTAs ("Start the qualifier →").

---

## 9. What to keep, what to drop

✅ **Keep across the product**
- The eyebrow → headline → subhead rhythm
- Tabular numbers everywhere money or dates appear
- Coral strike-through for "before" states
- Green for savings/success numbers only
- Navy section for the marquee CTA / featured content
- Stat cells with colored 2px left border

❌ **Don't introduce**
- Gradient text or rainbow gradients
- Drop shadows on text
- Emoji or decorative SVG illustrations
- Rounded-corner-with-left-border-accent containers (very generic)
- Outline icons mixed with filled icons on the same surface

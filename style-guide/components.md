# Component Patterns

> Copy these patterns into the existing app. Class names match `Landing Page.html` so styles transfer directly. All examples assume `tokens.css` is loaded.

---

## Button

```html
<a href="#" class="btn btn-primary">
  Get started
  <svg class="ic-sm" viewBox="0 0 24 24">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
</a>
```

Variants: `btn-primary` · `btn-navy` · `btn-outline` · `btn-ghost`
Modifiers: `btn-lg` (52px height instead of 40px)

```css
.btn {
  display: inline-flex; align-items: center; gap: 8px;
  height: 40px; padding: 0 18px;
  font-weight: 600; font-size: 14px;
  border-radius: var(--ddd-radius-md);
  transition: all 0.15s ease;
  white-space: nowrap;
}
.btn-primary {
  background: var(--ddd-primary); color: #fff;
  box-shadow: var(--ddd-shadow-md);
}
.btn-primary:hover {
  background: var(--ddd-primary-hover);
}
```

---

## Eyebrow Label

The signature element. Precedes nearly every section title.

```html
<div class="label">The Method</div>
<h2>Three modules. One date.</h2>
```

```css
.label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--ddd-primary);
}
/* Variants — swap color only */
.label.label-coral  { color: var(--ddd-coral); }
.label.label-teal   { color: var(--ddd-teal); }
.label.label-purple { color: var(--ddd-purple); }
```

---

## Eyebrow Pill (with status dot)

Used in the hero only.

```html
<div class="eyebrow">
  <span class="dot"></span>
  Debt acceleration · backed by real mathmagic
</div>
```

```css
.eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px;
  background: rgba(74,124,155,0.08);
  border: 1px solid rgba(74,124,155,0.18);
  border-radius: var(--ddd-radius-pill);
  font-size: 12px; font-weight: 600;
  color: var(--ddd-primary);
}
.eyebrow .dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--ddd-green);
  box-shadow: 0 0 0 3px rgba(91,159,91,0.2);
}
```

---

## Stat Cell (with colored left border)

```html
<div class="stat-cell">
  <div class="num">$284k</div>
  <div class="lbl">Median lifetime interest<br>saved per household</div>
</div>
```

```css
.stat-cell {
  text-align: left;
  padding-left: 16px;
  border-left: 2px solid var(--ddd-primary);
}
.stat-cell .num {
  font-size: 32px; font-weight: 900;
  color: var(--ddd-navy);
  letter-spacing: -0.025em;
  font-variant-numeric: tabular-nums;
}
.stat-cell .lbl {
  font-size: 11px; font-weight: 600;
  color: var(--ddd-fg-muted);
  margin-top: 6px;
}
```

Vary the `border-left-color` per cell (primary / teal / green / orange) to introduce rhythm without changing the type.

---

## Method / Feature Card

```html
<div class="how-card">
  <div class="how-num">01 / INTAKE</div>
  <div class="how-icon blue">
    <svg class="ic-lg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <!-- icon path -->
    </svg>
  </div>
  <h3>Qualifier</h3>
  <p>A 3-step intake covers debts, escrow, and cash flow.</p>
  <div class="micro">
    <svg class="ic-sm">…</svg>
    <b>~3 minutes</b>
  </div>
</div>
```

```css
.how-card {
  background: #fff;
  border: 1px solid var(--ddd-border-soft);
  border-radius: var(--ddd-radius-2xl);
  padding: 28px;
  transition: all var(--ddd-dur-base) ease;
}
.how-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--ddd-shadow-xl);
  border-color: rgba(74,124,155,0.3);
}
.how-num {
  font-family: var(--ddd-font-mono);
  font-size: 11px; font-weight: 700;
  letter-spacing: 0.18em;
  color: var(--ddd-fg-muted);
  margin-bottom: 16px;
}
.how-icon {
  width: 44px; height: 44px;
  border-radius: var(--ddd-radius-lg);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 18px;
}
.how-icon.blue   { background: rgba(74,124,155,0.1);  color: var(--ddd-primary); }
.how-icon.teal   { background: rgba(43,122,120,0.1);  color: var(--ddd-teal); }
.how-icon.orange { background: rgba(212,133,74,0.1);  color: var(--ddd-orange); }
.how-icon.green  { background: rgba(91,159,91,0.1);   color: var(--ddd-green); }
```

The colored icon tile is the **only** non-monochrome element on the card. Don't tint the heading or border to match.

---

## Hero Strike-through Animation

The signature brand moment. Apply when introducing a "before / after" framing.

```html
<h1>
  <span class="line">Pay off your debts</span>
  <span class="line"><span class="strike">in 30 years</span></span>
  <span class="line accent">in 9.</span>
</h1>
```

```css
.strike {
  position: relative;
  display: inline-block;
  color: var(--ddd-fg-muted);
}
.strike::after {
  content: "";
  position: absolute; left: 0; top: 50%;
  height: 4px; width: 100%;
  background: var(--ddd-coral);
  border-radius: 2px;
  transform-origin: left center;
  transform: translateY(-50%) scaleX(0);
  animation: strikeSwipe var(--ddd-dur-slow) var(--ddd-ease) 0.6s forwards;
}
@keyframes strikeSwipe {
  to { transform: translateY(-50%) scaleX(1); }
}
```

---

## Quote / Testimonial Card

```html
<div class="quote-card">
  <div class="quote-mark">"</div>
  <p class="quote-text">
    <b>Sixteen months later we're paying $1,800 less in interest a month.</b>
    That's a different life.
  </p>
  <div class="quote-attr">
    <div class="quote-avatar">JK</div>
    <div>
      <div class="quote-name">Jenna &amp; Kevin R.</div>
      <div class="quote-role">DIY plan · Tampa, FL</div>
    </div>
  </div>
</div>
```

The oversized open-quote glyph (`"`) is positioned absolute, navy at 12% opacity. Don't replace it with an icon.

---

## FAQ Item

```html
<div class="faq-item">
  <h4><span class="q">Q.</span> Is this a refinance product?</h4>
  <p>No. Debt.Done.Date doesn't touch your loan…</p>
</div>
```

```css
.faq-item h4 {
  font-size: 16px; font-weight: 700;
  display: flex; align-items: flex-start; gap: 10px;
}
.faq-item h4 .q {
  color: var(--ddd-primary);
  font-family: var(--ddd-font-mono);
  font-size: 13px; padding-top: 2px;
}
.faq-item p {
  font-size: 14.5px;
  color: var(--ddd-fg-muted);
  padding-left: 26px; /* aligns under the question text */
}
```

---

## Section Wrapper

Every full-width section follows this two-element scaffold:

```html
<section class="block">
  <div class="wrap">
    <div class="sec-head">
      <div class="label">Eyebrow</div>
      <h2>Section heading.</h2>
      <p>Optional subhead, never more than two lines.</p>
    </div>
    <!-- content grid -->
  </div>
</section>
```

```css
.wrap         { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
.wrap-narrow  { max-width:  920px; margin: 0 auto; padding: 0 24px; }
section.block { padding: 96px 0; }
.sec-head     { max-width: 720px; margin-bottom: 48px; }
.sec-head h2  {
  font-size: var(--ddd-fs-h2);
  font-weight: 900; letter-spacing: -0.025em;
  line-height: 1.05;
  color: var(--ddd-navy);
  margin: 12px 0 16px;
}
```

Use `.sec-head.center` (centered + auto-margins) only when the section content is itself centered (e.g., pricing cards, FAQ).

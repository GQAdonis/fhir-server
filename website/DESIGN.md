---
name: Tribe Health FHIR Server Docs
description: The evidence file behind the letter. Tribe Health's Cited Letter identity translated to a reading surface.
colors:
  desk: "#eef1f4"
  sheet: "#ffffff"
  ink: "#0d1d2b"
  ink-soft: "#3e4f5e"
  rule: "#cfd7df"
  navy: "#003b5c"
  navy-deep: "#002a42"
  on-navy: "#f3f7fa"
  on-navy-soft: "#b4cbd9"
  marker: "#ffe45c"
  met: "#1f7a4d"
  gap: "#9a5b00"
  void: "#b3261e"
  night-desk: "#011b2c"
  night-sheet: "#062a40"
  night-ink: "#eaf1f6"
  night-rule: "#1e4059"
  night-link: "#8ccbe9"
  night-code-field: "#001421"
typography:
  headline:
    fontFamily: "Nexa, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.5rem + 2vw, 2.875rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Nexa, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 1.3rem + 0.8vw, 1.875rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  body:
    fontFamily: "'Source Serif 4', Georgia, serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Nexa, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 700
    letterSpacing: "0.08em"
  code:
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    fontSize: "88%"
rounded:
  none: "0px"
  control: "4px"
spacing:
  sheet-padding: "clamp(1.5rem, 1rem + 2.5vw, 3.5rem)"
  section: "3rem"
components:
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.none}"
    padding: "clamp(1.5rem, 1rem + 2.5vw, 3.5rem)"
  code-field:
    backgroundColor: "{colors.navy-deep}"
    textColor: "{colors.on-navy}"
    typography: "{typography.code}"
    rounded: "{rounded.none}"
  sidebar-link-active:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.navy}"
    rounded: "{rounded.none}"
  admonition:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
  page-action-button:
    backgroundColor: "{colors.sheet}"
    textColor: "{colors.ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "0.35rem 0.6rem"
  footer:
    backgroundColor: "{colors.navy-deep}"
    textColor: "{colors.on-navy-soft}"
---

# Design System: Tribe Health FHIR Server Docs

## Overview

**Creative North Star: "The Evidence File"**

The docs are the reference material behind Tribe Health's cited letter. Each doc page is a square-edged white sheet laid on a cool desk, with the one paper elevation; navigation, table of contents and search sit on the desk around it. Ink Navy owns whole regions (every code block and the footer band), never scattered accents. Highlighter yellow appears only where evidence is in focus: the heading a reader jumped to, search hits, and selected text.

The identity is Tribe Health's, defined for the marketing site in `../../simple-ai-care/DESIGN.md` ("Cited Letter"). This file is its Read-mode translation. The marketing site is light-only; the docs ship light and dark (confirmed 2026-09-26), where dark is the night desk: the same world under navy, never a grey inversion.

**Key Characteristics:**
- Desk and sheet: the page is a document, the chrome is the table it lies on.
- Navy as fields: code blocks and the footer are solid navy bands in both modes.
- Yellow means evidence, and nothing else.
- Nexa for headings and every piece of chrome; Source Serif 4 for prose; system mono for code only.
- Square edges on paper and fields; 4px only on small controls.

## Colors

A restrained palette: one navy that owns regions, one highlighter for evidence, three evidence-state hues, and cool neutrals tinted from the navy.

### Primary
- **Ink Navy** (`navy`): links, active navigation, focus rings and the page-action focus outline. **Navy Deep** (`navy-deep`) is every code field and the footer band.

### Tertiary
- **Highlighter** (`marker`): the jumped-to heading's marker sweep, search-hit `<mark>`s and `::selection`. Text on it is always `ink`.

### Semantic
- **Met**, **Gap**, **Void**: the top edge and heading of tip/success, warning/caution and danger admonitions. Note and info admonitions take navy. Dark mode lifts each to a legible tint (#6fd0a0, #e8b25c, #ff9a92).

### Neutral
- **Desk** is the page ground, navbar and sidebar. **Sheet** is the doc page, the active sidebar item and pagination links. **Ink** and **Ink Soft** are text; **Rule** is every hairline.
- On navy, secondary text is **On-navy Soft**, tinted from the navy, never grey.

### Named Rules
**The Yellow Means Evidence Rule.** Highlighter marks only what the reader is looking at: a target heading, a search hit, a selection. Never decoration, never a hover state, never a badge.

**The Fields Not Accents Rule.** Navy appears as whole regions (code blocks, footer) or as the colour of a link or active item, never as tinted boxes, pills or icon tiles.

**The Night Desk Rule.** Dark mode rebuilds the same world under navy: desk `night-desk`, sheet `night-sheet`, code deeper than the sheet (`night-code-field`), links `night-link`. It is not a grey theme.

## Typography

**Display and UI Font:** Nexa (self-hosted WOFF2 at 400/700/800, `src/fonts/nexa/`)
**Body Font:** Source Serif 4 (Google Fonts, 400/600 and italic)
**Code Font:** the platform monospace stack

**Character:** Nexa's geometric confidence carries the brand and every control; the serif makes long technical reading feel like a document rather than a dashboard.

### Hierarchy
- **Headline** (Nexa 800, up to 2.875rem, 1.05, -0.02em, balanced): the page title.
- **Title** (Nexa 800, up to 1.875rem, 1.15): h2, preceded by a hairline rule and 3rem of space; h3 at 1.3125rem.
- **Body** (Source Serif 4 400, 1.0625rem, 1.6): prose, capped at 68ch for paragraphs, lists and quotes; tables and code run the full sheet width.
- **Label** (Nexa 700, 0.7–0.72rem, +0.08em, uppercase): document chrome only: table headers, admonition headings, the "On this page" label, footer column titles, pagination sublabels.
- **Code** (system mono, 88%): code fields and inline code, ligatures off.

### Named Rules
**The Chrome Speaks Nexa Rule.** Navbar, sidebar, TOC, breadcrumbs, pagination, buttons, search and table headers are Nexa; prose is never Nexa and chrome is never serif.

## Layout

Docusaurus's three-column docs layout: sidebar and TOC on the desk, the sheet in the centre. The sheet pads by `clamp(1.5rem, 1rem + 2.5vw, 3.5rem)`. Below 997px the sheet goes full-bleed, trades its shadow for hairlines top and bottom, and the navbar drops the "FHIR Server" product label. Tables are full-width ledgers from 997px up and horizontally scrollable blocks below. Headings keep `scroll-margin-top` clear of the 4rem navbar.

## Elevation & Depth

One elevation, the paper sheet: `0 1px 2px rgb(13 29 43 / .06), 0 18px 40px -18px rgb(13 29 43 / .28)` (dark: the same shape in black at higher opacity). Only the doc page carries it; the active sidebar item carries a 1px hint of it. Everything else is flat, separated by hairlines or navy fields.

## Shapes

Square: sheets, code fields, admonitions, tables, pagination links and sidebar items all have 0 radius. Small controls (page-action split button, search input) keep 4px. Admonitions carry a 3px state-coloured top edge, the source-slip edge from the marketing site.

## Components

### Code Field (signature)
A solid Navy Deep band in both modes (night-code-field in dark), square, no shadow. Titles sit in on-navy-soft mono above a faint rule. Syntax colours stay inside the brand: on-navy text, teal keywords, green strings, amber numbers, navy-tint properties, italic slate comments (`src/prism-theme.ts`).

### Target Heading (signature motion)
Following a link to a section sweeps a Highlighter marker across its heading, left to right, over 620ms `cubic-bezier(0.16, 1, 0.3, 1)`; the marker stays while the heading is the target. Disabled under reduced motion (the marker appears without the sweep). This is the site's one authored motion.

### Admonitions
Desk background, 3px top edge and uppercase Nexa label in the state colour (note/info navy, tip met, warning gap, danger void), no side stripe, no radius.

### Tables
Hairline ledgers: a 2px ink rule under an uppercase Nexa label header, 1px rule between rows, no zebra, no fills, tabular lining figures.

### Navigation
Desk navbar with a 1px rule: the Tribe Health mark (a lightened variant in dark), "Tribe Health" in Nexa 800, a hairline, then "FHIR Server" in Nexa 700 ink-soft. Sidebar links are Nexa; the current page is a white sheet with navy text at 700. TOC links are Nexa 0.8125rem, active in the link colour at 700.

### Page Actions
A split button above each page: Nexa 700 at 0.8125rem, 4px outer corners, 1px rule border, desk-wash hover, 2px primary focus outline.

### Footer
A Navy Deep band with Nexa label column titles, on-navy-soft links that brighten to on-navy on hover, and a serif copyright line carrying the WSO2 fork attribution.

## Do's and Don'ts

### Do:
- **Do** use the `--th-*` tokens in `src/css/custom.css` for every colour; set brand values only there.
- **Do** keep all prose on the sheet and all chrome on the desk.
- **Do** give every custom interactive element a 2px `--th-focus` outline at 2px offset.
- **Do** check new colours in both the day desk and the night desk.

### Don't:
- **Don't** use Highlighter yellow for anything but evidence in focus.
- **Don't** add rounded cards, tinted callout pills, gradients, glass or coloured side stripes.
- **Don't** put uppercase labels above headings; labels are document chrome only.
- **Don't** set prose in Nexa or chrome in the serif.
- **Don't** show real patient data in examples, screenshots or diagrams; synthetic only.

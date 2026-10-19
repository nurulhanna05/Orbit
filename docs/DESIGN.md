# AnomalyGuard design system

This is the reference for how the AnomalyGuard frontend looks and behaves. The tokens live in
`app/globals.css` (CSS variables, light and dark) and are mapped to Tailwind names in `tailwind.config.ts`.
Status presentation (icons, labels, chart fills, overlay colours) lives in `components/anomaly/status.tsx`.
If you need a colour, it should come from one of these. Raw Tailwind palette classes (`emerald-600`,
`red-500`, ...) and hex values in components are not used, except in the drawn camera scenes.

## Principles

1. **One question per page.** Each page header states the question it answers, and the most important
   information sits top-left. The Overview fits on one 1920×1080 screen.
2. **Show each fact once.** No duplicate widgets; long tables sit in tabs or lower on the page.
3. **Mostly neutrals. Colour means something.** Brand red is for brand surfaces only. Status colours are
   for status only. The same colour never means two things on one screen, and a chart uses one colour
   system, never two.
4. **Never colour alone.** Every severity or status shows an icon and a text label as well.
5. **Accessible by default.** WCAG 2.1 AA contrast, visible focus, full keyboard use, 44 px touch targets on
   mobile, reduced motion respected.

## Colour

### Brand

| Colour | Hex | Use | Never |
|---|---|---|---|
| Heritage Red | `#C9322D` | Primary button (one per view), active nav indicator bar, logo mark | Status, charts, errors |
| Heritage Red, strong | `#941B1E` | Primary button hover; key text links on light backgrounds | |
| Heritage Gold | `#FBBC76` | Brand moments only: the soft wash on the login page | White text on it; gold text on white; anything near a warning |
| Coral | `#F46C6C` | Decorative tints only (login wash) | Warnings or any status |

Gold is kept away from data screens on purpose: it sits too close to the amber warning colour, and
"never the same colour for two meanings on one screen" matters more than using the accent everywhere.

### Status palette, and why critical is plum

Critical, warning, info and success each have three tokens: a solid (`critical`) for icons, bars and chart
marks; a soft background (`critical-soft`); and a text colour (`critical-fg`).

**Critical is plum (`#701A75` light, `#D946EF` dark), not red.** The brand is red, so a red critical
would make every primary button look like an alarm and every alarm look like branding. Plum is still
"hot", it reads as distinct from the brand red at a glance, and it stays distinct for all three common
types of colour blindness (table below). Critical badges also carry the octagon icon and the word
"Critical", so the meaning never rests on hue.

| Status | Icon (lucide) | Light solid | Dark solid | Typical label |
|---|---|---|---|---|
| Critical | `OctagonAlert` | `#701A75` | `#D946EF` | Critical |
| Warning | `TriangleAlert` | `#D97706` | `#FBBF24` | Warning, Budget now |
| Info | `Info` | `#2563EB` | `#BAE6FD` | Info |
| Success | `CircleCheck` | `#0F766E` | `#14B8A6` | Healthy, Repair, In alert centre |

Use `<SeverityBadge severity>` or `<StatusBadge tone>` from `components/anomaly/status.tsx`. They render
the icon and the label together.

Camera overlays sit on drawn scenes that look the same in both themes, so they use fixed light-theme
fills (`TONE_OVERLAY`). Anomaly boxes take their alert's severity colour and name the class in the label.
Everything the model sees in passing (people, vehicles) is outlined in neutral grey.

### All tokens

| Token | Tailwind | Light | Dark | Role |
|---|---|---|---|---|
| `--background` | `background` | `#FAFAF9` | `#0C0A09` | Page background |
| `--foreground` | `foreground` | `#1C1917` | `#FAFAF9` | Body text, headings |
| `--card` | `card` | `#FFFFFF` | `#1C1917` | Cards, sidebar, header |
| `--card-foreground` | `card-foreground` | `#1C1917` | `#FAFAF9` | Text on cards |
| `--popover` | `popover` | `#FFFFFF` | `#1C1917` | Menus, dialogs |
| `--popover-foreground` | `popover-foreground` | `#1C1917` | `#FAFAF9` | Text in menus, dialogs |
| `--muted` | `muted` | `#F5F5F4` | `#292524` | Subtle fills: table headers, tab rails |
| `--muted-foreground` | `muted-foreground` | `#57534E` | `#A8A29E` | Secondary text, captions |
| `--secondary` | `secondary` | `#F5F5F4` | `#292524` | Secondary buttons |
| `--secondary-foreground` | `secondary-foreground` | `#1C1917` | `#FAFAF9` | Text on secondary buttons |
| `--accent` | `accent` | `#F5F5F4` | `#292524` | Hover and selected fills (UI state, not the brand accent) |
| `--accent-foreground` | `accent-foreground` | `#1C1917` | `#FAFAF9` | Text on hover fills |
| `--border` | `border` | `#E7E5E4` | `#3A3532` | Card and divider lines (decorative) |
| `--input` | `input` | `#8A847F` | `#78716C` | Form control borders (must reach 3:1) |
| `--ring` | `ring` | `#1C1917` | `#FAFAF9` | Keyboard focus ring |
| `--primary` | `bg-primary / brand` | `#C9322D` | `#C9322D` | Brand red: primary button, active nav, logo mark |
| `--primary-foreground` | `text-primary-foreground` | `#FFFFFF` | `#FFFFFF` | Text on brand red |
| `--brand-strong` | `brand-strong` | `#941B1E` | `#941B1E` | Brand red hover / pressed |
| `--link` | `link` | `#941B1E` | `#FCA5A1` | Key text links |
| `--gold` | `gold` | `#FBBC76` | `#FBBC76` | Heritage Gold: brand moments only (login), dark text only |
| `--gold-foreground` | `text-gold-foreground` | `#1C1917` | `#1C1917` | Text on gold |
| `--coral` | `coral` | `#F46C6C` | `#F46C6C` | Coral: decorative tints only |
| `--destructive` | `destructive` | `#701A75` | `#D946EF` | Destructive / error toasts (same as critical) |
| `--destructive-foreground` | `destructive-foreground` | `#FFFFFF` | `#1C1917` | Text on destructive |
| `--critical` | `critical` | `#701A75` | `#D946EF` | Critical: icons, bars, chart fills |
| `--critical-soft` | `bg-critical-soft` | `#FDF4FF` | `#3B0A3F` | Critical badge / callout background |
| `--critical-fg` | `text-critical-fg` | `#701A75` | `#F0ABFC` | Critical text |
| `--warning` | `warning` | `#D97706` | `#FBBF24` | Warning: icons, bars, chart fills |
| `--warning-soft` | `bg-warning-soft` | `#FFFBEB` | `#332106` | Warning badge background |
| `--warning-fg` | `text-warning-fg` | `#92400E` | `#FCD34D` | Warning text |
| `--info` | `info` | `#2563EB` | `#BAE6FD` | Info: icons, bars, chart fills |
| `--info-soft` | `bg-info-soft` | `#EFF6FF` | `#0C1E3D` | Info badge background |
| `--info-fg` | `text-info-fg` | `#1E40AF` | `#BAE6FD` | Info text |
| `--success` | `success` | `#0F766E` | `#14B8A6` | Healthy / done: icons, bars |
| `--success-soft` | `bg-success-soft` | `#F0FDFA` | `#042F2E` | Success badge background |
| `--success-fg` | `text-success-fg` | `#115E59` | `#5EEAD4` | Success text |
| `--chart-muted` | `chart-muted` | `#8A847F` | `#78716C` | Chart bars that are context, not the point |
| `--chart-strong` | `chart-strong` | `#44403C` | `#E7E5E4` | The one chart bar that is the point |

### Contrast and colour-blind check

| Pair | Light | Ratio | Dark | Ratio | Needs |
|---|---|---|---|---|---|
| foreground on background | `#1C1917` on `#FAFAF9` | 16.74 | `#FAFAF9` on `#0C0A09` | 18.92 | 4.5:1 text |
| foreground on card | `#1C1917` on `#FFFFFF` | 17.49 | `#FAFAF9` on `#1C1917` | 16.74 | 4.5:1 text |
| muted-foreground on background | `#57534E` on `#FAFAF9` | 7.30 | `#A8A29E` on `#0C0A09` | 7.83 | 4.5:1 text |
| muted-foreground on card | `#57534E` on `#FFFFFF` | 7.63 | `#A8A29E` on `#1C1917` | 6.93 | 4.5:1 text |
| muted-foreground on muted | `#57534E` on `#F5F5F4` | 6.99 | `#A8A29E` on `#292524` | 6.01 | 4.5:1 text |
| primary-foreground on primary | `#FFFFFF` on `#C9322D` | 5.28 | `#FFFFFF` on `#C9322D` | 5.28 | 4.5:1 text |
| primary-foreground on brand-strong | `#FFFFFF` on `#941B1E` | 8.63 | `#FFFFFF` on `#941B1E` | 8.63 | 4.5:1 text |
| link on card | `#941B1E` on `#FFFFFF` | 8.63 | `#FCA5A1` on `#1C1917` | 9.19 | 4.5:1 text |
| gold-foreground on gold | `#1C1917` on `#FBBC76` | 10.46 | `#1C1917` on `#FBBC76` | 10.46 | 4.5:1 text |
| critical-fg on critical-soft | `#701A75` on `#FDF4FF` | 9.34 | `#F0ABFC` on `#3B0A3F` | 9.17 | 4.5:1 text |
| critical-fg on card | `#701A75` on `#FFFFFF` | 10.03 | `#F0ABFC` on `#1C1917` | 9.94 | 4.5:1 text |
| warning-fg on warning-soft | `#92400E` on `#FFFBEB` | 6.84 | `#FCD34D` on `#332106` | 10.70 | 4.5:1 text |
| warning-fg on card | `#92400E` on `#FFFFFF` | 7.09 | `#FCD34D` on `#1C1917` | 12.13 | 4.5:1 text |
| info-fg on info-soft | `#1E40AF` on `#EFF6FF` | 8.01 | `#BAE6FD` on `#0C1E3D` | 12.47 | 4.5:1 text |
| info-fg on card | `#1E40AF` on `#FFFFFF` | 8.72 | `#BAE6FD` on `#1C1917` | 13.18 | 4.5:1 text |
| success-fg on success-soft | `#115E59` on `#F0FDFA` | 7.27 | `#5EEAD4` on `#042F2E` | 9.78 | 4.5:1 text |
| success-fg on card | `#115E59` on `#FFFFFF` | 7.58 | `#5EEAD4` on `#1C1917` | 11.82 | 4.5:1 text |
| destructive-foreground on destructive | `#FFFFFF` on `#701A75` | 10.03 | `#1C1917` on `#D946EF` | 5.06 | 4.5:1 text |
| input on card | `#8A847F` on `#FFFFFF` | 3.69 | `#78716C` on `#1C1917` | 3.65 | 3.0:1 graphic |
| ring on background | `#1C1917` on `#FAFAF9` | 16.74 | `#FAFAF9` on `#0C0A09` | 18.92 | 3.0:1 graphic |
| primary on card | `#C9322D` on `#FFFFFF` | 5.28 | `#C9322D` on `#1C1917` | 3.31 | 3.0:1 graphic |
| critical on card | `#701A75` on `#FFFFFF` | 10.03 | `#D946EF` on `#1C1917` | 5.06 | 3.0:1 graphic |
| warning on card | `#D97706` on `#FFFFFF` | 3.19 | `#FBBF24` on `#1C1917` | 10.48 | 3.0:1 graphic |
| info on card | `#2563EB` on `#FFFFFF` | 5.17 | `#BAE6FD` on `#1C1917` | 13.18 | 3.0:1 graphic |
| success on card | `#0F766E` on `#FFFFFF` | 5.47 | `#14B8A6` on `#1C1917` | 7.03 | 3.0:1 graphic |
| chart-muted on card | `#8A847F` on `#FFFFFF` | 3.69 | `#78716C` on `#1C1917` | 3.65 | 3.0:1 graphic |
| chart-strong on card | `#44403C` on `#FFFFFF` | 10.27 | `#E7E5E4` on `#1C1917` | 13.93 | 3.0:1 graphic |

Closest pair (CIEDE2000 ΔE, higher is more distinct) after simulating each vision type (Machado 2009, full severity):

| Set | Mode | Normal | Protanopia | Deuteranopia | Tritanopia |
|---|---|---|---|---|---|
| Severity (brand + critical/warning/info) | light | 25.8 (primary/warning) | 20.1 (primary/warning) | 13.4 (primary/warning) | 13.7 (primary/warning) |
| Severity (brand + critical/warning/info) | dark | 35.0 (critical/info) | 33.0 (critical/info) | 24.3 (critical/info) | 21.9 (critical/warning) |
| Health (brand + critical/warning/success) | light | 25.8 (primary/warning) | 18.6 (primary/success) | 13.4 (primary/warning) | 13.7 (primary/warning) |
| Health (brand + critical/warning/success) | dark | 37.9 (primary/critical) | 26.4 (warning/success) | 20.3 (critical/success) | 21.9 (critical/warning) |
| Brand red vs critical only | light | 34.9 | 42.9 | 47.7 | 24.2 |
| Brand red vs critical only | dark | 37.9 | 51.3 | 53.4 | 22.5 |

These figures are computed from the token values by `docs/tokens.py` (run `python docs/tokens.py`; `python docs/tokens.py css` prints the globals.css block) (WCAG 2.1 relative luminance; colour-blind
simulation with the Machado et al. 2009 matrices at full severity; distance as CIEDE2000 ΔE). As a rough
guide, ΔE above 10 is clearly distinguishable side by side. The closest pairs are brand red vs warning
amber for deuteranopia and tritanopia (about 13). They never share a role, and warning always carries its
triangle icon and label.

Border (`--border`, about 1.2:1) is decorative: cards are identified by their content, not their outline.
Anything whose outline is the only cue, such as a text field or checkbox, uses `--input` (3.6:1 or more).

## Typography

One font: Inter. Numbers in tables, KPIs and counters use tabular figures (`.tabular`).

| Step | Size / line height | Tailwind | Use |
|---|---|---|---|
| 11 | 11 / 16 px | `text-2xs` | Camera overlays only (box labels, Live and zone chips, timestamps) |
| 12 | 12 / 16 px | `text-xs` | Captions, metadata, table cells with dense data, badges |
| 14 | 14 / 20 px | `text-sm` | Body text, buttons, form controls, descriptions |
| 16 | 16 / 24 px | `text-base` | Card titles (`h2`, semibold) |
| 20 | 20 / 28 px | `text-xl` | Secondary KPI values |
| 24 | 24 / 32 px | `text-2xl` | Page titles (`h1`, semibold), KPI values |
| 30+ | 48 to 60 px | `text-5xl`/`6xl` | The single hero KPI on Analytics |

Heading order: each page has one `h1` (from `PageHeader`); card titles are `h2` by default (`CardTitle`),
and nested sections use `h3` (`<CardTitle as="h3">`).

## Spacing and layout

- 4 px base unit; use steps of 4 and 8: `1` (4), `2` (8), `3` (12), `4` (16), `6` (24), `8` (32).
- Page: `p-4` mobile, `p-6` desktop, content capped at 1600 px. Sections are `space-y-6`; KPI grids `gap-4`.
- Cards: border, no shadow, `rounded-lg`, padding 16 (`p-4`) for dense cards or 24 (`p-6`) by default.
  Shadows are only for things that float: menus, popovers, dialogs, toasts.
- Breakpoints tested: 390, 768, 1280 and 1920 px. No horizontal page scroll; wide tables scroll inside
  their card.

## Components

- **Page header** (`components/layout/page-header.tsx`): title, one line saying what the page answers,
  actions on the right.
- **Buttons**: at most one primary (brand red) button per view, for the action that view exists for
  (Log in, Wear log CSV, Audit summary, Run analysis, Save changes). Everything else is `outline`,
  `ghost` or `link`. Repeated row actions (Resolve, Start work) are never primary.
  Icon-only buttons always have an `aria-label`.
- **Badges**: `StatusBadge` / `SeverityBadge` for status (icon and label), `outline` for neutral facts
  (Awaiting action, Ticket TCK-1019), `default` (dark) for counts.
- **KPI tiles** (`components/anomaly/stat-tile.tsx`): label with icon, then the value. A value is coloured
  only when it is a status (for example open critical alerts), and then the icon matches.
- **Tables**: `bg-muted` header row, 12 px headers, 12 to 14 px cells, tabular numbers, row borders only.
- **Empty, loading and error states**: centred muted text in the card that would hold the data;
  loading uses `Loader2` with a text label; errors use the destructive toast.
- **Icons**: lucide-react only, 16 px in text and buttons (`h-4 w-4`), decorative icons `aria-hidden`.
- **Progress bars**: neutral (`chart-strong`) unless the bar is a status, such as asset health.

## Charts

- Recharts. One colour system per chart: **comparison charts are neutral** (`chart-muted`, with the one
  bar that matters in `chart-strong`); **severity charts use the status palette** with the same tokens as
  the badges.
- Bars are sorted largest first unless the axis is time. Long category names go on a horizontal bar chart
  rather than rotated labels.
- Values are labelled directly on the bars, so value axes and gridlines are hidden.
- No legend when direct labels identify the series. Stacked severity charts show a compact key with
  swatch, icon and label (`SeverityLegend`).
- No 3D, no gradients, no pie charts.
- Camera names, not IDs, on chart axes.

## Accessibility checklist

- Text meets 4.5:1 and UI graphics 3:1 in both themes (tables above).
- `:focus-visible` draws a 2 px outline in `--ring` on anything that does not draw its own focus ring.
- Every icon-only control has an `aria-label`. The navigation marks the current page with
  `aria-current="page"`. Mobile tab labels stay in the accessibility tree (`sr-only`).
- Clickable table rows (Asset register) also contain a real button, so the action works by keyboard.
- Sandbox timeline markers are buttons with descriptive labels; their snapshot previews open on focus
  as well as hover.
- Touch targets are at least 44 px below 768 px: buttons, inputs, selects, tabs and toggles grow to `min-h-11` (the min-size spacing scale is enabled in `tailwind.config.ts`, since Tailwind 3.3 lacks it),
  and switches and checkboxes have an invisible hit area that extends past their outline.
- Motion: `prefers-reduced-motion: reduce` turns off transitions and animations globally. The asset
  ticker pauses on hover, on keyboard focus and with its pause button, and under reduced motion it does
  not move at all and scrolls by hand instead. Page entrance animations were removed.
- Dark mode: every token has a dark value; components use tokens only, so both themes stay in step.

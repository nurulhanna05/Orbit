# Orbit design system

This is the reference for how the Orbit frontend looks and behaves. The tokens live in
`app/globals.css` (CSS variables, light and dark) and are mapped to Tailwind names in `tailwind.config.ts`.
Status presentation (icons, labels, chart fills, overlay colours) lives in `components/anomaly/status.tsx`.
If you need a colour, it should come from one of these. Raw Tailwind palette classes (`emerald-600`,
`red-500`, ...) and hex values in components are not used, except in the drawn camera scenes.

## Principles

1. **One question per page.** Each page header states the question it answers, and the most important
   information sits top-left. The Overview fits on one 1920×1080 screen.
2. **Show each fact once.** No duplicate widgets; long tables sit in tabs or lower on the page.
3. **Mostly neutrals. Colour means something.** Orbit blue is for brand surfaces only. Status colours are
   for status only. The same colour never means two things on one screen, and a chart uses one colour
   system, never two.
4. **Never colour alone.** Every severity or status shows an icon and a text label as well.
5. **Accessible by default.** WCAG 2.1 AA contrast, visible focus, full keyboard use, 44 px touch targets on
   mobile, reduced motion respected.

## Colour

### Logo

The logo is the Orbit wordmark: a gold-to-blue ring around the "O". It comes in two colourways in
`public/brand/`:

| File | Text | Ring | Use on |
|---|---|---|---|
| `orbit-logo-light.svg` | Navy `#0B1846` | Muted gold `#E9A93A` to blue `#2F7FD0` | Light theme |
| `orbit-logo-dark.svg` | Cream `#F5F6F2` | Bright gold `#FFC23D` to blue `#22A6FF`, with glow | Dark theme |

Use `<OrbitLogo>` (`components/layout/orbit-logo.tsx`). It renders both files, and the theme class shows
the right one. The header uses it at 40 px high, the login card at 96 px. Don't recolour it or put it on a coloured
fill. The favicon (`app/icon.svg`) is the ringed "O" on a navy tile, so it works on light and dark
browser tabs.

### Brand

The UI palette is taken from the logo. The neutrals are tinted with the logo's navy, and the brand colour is the blue end
of the ring.

| Colour | Light | Dark | Use | Never |
|---|---|---|---|---|
| Orbit navy | `#0B1846` | | Body text and headings in light mode; text on blue in dark mode | |
| Orbit cream | | `#F5F6F2` | Body text and headings in dark mode | |
| Orbit blue | `#1D6BC0` | `#22A6FF` | Primary button (one per view), active nav indicator bar | Status, charts, errors |
| Orbit blue, strong | `#15529A` | `#63BFFF` | Primary button hover; key text links (`link`: `#15529A` / `#8FD6FF`) | |

The logo's ring blue `#2F7FD0` holds white text at only 4.1:1, so light mode uses the slightly deeper
`#1D6BC0` (5.4:1). Dark mode uses the logo's bright `#22A6FF` with navy text (6.5:1), the same pairing as
the logo itself.

The logo's gold is not a UI colour. It sits too close to the amber warning colour, and "never the same
colour for two meanings on one screen" matters more than echoing the logo. It appears only in the logo itself.

### Status palette, and why info is slate

Critical, warning, info and success each have three tokens: a solid (`critical`) for icons, bars and chart
marks; a soft background (`critical-soft`); and a text colour (`critical-fg`).

**Critical is red** (`#B91C1C` light, `#F87171` dark). The brand is blue, so red can mean "alarm" and nothing else.

**Info is slate (`#475569` light, `#94A3B8` dark), not blue.** A blue info would make every primary button
look like a notice. Violet was tried as well, but people with red-green colour blindness see it as the
same colour as the brand blue (ΔE about 2 to 6). Slate stays distinct from the brand for all three common types of colour
blindness (table below), and info is the lowest severity, so a quieter colour suits it. Info badges also carry the
circled "i" icon and the word "Info", so the meaning never rests on hue.

| Status | Icon (lucide) | Light solid | Dark solid | Typical label |
|---|---|---|---|---|
| Critical | `OctagonAlert` | `#B91C1C` | `#F87171` | Critical |
| Warning | `TriangleAlert` | `#D97706` | `#FBBF24` | Warning, Budget now |
| Info | `Info` | `#475569` | `#94A3B8` | Info |
| Success | `CircleCheck` | `#047857` | `#34D399` | Healthy, Repair, In alert centre |

Use `<SeverityBadge severity>` or `<StatusBadge tone>` from `components/anomaly/status.tsx`. They render
the icon and the label together.

Camera overlays sit on drawn scenes that look the same in both themes, so they use fixed light-theme
fills (`TONE_OVERLAY`). Anomaly boxes take their alert's severity colour and name the class in the label.
Everything the model sees in passing (people, vehicles) is outlined in neutral grey.

### All tokens

| Token | Tailwind | Light | Dark | Role |
|---|---|---|---|---|
| `--background` | `background` | `#F6F7FA` | `#070C1F` | Page background |
| `--foreground` | `foreground` | `#0B1846` | `#F5F6F2` | Body text, headings (Orbit navy / Orbit cream) |
| `--card` | `card` | `#FFFFFF` | `#0E1530` | Cards, sidebar, header |
| `--card-foreground` | `card-foreground` | `#0B1846` | `#F5F6F2` | Text on cards |
| `--popover` | `popover` | `#FFFFFF` | `#0E1530` | Menus, dialogs |
| `--popover-foreground` | `popover-foreground` | `#0B1846` | `#F5F6F2` | Text in menus, dialogs |
| `--muted` | `muted` | `#EEF1F6` | `#18213F` | Subtle fills: table headers, tab rails |
| `--muted-foreground` | `muted-foreground` | `#4A5372` | `#A3ACC7` | Secondary text, captions |
| `--secondary` | `secondary` | `#EEF1F6` | `#18213F` | Secondary buttons |
| `--secondary-foreground` | `secondary-foreground` | `#0B1846` | `#F5F6F2` | Text on secondary buttons |
| `--accent` | `accent` | `#EEF1F6` | `#18213F` | Hover and selected fills (UI state, not the brand accent) |
| `--accent-foreground` | `accent-foreground` | `#0B1846` | `#F5F6F2` | Text on hover fills |
| `--border` | `border` | `#DFE3EC` | `#263052` | Card and divider lines (decorative) |
| `--input` | `input` | `#7F88A3` | `#6B7598` | Form control borders (must reach 3:1) |
| `--ring` | `ring` | `#0B1846` | `#F5F6F2` | Keyboard focus ring |
| `--primary` | `bg-primary / brand` | `#1D6BC0` | `#22A6FF` | Orbit blue: primary button, active nav |
| `--primary-foreground` | `text-primary-foreground` | `#FFFFFF` | `#0B1846` | Text on Orbit blue |
| `--brand-strong` | `brand-strong` | `#15529A` | `#63BFFF` | Orbit blue hover / pressed |
| `--link` | `link` | `#15529A` | `#8FD6FF` | Key text links |
| `--destructive` | `destructive` | `#B91C1C` | `#F87171` | Destructive / error toasts (same as critical) |
| `--destructive-foreground` | `destructive-foreground` | `#FFFFFF` | `#0B1846` | Text on destructive |
| `--critical` | `critical` | `#B91C1C` | `#F87171` | Critical: icons, bars, chart fills |
| `--critical-soft` | `bg-critical-soft` | `#FEF2F2` | `#3B0D14` | Critical badge / callout background |
| `--critical-fg` | `text-critical-fg` | `#991B1B` | `#FCA5A5` | Critical text |
| `--warning` | `warning` | `#D97706` | `#FBBF24` | Warning: icons, bars, chart fills |
| `--warning-soft` | `bg-warning-soft` | `#FFFBEB` | `#332106` | Warning badge background |
| `--warning-fg` | `text-warning-fg` | `#92400E` | `#FCD34D` | Warning text |
| `--info` | `info` | `#475569` | `#94A3B8` | Info: icons, bars, chart fills |
| `--info-soft` | `bg-info-soft` | `#F1F5F9` | `#1A2236` | Info badge background |
| `--info-fg` | `text-info-fg` | `#334155` | `#CBD5E1` | Info text |
| `--success` | `success` | `#047857` | `#34D399` | Healthy / done: icons, bars |
| `--success-soft` | `bg-success-soft` | `#ECFDF5` | `#022C22` | Success badge background |
| `--success-fg` | `text-success-fg` | `#065F46` | `#6EE7B7` | Success text |
| `--chart-muted` | `chart-muted` | `#7F88A3` | `#6B7598` | Chart bars that are context, not the point |
| `--chart-strong` | `chart-strong` | `#1E2A4F` | `#DDE3F0` | The one chart bar that is the point |

### Contrast and colour-blind check

| Pair | Light | Ratio | Dark | Ratio | Needs |
|---|---|---|---|---|---|
| foreground on background | `#0B1846` on `#F6F7FA` | 15.89 | `#F5F6F2` on `#070C1F` | 17.89 | 4.5:1 text |
| foreground on card | `#0B1846` on `#FFFFFF` | 17.03 | `#F5F6F2` on `#0E1530` | 16.56 | 4.5:1 text |
| muted-foreground on background | `#4A5372` on `#F6F7FA` | 7.07 | `#A3ACC7` on `#070C1F` | 8.58 | 4.5:1 text |
| muted-foreground on card | `#4A5372` on `#FFFFFF` | 7.58 | `#A3ACC7` on `#0E1530` | 7.94 | 4.5:1 text |
| muted-foreground on muted | `#4A5372` on `#EEF1F6` | 6.69 | `#A3ACC7` on `#18213F` | 6.99 | 4.5:1 text |
| primary-foreground on primary | `#FFFFFF` on `#1D6BC0` | 5.36 | `#0B1846` on `#22A6FF` | 6.46 | 4.5:1 text |
| primary-foreground on brand-strong | `#FFFFFF` on `#15529A` | 7.76 | `#0B1846` on `#63BFFF` | 8.45 | 4.5:1 text |
| foreground on muted | `#0B1846` on `#EEF1F6` | 15.04 | `#F5F6F2` on `#18213F` | 14.57 | 4.5:1 text |
| link on card | `#15529A` on `#FFFFFF` | 7.76 | `#8FD6FF` on `#0E1530` | 11.32 | 4.5:1 text |
| critical-fg on critical-soft | `#991B1B` on `#FEF2F2` | 7.60 | `#FCA5A5` on `#3B0D14` | 8.83 | 4.5:1 text |
| critical-fg on card | `#991B1B` on `#FFFFFF` | 8.31 | `#FCA5A5` on `#0E1530` | 9.47 | 4.5:1 text |
| warning-fg on warning-soft | `#92400E` on `#FFFBEB` | 6.84 | `#FCD34D` on `#332106` | 10.70 | 4.5:1 text |
| warning-fg on card | `#92400E` on `#FFFFFF` | 7.09 | `#FCD34D` on `#0E1530` | 12.46 | 4.5:1 text |
| info-fg on info-soft | `#334155` on `#F1F5F9` | 9.45 | `#CBD5E1` on `#1A2236` | 10.67 | 4.5:1 text |
| info-fg on card | `#334155` on `#FFFFFF` | 10.35 | `#CBD5E1` on `#0E1530` | 12.10 | 4.5:1 text |
| success-fg on success-soft | `#065F46` on `#ECFDF5` | 7.29 | `#6EE7B7` on `#022C22` | 9.94 | 4.5:1 text |
| success-fg on card | `#065F46` on `#FFFFFF` | 7.68 | `#6EE7B7` on `#0E1530` | 11.79 | 4.5:1 text |
| destructive-foreground on destructive | `#FFFFFF` on `#B91C1C` | 6.47 | `#0B1846` on `#F87171` | 6.16 | 4.5:1 text |
| input on card | `#7F88A3` on `#FFFFFF` | 3.53 | `#6B7598` on `#0E1530` | 3.96 | 3.0:1 graphic |
| ring on background | `#0B1846` on `#F6F7FA` | 15.89 | `#F5F6F2` on `#070C1F` | 17.89 | 3.0:1 graphic |
| primary on card | `#1D6BC0` on `#FFFFFF` | 5.36 | `#22A6FF` on `#0E1530` | 6.82 | 3.0:1 graphic |
| critical on card | `#B91C1C` on `#FFFFFF` | 6.47 | `#F87171` on `#0E1530` | 6.50 | 3.0:1 graphic |
| warning on card | `#D97706` on `#FFFFFF` | 3.19 | `#FBBF24` on `#0E1530` | 10.76 | 3.0:1 graphic |
| info on card | `#475569` on `#FFFFFF` | 7.58 | `#94A3B8` on `#0E1530` | 7.01 | 3.0:1 graphic |
| success on card | `#047857` on `#FFFFFF` | 5.48 | `#34D399` on `#0E1530` | 9.35 | 3.0:1 graphic |
| chart-muted on card | `#7F88A3` on `#FFFFFF` | 3.53 | `#6B7598` on `#0E1530` | 3.96 | 3.0:1 graphic |
| chart-strong on card | `#1E2A4F` on `#FFFFFF` | 14.01 | `#DDE3F0` on `#0E1530` | 13.97 | 3.0:1 graphic |

Closest pair (CIEDE2000 ΔE, higher is more distinct) after simulating each vision type (Machado 2009, full severity):

| Set | Mode | Normal | Protanopia | Deuteranopia | Tritanopia |
|---|---|---|---|---|---|
| Severity (brand + critical/warning/info) | light | 15.2 (primary/info) | 17.8 (primary/info) | 16.0 (primary/info) | 15.4 (primary/info) |
| Severity (brand + critical/warning/info) | dark | 16.4 (primary/info) | 15.0 (primary/info) | 16.4 (primary/info) | 14.7 (primary/info) |
| Health (brand + critical/warning/success) | light | 28.9 (critical/warning) | 15.2 (critical/success) | 17.8 (critical/success) | 9.9 (primary/success) |
| Health (brand + critical/warning/success) | dark | 39.6 (warning/success) | 16.5 (warning/success) | 9.9 (critical/success) | 10.6 (primary/success) |
| Brand blue vs info only | light | 15.2 | 17.8 | 16.0 | 15.4 |
| Brand blue vs info only | dark | 16.4 | 15.0 | 16.4 | 14.7 |

These figures are computed from the token values by `docs/tokens.py` (run `python docs/tokens.py`; `python docs/tokens.py css` prints the globals.css block) (WCAG 2.1 relative luminance; colour-blind
simulation with the Machado et al. 2009 matrices at full severity; distance as CIEDE2000 ΔE). As a rough
guide, ΔE above 10 is clearly distinguishable side by side. The closest pairs are just under 10:
brand blue vs success green for tritanopia (light), and critical red vs success green for deuteranopia (dark).
Brand blue and success never share a role, and every status carries its own icon and label.

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
- **Buttons**: at most one primary (Orbit blue) button per view, for the action that view exists for
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

## Motion

Motion follows the logo: things arrive like a body settling into orbit, quickly at first and then easing
gently into place, and leave by accelerating away. It is short and quiet, never decorative, and there are no
page entrance animations.

| Token (Tailwind) | Value | Use |
|---|---|---|
| `ease-orbit` (also the default for every `transition*` utility) | `cubic-bezier(0.22, 1, 0.36, 1)` | Anything arriving or changing state: hovers, tabs, switches, dialogs, menus, toasts |
| `ease-orbit-in` | `cubic-bezier(0.64, 0, 0.78, 0)` | Anything leaving (applied to every `animate-out`) |
| default duration | 200 ms | Hovers, colour and state changes, menus, popovers, toasts |
| `duration-300` / `duration-150` | 300 ms in, 150 ms out | Dialogs: fade, settle from 97 % scale and rise 8 px |
| `duration-300` / `duration-200` | 300 ms in, 200 ms out | Sheets (mobile navigation) sliding from their edge |
| `duration-500` | 500 ms | Progress bars gliding to a new value |

**Loading: `<OrbitSpinner>`** (`components/ui/orbit-spinner.tsx`) is the only loading indicator. It is the logo
in miniature, a dot orbiting a tilted ring around an "O", once every 1.4 s. `tone="current"` (default) draws in the
text colour for buttons and inline states; `tone="brand"` uses the logo's gold-to-blue ring for full-page
loading. It always sits next to a text label ("Logging in…", "Anonymising photo…") or carries `label` itself.
Generic spinning icons (`Loader2`, `animate-spin`) are not used.

`prefers-reduced-motion: reduce` turns all CSS transitions and animations off globally. The spinner's orbit is
an SVG animation that rule cannot reach, so the component checks the setting itself and holds the dot still.

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
- Motion: `prefers-reduced-motion: reduce` turns off transitions and animations globally, and the Orbit spinner stops orbiting. The asset
  ticker pauses on hover, on keyboard focus and with its pause button, and under reduced motion it does
  not move at all and scrolls by hand instead. Page entrance animations were removed.
- Dark mode: every token has a dark value; components use tokens only, so both themes stay in step.

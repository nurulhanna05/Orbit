"""Single source for Orbit design tokens: emits the globals.css block and the contrast / colour-blind tables."""
import colorsys, sys
from palette import contrast, de2000, simulate, min_pairs, KINDS, hex2rgb
# name: (light, dark, role)
T = {
 'background': ('#F6F7FA', '#070C1F', 'Page background'),
 'foreground': ('#0B1846', '#F5F6F2', 'Body text, headings (Orbit navy / Orbit cream)'),
 'card': ('#FFFFFF', '#0E1530', 'Cards, sidebar, header'),
 'card-foreground': ('#0B1846', '#F5F6F2', 'Text on cards'),
 'popover': ('#FFFFFF', '#0E1530', 'Menus, dialogs'),
 'popover-foreground': ('#0B1846', '#F5F6F2', 'Text in menus, dialogs'),
 'muted': ('#EEF1F6', '#18213F', 'Subtle fills: table headers, tab rails'),
 'muted-foreground': ('#4A5372', '#A3ACC7', 'Secondary text, captions'),
 'secondary': ('#EEF1F6', '#18213F', 'Secondary buttons'),
 'secondary-foreground': ('#0B1846', '#F5F6F2', 'Text on secondary buttons'),
 'accent': ('#EEF1F6', '#18213F', 'Hover and selected fills (UI state, not the brand accent)'),
 'accent-foreground': ('#0B1846', '#F5F6F2', 'Text on hover fills'),
 'border': ('#DFE3EC', '#263052', 'Card and divider lines (decorative)'),
 'input': ('#7F88A3', '#6B7598', 'Form control borders (must reach 3:1)'),
 'ring': ('#0B1846', '#F5F6F2', 'Keyboard focus ring'),
 'primary': ('#1D6BC0', '#22A6FF', 'Orbit blue: primary button, active nav'),
 'primary-foreground': ('#FFFFFF', '#0B1846', 'Text on Orbit blue'),
 'brand-strong': ('#15529A', '#63BFFF', 'Orbit blue hover / pressed'),
 'link': ('#15529A', '#8FD6FF', 'Key text links'),
 'destructive': ('#B91C1C', '#F87171', 'Destructive / error toasts (same as critical)'),
 'destructive-foreground': ('#FFFFFF', '#0B1846', 'Text on destructive'),
 'critical': ('#B91C1C', '#F87171', 'Critical: icons, bars, chart fills'),
 'critical-soft': ('#FEF2F2', '#3B0D14', 'Critical badge / callout background'),
 'critical-fg': ('#991B1B', '#FCA5A5', 'Critical text'),
 'warning': ('#D97706', '#FBBF24', 'Warning: icons, bars, chart fills'),
 'warning-soft': ('#FFFBEB', '#332106', 'Warning badge background'),
 'warning-fg': ('#92400E', '#FCD34D', 'Warning text'),
 'info': ('#475569', '#94A3B8', 'Info: icons, bars, chart fills'),
 'info-soft': ('#F1F5F9', '#1A2236', 'Info badge background'),
 'info-fg': ('#334155', '#CBD5E1', 'Info text'),
 'success': ('#047857', '#34D399', 'Healthy / done: icons, bars'),
 'success-soft': ('#ECFDF5', '#022C22', 'Success badge background'),
 'success-fg': ('#065F46', '#6EE7B7', 'Success text'),
 'chart-muted': ('#7F88A3', '#6B7598', 'Chart bars that are context, not the point'),
 'chart-strong': ('#1E2A4F', '#DDE3F0', 'The one chart bar that is the point'),
}
def hsl(h):
    r, g, b = hex2rgb(h); H, L, S = colorsys.rgb_to_hls(r, g, b)
    return f"{round(H * 360)} {round(S * 100, 1)}% {round(L * 100, 1)}%"
def css():
    out = []
    for i, sel in enumerate((':root', '.dark')):
        out.append(f"  {sel} {{")
        for k, v in T.items(): out.append(f"    --{k}: {hsl(v[i])}; /* {v[i]} */")
        if i == 0: out.append("    --radius: 0.5rem;")
        out.append("  }")
    return '\n'.join(out)
TEXT = [('foreground','background'),('foreground','card'),('muted-foreground','background'),('muted-foreground','card'),('muted-foreground','muted'),
  ('primary-foreground','primary'),('primary-foreground','brand-strong'),('foreground','muted'),('link','card'),
  ('critical-fg','critical-soft'),('critical-fg','card'),('warning-fg','warning-soft'),('warning-fg','card'),
  ('info-fg','info-soft'),('info-fg','card'),('success-fg','success-soft'),('success-fg','card'),('destructive-foreground','destructive')]
GFX = [('input','card'),('ring','background'),('primary','card'),('critical','card'),('warning','card'),('info','card'),('success','card'),('chart-muted','card'),('chart-strong','card')]
def tables():
    rows = ["| Pair | Light | Ratio | Dark | Ratio | Needs |", "|---|---|---|---|---|---|"]
    for kind, pairs, need in (('text', TEXT, 4.5), ('graphic', GFX, 3.0)):
        for a, b in pairs:
            cells = []
            for i in (0, 1):
                r = contrast(T[a][i], T[b][i]); cells += [f"`{T[a][i]}` on `{T[b][i]}`", f"{r:.2f}" + ('' if r >= need else ' **FAIL**')]
            rows.append(f"| {a} on {b} | " + ' | '.join(cells) + f" | {need}:1 {kind} |")
    rows += ["", "Closest pair (CIEDE2000 ΔE, higher is more distinct) after simulating each vision type (Machado 2009, full severity):", "",
             "| Set | Mode | Normal | Protanopia | Deuteranopia | Tritanopia |", "|---|---|---|---|---|---|"]
    sets = {'Severity (brand + critical/warning/info)': ['primary','critical','warning','info'], 'Health (brand + critical/warning/success)': ['primary','critical','warning','success']}
    for name, keys in sets.items():
        for i, mode in ((0, 'light'), (1, 'dark')):
            mp = min_pairs({k: T[k][i] for k in keys})
            rows.append(f"| {name} | {mode} | " + ' | '.join(f"{mp[k][0]:.1f} ({mp[k][1]}/{mp[k][2]})" for k in KINDS) + " |")
    for i, mode in ((0, 'light'), (1, 'dark')):
        rows.append(f"| Brand blue vs info only | {mode} | " + ' | '.join(f"{de2000(simulate(T['primary'][i], k), simulate(T['info'][i], k)):.1f}" for k in KINDS) + " |")
    return '\n'.join(rows)
if __name__ == '__main__':
    print(css() if sys.argv[1:] == ['css'] else tables())

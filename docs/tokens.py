"""Single source for AnomalyGuard design tokens: emits the globals.css block and the contrast / colour-blind tables."""
import colorsys, sys
from palette import contrast, de2000, simulate, min_pairs, KINDS, hex2rgb
# name: (light, dark, role)
T = {
 'background': ('#FAFAF9', '#0C0A09', 'Page background'),
 'foreground': ('#1C1917', '#FAFAF9', 'Body text, headings'),
 'card': ('#FFFFFF', '#1C1917', 'Cards, sidebar, header'),
 'card-foreground': ('#1C1917', '#FAFAF9', 'Text on cards'),
 'popover': ('#FFFFFF', '#1C1917', 'Menus, dialogs'),
 'popover-foreground': ('#1C1917', '#FAFAF9', 'Text in menus, dialogs'),
 'muted': ('#F5F5F4', '#292524', 'Subtle fills: table headers, tab rails'),
 'muted-foreground': ('#57534E', '#A8A29E', 'Secondary text, captions'),
 'secondary': ('#F5F5F4', '#292524', 'Secondary buttons'),
 'secondary-foreground': ('#1C1917', '#FAFAF9', 'Text on secondary buttons'),
 'accent': ('#F5F5F4', '#292524', 'Hover and selected fills (UI state, not the brand accent)'),
 'accent-foreground': ('#1C1917', '#FAFAF9', 'Text on hover fills'),
 'border': ('#E7E5E4', '#3A3532', 'Card and divider lines (decorative)'),
 'input': ('#8A847F', '#78716C', 'Form control borders (must reach 3:1)'),
 'ring': ('#1C1917', '#FAFAF9', 'Keyboard focus ring'),
 'primary': ('#C9322D', '#C9322D', 'Brand red: primary button, active nav, logo mark'),
 'primary-foreground': ('#FFFFFF', '#FFFFFF', 'Text on brand red'),
 'brand-strong': ('#941B1E', '#941B1E', 'Brand red hover / pressed'),
 'link': ('#941B1E', '#FCA5A1', 'Key text links'),
 'gold': ('#FBBC76', '#FBBC76', 'Heritage Gold: brand moments only (login), dark text only'),
 'gold-foreground': ('#1C1917', '#1C1917', 'Text on gold'),
 'coral': ('#F46C6C', '#F46C6C', 'Coral: decorative tints only'),
 'destructive': ('#701A75', '#D946EF', 'Destructive / error toasts (same as critical)'),
 'destructive-foreground': ('#FFFFFF', '#1C1917', 'Text on destructive'),
 'critical': ('#701A75', '#D946EF', 'Critical: icons, bars, chart fills'),
 'critical-soft': ('#FDF4FF', '#3B0A3F', 'Critical badge / callout background'),
 'critical-fg': ('#701A75', '#F0ABFC', 'Critical text'),
 'warning': ('#D97706', '#FBBF24', 'Warning: icons, bars, chart fills'),
 'warning-soft': ('#FFFBEB', '#332106', 'Warning badge background'),
 'warning-fg': ('#92400E', '#FCD34D', 'Warning text'),
 'info': ('#2563EB', '#BAE6FD', 'Info: icons, bars, chart fills'),
 'info-soft': ('#EFF6FF', '#0C1E3D', 'Info badge background'),
 'info-fg': ('#1E40AF', '#BAE6FD', 'Info text'),
 'success': ('#0F766E', '#14B8A6', 'Healthy / done: icons, bars'),
 'success-soft': ('#F0FDFA', '#042F2E', 'Success badge background'),
 'success-fg': ('#115E59', '#5EEAD4', 'Success text'),
 'chart-muted': ('#8A847F', '#78716C', 'Chart bars that are context, not the point'),
 'chart-strong': ('#44403C', '#E7E5E4', 'The one chart bar that is the point'),
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
  ('primary-foreground','primary'),('primary-foreground','brand-strong'),('link','card'),('gold-foreground','gold'),
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
        rows.append(f"| Brand red vs critical only | {mode} | " + ' | '.join(f"{de2000(simulate(T['primary'][i], k), simulate(T['critical'][i], k)):.1f}" for k in KINDS) + " |")
    return '\n'.join(rows)
if __name__ == '__main__':
    print(css() if sys.argv[1:] == ['css'] else tables())

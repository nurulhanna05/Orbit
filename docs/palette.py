"""Palette checks: WCAG contrast, CIEDE2000 distance, and colour-vision-deficiency simulation (Machado 2009, severity 1)."""
import itertools, math, sys

def hex2rgb(h): h = h.lstrip('#'); return [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
def lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def unlin(c): c = min(1, max(0, c)); return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
def lum(h): r, g, b = map(lin, hex2rgb(h)); return 0.2126 * r + 0.7152 * g + 0.0722 * b
def contrast(a, b): la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + 0.05) / (lb + 0.05)

MACHADO = {
    'protan': [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    'deutan': [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    'tritan': [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}
def simulate(h, kind):
    if kind == 'normal': return h
    rgb = [lin(c) for c in hex2rgb(h)]
    out = [sum(m * c for m, c in zip(row, rgb)) for row in MACHADO[kind]]
    return '#' + ''.join(f'{round(unlin(c) * 255):02x}' for c in out)

def lab(h):
    r, g, b = map(lin, hex2rgb(h))
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    return 116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))

def de2000(c1, c2):
    L1, a1, b1 = lab(c1); L2, a2, b2 = lab(c2)
    C1, C2 = math.hypot(a1, b1), math.hypot(a2, b2); Cb = (C1 + C2) / 2
    G = 0.5 * (1 - math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)))
    a1p, a2p = a1 * (1 + G), a2 * (1 + G)
    C1p, C2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360; h2p = math.degrees(math.atan2(b2, a2p)) % 360
    dLp, dCp = L2 - L1, C2p - C1p
    dhp = 0 if C1p * C2p == 0 else (h2p - h1p if abs(h2p - h1p) <= 180 else h2p - h1p - 360 if h2p > h1p else h2p - h1p + 360)
    dHp = 2 * math.sqrt(C1p * C2p) * math.sin(math.radians(dhp / 2))
    Lbp, Cbp = (L1 + L2) / 2, (C1p + C2p) / 2
    hbp = h1p + h2p if C1p * C2p == 0 else ((h1p + h2p) / 2 if abs(h1p - h2p) <= 180 else (h1p + h2p + 360) / 2 if h1p + h2p < 360 else (h1p + h2p - 360) / 2)
    T = 1 - 0.17 * math.cos(math.radians(hbp - 30)) + 0.24 * math.cos(math.radians(2 * hbp)) + 0.32 * math.cos(math.radians(3 * hbp + 6)) - 0.20 * math.cos(math.radians(4 * hbp - 63))
    SL = 1 + 0.015 * (Lbp - 50) ** 2 / math.sqrt(20 + (Lbp - 50) ** 2); SC = 1 + 0.045 * Cbp; SH = 1 + 0.015 * Cbp * T
    RT = -2 * math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7)) * math.sin(math.radians(60 * math.exp(-((hbp - 275) / 25) ** 2)))
    return math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH))

KINDS = ['normal', 'protan', 'deutan', 'tritan']
def min_pairs(colours):
    """For each vision type, the closest pair of named colours and its CIEDE2000 distance."""
    res = {}
    for k in KINDS:
        best = min(((de2000(simulate(a[1], k), simulate(b[1], k)), a[0], b[0]) for a, b in itertools.combinations(colours.items(), 2)))
        res[k] = best
    return res

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'search'
    if mode == 'search':
        brand = '#C9322D'
        others = {'warning': '#D97706', 'info': '#2563EB', 'success': '#15803D'}
        for crit in ['#991B1B', '#7F1D1D', '#B3125B', '#9D174D', '#BE185D', '#A21CAF', '#86198F', '#6D28D9', '#C026D3', '#E11D48']:
            cs = {'brand': brand, 'critical': crit, **others}
            vs_brand = min(de2000(simulate(brand, k), simulate(crit, k)) for k in KINDS)
            mp = min_pairs(cs)
            worst = min(v[0] for v in mp.values())
            print(f"{crit}: vs brand min ΔE {vs_brand:5.1f} | worst pair overall {worst:5.1f} "
                  + ' '.join(f"{k}:{v[0]:.0f}({v[1]}/{v[2]})" for k, v in mp.items()) + f" | on white {contrast(crit, '#FFFFFF'):.2f}")

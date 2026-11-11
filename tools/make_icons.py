"""PNG-иконки для PWA (iOS не берёт SVG). Рисует ту же катушку, что icon.svg, без сторонних библиотек."""
import math, pathlib, struct, zlib

def png(path, n):
    bg = (0x0e, 0x0f, 0x13)
    a, b = (0x6b, 0x55, 0xf5), (0xc0, 0x7b, 0xff)
    s = n / 512
    rows = []
    for yy in range(n):
        row = bytearray([0])
        for xx in range(n):
            d = math.hypot(xx + .5 - 256 * s, yy + .5 - 256 * s) / s
            c = bg
            if d <= 160:  # диагональный градиент, как в icon.svg
                t = min(1, max(0, (xx + yy) / (2 * n)))
                c = tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))
                if abs(d - 118) <= 6 or abs(d - 84) <= 6:
                    c = tuple(round(v + (255 - v) * .35) for v in c)
            if d <= 44: c = bg
            row += bytes(c)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    pathlib.Path(path).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
                                  + chunk(b"IDAT", raw) + chunk(b"IEND", b""))

for n in (192, 512):
    png(pathlib.Path(__file__).parent.parent / "site" / f"icon-{n}.png", n)

"""PNG-иконки для PWA (iOS не берёт SVG). Рисует ту же катушку, что icon.svg, без сторонних библиотек."""
import math, pathlib, struct, zlib

def png(path, n):
    bg, blue, light = (0x16, 0x18, 0x1d), (0x2a, 0x62, 0xd9), (0x6b, 0x9b, 0xff)
    s = n / 512
    rows = []
    for yy in range(n):
        row = bytearray([0])
        for xx in range(n):
            d = math.hypot(xx + .5 - 256 * s, yy + .5 - 256 * s) / s
            c = bg
            if d <= 150: c = blue
            if abs(d - 110) <= 7 or abs(d - 74) <= 7: c = light
            if d <= 38: c = bg
            row += bytes(c)
        rows.append(bytes(row))
    raw = zlib.compress(b"".join(rows), 9)
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    pathlib.Path(path).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 2, 0, 0, 0))
                                  + chunk(b"IDAT", raw) + chunk(b"IEND", b""))

for n in (192, 512):
    png(pathlib.Path(__file__).parent.parent / "site" / f"icon-{n}.png", n)

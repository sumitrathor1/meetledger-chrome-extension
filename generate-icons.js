/**
 * Icon Generator for MeetLedger
 * Generates icon-16.png, icon-32.png, icon-48.png, icon-128.png
 * Using Node.js built-in zlib and fs without any external dependencies.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPNG(width, height, rgbaBuffer) {
  // Add filter byte (0 = None) at the beginning of each scanline
  const scanlineWidth = width * 4;
  const filteredData = Buffer.alloc(height * (scanlineWidth + 1));

  for (let y = 0; y < height; y++) {
    filteredData[y * (scanlineWidth + 1)] = 0; // Filter: None
    rgbaBuffer.copy(
      filteredData,
      y * (scanlineWidth + 1) + 1,
      y * scanlineWidth,
      (y + 1) * scanlineWidth
    );
  }

  const compressedData = zlib.deflateSync(filteredData, { level: 9 });

  // CRC32 calculation table
  const crcTable = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4);
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA color type
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function drawMeetLedgerIcon(size) {
  const buf = Buffer.alloc(size * size * 4);

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const idx = (y * size + x) * 4;
    const currentA = buf[idx + 3] / 255;
    const newA = a / 255;
    const outA = newA + currentA * (1 - newA);

    if (outA > 0) {
      buf[idx] = Math.round((r * newA + buf[idx] * currentA * (1 - newA)) / outA);
      buf[idx + 1] = Math.round((g * newA + buf[idx + 1] * currentA * (1 - newA)) / outA);
      buf[idx + 2] = Math.round((b * newA + buf[idx + 2] * currentA * (1 - newA)) / outA);
      buf[idx + 3] = Math.round(outA * 255);
    }
  }

  function fillRoundedRect(x, y, w, h, r, red, green, blue, alpha) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        let inside = false;
        if (px >= x + r && px < x + w - r && py >= y && py < y + h) inside = true;
        else if (py >= y + r && py < y + h - r && px >= x && px < x + w) inside = true;
        else {
          const cx = px < x + r ? x + r : x + w - r - 1;
          const cy = py < y + r ? y + r : y + h - r - 1;
          const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
          if (dist <= r) inside = true;
        }
        if (inside) setPixel(px, py, red, green, blue, alpha);
      }
    }
  }

  function fillCircle(cx, cy, radius, red, green, blue, alpha) {
    for (let py = Math.floor(cy - radius); py <= Math.ceil(cy + radius); py++) {
      for (let px = Math.floor(cx - radius); px <= Math.ceil(cx + radius); px++) {
        const dist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
        if (dist <= radius) {
          setPixel(px, py, red, green, blue, alpha);
        }
      }
    }
  }

  function drawLine(x0, y0, x1, y1, width, red, green, blue, alpha) {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0;
    let cy = y0;

    while (true) {
      fillCircle(cx, cy, width / 2, red, green, blue, alpha);
      if (Math.abs(cx - x1) < 1 && Math.abs(cy - y1) < 1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }
    }
  }

  const s = size / 128;

  // 1. Base Indigo/Blue Card
  fillRoundedRect(Math.round(8 * s), Math.round(8 * s), Math.round(112 * s), Math.round(112 * s), Math.round(24 * s), 79, 70, 229, 255);

  // 2. White Ledger Sheet
  fillRoundedRect(Math.round(22 * s), Math.round(22 * s), Math.round(84 * s), Math.round(84 * s), Math.round(14 * s), 255, 255, 255, 255);

  // 3. Header Bar
  fillRoundedRect(Math.round(22 * s), Math.round(22 * s), Math.round(84 * s), Math.round(18 * s), Math.round(10 * s), 238, 242, 255, 255);

  // Three dots in header
  fillCircle(Math.round(36 * s), Math.round(31 * s), Math.max(1, Math.round(3 * s)), 99, 102, 241, 255);
  fillCircle(Math.round(64 * s), Math.round(31 * s), Math.max(1, Math.round(3 * s)), 99, 102, 241, 255);
  fillCircle(Math.round(92 * s), Math.round(31 * s), Math.max(1, Math.round(3 * s)), 99, 102, 241, 255);

  // 4. Ledger rows
  // Row 1
  fillCircle(Math.round(38 * s), Math.round(54 * s), Math.max(1, Math.round(5 * s)), 129, 140, 248, 255);
  fillRoundedRect(Math.round(48 * s), Math.round(51 * s), Math.round(34 * s), Math.max(2, Math.round(6 * s)), Math.round(2 * s), 226, 232, 240, 255);
  fillCircle(Math.round(92 * s), Math.round(54 * s), Math.max(1, Math.round(4 * s)), 16, 185, 129, 255);

  // Row 2
  fillCircle(Math.round(38 * s), Math.round(70 * s), Math.max(1, Math.round(5 * s)), 165, 180, 252, 255);
  fillRoundedRect(Math.round(48 * s), Math.round(67 * s), Math.round(26 * s), Math.max(2, Math.round(6 * s)), Math.round(2 * s), 226, 232, 240, 255);
  fillCircle(Math.round(92 * s), Math.round(70 * s), Math.max(1, Math.round(4 * s)), 16, 185, 129, 255);

  // Mini Analytics Bars (bottom left)
  fillRoundedRect(Math.round(36 * s), Math.round(90 * s), Math.round(6 * s), Math.round(8 * s), Math.round(2 * s), 199, 210, 254, 255);
  fillRoundedRect(Math.round(46 * s), Math.round(86 * s), Math.round(6 * s), Math.round(12 * s), Math.round(2 * s), 129, 140, 248, 255);
  fillRoundedRect(Math.round(56 * s), Math.round(82 * s), Math.round(6 * s), Math.round(16 * s), Math.round(2 * s), 99, 102, 241, 255);
  fillRoundedRect(Math.round(66 * s), Math.round(78 * s), Math.round(6 * s), Math.round(20 * s), Math.round(2 * s), 79, 70, 229, 255);

  // Floating Checkmark Badge (bottom right)
  fillCircle(Math.round(94 * s), Math.round(92 * s), Math.round(15 * s), 16, 185, 129, 255);
  // Checkmark lines
  drawLine(Math.round(88 * s), Math.round(92 * s), Math.round(92 * s), Math.round(96 * s), Math.max(1.5, 3 * s), 255, 255, 255, 255);
  drawLine(Math.round(92 * s), Math.round(96 * s), Math.round(101 * s), Math.round(87 * s), Math.max(1.5, 3 * s), 255, 255, 255, 255);

  return buf;
}

const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, 'assets', 'icons');

sizes.forEach(size => {
  const rgba = drawMeetLedgerIcon(size);
  const pngBuf = createPNG(size, size, rgba);
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, pngBuf);
  console.log(`Generated ${outPath} (${size}x${size}, ${pngBuf.length} bytes)`);
});


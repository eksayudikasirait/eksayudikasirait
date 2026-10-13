import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let crc = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c >>> 0;
}

function makePng(width, height, isMaskable = false) {
  // Create scanlines: each row has 1 filter byte (0) + width * 4 RGBA bytes
  const rowLen = 1 + width * 4;
  const raw = Buffer.alloc(height * rowLen);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = (Math.min(width, height) / 2) * (isMaskable ? 0.95 : 0.88);
  const innerR = outerR * 0.78;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLen;
    raw[rowOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background color: Deep royal navy (#020617)
      let r = 2;
      let g = 6;
      let b = 23;
      let a = 255;

      if (isMaskable) {
        // Full bleed background for maskable icon
        r = 2;
        g = 6;
        b = 23;
      } else {
        // Rounded corner squircle
        const cornerDist = Math.max(Math.abs(dx) - width * 0.38, Math.abs(dy) - height * 0.38, 0);
        if (cornerDist > width * 0.08) {
          a = 0;
        }
      }

      if (a > 0) {
        // Golden ring
        if (dist <= outerR && dist >= outerR - Math.max(2, width * 0.035)) {
          r = 251; // Amber gold #f59e0b
          g = 191;
          b = 36;
        } else if (dist < outerR - Math.max(2, width * 0.035) && dist > innerR) {
          // Sky blue ring fill
          r = 12;
          g = 74;
          b = 110;
        } else if (dist <= innerR) {
          // Central emblem background: deep indigo navy
          r = 15;
          g = 23;
          b = 42;

          // Computer monitor / ANBK shield motif in center
          const iconW = innerR * 0.95;
          const iconH = innerR * 0.7;
          if (Math.abs(dx) < iconW && Math.abs(dy) < iconH) {
            // Monitor screen bezel
            if (
              Math.abs(dx) > iconW - Math.max(2, width * 0.02) ||
              Math.abs(dy) > iconH - Math.max(2, width * 0.02)
            ) {
              r = 56; // Sky 400
              g = 189;
              b = 248;
            } else {
              // Screen center
              r = 8;
              g = 47;
              b = 73;

              // Checkmark / Book wings in center of screen
              if (Math.abs(dy - 2) < innerR * 0.22 && Math.abs(dx) < innerR * 0.5) {
                const wingY = Math.abs(dx) * 0.35 - innerR * 0.05;
                if (Math.abs(dy - wingY) < Math.max(2, width * 0.025)) {
                  r = 52; // Emerald 400
                  g = 211;
                  b = 153;
                }
              }
            }
          }

          // Monitor stand
          if (Math.abs(dx) < width * 0.04 && dy >= iconH && dy <= innerR * 0.85) {
            r = 148;
            g = 163;
            b = 184;
          }
          if (Math.abs(dx) < width * 0.18 && dy >= innerR * 0.8 && dy <= innerR * 0.92) {
            r = 251;
            g = 191;
            b = 36;
          }
        }
      }

      raw[pxOffset] = r;
      raw[pxOffset + 1] = g;
      raw[pxOffset + 2] = b;
      raw[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(raw, { level: 9 });

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // Bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Compression
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', deflated);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const typeAndData = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate PWA icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), makePng(192, 192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), makePng(512, 512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), makePng(512, 512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), makePng(180, 180, false));
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), makePng(64, 64, false));

// SVG icon
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="104" fill="#020617"/>
  <circle cx="256" cy="256" r="210" fill="none" stroke="#f59e0b" stroke-width="14"/>
  <circle cx="256" cy="256" r="190" fill="#0c4a6e" opacity="0.4"/>
  <rect x="116" y="136" width="280" height="190" rx="18" fill="#0f172a" stroke="#38bdf8" stroke-width="12"/>
  <rect x="136" y="156" width="240" height="150" rx="10" fill="#0369a1" opacity="0.3"/>
  <path d="M176 230 L236 270 L336 190" fill="none" stroke="#34d399" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="236" y="326" width="40" height="50" fill="#94a3b8"/>
  <rect x="186" y="376" width="140" height="24" rx="12" fill="#f59e0b"/>
  <text x="256" y="440" font-family="system-ui, sans-serif" font-weight="800" font-size="28" fill="#38bdf8" text-anchor="middle" letter-spacing="4">ANBK SMPN 7</text>
</svg>`;

fs.writeFileSync(path.join(publicDir, 'icon.svg'), svgContent, 'utf-8');

console.log('PWA icons generated successfully in public/');

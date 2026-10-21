/**
 * MiniLedger Automated PNG Asset Generator
 * Generates valid, crisp PNG files for Expo Go without external native image libraries:
 *  - apps/mobile/assets/icon.png (1024x1024)
 *  - apps/mobile/assets/adaptive-icon.png (1024x1024)
 *  - apps/mobile/assets/splash.png (1284x2778)
 *  - apps/mobile/assets/favicon.png (64x64)
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// Precompute CRC32 table required by the PNG specification
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
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

function createPngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

/**
 * Renders a stylized MiniLedger Brand Emblem (Indigo Obsidian background,
 * Glowing Royal Indigo rounded card, and Saffron Gold geometric Ledger/Rupee bars)
 */
function generateMiniLedgerPng(width, height, isSplash = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Each scanline has 1 filter byte + width * 4 RGBA bytes
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  const cx = width / 2;
  const cy = height / 2;
  const emblemRadius = isSplash
    ? Math.min(width, height) * 0.16
    : Math.min(width, height) * 0.34;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Base background: Deep Obsidian (#090D16) with subtle radial indigo glow
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let r = 9;
      let g = 13;
      let b = 22;

      // Radial ambient glow around center
      const glowRadius = emblemRadius * 1.65;
      if (dist < glowRadius) {
        const t = 1 - dist / glowRadius;
        r = Math.min(255, Math.round(r + 45 * t * t));
        g = Math.min(255, Math.round(g + 38 * t * t));
        b = Math.min(255, Math.round(b + 110 * t * t));
      }

      // Rounded Square Emblem Box
      const boxHalf = emblemRadius * 0.85;
      const cornerRadius = boxHalf * 0.28;
      const qx = Math.abs(dx) - (boxHalf - cornerRadius);
      const qy = Math.abs(dy) - (boxHalf - cornerRadius);
      const roundBoxDist =
        Math.sqrt(Math.max(qx, 0) ** 2 + Math.max(qy, 0) ** 2) +
        Math.min(Math.max(qx, qy), 0) -
        cornerRadius;

      if (roundBoxDist <= 0) {
        // Inside Royal Indigo Card (#4F46E5 -> #3730A3 gradient)
        const grad = (dy + boxHalf) / (2 * boxHalf);
        r = Math.round(99 * (1 - grad) + 55 * grad);
        g = Math.round(102 * (1 - grad) + 48 * grad);
        b = Math.round(241 * (1 - grad) + 163 * grad);

        // Inner Gold border ring
        if (roundBoxDist > -Math.max(2, emblemRadius * 0.035)) {
          r = 245;
          g = 158;
          b = 11;
        }

        // Geometric Rupee / Ledger Bars inside the emblem (Saffron Gold #F59E0B & Crisp White)
        const nx = dx / boxHalf; // Normalized -1 to 1
        const ny = dy / boxHalf; // Normalized -1 to 1

        const isTopBar = Math.abs(nx) < 0.46 && ny > -0.52 && ny < -0.34;
        const isMidBar = Math.abs(nx) < 0.46 && ny > -0.22 && ny < -0.06;
        const isStem = nx > -0.46 && nx < -0.26 && ny > -0.52 && ny < 0.52;
        const isDiagonal =
          ny >= -0.06 && ny <= 0.54 && Math.abs(nx - (ny * 0.95 - 0.1)) < 0.13;

        if (isTopBar || isMidBar || isDiagonal) {
          // Saffron Gold (#FBBF24)
          r = 251;
          g = 191;
          b = 36;
        } else if (isStem) {
          // Crisp Ivory White (#F8FAFC)
          r = 248;
          g = 250;
          b = 252;
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = 255;
    }
  }

  const compressed = zlib.deflateSync(rawData, { level: 6 });

  return Buffer.concat([
    signature,
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", compressed),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function run() {
  const assetsDir = path.join(__dirname, "..", "apps", "mobile", "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  const targets = [
    { name: "icon.png", width: 512, height: 512, splash: false },
    { name: "adaptive-icon.png", width: 512, height: 512, splash: false },
    { name: "splash.png", width: 720, height: 1520, splash: true },
    { name: "favicon.png", width: 64, height: 64, splash: false },
  ];

  console.log(
    "🎨 [MiniLedger] Generating brand icons & splash screen assets...",
  );
  for (const item of targets) {
    const filePath = path.join(assetsDir, item.name);
    const pngBuffer = generateMiniLedgerPng(
      item.width,
      item.height,
      item.splash,
    );
    fs.writeFileSync(filePath, pngBuffer);
    console.log(
      `   ✅ Created apps/mobile/assets/${item.name} (${item.width}x${item.height})`,
    );
  }
  console.log("✨ [MiniLedger] All Expo Go assets generated successfully!");
}

run();

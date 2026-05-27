const sharp = require('sharp');
const path = require('path');

const SIZE = 1024;
const CORNER_R = 220;
const PADDING = 60;

async function main() {
  const srcPath = path.join(__dirname, 'eye-closed.png');
  const outDir = __dirname;
  const embedSize = SIZE - PADDING * 2;

  const chicken = await sharp(srcPath)
    .resize(embedSize, embedSize, { fit: 'cover' })
    .ensureAlpha()
    .png()
    .toBuffer();

  const maskSvg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${PADDING}" y="${PADDING}" width="${embedSize}" height="${embedSize}" rx="${CORNER_R}" ry="${CORNER_R}" fill="white"/>
  </svg>`;
  const maskBuffer = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  const finalBuffer = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: chicken, left: PADDING, top: PADDING },
      { input: maskBuffer, blend: 'dest-in' }
    ])
    .png()
    .toBuffer();

  const sizes = [1024, 512, 256, 128, 64, 48, 32, 16];
  for (const s of sizes) {
    const out = s === 1024
      ? path.join(outDir, 'icon-vault-md.png')
      : path.join(outDir, `icon-vault-md-${s}.png`);
    await sharp(finalBuffer).resize(s, s).png().toFile(out);
    console.log(`  -> ${out} (${s}x${s})`);
  }

  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });

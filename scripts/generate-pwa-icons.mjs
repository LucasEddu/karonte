import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'public/assets/karonte-favicon.svg'));

const outputs = [
  { file: 'pwa-192x192.png', size: 192 },
  { file: 'pwa-512x512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'pwa-maskable-512x512.png', size: 512, maskable: true },
];

for (const { file, size, maskable } of outputs) {
  const iconSize = maskable ? Math.round(size * 0.72) : size;
  const icon = await sharp(source).resize(iconSize, iconSize).png().toBuffer();

  let pipeline = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: maskable ? '#993C1D' : { r: 11, g: 16, b: 24, alpha: 1 },
    },
  }).composite([{ input: icon, gravity: 'centre' }]);

  await pipeline.png().toFile(join(root, 'public', file));
  console.log(`generated public/${file}`);
}

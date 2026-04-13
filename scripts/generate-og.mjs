import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';

const svgPath = join(process.cwd(), 'public', 'og-default.svg');
const pngPath = join(process.cwd(), 'public', 'og-default.png');

const svgBuffer = readFileSync(svgPath);

await sharp(svgBuffer)
  .resize(1200, 630)
  .png()
  .toFile(pngPath);

console.log('✅ og-default.png generated');
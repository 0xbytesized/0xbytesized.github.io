import sharp from 'sharp';
import { readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const svgPath = join(process.cwd(), 'public', 'og-default.svg');
const pngPath = join(process.cwd(), 'public', 'og-default.png');

// Solo regenerar si el SVG es más reciente que el PNG
if (existsSync(pngPath) && statSync(svgPath).mtimeMs < statSync(pngPath).mtimeMs) {
  console.log('✅ og-default.png is up to date');
  process.exit(0);
}

const svgContent = readFileSync(svgPath, 'utf8');

// Replace generic font names with installed fonts
const withFonts = svgContent
  .replace(/font-family="monospace"/g, 'font-family="DejaVu Sans Mono"')
  .replace(/font-family="sans-serif"/g, 'font-family="DejaVu Sans"');

await sharp(Buffer.from(withFonts))
  .resize(1200, 630)
  .png()
  .toFile(pngPath);

console.log('✅ og-default.png generated');

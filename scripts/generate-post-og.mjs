import sharp from 'sharp';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const blogDir = join(process.cwd(), 'src', 'content', 'blog');
const outDir = join(process.cwd(), 'public', 'og');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const files = readdirSync(blogDir).filter(f => f.endsWith('.mdx'));

for (const file of files) {
  const content = readFileSync(join(blogDir, file), 'utf-8');
  const titleMatch = content.match(/^title:\s*["'](.+?)["']/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled';

  // Truncate title if too long for the image
  const displayTitle = title.length > 55 ? title.substring(0, 52) + '...' : title;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0b" />
      <stop offset="100%" style="stop-color:#111113" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#22d3ee" />
      <stop offset="100%" style="stop-color:#a78bfa" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)" />
  <rect x="0" y="620" width="1200" height="10" fill="url(#accent)" />
  <text x="80" y="100" font-family="monospace" font-size="28" font-weight="bold" fill="#22d3ee">0xbytesized</text>
  <text x="80" y="300" font-family="sans-serif" font-size="52" font-weight="bold" fill="#e4e4e7">${escapeXml(displayTitle)}</text>
  <rect x="80" y="420" width="200" height="4" rx="2" fill="url(#accent)" opacity="0.4" />
  <text x="80" y="500" font-family="monospace" font-size="18" fill="#52525b">0xbytesized.github.io</text>
</svg>`;

  const slug = file.replace('.mdx', '');
  const pngPath = join(outDir, `${slug}.png`);

  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png()
    .toFile(pngPath);

  console.log(`✅ ${slug}.png`);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
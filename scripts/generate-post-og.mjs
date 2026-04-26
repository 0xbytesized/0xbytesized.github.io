import sharp from 'sharp';
import { readdirSync, readFileSync, statSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const blogDir = join(process.cwd(), 'src', 'content', 'blog');
const outDir = join(process.cwd(), 'public', 'og');

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const files = readdirSync(blogDir).filter(f => f.endsWith('.mdx'));

// Map de tags a emoji/icono
const TAG_ICONS = {
  rust: '🦀',
  zig: '⚡',
  javascript: '🟨',
  typescript: '🔷',
  sql: '🗄️',
  postgres: '🐘',
  react: '⚛️',
  web: '🌐',
  seguridad: '🔒',
  linux: '🐧',
  ai: '🤖',
  ia: '🤖',
  tooling: '🔧',
  performance: '⚡',
  video: '🎬',
  audio: '🎧',
  webgl: '🎮',
  compiler: '⚙️',
  compilador: '⚙️',
};

function pickIcon(tags) {
  if (!tags || tags.length === 0) return '💻';
  for (const tag of tags) {
    const t = tag.toLowerCase().trim();
    if (TAG_ICONS[t]) return TAG_ICONS[t];
  }
  return '💻';
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  } catch {
    return dateStr;
  }
}

const FONT_REGULAR = 'DejaVu Sans';
const FONT_BOLD = 'DejaVu Sans';
const FONT_MONO = 'DejaVu Sans Mono';

let generated = 0;
let skipped = 0;

for (const file of files) {
  const slug = file.replace('.mdx', '');
  const pngPath = join(outDir, `${slug}.png`);

  const mdxStat = statSync(join(blogDir, file));
  if (existsSync(pngPath) && mdxStat.mtimeMs < statSync(pngPath).mtimeMs) {
    skipped++;
    continue;
  }

  const content = readFileSync(join(blogDir, file), 'utf-8');

  // Parse frontmatter
  const titleMatch = content.match(/^title:\s*["'](.+?)["']/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled';

  const dateMatch = content.match(/^date:\s*["']?(.+?)["']?\s*$/m);
  const dateStr = dateMatch ? dateMatch[1] : '';

  const tagsMatch = content.match(/^tags:\s*\[(.+?)\]/m);
  const tags = tagsMatch
    ? tagsMatch[1].split(',').map(t => t.trim().replace(/["']/g, '')).filter(Boolean)
    : [];

  const displayTitle = title.length > 55 ? title.substring(0, 52) + '...' : title;
  const icon = pickIcon(tags);
  const formattedDate = formatDate(dateStr);

  // Generate tags chips
  const chips = tags.slice(0, 4).map((tag, i) => {
    const x = 80 + i * (tag.length * 14 + 40);
    return `
      <rect x="${x}" y="420" width="${tag.length * 12 + 24}" height="28" rx="14" fill="#1c1c1f" stroke="#22d3ee" stroke-width="1" />
      <text x="${x + 12}" y="439" font-family="${FONT_REGULAR}" font-size="14" fill="#22d3ee" text-anchor="middle">${escapeXml(tag)}</text>
    `;
  }).join('\n    ');

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

  <!-- Header -->
  <text x="80" y="80" font-family="${FONT_BOLD}" font-size="24" font-weight="bold" fill="#22d3ee">0xbytesized</text>
  <text x="1120" y="80" font-family="${FONT_MONO}" font-size="16" fill="#52525b" text-anchor="end">${escapeXml(formattedDate)}</text>

  <!-- Icon -->
  <text x="80" y="200" font-size="48">${icon}</text>

  <!-- Title -->
  <text x="80" y="280" font-family="${FONT_BOLD}" font-size="48" font-weight="bold" fill="#e4e4e7">${escapeXml(displayTitle)}</text>

  <!-- Tags -->
  ${chips}

  <!-- URL -->
  <text x="80" y="510" font-family="${FONT_MONO}" font-size="18" fill="#52525b">0xbytesized.github.io</text>
</svg>`;

  await sharp(Buffer.from(svg))
    .resize(1200, 630)
    .png()
    .toFile(pngPath);

  generated++;
}

console.log(`✅ OG images: ${generated} generated, ${skipped} skipped (up to date)`);

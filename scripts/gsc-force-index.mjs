import { google } from 'googleapis';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const credsPath = process.argv[2] || process.env.GSC_CREDENTIALS;
if (!credsPath) {
  console.error('Usage: node scripts/gsc-force-index.mjs <path-to-service-account.json>');
  console.error('   or: GSC_CREDENTIALS=<path> node scripts/gsc-force-index.mjs');
  process.exit(1);
}
const credentials = JSON.parse(readFileSync(credsPath, 'utf8'));
const SITE_URL = 'https://0xbytesized.github.io';

// Leer todos los posts dinámicamente
const blogDir = join(__dirname, '..', 'src', 'content', 'blog');
const posts = readdirSync(blogDir)
  .filter(f => f.endsWith('.mdx'))
  .map(f => f.replace('.mdx', ''));

const SITEMAP_URLS = [
  `${SITE_URL}/`,
  `${SITE_URL}/sobre-mi/`,
  ...posts.map(slug => `${SITE_URL}/${slug}/`),
];

function makeAuth(scopes) {
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
  });
}

async function main() {
  console.log(`\n📋 Posts encontrados: ${posts.length}`);
  console.log(`🚀 Solicitando indexación de ${SITEMAP_URLS.length} URLs vía Indexing API...\n`);

  const indexAuth = makeAuth(['https://www.googleapis.com/auth/indexing']);
  let success = 0;
  let failed = 0;

  for (const url of SITEMAP_URLS) {
    try {
      const res = await google.indexing('v3').urlNotifications.publish({
        requestBody: { type: 'URL_UPDATED', url },
        auth: indexAuth,
      });
      console.log(`✅ ${url} → ${res.data.urlNotification?.type || 'queued'}`);
      success++;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      const code = err.code || err.response?.status;
      console.log(`❌ ${url} → ${code}: ${msg}`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n📊 Indexing API: ${success} OK, ${failed} fallidas de ${SITEMAP_URLS.length}\n`);

  // Step 2: Check index status with URL Inspection API
  console.log('─'.repeat(60));
  console.log('📋 Estado actual de indexación (URL Inspection):\n');

  const scAuth = makeAuth(['https://www.googleapis.com/auth/webmasters']);
  await scAuth.authorize();
  const searchconsole = google.searchconsole({ version: 'v1', auth: scAuth });

  const checkUrls = [
    SITE_URL + '/',
    SITE_URL + '/skills-no-son-la-respuesta-claude-code/',
    SITE_URL + '/svelte-5-runas/',
    SITE_URL + '/sobre-mi/',
  ];

  for (const url of checkUrls) {
    try {
      const inspect = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          siteUrl: SITE_URL + '/',
          inspectionUrl: url,
        }
      });
      const result = inspect.data?.inspectionResult?.indexStatusResult;
      console.log(`🔍 ${url}`);
      console.log(`   Indexado: ${result?.verdict || 'desconocido'}`);
      console.log(`   Último crawl: ${result?.lastCrawlTime || 'nunca'}`);
      console.log(`   PageFetch: ${result?.pageFetchState || '?'}`);
      console.log(`   robots.txt: ${result?.robotsTxtState || '?'}`);
      console.log('');
    } catch (err) {
      console.error(`   Error: ${err.message}\n`);
    }
  }
}

main().catch(console.error);

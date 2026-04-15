import { google } from 'googleapis';
import { readFileSync } from 'fs';

const credentials = JSON.parse(readFileSync('/data/secrets/gsc-service-account.json', 'utf8'));
const SITE_URL = 'https://0xbytesized.github.io';

const SITEMAP_URLS = [
  `${SITE_URL}/`,
  `${SITE_URL}/6502-postgres-emulador-cpu-sql/`,
  `${SITE_URL}/astro-5-server-islands/`,
  `${SITE_URL}/biome-2-linting-rapido-con-tipos/`,
  `${SITE_URL}/bun-1-2-todo-lo-que-necesitas/`,
  `${SITE_URL}/cloudflare-cf-cli-reemplaza-wrangler/`,
  `${SITE_URL}/deno-2-compatibilidad-node/`,
  `${SITE_URL}/docker-pull-espana-laliga/`,
  `${SITE_URL}/effect-ts-tipos-que-cuidan/`,
  `${SITE_URL}/elysia-bun-framework-jit/`,
  `${SITE_URL}/enlightenment-e16-bug-20-anos-newton/`,
  `${SITE_URL}/final-eleventy-monetizacion-ssg/`,
  `${SITE_URL}/github-stacked-prs-gh-stack/`,
  `${SITE_URL}/jujutsu-jj-el-vcs-que-git-quiso-ser/`,
  `${SITE_URL}/openssl-4-ech-postcuantico-adios-ssl3/`,
  `${SITE_URL}/por-que-ai-falla-frontend/`,
  `${SITE_URL}/react-19-server-components/`,
  `${SITE_URL}/rust-2024-edicion-nuevas-reglas/`,
  `${SITE_URL}/servo-0-1-crates-embed-web-rust/`,
  `${SITE_URL}/skills-no-son-la-respuesta-claude-code/`,
  `${SITE_URL}/sobre-mi/`,
  `${SITE_URL}/svelte-5-runas/`,
  `${SITE_URL}/tailwind-css-4-oxide/`,
  `${SITE_URL}/vite-6-ecosistema-moderno/`,
  `${SITE_URL}/wordpress-supply-chain-30-plugins-backdoor/`,
  `${SITE_URL}/zig-0-16-io-interfaz-revolucion/`,
];

function makeAuth(scopes) {
  return new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes,
  });
}

async function main() {
  // Step 1: Try Indexing API
  console.log(`\n🚀 Solicitando indexación de ${SITEMAP_URLS.length} URLs vía Indexing API...\n`);

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
      const amp = inspect.data?.inspectionResult?.ampResult;
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
import { google } from 'googleapis';
import { readFileSync } from 'fs';

const credsPath = process.argv[2] || process.env.GSC_CREDENTIALS;
if (!credsPath) {
  console.error('Usage: node scripts/gsc-status.mjs <path-to-service-account.json>');
  console.error('   or: GSC_CREDENTIALS=<path> node scripts/gsc-status.mjs');
  process.exit(1);
}
const key = JSON.parse(readFileSync(credsPath, 'utf8'));
const SITE = 'https://0xbytesized.github.io';

const auth = new google.auth.JWT({
  email: key.client_email,
  key: key.private_key,
  scopes: ['https://www.googleapis.com/auth/webmasters']
});

async function run() {
  await auth.authorize();
  const gsc = google.searchconsole({ version: 'v1', auth });

  // Get site info
  try {
    const siteInfo = await gsc.sites.get({ siteUrl: SITE });
    console.log('Site:', siteInfo.data.siteUrl);
    console.log('Permission level:', siteInfo.data.permissionLevel);
  } catch(e) {
    console.log('Site info error:', e.response?.data || e.message);
  }

  // Check sitemaps
  try {
    const sm = await gsc.sitemaps.list({ siteUrl: SITE });
    for (const s of sm.data.sitemap || []) {
      console.log(`Sitemap: ${s.path} | errors: ${s.errors} | pending: ${s.isPending} | downloaded: ${s.lastDownloaded}`);
    }
  } catch(e) {
    console.log('Sitemaps error:', e.message);
  }
}

run();
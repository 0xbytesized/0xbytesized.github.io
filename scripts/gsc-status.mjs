import { google } from 'googleapis';
import { readFileSync } from 'fs';

const key = JSON.parse(readFileSync('/data/uploads/2026-04-15T18-03-48-549Z_agente-pig-3b68d17c09cd.json', 'utf8'));
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
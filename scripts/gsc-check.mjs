import { google } from 'googleapis';
import { readFileSync } from 'fs';

const credsPath = process.argv[2] || process.env.GSC_CREDENTIALS;
if (!credsPath) {
  console.error('Usage: node scripts/gsc-check.mjs <path-to-service-account.json>');
  console.error('   or: GSC_CREDENTIALS=<path> node scripts/gsc-check.mjs');
  process.exit(1);
}
const credentials = JSON.parse(readFileSync(credsPath, 'utf8'));

const SITE_URL = 'https://0xbytesized.github.io';

const auth = new google.auth.JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: ['https://www.googleapis.com/auth/webmasters']
});

const searchconsole = google.searchconsole({ version: 'v1', auth });

async function main() {
  await auth.authorize();

  // Step 1: Check if we have access
  console.log('Checking access to Search Console...');
  try {
    const sites = await searchconsole.sites.list();
    console.log('Connected! Sites verified:');
    for (const site of sites.data.siteEntry || []) {
      console.log(`  - ${site.siteUrl} (permission: ${site.permissionLevel})`);
    }
  } catch (err) {
    console.error('Cannot list sites:', err.message);
    
    // Try adding the site as a property
    console.log('\nTrying to add site property...');
    try {
      await searchconsole.sites.add({ siteUrl: SITE_URL });
      console.log(`Added ${SITE_URL} as property!`);
    } catch (addErr) {
      console.error('Cannot add site:', addErr.message);
    }
  }

  // Step 2: Submit sitemap
  console.log('\nSubmitting sitemap...');
  try {
    await searchconsole.sitemaps.submit({
      siteUrl: SITE_URL,
      feedpath: `${SITE_URL}/sitemap-index.xml`
    });
    console.log('Sitemap submitted successfully!');
  } catch (err) {
    if (err.message?.includes('already')) {
      console.log('Sitemap already submitted.');
    } else {
      console.error('Sitemap submission error:', err.message);
    }
  }

  // Step 3: Check index status
  console.log('\nRecent indexing data (may take a few days to populate):');
  try {
    const inspect = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        siteUrl: SITE_URL,
        inspectionUrl: SITE_URL,
      }
    });
    console.log('Index status:', JSON.stringify(inspect.data, null, 2));
  } catch (err) {
    console.error('URL inspection error:', err.message);
  }
}

main().catch(console.error);
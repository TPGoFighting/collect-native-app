// Verify the deployed App Links verification file without writing to production.
//   node scripts/verify-assetlinks.mjs [expected-sha256]
const url = 'https://collect.tpgofighting.top/.well-known/assetlinks.json';
const expected = process.argv[2]?.replace(/:/g, '').toLowerCase() ?? null;

try {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    console.error(`FAIL ${url} -> HTTP ${res.status}`);
    process.exit(1);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    console.error(`FAIL content-type is ${contentType}, expected application/json`);
    process.exit(1);
  }
  const statements = await res.json();
  const entry = statements.find(
    (s) => s?.target?.package_name === 'top.tpgofighting.collect'
      && s?.relation?.includes('delegate_permission/common.handle_all_urls'),
  );
  if (!entry) {
    console.error('FAIL no matching package/handle_all_urls statement');
    process.exit(1);
  }
  const fingerprints = entry.target.sha256_cert_fingerprints || [];
  if (!fingerprints.length || fingerprints.some((fp) => /^REPLACE_/.test(fp))) {
    console.error('FAIL fingerprint is still a placeholder');
    process.exit(1);
  }
  if (expected && !fingerprints.some((fp) => fp.replace(/:/g, '').toLowerCase() === expected)) {
    console.error('FAIL deployed fingerprint does not match the provided release certificate');
    process.exit(1);
  }
  console.log(`OK ${url} — ${fingerprints.length} fingerprint(s), package ${entry.target.package_name}`);
} catch (e) {
  console.error(`FAIL ${e.message}`);
  process.exit(1);
}

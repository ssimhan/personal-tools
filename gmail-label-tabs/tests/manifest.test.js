const manifest = require('../manifest.json');

test('manifest has required MV3 fields', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toContain('identity');
  expect(manifest.host_permissions).toContain('https://mail.google.com/*');
  expect(manifest.oauth2.scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
});

test('content scripts load cache and layout before the injector', () => {
  const scripts = manifest.content_scripts[0].js;
  expect(scripts.indexOf('lib/cache.js')).toBeGreaterThan(-1);
  expect(scripts.indexOf('lib/layout.js')).toBeGreaterThan(-1);
  expect(scripts.indexOf('lib/cache.js')).toBeLessThan(scripts.indexOf('lib/injector.js'));
  expect(scripts.indexOf('lib/layout.js')).toBeLessThan(scripts.indexOf('lib/injector.js'));
});

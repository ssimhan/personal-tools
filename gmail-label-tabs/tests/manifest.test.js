const manifest = require('../manifest.json');

test('manifest has required MV3 fields', () => {
  expect(manifest.manifest_version).toBe(3);
  expect(manifest.permissions).toContain('identity');
  expect(manifest.host_permissions).toContain('https://mail.google.com/*');
  expect(manifest.oauth2.scopes).toContain('https://www.googleapis.com/auth/gmail.readonly');
});

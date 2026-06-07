test('content script modules attach browser globals and return their api objects', () => {
  jest.resetModules();

  const LH = require('../lib/label-hierarchy');
  const SQ = require('../lib/search-query');
  const API = require('../lib/api-client');
  const PB = require('../lib/pill-bar');
  const Injector = require('../lib/injector');

  expect(window.LabelHierarchy).toBe(LH);
  expect(window.SearchQuery).toBe(SQ);
  expect(window.ApiClient).toBe(API);
  expect(window.PillBar).toBe(PB);
  expect(window.Injector).toBe(Injector);
  expect(typeof Injector.init).toBe('function');
});

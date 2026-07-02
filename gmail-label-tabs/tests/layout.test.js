const Layout = require('../lib/layout');

function rect({ top = 150, left = 240, width = 900, height = 400 } = {}) {
  return { top, left, width, height, right: left + width, bottom: top + height };
}

beforeEach(() => {
  document.body.innerHTML = '<main><div id="host" style="padding-top: 8px"><table id="anchor"></table></div></main>';
  Layout.teardown();
});

afterEach(() => {
  Layout.teardown();
});

test('mount reserves space and positions the portal at the original list edge', () => {
  const anchor = document.getElementById('anchor');
  const host = document.getElementById('host');
  const wrapper = document.createElement('section');

  anchor.getBoundingClientRect = jest.fn(() => rect());
  wrapper.getBoundingClientRect = jest.fn(() => rect({ top: 0, left: 0, width: 0, height: 52 }));

  expect(Layout.mount(wrapper, anchor)).toBe(true);
  expect(wrapper.parentNode).toBe(document.body);
  expect(wrapper.style.top).toBe('150px');
  expect(wrapper.style.left).toBe('240px');
  expect(wrapper.style.width).toBe('900px');
  expect(host.style.paddingTop).toBe('60px');
});

test('sync adjusts for a taller sub-row without compounding padding', () => {
  const anchor = document.getElementById('anchor');
  const host = document.getElementById('host');
  const wrapper = document.createElement('section');
  let wrapperHeight = 52;
  let anchorTop = 150;

  anchor.getBoundingClientRect = jest.fn(() => rect({ top: anchorTop }));
  wrapper.getBoundingClientRect = jest.fn(() => rect({ top: 0, left: 0, width: 0, height: wrapperHeight }));

  Layout.mount(wrapper, anchor);
  anchorTop = 202;
  wrapperHeight = 92;
  Layout.sync(anchor);

  expect(wrapper.style.top).toBe('150px');
  expect(host.style.paddingTop).toBe('100px');
});

test('teardown restores the exact original inline padding', () => {
  const anchor = document.getElementById('anchor');
  const host = document.getElementById('host');
  const wrapper = document.createElement('section');

  anchor.getBoundingClientRect = jest.fn(() => rect());
  wrapper.getBoundingClientRect = jest.fn(() => rect({ top: 0, left: 0, width: 0, height: 52 }));
  Layout.mount(wrapper, anchor);
  Layout.teardown();

  expect(host.style.paddingTop).toBe('8px');
  expect(document.body.contains(wrapper)).toBe(false);
});

test('teardown preserves a host padding change made after mount', () => {
  const anchor = document.getElementById('anchor');
  const host = document.getElementById('host');
  const wrapper = document.createElement('section');

  anchor.getBoundingClientRect = jest.fn(() => rect());
  wrapper.getBoundingClientRect = jest.fn(() => rect({ top: 0, left: 0, width: 0, height: 52 }));
  Layout.mount(wrapper, anchor);
  host.style.paddingTop = '20px';
  Layout.teardown();

  expect(host.style.paddingTop).toBe('20px');
});

test('mount rejects an anchor that overlaps a visible Gmail toolbar', () => {
  document.body.innerHTML = '<div role="main" id="main"><div role="toolbar" id="toolbar"></div><div id="host"><table id="anchor"></table></div></div>';
  const main = document.getElementById('main');
  const toolbar = document.getElementById('toolbar');
  const anchor = document.getElementById('anchor');
  const wrapper = document.createElement('section');

  main.getBoundingClientRect = jest.fn(() => rect({ top: 64, left: 200, width: 1000, height: 700 }));
  toolbar.getBoundingClientRect = jest.fn(() => rect({ top: 64, left: 200, width: 1000, height: 48 }));
  anchor.getBoundingClientRect = jest.fn(() => rect({ top: 96, left: 240, width: 900 }));

  expect(Layout.mount(wrapper, anchor)).toBe(false);
  expect(document.body.contains(wrapper)).toBe(false);
});

test('a rejected replacement anchor hides the previous portal', () => {
  const anchor = document.getElementById('anchor');
  const wrapper = document.createElement('section');
  anchor.getBoundingClientRect = jest.fn(() => rect());
  wrapper.getBoundingClientRect = jest.fn(() => rect({ top: 0, left: 0, width: 0, height: 52 }));
  Layout.mount(wrapper, anchor);

  const invalidAnchor = document.createElement('table');
  document.getElementById('host').appendChild(invalidAnchor);
  invalidAnchor.getBoundingClientRect = jest.fn(() => rect({ width: 0 }));

  expect(Layout.mount(document.createElement('section'), invalidAnchor)).toBe(false);
  expect(wrapper.style.visibility).toBe('hidden');
});

test('scheduleSync coalesces a burst into one animation frame', () => {
  const anchor = document.getElementById('anchor');
  const wrapper = document.createElement('section');
  let frameCallback;
  const requestFrame = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    frameCallback = callback;
    return 42;
  });

  anchor.getBoundingClientRect = jest.fn(() => rect());
  wrapper.getBoundingClientRect = jest.fn(() => rect({ top: 0, left: 0, width: 0, height: 52 }));
  Layout.mount(wrapper, anchor);
  Layout.scheduleSync(anchor);
  Layout.scheduleSync(anchor);
  Layout.scheduleSync(anchor);

  expect(requestFrame).toHaveBeenCalledTimes(1);
  frameCallback();
  requestFrame.mockRestore();
});

test('mount fails closed for disconnected or zero-width anchors', () => {
  const anchor = document.getElementById('anchor');
  const wrapper = document.createElement('section');
  anchor.getBoundingClientRect = jest.fn(() => rect({ width: 0 }));

  expect(Layout.mount(wrapper, anchor)).toBe(false);
  expect(document.body.contains(wrapper)).toBe(false);
});

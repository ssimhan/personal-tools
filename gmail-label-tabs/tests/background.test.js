describe('background token bridge', () => {
  let listener;

  beforeEach(() => {
    jest.resetModules();
    listener = null;
    global.chrome = {
      identity: {
        getAuthToken: jest.fn(),
        removeCachedAuthToken: jest.fn()
      },
      runtime: {
        lastError: null,
        onMessage: {
          addListener: jest.fn(callback => { listener = callback; })
        }
      }
    };
    require('../background');
  });

  test.each([
    ['legacy string', 'token-string'],
    ['current result object', { token: 'token-object' }]
  ])('returns a token from the %s callback shape', (label, result) => {
    chrome.identity.getAuthToken.mockImplementation((details, callback) => callback(result));
    const sendResponse = jest.fn();

    expect(listener({ type: 'GET_TOKEN' }, {}, sendResponse)).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith({
      token: typeof result === 'string' ? result : result.token
    });
  });

  test('invalidates the exact rejected token', () => {
    chrome.identity.removeCachedAuthToken.mockImplementation((details, callback) => callback());
    const sendResponse = jest.fn();

    expect(listener({ type: 'INVALIDATE_TOKEN', token: 'expired' }, {}, sendResponse)).toBe(true);
    expect(chrome.identity.removeCachedAuthToken).toHaveBeenCalledWith(
      { token: 'expired' },
      expect.any(Function)
    );
    expect(sendResponse).toHaveBeenCalledWith({ ok: true });
  });
});

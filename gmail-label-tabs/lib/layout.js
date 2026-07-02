const GltLayout = (() => {
  const state = {
    anchor: null,
    appliedHeight: 0,
    basePadding: 0,
    host: null,
    lastAppliedPadding: '',
    originalInlinePadding: '',
    pendingAnchor: null,
    resizeObserver: null,
    scheduledFrame: null,
    wrapper: null
  };

  function measure(element) {
    return element && typeof element.getBoundingClientRect === 'function'
      ? element.getBoundingClientRect()
      : null;
  }

  function isValidAnchor(anchor) {
    if (!anchor || !anchor.isConnected || !anchor.parentElement) return false;
    const rect = measure(anchor);
    if (!rect || rect.width < 100 || rect.top < 0) return false;

    const main = anchor.closest('[role="main"]');
    const mainRect = measure(main);
    if (mainRect && mainRect.height > 0 && rect.top < mainRect.top) return false;

    const protectedElements = Array.from(document.querySelectorAll('header, [role="banner"]'));
    if (main) protectedElements.push(...Array.from(main.querySelectorAll('[role="toolbar"]')));

    const protectedBottom = protectedElements.reduce((bottom, element) => {
      const protectedRect = measure(element);
      if (!protectedRect || protectedRect.width <= 0 || protectedRect.height <= 0) return bottom;
      const overlapsHorizontally = protectedRect.right > rect.left && protectedRect.left < rect.right;
      const beginsAboveAnchor = protectedRect.top <= rect.top;
      return overlapsHorizontally && beginsAboveAnchor
        ? Math.max(bottom, protectedRect.bottom)
        : bottom;
    }, mainRect && mainRect.height > 0 ? mainRect.top : 0);

    return rect.top >= protectedBottom;
  }

  function releaseHost() {
    if (state.host && (!state.lastAppliedPadding || state.host.style.paddingTop === state.lastAppliedPadding)) {
      state.host.style.paddingTop = state.originalInlinePadding;
    }
    state.host = null;
    state.anchor = null;
    state.appliedHeight = 0;
    state.basePadding = 0;
    state.lastAppliedPadding = '';
    state.originalInlinePadding = '';
    state.pendingAnchor = null;
  }

  function captureHost(anchor) {
    const host = anchor.parentElement;
    if (state.host === host) {
      state.anchor = anchor;
      return;
    }

    releaseHost();
    state.host = host;
    state.anchor = anchor;
    state.originalInlinePadding = host.style.paddingTop || '';
    const computedPadding = parseFloat(window.getComputedStyle(host).paddingTop);
    state.basePadding = Number.isFinite(computedPadding) ? computedPadding : 0;
  }

  function adoptExternalPaddingChange() {
    if (!state.host || !state.lastAppliedPadding) return;
    if (state.host.style.paddingTop === state.lastAppliedPadding) return;

    state.originalInlinePadding = state.host.style.paddingTop || '';
    const computedPadding = parseFloat(window.getComputedStyle(state.host).paddingTop);
    state.basePadding = Number.isFinite(computedPadding) ? computedPadding : 0;
    state.appliedHeight = 0;
    state.lastAppliedPadding = '';
  }

  function sync(anchor) {
    if (!state.wrapper) return false;
    const candidate = anchor || state.anchor;

    if (!isValidAnchor(candidate)) {
      state.wrapper.style.visibility = 'hidden';
      return false;
    }

    captureHost(candidate);
    adoptExternalPaddingChange();

    const anchorRect = measure(candidate);
    const wrapperRect = measure(state.wrapper);
    const wrapperHeight = Math.max(
      wrapperRect ? wrapperRect.height : 0,
      state.wrapper.offsetHeight || 0
    );
    const originalTop = anchorRect.top - state.appliedHeight;

    const appliedPadding = state.basePadding + wrapperHeight + 'px';
    state.host.style.paddingTop = appliedPadding;
    state.wrapper.style.top = originalTop + 'px';
    state.wrapper.style.left = anchorRect.left + 'px';
    state.wrapper.style.width = anchorRect.width + 'px';
    state.wrapper.style.right = 'auto';
    state.wrapper.style.visibility = 'visible';
    state.appliedHeight = wrapperHeight;
    state.lastAppliedPadding = appliedPadding;
    return true;
  }

  function scheduleSync(anchor) {
    if (!state.wrapper) return;
    if (anchor && anchor.nodeType === 1) state.pendingAnchor = anchor;
    if (state.scheduledFrame !== null) return;
    state.scheduledFrame = window.requestAnimationFrame(() => {
      state.scheduledFrame = null;
      const pendingAnchor = state.pendingAnchor;
      state.pendingAnchor = null;
      sync(pendingAnchor);
    });
  }

  function mount(wrapper, anchor) {
    if (!wrapper || !isValidAnchor(anchor)) {
      hide();
      return false;
    }
    teardown();

    state.wrapper = wrapper;
    wrapper.style.visibility = 'hidden';
    document.body.appendChild(wrapper);

    if (typeof ResizeObserver !== 'undefined') {
      state.resizeObserver = new ResizeObserver(() => scheduleSync());
      state.resizeObserver.observe(wrapper);
      state.resizeObserver.observe(anchor);
    }
    window.addEventListener('resize', scheduleSync);

    if (!sync(anchor)) {
      teardown();
      return false;
    }
    return true;
  }

  function hide() {
    if (state.wrapper) state.wrapper.style.visibility = 'hidden';
  }

  function teardown() {
    if (state.scheduledFrame !== null) {
      window.cancelAnimationFrame(state.scheduledFrame);
      state.scheduledFrame = null;
    }
    if (state.resizeObserver) {
      state.resizeObserver.disconnect();
      state.resizeObserver = null;
    }
    window.removeEventListener('resize', scheduleSync);
    releaseHost();
    if (state.wrapper && state.wrapper.parentNode) state.wrapper.remove();
    state.wrapper = null;
  }

  function getWrapper() {
    return state.wrapper;
  }

  const api = { getWrapper, hide, mount, scheduleSync, sync, teardown };

  if (typeof window !== 'undefined') window.GltLayout = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();

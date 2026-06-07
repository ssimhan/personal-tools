const PillBar = (() => {
  function displayName(name) {
    if (typeof LabelHierarchy !== 'undefined' && LabelHierarchy.getDisplayName) {
      return LabelHierarchy.getDisplayName(name);
    }

    const lastSegment = String(name || '').split('/').pop();
    return lastSegment.replace(/^\d+\s*[-–]\s*/, '').trim();
  }

  function createElement(tagName, attrs, children) {
    const element = document.createElement(tagName);
    const safeAttrs = attrs || {};

    Object.keys(safeAttrs).forEach(key => {
      const value = safeAttrs[key];

      if (key === 'className') element.className = value;
      else if (key === 'style') Object.assign(element.style, value);
      else if (value !== undefined && value !== null) element.setAttribute(key, value);
    });

    (children || []).forEach(child => {
      if (typeof child === 'string') element.appendChild(document.createTextNode(child));
      else if (child) element.appendChild(child);
    });

    return element;
  }

  function badge(count) {
    if (!count || count <= 0) return null;
    return createElement('span', { className: 'glt-badge' }, [String(count)]);
  }

  function colorDot(className, color) {
    return createElement('span', {
      className,
      style: { backgroundColor: color || '#AEAAA0' },
      'aria-hidden': 'true'
    });
  }

  function createPill(label, isActive) {
    return createElement('button', {
      className: 'glt-pill' + (isActive ? ' glt-pill--active' : ''),
      type: 'button',
      'data-label-id': label.id,
      'data-label-name': label.name,
      title: displayName(label.name)
    }, [
      colorDot('glt-dot', label.color),
      createElement('span', { className: 'glt-name' }, [displayName(label.name)]),
      badge(label.unread)
    ]);
  }

  function createUnlabeledPill(hasUnread) {
    return createElement('button', {
      className: 'glt-pill glt-pill--unlabeled',
      type: 'button',
      'data-label-id': '__unlabeled__',
      'data-label-name': '__unlabeled__',
      title: 'Unlabeled'
    }, [
      colorDot('glt-dot', '#AEAAA0'),
      createElement('span', { className: 'glt-name' }, ['Unlabeled']),
      badge(hasUnread)
    ]);
  }

  function createSubPill(label, isActive) {
    return createElement('button', {
      className: 'glt-subpill' + (isActive ? ' glt-subpill--active' : ''),
      type: 'button',
      'data-label-id': label.id,
      'data-label-name': label.name,
      title: displayName(label.name)
    }, [
      colorDot('glt-subdot', label.color),
      createElement('span', { className: 'glt-subname' }, [displayName(label.name)]),
      badge(label.unread)
    ]);
  }

  function createAllSubPill(parentLabel, isActive) {
    return createElement('button', {
      className: 'glt-subpill' + (isActive ? ' glt-subpill--active' : ''),
      type: 'button',
      'data-label-id': parentLabel.id,
      'data-label-name': parentLabel.name,
      'data-sub-all': 'true'
    }, [
      createElement('span', { className: 'glt-subname' }, ['All ' + displayName(parentLabel.name)]),
      badge(parentLabel.unread)
    ]);
  }

  function createPillBar(activeLabels, unlabeledCount, activeLabelId) {
    const wrapper = createElement('section', {
      className: 'glt-wrapper',
      'aria-label': 'Gmail label tabs'
    });

    const pillRow = createElement('div', { className: 'glt-scroll-wrap' }, [
      createElement('div', { className: 'glt-pill-row' })
    ]);
    const row = pillRow.querySelector('.glt-pill-row');

    activeLabels.forEach(label => {
      row.appendChild(createPill(label, label.id === activeLabelId));
    });

    if (unlabeledCount !== false && unlabeledCount !== null && unlabeledCount !== undefined) {
      row.appendChild(createUnlabeledPill(unlabeledCount));
    }

    const subRow = createElement('div', {
      className: 'glt-scroll-wrap glt-scroll-wrap--sub',
      style: { display: 'none' }
    }, [
      createElement('div', { className: 'glt-subpill-row' })
    ]);

    wrapper.appendChild(pillRow);
    wrapper.appendChild(subRow);
    return wrapper;
  }

  function showSubPills(wrapper, parentLabel, activeSubId) {
    const subWrap = wrapper.querySelector('.glt-scroll-wrap--sub');
    const subRow = wrapper.querySelector('.glt-subpill-row');

    subRow.innerHTML = '';
    subWrap.style.display = 'block';
    subRow.appendChild(createAllSubPill(parentLabel, !activeSubId));

    (parentLabel.children || []).forEach(child => {
      subRow.appendChild(createSubPill(child, child.id === activeSubId));
    });
  }

  function hideSubPills(wrapper) {
    const subWrap = wrapper.querySelector('.glt-scroll-wrap--sub');
    const subRow = wrapper.querySelector('.glt-subpill-row');

    if (subWrap) subWrap.style.display = 'none';
    if (subRow) subRow.innerHTML = '';
  }

  const api = {
    createPill,
    createPillBar,
    createSubPill,
    hideSubPills,
    showSubPills
  };

  if (typeof window !== 'undefined') window.PillBar = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();

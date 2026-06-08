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

  function colorWithAlpha(color, alpha) {
    if (!color) return null;
    const hex = String(color).replace('#', '');
    if (hex.length !== 6) return null;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  function applyTint(element, color, unread) {
    if (unread > 0) {
      const tint = colorWithAlpha(color, 0.15);
      if (tint) element.style.setProperty('--glt-tint', tint);
    }
  }

  function createPillElement(label, isActive, pillClass, nameClass) {
    const pill = createElement('button', {
      className: pillClass + (isActive ? ' ' + pillClass + '--active' : ''),
      type: 'button',
      'data-label-id': label.id,
      'data-label-name': label.name,
      title: displayName(label.name)
    }, [
      createElement('span', { className: nameClass }, [displayName(label.name)]),
      badge(label.unread)
    ]);
    applyTint(pill, label.color, label.unread);
    return pill;
  }

  function createPill(label, isActive) {
    return createPillElement(label, isActive, 'glt-pill', 'glt-name');
  }

  function createAllInboxPill(isActive) {
    // Not using createPillElement: display text ("All Inbox") differs from data-label-name (__all__),
    // and this pill never has a badge or tint.
    return createElement('button', {
      className: 'glt-pill' + (isActive ? ' glt-pill--active' : ''),
      type: 'button',
      'data-label-id': '__all__',
      'data-label-name': '__all__',
      title: 'All Inbox'
    }, [
      createElement('span', { className: 'glt-name' }, ['All Inbox'])
    ]);
  }

  function createUnlabeledPill(hasUnread) {
    const pill = createElement('button', {
      className: 'glt-pill glt-pill--unlabeled',
      type: 'button',
      'data-label-id': '__unlabeled__',
      'data-label-name': '__unlabeled__',
      title: 'Unlabeled'
    }, [
      createElement('span', { className: 'glt-name' }, ['Unlabeled']),
      badge(hasUnread)
    ]);
    applyTint(pill, '#AEAAA0', hasUnread);
    return pill;
  }

  function createSubPill(label, isActive) {
    return createPillElement(label, isActive, 'glt-subpill', 'glt-subname');
  }

  function createAllSubPill(parentLabel, isActive) {
    // Not using createPillElement: display text is "All {parent}", not displayName(label.name),
    // and needs the extra data-sub-all attribute that createPillElement doesn't set.
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

    row.appendChild(createAllInboxPill(!activeLabelId || activeLabelId === '__all__'));

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

const LabelHierarchy = (() => {
  const SYSTEM_LABELS = [
    'CHAT',
    'CATEGORY_FORUMS',
    'CATEGORY_PERSONAL',
    'CATEGORY_PROMOTIONS',
    'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES',
    'DRAFT',
    'IMPORTANT',
    'INBOX',
    'SENT',
    'SPAM',
    'STARRED',
    'TRASH',
    'UNREAD'
  ];

  function isSystemLabel(name) {
    return SYSTEM_LABELS.indexOf(name) !== -1 || name.indexOf('CATEGORY_') === 0;
  }

  function normalizeColor(label) {
    if (!label.color) return null;
    return label.color.backgroundColor || label.color.textColor || null;
  }

  function createNode(label) {
    return {
      id: label.id,
      name: label.name,
      color: normalizeColor(label),
      children: [],
      depth: label.name.split('/').length - 1,
      unread: 0,
      present: false
    };
  }

  function buildTree(apiLabels) {
    const userLabels = (apiLabels || []).filter(label => (
      label.type !== 'system' && !isSystemLabel(label.name)
    ));
    const byName = {};
    const roots = [];

    userLabels.forEach(label => {
      byName[label.name] = createNode(label);
    });

    userLabels.forEach(label => {
      const node = byName[label.name];
      const parts = label.name.split('/');

      if (parts.length === 1) {
        roots.push(node);
        return;
      }

      const parentName = parts.slice(0, -1).join('/');
      const parent = byName[parentName];

      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    });

    sortChildren(roots);
    return sortTopLevel(roots);
  }

  function sortChildren(nodes) {
    nodes.forEach(node => {
      node.children.sort((a, b) => getDisplayName(a.name).localeCompare(getDisplayName(b.name)));
      sortChildren(node.children);
    });
  }

  function getDescendantIds(node) {
    const ids = [];

    function walk(current) {
      (current.children || []).forEach(child => {
        ids.push(child.id);
        walk(child);
      });
    }

    walk(node);
    return ids;
  }

  function flattenNodes(nodes) {
    const flat = [];

    function walk(list) {
      list.forEach(node => {
        flat.push(node);
        walk(node.children || []);
      });
    }

    walk(nodes || []);
    return flat;
  }

  function findNodeById(nodes, id) {
    return flattenNodes(nodes).find(node => node.id === id) || null;
  }

  function getDisplayName(fullName) {
    const lastSegment = String(fullName || '').split('/').pop();
    return lastSegment.replace(/^\d+\s*[-–]\s*/, '').trim();
  }

  function getNumericPrefix(name) {
    const match = String(name || '').match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : Infinity;
  }

  function sortTopLevel(nodes) {
    return (nodes || []).slice().sort((a, b) => {
      const aPrefix = getNumericPrefix(a.name);
      const bPrefix = getNumericPrefix(b.name);

      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return getDisplayName(a.name).localeCompare(getDisplayName(b.name));
    });
  }

  function getDescendantNames(node) {
    const names = [];

    function walk(current) {
      (current.children || []).forEach(child => {
        names.push(child.name);
        walk(child);
      });
    }

    walk(node);
    return names;
  }

  const api = {
    buildTree,
    findNodeById,
    flattenNodes,
    getDescendantIds,
    getDescendantNames,
    getDisplayName,
    isSystemLabel,
    sortTopLevel
  };

  if (typeof window !== 'undefined') window.LabelHierarchy = api;
  if (typeof module !== 'undefined') module.exports = api;
  return api;
})();

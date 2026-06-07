const LH = require('../lib/label-hierarchy');

const labels = [
  { id: 'career', name: '3- Career', color: { backgroundColor: '#e67e22' } },
  { id: 'job', name: '3- Career/Job Hunt' },
  { id: 'glean', name: '3- Career/Glean' },
  { id: 'competitive', name: '3- Career/Glean/Competitive' },
  { id: 'sandhya', name: '1 - Sandhya', color: { backgroundColor: '#9b59b6' } },
  { id: 'friends', name: '6- Friends' },
  { id: 'chatting', name: 'Chatting' },
  { id: 'inbox', name: 'INBOX' },
  { id: 'sent', name: 'SENT' }
];

test('buildTree filters system labels and nests user labels', () => {
  const tree = LH.buildTree(labels);
  const career = tree.find(node => node.id === 'career');
  const glean = career.children.find(node => node.id === 'glean');

  expect(tree.find(node => node.id === 'inbox')).toBeUndefined();
  expect(career.children.map(node => node.id)).toEqual(['glean', 'job']);
  expect(glean.children[0].id).toBe('competitive');
});

test('getDescendantIds returns all descendants at any depth', () => {
  const career = LH.buildTree(labels).find(node => node.id === 'career');
  expect(LH.getDescendantIds(career)).toEqual(['glean', 'competitive', 'job']);
});

test('getDescendantNames returns all descendant names at any depth', () => {
  const career = LH.buildTree(labels).find(node => node.id === 'career');
  expect(LH.getDescendantNames(career)).toContain('3- Career/Glean/Competitive');
});

test('getDisplayName strips numeric prefixes and shows final path segment', () => {
  expect(LH.getDisplayName('3- Career')).toBe('Career');
  expect(LH.getDisplayName('1 - Sandhya')).toBe('Sandhya');
  expect(LH.getDisplayName('3- Career/Job Hunt')).toBe('Job Hunt');
  expect(LH.getDisplayName('cc-automated')).toBe('cc-automated');
});

test('sortTopLevel orders numbered labels before unnumbered labels', () => {
  const sorted = LH.buildTree(labels);
  expect(sorted.map(node => node.id)).toEqual(['sandhya', 'career', 'friends', 'chatting']);
});

test('findNodeById finds nested nodes', () => {
  const tree = LH.buildTree(labels);
  expect(LH.findNodeById(tree, 'competitive').name).toBe('3- Career/Glean/Competitive');
});

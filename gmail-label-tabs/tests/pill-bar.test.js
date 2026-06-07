global.LabelHierarchy = require('../lib/label-hierarchy');
const PB = require('../lib/pill-bar');

const activeLabels = [
  { id: 'sandhya', name: '1 - Sandhya', unread: 1, color: '#9b59b6', children: [] },
  {
    id: 'career',
    name: '3- Career',
    unread: 4,
    color: '#e67e22',
    children: [
      { id: 'job', name: '3- Career/Job Hunt', unread: 2, color: null, children: [] },
      { id: 'glean', name: '3- Career/Glean', unread: 1, color: null, children: [] }
    ]
  }
];

beforeEach(() => {
  document.body.innerHTML = '';
});

test('renders top-level pills and strips numeric prefixes', () => {
  document.body.appendChild(PB.createPillBar(activeLabels, false));

  // All Inbox pill + one per active label
  expect(document.querySelectorAll('.glt-pill[data-label-id]').length).toBe(3);
  expect(document.body.textContent).toContain('Sandhya');
  expect(document.body.textContent).toContain('Career');
  expect(document.body.textContent).not.toContain('1 - Sandhya');
});

test('renders unread badges when count is positive', () => {
  document.body.appendChild(PB.createPillBar(activeLabels, false));

  expect(document.querySelector('.glt-badge').textContent).toBe('1');
});

test('unlabeled pill renders last when present', () => {
  document.body.appendChild(PB.createPillBar(activeLabels, 3));
  const pills = Array.from(document.querySelectorAll('.glt-pill'));

  expect(pills[pills.length - 1].dataset.labelId).toBe('__unlabeled__');
  expect(pills[pills.length - 1].textContent).toContain('Unlabeled');
});

test('sub-pill row is hidden by default', () => {
  document.body.appendChild(PB.createPillBar(activeLabels, false));

  expect(document.querySelector('.glt-scroll-wrap--sub').style.display).toBe('none');
});

test('showSubPills renders all parent and direct children only', () => {
  const wrapper = PB.createPillBar(activeLabels, false);
  document.body.appendChild(wrapper);

  PB.showSubPills(wrapper, activeLabels[1], null);

  expect(document.querySelector('.glt-scroll-wrap--sub').style.display).toBe('block');
  expect(document.body.textContent).toContain('All Career');
  expect(document.body.textContent).toContain('Job Hunt');
  expect(document.body.textContent).toContain('Glean');
});

const DESTINATIONS = Object.freeze([
  Object.freeze({ route: 'home', label: 'Home', icon: '⌂', emphasized: false }),
  Object.freeze({ route: 'talk', label: 'Chat', icon: '◉', emphasized: true }),
  Object.freeze({ route: 'grow', label: 'Growth', icon: '↗', emphasized: false }),
  Object.freeze({ route: 'memories', label: 'Memories', icon: '◇', emphasized: false }),
  Object.freeze({ route: 'world', label: 'Haven', icon: '◌', emphasized: false }),
]);

export function primaryDestinations9() {
  return DESTINATIONS.map((item) => ({ ...item }));
}

export function settingsEntry9() {
  return { route: 'settings', label: 'Settings', source: 'profile' };
}

export function normalizePrimaryRoute9(value) {
  const route = String(value || 'home').replace(/^#\/?/, '').split('/')[0];
  if (route === 'settings') return 'settings';
  return DESTINATIONS.some((item) => item.route === route) ? route : 'home';
}

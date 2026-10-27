import 'server-only';

/**
 * The five destinations, resolved against the deployment's enabled modules.
 *
 * The set is a DEFAULT, not a fixed list: `docs/ux/dev.md` requires that a
 * group not using labs does not ship an empty Health tab. The admin says which
 * modules are on; a destination whose module is off is not rendered at all,
 * rather than rendered as a broken control.
 *
 * `icon` names an entry in components/ui/Icon.jsx (inline SVG, no icon font).
 */
const ALL = [
  { key: 'home', href: '/', label: 'Home', icon: 'home', module: null },
  { key: 'care', href: '/care', label: 'Care', icon: 'care', module: null },
  { key: 'talk', href: '/talk', label: 'Talk', icon: 'talk', module: 'messaging', raised: true },
  // Health holds tracking and lab results; it shows while either is on.
  { key: 'health', href: '/health', label: 'Health', icon: 'health', module: ['vitals', 'labs'] },
  { key: 'record', href: '/record', label: 'Record', icon: 'record', module: null },
];

export function destinationsFor(config) {
  const modules = config?.portal?.modules ?? {};

  return ALL.filter((destination) => {
    if (!destination.module) return true;

    // Absent means enabled. A deployment that has never touched the setting
    // should get the default portal, not a portal with holes in it.
    return [destination.module].flat().some((module) => modules[module] !== false);
  });
}

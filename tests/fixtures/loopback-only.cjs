const net = require('node:net');
const allowed = new Set((process.env.FIXTURE_ALLOWED_PORTS || '').split(','));
function permit(host, port) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !allowed.has(String(port))) {
    throw new Error('Isolated portal smoke blocked outbound network');
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  permit(url.hostname, url.port || (url.protocol === 'https:' ? 443 : 80));
  return originalFetch(input, init);
};
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  if (typeof options !== 'object') options = { port: options, host: typeof args[1] === 'string' ? args[1] : 'localhost' };
  permit(options.host || 'localhost', options.port);
  return connect.apply(this, args);
};

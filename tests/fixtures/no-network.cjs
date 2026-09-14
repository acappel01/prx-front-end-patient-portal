// Build/test bootstrap: no credential-bearing env or outbound request is allowed.
for (const key of ['ADMIN_API_BASE_URL', 'ADMIN_API_TOKEN', 'SESSION_SECRET']) delete process.env[key];
globalThis.fetch = async () => { throw new Error('Network disabled for isolated portal build'); };
const http = require('node:http');
const https = require('node:https');
for (const module of [http, https]) {
  module.request = module.get = () => { throw new Error('Network disabled for isolated portal build'); };
}

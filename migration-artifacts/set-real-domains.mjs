#!/usr/bin/env node
// Points the big-vps Faithline apps at their real addresses (plus the test
// sslip ones) and sets the public URLs to match the live site. Run before the
// DNS switch; visitors only reach big-vps once DNS points there.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const HOME = os.homedir();
const TOKEN = fs.readFileSync(path.join(HOME, '.config/coolify-vps/token-bigvps'), 'utf8').trim();
const API = 'http://169.58.8.203:8000/api/v1';

const SITE = { uuid: 'c2zgf3xq4eunjezcftfeolyq', hosts: ['faithlinegh.com', 'www.faithlinegh.com', 'faithline.169-58-8-203.sslip.io'] };
const AI = { uuid: 'mco9z9ybatewgtpy1saniz4i', hosts: ['ai.faithlinegh.com', 'faithline-ai.169-58-8-203.sslip.io'] };

function labels(uuid, hosts) {
  const lines = ['traefik.enable=true', 'traefik.http.middlewares.gzip.compress=true',
    'traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https'];
  hosts.forEach((host, i) => {
    const http = `http-${i}-${uuid}`, https = `https-${i}-${uuid}`;
    lines.push(`traefik.http.routers.${http}.rule=Host(\`${host}\`)`, `traefik.http.routers.${http}.entryPoints=http`,
      `traefik.http.routers.${http}.middlewares=redirect-to-https`, `traefik.http.routers.${https}.rule=Host(\`${host}\`)`,
      `traefik.http.routers.${https}.entryPoints=https`, `traefik.http.routers.${https}.tls=true`,
      `traefik.http.routers.${https}.tls.certresolver=letsencrypt`, `traefik.http.routers.${https}.middlewares=gzip`,
      `traefik.http.services.${https}.loadbalancer.server.port=3000`, `traefik.http.routers.${https}.service=${https}`);
  });
  return Buffer.from(lines.join('\n')).toString('base64');
}

async function setEnv(uuid, key, value, buildtime) {
  const body = { key, value, is_literal: true, is_buildtime: buildtime, is_preview: false };
  let r = await fetch(`${API}/applications/${uuid}/envs`, { method: 'PATCH', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) r = await fetch(`${API}/applications/${uuid}/envs`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  console.log(`  ${key}: ${r.ok ? 'ok' : 'HTTP ' + r.status}`);
}

const sql = [SITE, AI].map((a) => `UPDATE applications SET fqdn = '${a.hosts.map((h) => 'https://' + h).join(',')}', custom_labels = '${labels(a.uuid, a.hosts)}' WHERE uuid = '${a.uuid}';`).join('\n');
const r = spawnSync('ssh', ['big-vps', 'docker exec -i coolify-db psql -q -U coolify -d coolify -v ON_ERROR_STOP=1'], { input: sql, encoding: 'utf8' });
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
console.log('domains set');

console.log('site:');
for (const k of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'STORAGE_PUBLIC_URL']) await setEnv(SITE.uuid, k, 'https://faithlinegh.com', true);
console.log('ai:');
await setEnv(AI.uuid, 'NEXT_PUBLIC_APP_URL', 'https://ai.faithlinegh.com', true);
await setEnv(AI.uuid, 'STORAGE_PUBLIC_URL', 'https://ai.faithlinegh.com', false);
await setEnv(AI.uuid, 'STOREFRONT_URL', 'https://www.faithlinegh.com', false);

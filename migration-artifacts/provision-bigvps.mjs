#!/usr/bin/env node
// Creates (or updates) the two Faithline apps on big-vps Coolify:
//   faithlinegh-app  (storefront, public repo katalambano878/Faithlinegh)
//   faithline-ai     (WhatsApp agent, private repo Drrbarns/faithline-whatsapp-ai)
// on temporary sslip addresses, with settings copied from coolify-vps plus the
// plain-Postgres ones. Prints setting NAMES only, never values.
//
// Usage: node migration-artifacts/provision-bigvps.mjs [--branch staging/plain-postgres]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const HOME = os.homedir();
const tok = (f) => fs.readFileSync(path.join(HOME, '.config/coolify-vps', f), 'utf8').trim();
const OLD = { api: 'http://84.247.165.196:8000/api/v1', token: tok('token') };
const NEW = { api: 'http://169.58.8.203:8000/api/v1', token: tok('token-bigvps') };
const SERVER_UUID = 'd11ltfeuj6qtltuts2lx8f7l';
const BRANCH = process.argv.includes('--branch') ? process.argv[process.argv.indexOf('--branch') + 1] : 'staging/plain-postgres';
const DEPLOY_KEY_UUID = 't2wqe03syulbzvrraqkl2f1y';
const STORAGE_HOST_DIR = '/data/coolify/faithline/storage';

const SITE_HOST = 'faithline.169-58-8-203.sslip.io';
const AI_HOST = 'faithline-ai.169-58-8-203.sslip.io';

async function api(target, p, opts = {}) {
  const res = await fetch(target.api + p, {
    method: opts.method || 'GET',
    headers: { Authorization: `Bearer ${target.token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: res.ok, status: res.status, data };
}

function ssh(host, cmd, input) {
  const r = spawnSync('ssh', [host, cmd], { encoding: 'utf8', input, maxBuffer: 20 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`ssh ${host} failed: ${(r.stderr || r.stdout).slice(0, 500)}`);
  return r.stdout;
}

function secretFile(name, make) {
  const f = path.join(HOME, '.config/coolify-vps', name);
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const v = make();
  fs.writeFileSync(f, v + '\n', { mode: 0o600 });
  return v;
}

function directDbUrl() {
  const txt = fs.readFileSync(path.join(HOME, '.config/coolify-vps/faithline-provision.txt'), 'utf8');
  const m = txt.match(/DIRECT_URL=(postgres:\/\/\S+)/);
  if (!m) throw new Error('DIRECT_URL not found in faithline-provision.txt');
  return m[1];
}

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

async function ensureProject() {
  const list = await api(NEW, '/projects');
  let proj = (list.data || []).find((p) => p.name === 'faithline');
  if (!proj) {
    const c = await api(NEW, '/projects', { method: 'POST', body: { name: 'faithline', description: 'Faithline storefront + WhatsApp agent (plain Postgres)' } });
    if (!c.ok) throw new Error('project: ' + JSON.stringify(c.data));
    proj = c.data;
  }
  const d = await api(NEW, `/projects/${proj.uuid}`);
  return { projectUuid: proj.uuid, environmentUuid: d.data?.environments?.[0]?.uuid, environmentName: d.data?.environments?.[0]?.name || 'production' };
}

async function ensureApp(kind, proj) {
  const name = kind === 'site' ? 'faithlinegh-app' : 'faithline-ai';
  const apps = await api(NEW, '/applications');
  let app = (apps.data || []).find((a) => a.name === name);
  if (!app) {
    const common = {
      project_uuid: proj.projectUuid, server_uuid: SERVER_UUID, environment_name: proj.environmentName,
      environment_uuid: proj.environmentUuid, git_branch: BRANCH, build_pack: 'dockerfile', ports_exposes: '3000',
      name, instant_deploy: false,
    };
    const c = kind === 'site'
      ? await api(NEW, '/applications/public', { method: 'POST', body: { ...common, git_repository: 'https://github.com/katalambano878/Faithlinegh' } })
      : await api(NEW, '/applications/private-deploy-key', { method: 'POST', body: { ...common, git_repository: 'git@github.com:Drrbarns/faithline-whatsapp-ai.git', private_key_uuid: DEPLOY_KEY_UUID } });
    if (!c.ok) throw new Error(`create ${name}: ${JSON.stringify(c.data).slice(0, 400)}`);
    app = c.data;
  }
  const uuid = app.uuid;
  const host = kind === 'site' ? SITE_HOST : AI_HOST;
  const sql = `
UPDATE applications SET fqdn = 'https://${host}', git_branch = '${BRANCH}', build_pack = 'dockerfile',
  health_check_enabled = true, health_check_path = '/', custom_labels = '${labels(uuid, [host])}'
WHERE uuid = '${uuid}';
INSERT INTO local_persistent_volumes (name, mount_path, host_path, resource_type, resource_id, is_preview_suffix_enabled, uuid, created_at, updated_at)
SELECT '${name}-storage', '/app/storage', '${kind === 'site' ? STORAGE_HOST_DIR : '/data/coolify/faithline/ai-storage'}', 'App\\Models\\Application', id, false, '${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}', NOW(), NOW()
FROM applications WHERE uuid='${uuid}'
  AND NOT EXISTS (SELECT 1 FROM local_persistent_volumes l WHERE l.resource_id = applications.id AND l.mount_path = '/app/storage');
`;
  ssh('big-vps', 'docker exec -i coolify-db psql -q -U coolify -d coolify -v ON_ERROR_STOP=1', sql);
  return { uuid, name, host };
}

async function upsertEnv(uuid, key, value, buildtime) {
  if (value == null || value === '') return;
  const body = { key, value: String(value), is_literal: true, is_buildtime: !!buildtime, is_preview: false };
  let r = await api(NEW, `/applications/${uuid}/envs`, { method: 'POST', body });
  if (!r.ok) r = await api(NEW, `/applications/${uuid}/envs`, { method: 'PATCH', body });
  if (!r.ok) console.warn(`  ! ${key}: HTTP ${r.status}`);
}

async function oldEnvs(uuid) {
  const r = await api(OLD, `/applications/${uuid}/envs`);
  const out = {};
  for (const e of r.data || []) if (!e.is_preview && e.value) out[e.key] = { value: e.value, buildtime: !!e.is_buildtime };
  return out;
}

const DROP = new Set(['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_JWT_SECRET', 'STOREFRONT_SUPABASE_URL',
  'STOREFRONT_SUPABASE_ANON_KEY', 'STOREFRONT_SUPABASE_SERVICE_ROLE_KEY', 'NIXPACKS_NODE_VERSION', 'SOURCE_COMMIT', 'COOLIFY_URL',
  'COOLIFY_FQDN', 'COOLIFY_BRANCH', 'COOLIFY_RESOURCE_UUID', 'COOLIFY_CONTAINER_NAME', 'PORT', 'HOST', 'HOSTNAME']);

async function main() {
  const jwt = secretFile('faithline-jwt', () => crypto.randomBytes(32).toString('hex'));
  const dashSecret = secretFile('faithline-ai-session', () => crypto.randomBytes(32).toString('hex'));
  const db = directDbUrl();
  const proj = await ensureProject();
  console.log('project', proj.projectUuid);

  const site = await ensureApp('site', proj);
  const ai = await ensureApp('ai', proj);
  console.log('apps', site.name, site.uuid, '|', ai.name, ai.uuid);
  ssh('big-vps', `mkdir -p ${STORAGE_HOST_DIR} /data/coolify/faithline/ai-storage/media`);

  const siteUrl = `https://${site.host}`;
  const aiUrl = `https://${ai.host}`;

  // Storefront
  const s = await oldEnvs('m1399l37pbz8r9blpdl13oi7');
  const siteEnv = {};
  for (const [k, v] of Object.entries(s)) if (!DROP.has(k)) siteEnv[k] = v;
  Object.assign(siteEnv, {
    NEXT_PUBLIC_USE_PLAIN_PG: { value: 'true', buildtime: true },
    NEXT_PUBLIC_SUPABASE_URL: { value: siteUrl, buildtime: true },
    NEXT_PUBLIC_APP_URL: { value: siteUrl, buildtime: true },
    DATABASE_URL: { value: db, buildtime: true },
    AUTH_JWT_SECRET: { value: jwt, buildtime: true },
    JWT_SECRET: { value: jwt, buildtime: true },
    STORAGE_SIGNING_SECRET: { value: jwt, buildtime: true },
    STORAGE_ROOT: { value: '/app/storage', buildtime: true },
    STORAGE_PUBLIC_URL: { value: siteUrl, buildtime: true },
  });
  for (const [k, v] of Object.entries(siteEnv)) await upsertEnv(site.uuid, k, v.value, v.buildtime || k.startsWith('NEXT_PUBLIC_'));
  console.log('site settings:', Object.keys(siteEnv).sort().join(', '));

  // WhatsApp agent
  const a = await oldEnvs('e11od1nbajiu3cqoa696j9p3');
  const aiEnv = {};
  for (const [k, v] of Object.entries(a)) if (!DROP.has(k)) aiEnv[k] = v;
  Object.assign(aiEnv, {
    NEXT_PUBLIC_APP_URL: { value: aiUrl, buildtime: true },
    STOREFRONT_URL: { value: siteUrl, buildtime: false },
    DATABASE_URL: { value: db, buildtime: false },
    AUTH_JWT_SECRET: { value: jwt, buildtime: false },
    DASHBOARD_SESSION_SECRET: { value: dashSecret, buildtime: false },
    STORAGE_ROOT: { value: '/app/storage', buildtime: false },
    STORAGE_PUBLIC_URL: { value: aiUrl, buildtime: false },
    STORAGE_SIGNING_SECRET: { value: jwt, buildtime: false },
  });
  delete aiEnv.NEXT_PUBLIC_SUPABASE_URL;
  for (const [k, v] of Object.entries(aiEnv)) await upsertEnv(ai.uuid, k, v.value, v.buildtime || k.startsWith('NEXT_PUBLIC_'));
  console.log('ai settings:', Object.keys(aiEnv).sort().join(', '));
  fs.writeFileSync(path.join(HOME, '.config/coolify-vps/faithline-bigvps-apps.json'), JSON.stringify({ site, ai, project: proj }, null, 2), { mode: 0o600 });
}

main().catch((e) => { console.error(e.message); process.exit(1); });

import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';

const freePort = async () => {
  const server = createServer().listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(r => server.close(r));
  return port;
};

test('participant launcher serves a fresh local shop, console and references', { timeout: 60_000 }, async t => {
  const root = resolve('.');
  const dir = await mkdtemp(join(tmpdir(), 'w5 platform '));
  for (const name of ['src', 'scripts', 'demo', 'console', 'fixtures', 'hub', 'docs', 'lessons', 'package.json', 'package-lock.json', 'tsconfig.json']) {
    await cp(join(root, name), join(dir, name), {
      recursive: true,
      filter: path => ![join(root, 'demo', 'data'), join(root, 'console', 'data'), join(root, 'demo', 'incidents')].includes(path),
    });
  }
  await mkdir(join(dir, 'approvals'));
  await symlink(join(root, 'node_modules'), join(dir, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  const shopPort = await freePort();
  let consolePort = await freePort();
  while (consolePort === shopPort) consolePort = await freePort();
  const env = { ...process.env, AGENT_SHOP_PORT: String(shopPort), AGENT_CONSOLE_PORT: String(consolePort) };
  for (const key of ['AGENT_DEMO_DATA', 'AGENT_TELEMETRY', 'AGENT_SHOP_URL', 'AGENT_DB', 'AGENT_APPROVALS_DIR']) delete env[key];
  const child = spawn(process.execPath, ['scripts/start.mjs', '--fast', '--offline'], {
    cwd: dir, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { output += data; });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f']);
      else child.kill('SIGTERM');
      await exited;
    }
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });
  const deadline = Date.now() + 40_000;
  let health;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) assert.fail(output);
    try {
      const response = await fetch(`http://127.0.0.1:${consolePort}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { health = await response.json(); break; }
    } catch {}
    await setTimeout(200);
  }
  assert.ok(health, output);
  assert.equal(health.model, 'offline');
  assert.ok(health.shop, output);
  assert.equal((await fetch(`http://127.0.0.1:${shopPort}/health`)).status, 200);
  const hub = await fetch(`http://127.0.0.1:${consolePort}/hub`);
  assert.equal(hub.status, 200);
  assert.match(await hub.text(), /Expected reference: Describe the change before the solution/);
  assert.equal((await fetch(`http://127.0.0.1:${consolePort}/docs/assignment-examples/intent.png`)).status, 200);
  assert.deepEqual(await (await fetch(`http://127.0.0.1:${consolePort}/api/incidents`)).json(), []);
});

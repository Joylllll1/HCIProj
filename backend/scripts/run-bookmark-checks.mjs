import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

// Start a disposable standalone MongoDB; never connect to the application's URI.
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const directory = await mkdtemp(join(tmpdir(), 'bookmark-tests-'));
const mongo = spawn(process.env.MONGOD_BIN || 'mongod', [
  '--dbpath', directory, '--port', String(port), '--bind_ip', '127.0.0.1', '--logpath', join(directory, 'mongo.log'),
], { stdio: 'ignore' });
let startError;
mongo.on('error', (error) => { startError = error; });
const exited = new Promise((resolve) => mongo.once('exit', resolve));
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (startError) throw new Error('请安装 mongod 或通过 MONGOD_BIN 指定路径', { cause: startError });
    if (mongo.exitCode !== null) throw new Error(await readFile(join(directory, 'mongo.log'), 'utf8'));
    ready = await new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => { socket.destroy(); resolve(false); });
    });
    if (ready) break;
    await delay(100);
  }
  if (!ready) throw new Error('临时 MongoDB 启动超时');
  const runner = spawn(process.execPath, ['--test'], {
    cwd: new URL('../', import.meta.url), stdio: 'inherit',
    env: { ...process.env, BOOKMARK_TEST_MONGODB_URI: `mongodb://127.0.0.1:${port}/bookmark_test_${process.pid}` },
  });
  process.exitCode = await new Promise((resolve, reject) => { runner.once('error', reject); runner.once('exit', (code) => resolve(code ?? 1)); });
} finally {
  if (!startError && mongo.exitCode === null) { mongo.kill('SIGTERM'); await exited; }
  await rm(directory, { recursive: true, force: true });
}

// Tests for the entrypoint run: main.ts copies app/ + screenshots/ and
// writes a dossier.json that a second run reproduces byte for byte.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('..', import.meta.url));

function runMain(outDir) {
  return spawnSync(process.execPath, ['main.ts'], {
    cwd: repo,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
    encoding: 'utf8',
  });
}

describe('main.ts dossier run', () => {
  it('writes dossier.json and copies app/ and screenshots/', () => {
    const out = mkdtempSync(join(tmpdir(), 'vice-out-'));
    try {
      const run = runMain(out);
      assert.equal(run.status, 0, run.stderr);
      assert.ok(existsSync(join(out, 'dossier.json')));
      assert.ok(existsSync(join(out, 'app', 'index.html')));
      const dossier = JSON.parse(readFileSync(join(out, 'dossier.json'), 'utf8'));
      assert.equal(dossier.schema, 'makefun/dossier/v1');
      assert.ok(readFileSync(join(out, 'dossier.json')).length <= 1.5 * 1024 * 1024);
      assert.match(dossier.text, /drawCover/);
      assert.match(dossier.text, /Simian/);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('a second run writes byte-identical dossier.json', () => {
    const a = mkdtempSync(join(tmpdir(), 'vice-a-'));
    const b = mkdtempSync(join(tmpdir(), 'vice-b-'));
    try {
      assert.equal(runMain(a).status, 0);
      assert.equal(runMain(b).status, 0);
      assert.deepEqual(readFileSync(join(a, 'dossier.json')), readFileSync(join(b, 'dossier.json')));
    } finally {
      rmSync(a, { recursive: true, force: true });
      rmSync(b, { recursive: true, force: true });
    }
  });
});

describe('repo files', () => {
  it('LICENSE carries the SPDX identifier line', () => {
    assert.match(readFileSync(join(repo, 'LICENSE'), 'utf8'), /^SPDX-License-Identifier: MIT$/m);
  });

  it('README starts with the three make.fun badges for this repo', () => {
    const readme = readFileSync(join(repo, 'README.md'), 'utf8');
    assert.ok(readme.startsWith('# gta6-cover-art-01-r7\n'));
    assert.ok(readme.includes('https://make.fun/badge/gta6-cover-art-01.svg'));
    assert.ok(readme.includes('https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01-r7/rank.svg'));
    assert.ok(readme.includes('https://make.fun/badge/gta6-cover-art-01/hyde1990/gta6-cover-art-01-r7/reward.svg'));
    assert.ok(!readme.includes('{owner}') && !readme.includes('{repo}'));
  });

  it('package.json names the entry and has no runtime dependencies', () => {
    const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
    assert.equal(pkg.name, 'gta6-cover-art-01-r7');
    assert.equal(pkg.dependencies, undefined);
    assert.ok(pkg.scripts.test && pkg.scripts.start && pkg.scripts.shots);
  });
});

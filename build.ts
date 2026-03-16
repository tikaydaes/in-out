import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const production = process.env.NODE_ENV === 'production';

const manifestPath = new URL('./manifest.json', import.meta.url).pathname;
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const [major, minor, patch] = manifest.version.split('.').map(Number);
manifest.version = `${major}.${minor}.${patch + 1}`;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Version bumped to ${manifest.version}`);

const commonConfig: esbuild.BuildOptions = {
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: production,
  sourcemap: !production,
  logLevel: 'info',
};

await Promise.all([
  esbuild.build({
    ...commonConfig,
    entryPoints: ['popup/popup.ts'],
    outfile: 'dist/popup.js',
  }),
  esbuild.build({
    ...commonConfig,
    entryPoints: ['background/service-worker.ts'],
    outfile: 'dist/service-worker.js',
  }),
  esbuild.build({
    ...commonConfig,
    entryPoints: ['content/content.ts'],
    outfile: 'dist/content.js',
  }),
]);

console.log('Build complete');

import * as esbuild from 'esbuild';

const production = process.env.NODE_ENV === 'production';

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

const esbuild = require('esbuild');

async function build() {
  await esbuild.build({
    entryPoints: ['code.ts'],
    bundle: true,
    outfile: 'code.js',
    platform: 'browser',
    target: 'es2015',
    format: 'iife',
    external: ['openai'], // Add this back to prevent bundling
    define: {
      'global': 'globalThis',
    },
  });

  console.log('✅ Build complete');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
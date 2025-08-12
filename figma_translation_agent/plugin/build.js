const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    envFile.split('\n').forEach(line => {
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
        const [key, ...valueParts] = trimmedLine.split('=');
        if (key && valueParts.length > 0) {
          // Join back in case value contains '=' and remove any trailing semicolons
          const value = valueParts.join('=').replace(/;$/, '').trim();
          env[key.trim()] = value;
        }
      }
    });
  }
  
  return env;
}

async function build() {
  const env = loadEnv();
  
  console.log('Environment loaded:', Object.keys(env)); // Debug log
  
  await esbuild.build({
    entryPoints: ['code.ts'],
    bundle: true,
    outfile: 'code.js',
    platform: 'browser',
    target: 'es2015',
    format: 'iife',
    external: ['openai'],
    define: {
      'process.env.OPENAI_API_KEY': JSON.stringify(env.OPENAI_API_KEY || ''),
      'process.env.GROQ_API_KEY': JSON.stringify(env.GROQ_API_KEY || ''),
      'global': 'globalThis',
    },
  });

  console.log('✅ Build complete');
}

build().catch((error) => {
  console.error('Build failed:', error);
  process.exit(1);
});
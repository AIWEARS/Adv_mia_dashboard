import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(__dirname, 'client');

// Change CWD to client dir so PostCSS/Tailwind resolve paths correctly
process.chdir(clientDir);

// Resolve vite from client/node_modules
const require = createRequire(resolve(clientDir, 'package.json'));
const { createServer } = require('vite');

async function start() {
  const server = await createServer({
    root: clientDir,
    configFile: resolve(clientDir, 'vite.config.js'),
    server: {
      port: 5173,
      strictPort: true
    }
  });
  await server.listen();
  server.printUrls();
}

start().catch(err => {
  console.error(err);
  process.exit(1);
});

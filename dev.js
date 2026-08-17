const { spawn } = require('child_process');

console.log('=======================================================');
console.log(' Starting AquaRescue Command System (Socket + Next.js)');
console.log('=======================================================');

const server = spawn('node', ['server.js'], { stdio: 'inherit', shell: true });
const nextDev = spawn('npx', ['next', 'dev'], { stdio: 'inherit', shell: true });

const cleanup = () => {
  if (server && !server.killed) server.kill();
  if (nextDev && !nextDev.killed) nextDev.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

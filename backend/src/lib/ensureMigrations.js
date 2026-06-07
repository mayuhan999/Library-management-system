const { execSync } = require('node:child_process');
const path = require('node:path');

let ran = false;

/** Apply pending Prisma migrations once per process (fixes missing Payment table, etc.). */
function ensureMigrations() {
  if (ran || process.env.SKIP_AUTO_MIGRATE === '1') return;
  ran = true;
  const backendRoot = path.join(__dirname, '..', '..');
  try {
    execSync('npx prisma migrate deploy', {
      cwd: backendRoot,
      stdio: 'pipe',
      env: process.env,
    });
  } catch (e) {
    const msg = e.stderr?.toString() || e.stdout?.toString() || e.message;
    console.error('[ensureMigrations] prisma migrate deploy failed:', msg);
    throw e;
  }
}

module.exports = { ensureMigrations };

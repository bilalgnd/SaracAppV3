require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fetchLogs() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  const res = await ssh.execCommand('pm2 logs saracapp --nostream --lines 50');
  console.log(res.stdout);
  console.error(res.stderr);
  process.exit(0);
}

fetchLogs();

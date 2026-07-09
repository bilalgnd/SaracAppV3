require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function restartPm2() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  
  const res = await ssh.execCommand('pm2 restart saracapp');
  console.log(res.stdout);
  console.error(res.stderr);
  process.exit(0);
}

restartPm2();

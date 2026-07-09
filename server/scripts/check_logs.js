require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function check() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  const res = await ssh.execCommand('grep "SYNC_ORDERS" /home/bilalgnd/.pm2/logs/saracapp-out.log | tail -n 10');
  console.log("OUT LOG:");
  console.log(res.stdout);
  
  process.exit(0);
}
check();

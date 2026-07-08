require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkNginx() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  
  const res = await ssh.execCommand('cat /etc/nginx/sites-enabled/saracapp');
  console.log(res.stdout);
  console.error(res.stderr);
  process.exit(0);
}

checkNginx();

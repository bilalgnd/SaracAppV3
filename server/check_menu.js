require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkMenu() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  
  const res = await ssh.execCommand('curl -v http://127.0.0.1:5000/menu');
  console.log(res.stdout);
  console.error(res.stderr);
  process.exit(0);
}

checkMenu();

require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function patchServer() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  
  await ssh.execCommand("sed -i 's/console.log(\\'Phone rejected (Invalid Token)\\')/console.log(\\'Phone rejected (Invalid Token)\\', \\'received:\\', token, \\'expected:\\', systemSettings.API_TOKEN)/g' /home/bilalgnd/saracapp/dist/server.js");
  await ssh.execCommand('pm2 restart saracapp');
  process.exit(0);
}

patchServer();

require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function updateExpressLimit() {
  await ssh.connect({ host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD });
  
  await ssh.execCommand("sed -i \"s/limit: '10mb'/limit: '100mb'/g\" /home/bilalgnd/myhealth/server.js");
  await ssh.execCommand("sed -i \"s/limit: '50mb'/limit: '100mb'/g\" /home/bilalgnd/myhealth/server.js");
  await ssh.execCommand('pm2 restart myhealth');
  
  const check = await ssh.execCommand("grep 'limit' /home/bilalgnd/myhealth/server.js");
  console.log('✅ Express body limit updated:', check.stdout);
  process.exit(0);
}
updateExpressLimit();

require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function checkLogs() {
  await ssh.connect({ host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD });
  const pw = process.env.SSH_PASSWORD;
  
  console.log('--- Nginx Error Log (Last 25 lines) ---');
  let res = await ssh.execCommand(`echo '${pw}' | sudo -S tail -n 25 /var/log/nginx/error.log`);
  console.log(res.stdout || res.stderr);

  console.log('\n--- Nginx Access Log (Last 15 lines with 413) ---');
  res = await ssh.execCommand(`echo '${pw}' | sudo -S grep '413' /var/log/nginx/access.log | tail -n 15`);
  console.log(res.stdout || res.stderr);

  console.log('\n--- Check all client_max_body_size in all Nginx configs ---');
  res = await ssh.execCommand(`echo '${pw}' | sudo -S grep -rn 'client_max_body_size' /etc/nginx/`);
  console.log(res.stdout || res.stderr);

  process.exit(0);
}
checkLogs();

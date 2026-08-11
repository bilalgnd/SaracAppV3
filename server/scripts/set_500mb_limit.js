require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function set500MBLimit() {
  console.log('Connecting to server...');
  await ssh.connect({ host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD });
  console.log('Connected!');

  const pw = process.env.SSH_PASSWORD;
  const sudo = async (cmd) => {
    const res = await ssh.execCommand(`echo '${pw}' | sudo -S ${cmd}`, { cwd: '/home/bilalgnd' });
    console.log('CMD:', cmd);
    if (res.stdout) console.log('OUT:', res.stdout);
    if (res.stderr && !res.stderr.includes('[sudo]')) console.log('ERR:', res.stderr);
    return res;
  };

  // 1. Update /etc/nginx/nginx.conf http block
  console.log('\n--- Setting client_max_body_size 500M in /etc/nginx/nginx.conf ---');
  await sudo("sed -i '/client_max_body_size/d' /etc/nginx/nginx.conf");
  await sudo("sed -i '/http {/a\\\\    client_max_body_size 500M;' /etc/nginx/nginx.conf");

  // 2. Update /etc/nginx/sites-available/saracapp server block
  console.log('\n--- Setting client_max_body_size 500M in /etc/nginx/sites-available/saracapp ---');
  await sudo("sed -i 's/client_max_body_size [0-9]*[MG];/client_max_body_size 500M;/g' /etc/nginx/sites-available/saracapp");

  // 3. Update myhealth server.js express body parser limits to 500mb
  console.log('\n--- Updating express limit to 500mb in myhealth server.js ---');
  await ssh.execCommand("sed -i \"s/limit: '[0-9]*mb'/limit: '500mb'/g\" /home/bilalgnd/myhealth/server.js");
  await ssh.execCommand("sed -i \"s/limit: '[0-9]*M'/limit: '500mb'/g\" /home/bilalgnd/myhealth/server.js");

  // Restart PM2
  await ssh.execCommand('pm2 restart myhealth');

  // Test and Reload Nginx
  console.log('\n--- Testing and Reloading Nginx ---');
  await sudo('nginx -t');
  await sudo('systemctl restart nginx');

  console.log('\n✅ GLOBAL LIMIT INCREASED TO 500MB (500M)!');
  process.exit(0);
}

set500MBLimit().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

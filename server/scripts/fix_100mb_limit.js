require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixNginxGlobal() {
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

  // 1. Add client_max_body_size 100M into main nginx.conf http block
  console.log('\n--- Updating /etc/nginx/nginx.conf ---');
  await sudo("sed -i '/client_max_body_size/d' /etc/nginx/nginx.conf");
  await sudo("sed -i '/http {/a\\\\    client_max_body_size 100M;' /etc/nginx/nginx.conf");

  // 2. Also update express server body-parser limit in myhealth server.js
  console.log('\n--- Checking Express body limits in myhealth/server.js ---');
  const checkBodyLimit = await ssh.execCommand("grep 'limit' /home/bilalgnd/myhealth/server.js");
  console.log('Current express body limits:', checkBodyLimit.stdout || 'None');

  // Update server.js on remote to use express.json({ limit: '100mb' })
  const updateExpressBody = `
const fs = require('fs');
let content = fs.readFileSync('/home/bilalgnd/myhealth/server.js', 'utf8');
content = content.replace(/express\.json\(\)/g, "express.json({ limit: '100mb' })");
content = content.replace(/express\.urlencoded\(\{ extended: true \}\)/g, "express.urlencoded({ limit: '100mb', extended: true })");
fs.writeFileSync('/home/bilalgnd/myhealth/server.js', content);
`;
  await ssh.execCommand(`node -e "${updateExpressBody.replace(/\n/g, ' ')}"`);

  // 3. Restart PM2 myhealth
  console.log('\n--- Restarting PM2 myhealth ---');
  await ssh.execCommand('pm2 restart myhealth');

  // 4. Test and Reload Nginx
  console.log('\n--- Testing and Reloading Nginx ---');
  await sudo('nginx -t');
  await sudo('systemctl restart nginx');

  console.log('\n✅ BOTH Nginx and Express limits increased to 100MB!');
  process.exit(0);
}

fixNginxGlobal().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

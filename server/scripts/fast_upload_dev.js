require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function uploadDev() {
  console.log('Connecting to VPS...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Connected! Uploading backend server and apiorders_dev.html...');
  const root = path.join(__dirname, '..');

  await ssh.putFile(path.join(root, 'dist', 'server.js'), '/home/bilalgnd/saracapp/dist/server.js');
  await ssh.putFile(path.join(root, 'src', 'server.ts'), '/home/bilalgnd/saracapp/src/server.ts');
  await ssh.putFile(path.join(root, 'public', 'templates', 'apiorders_dev.html'), '/home/bilalgnd/saracapp/public/templates/apiorders_dev.html');
  await ssh.putFile(path.join(root, 'public', 'templates', 'apiorders.html'), '/home/bilalgnd/saracapp/public/templates/apiorders.html');

  console.log('Files uploaded. Restarting PM2 (saracapp)...');
  const res = await ssh.execCommand('pm2 restart saracapp', { cwd: '/home/bilalgnd/saracapp' });
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);

  console.log('Deploy completed successfully!');
  process.exit(0);
}

uploadDev().catch(err => {
  console.error('Deploy error:', err);
  process.exit(1);
});

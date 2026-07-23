require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function upload() {
  console.log('Connecting to server...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Uploading anti template and server.js...');
  const root = path.join(__dirname, '..');

  await ssh.putFile(path.join(root, 'dist', 'server.js'), '/home/bilalgnd/saracapp/dist/server.js');
  await ssh.putFile(path.join(root, 'src', 'server.ts'), '/home/bilalgnd/saracapp/src/server.ts');
  await ssh.putFile(path.join(root, 'public', 'templates', 'anti.html'), '/home/bilalgnd/saracapp/public/templates/anti.html');

  console.log('Restarting PM2 saracapp...');
  const res = await ssh.execCommand('pm2 restart saracapp');
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
  console.log('Instant upload finished!');
  process.exit(0);
}

upload().catch(e => {
  console.error(e);
  process.exit(1);
});

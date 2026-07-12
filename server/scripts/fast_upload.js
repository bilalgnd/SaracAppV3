require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function upload() {
  console.log('Connecting...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Connected. Uploading dist/server.js and src/server.ts...');
  const fs = require('fs');
  const root = path.join(__dirname, '..');
  
  async function safePutFile(local, remote) {
    if (fs.existsSync(local)) {
      await ssh.putFile(local, remote);
    }
  }

  async function safePutDir(local, remote) {
    if (fs.existsSync(local)) {
      await ssh.putDirectory(local, remote);
    }
  }

  await safePutFile(path.join(root, 'dist', 'server.js'), '/home/bilalgnd/saracapp/dist/server.js');
  await safePutFile(path.join(root, 'src', 'server.ts'), '/home/bilalgnd/saracapp/src/server.ts');
  await safePutFile(path.join(root, 'package.json'), '/home/bilalgnd/saracapp/package.json');
  await safePutFile(path.join(root, 'package-lock.json'), '/home/bilalgnd/saracapp/package-lock.json');
  await safePutFile(path.join(root, 'dist', 'models.js'), '/home/bilalgnd/saracapp/dist/models.js');
  await safePutFile(path.join(root, 'src', 'models.ts'), '/home/bilalgnd/saracapp/src/models.ts');
  await safePutDir(path.join(root, 'src', 'services'), '/home/bilalgnd/saracapp/src/services');
  await safePutDir(path.join(root, 'dist', 'services'), '/home/bilalgnd/saracapp/dist/services');
  await safePutFile(path.join(root, 'public', 'templates', 'admintools.html'), '/home/bilalgnd/saracapp/public/templates/admintools.html');
  await safePutFile(path.join(root, 'public', 'templates', 'portfolio.html'), '/home/bilalgnd/saracapp/public/templates/portfolio.html');
  await safePutFile(path.join(root, 'public', 'templates', 'tv.html'), '/home/bilalgnd/saracapp/public/templates/tv.html');
  await safePutFile(path.join(root, 'public', 'static', 'favicon.png'), '/home/bilalgnd/saracapp/public/static/favicon.png');
  await safePutFile(path.join(root, 'public', 'static', 'profile.jpg'), '/home/bilalgnd/saracapp/public/static/profile.jpg');
  await safePutFile(path.join(root, 'public', 'static', 'bg.jpg'), '/home/bilalgnd/saracapp/public/static/bg.jpg');
  await safePutDir(path.join(root, 'public', 'pos_app'), '/home/bilalgnd/saracapp/public/pos_app');
  await safePutDir(path.join(root, 'public', 'qr_app'), '/home/bilalgnd/saracapp/public/qr_app');
  console.log('Uploaded. Installing dependencies...');
  await ssh.execCommand('npm install', { cwd: '/home/bilalgnd/saracapp' });
  console.log('Restarting PM2...');
  const res = await ssh.execCommand('pm2 restart saracapp');
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
  console.log('Done.');
  process.exit(0);
}

upload().catch(e => {
  console.error(e);
  process.exit(1);
});

require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function upload() {
  console.log('Connecting...');
  await ssh.connect({
    host: 'bilalgnd.shop',
    username: 'bilalgnd00',
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

  await safePutFile(path.join(root, 'dist', 'server.js'), '/home/bilalgnd00/saracapp/dist/server.js');
  await safePutFile(path.join(root, 'src', 'server.ts'), '/home/bilalgnd00/saracapp/src/server.ts');
  await safePutFile(path.join(root, 'package.json'), '/home/bilalgnd00/saracapp/package.json');
  await safePutFile(path.join(root, 'package-lock.json'), '/home/bilalgnd00/saracapp/package-lock.json');
  // Preserve remote production .env file (do not overwrite on deploy)
  // await safePutFile(path.join(root, '.env'), '/home/bilalgnd00/saracapp/.env');
  await safePutFile(path.join(root, 'dist', 'models.js'), '/home/bilalgnd00/saracapp/dist/models.js');
  await safePutFile(path.join(root, 'src', 'models.ts'), '/home/bilalgnd00/saracapp/src/models.ts');
  await safePutDir(path.join(root, 'src', 'services'), '/home/bilalgnd00/saracapp/src/services');
  await safePutDir(path.join(root, 'dist', 'services'), '/home/bilalgnd00/saracapp/dist/services');
  await safePutFile(path.join(root, 'public', 'templates', 'admintools.html'), '/home/bilalgnd00/saracapp/public/templates/admintools.html');
  await safePutFile(path.join(root, 'public', 'templates', 'login.html'), '/home/bilalgnd00/saracapp/public/templates/login.html');
  await safePutFile(path.join(root, 'public', 'templates', 'portfolio.html'), '/home/bilalgnd00/saracapp/public/templates/portfolio.html');
  await safePutFile(path.join(root, 'public', 'templates', 'tv.html'), '/home/bilalgnd00/saracapp/public/templates/tv.html');
  await safePutFile(path.join(root, 'public', 'templates', 'apiorders.html'), '/home/bilalgnd00/saracapp/public/templates/apiorders.html');
  await safePutFile(path.join(root, 'public', 'templates', 'apiorders_dev.html'), '/home/bilalgnd00/saracapp/public/templates/apiorders_dev.html');
  await safePutFile(path.join(root, 'public', 'templates', 'anti.html'), '/home/bilalgnd00/saracapp/public/templates/anti.html');
  await ssh.execCommand('rm -f /home/bilalgnd00/saracapp/public/templates/tgo_admin.html');
  await ssh.execCommand('rm -rf /home/bilalgnd00/saracapp/public/pos_app');
  await safePutDir(path.join(root, 'public', 'pos_app'), '/home/bilalgnd00/saracapp/public/pos_app');
  await ssh.execCommand('rm -rf /home/bilalgnd00/saracapp/public/pos_mobil');
  await safePutDir(path.join(root, 'public', 'pos_mobil'), '/home/bilalgnd00/saracapp/public/pos_mobil');
  await safePutDir(path.join(root, 'public', 'qr'), '/home/bilalgnd00/saracapp/public/qr');
  await safePutDir(path.join(root, 'public', 'qr_app'), '/home/bilalgnd00/saracapp/public/qr_app');
  await safePutFile(path.join(root, 'public', 'static', 'profile.jpg'), '/home/bilalgnd00/saracapp/public/static/profile.jpg');
  await safePutFile(path.join(root, 'public', 'static', 'profile_video.mp4'), '/home/bilalgnd00/saracapp/public/static/profile_video.mp4');
  await safePutFile(path.join(root, 'public', 'static', 'profile_video2.mp4'), '/home/bilalgnd00/saracapp/public/static/profile_video2.mp4');
  await safePutFile(path.join(root, 'public', 'static', 'bg.jpg'), '/home/bilalgnd00/saracapp/public/static/bg.jpg');
  await safePutFile(path.join(root, 'public', 'static', 'bg_scroll.png'), '/home/bilalgnd00/saracapp/public/static/bg_scroll.png');
  await safePutFile(path.join(root, 'public', 'static', 'bg_logo.png'), '/home/bilalgnd00/saracapp/public/static/bg_logo.png');
  await safePutFile(path.join(root, 'public', 'bg_logo.png'), '/home/bilalgnd00/saracapp/public/bg_logo.png');
  await safePutFile(path.join(root, 'public', 'bg.png'), '/home/bilalgnd00/saracapp/public/bg.png');
  await safePutFile(path.join(root, 'public', 'vantage_logo.png'), '/home/bilalgnd00/saracapp/public/vantage_logo.png');
  await safePutFile(path.join(root, 'public', 'static', 'favicon.png'), '/home/bilalgnd00/saracapp/public/static/favicon.png');
  await ssh.execCommand('mkdir -p /home/bilalgnd00/saracapp/public/static/sq');
  await safePutDir(path.join(root, 'public', 'static', 'sq'), '/home/bilalgnd00/saracapp/public/static/sq');
  console.log('Uploaded. Compiling TypeScript on server...');
  await ssh.execCommand('npx tsc', { cwd: '/home/bilalgnd00/saracapp' });
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

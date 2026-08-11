require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function uploadTvFix() {
  console.log('Connecting to VPS...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Connected. Uploading server.js, models.js, and tv.html...');
  const root = path.join(__dirname, '..');

  await ssh.putFile(path.join(root, 'dist', 'server.js'), '/home/bilalgnd/saracapp/dist/server.js');
  console.log('✓ Uploaded dist/server.js');
  await ssh.putFile(path.join(root, 'src', 'server.ts'), '/home/bilalgnd/saracapp/src/server.ts');
  console.log('✓ Uploaded src/server.ts');
  await ssh.putFile(path.join(root, 'dist', 'models.js'), '/home/bilalgnd/saracapp/dist/models.js');
  console.log('✓ Uploaded dist/models.js');
  await ssh.putFile(path.join(root, 'src', 'models.ts'), '/home/bilalgnd/saracapp/src/models.ts');
  console.log('✓ Uploaded src/models.ts');
  await ssh.putFile(path.join(root, 'public', 'templates', 'tv.html'), '/home/bilalgnd/saracapp/public/templates/tv.html');
  const fs = require('fs');
  await ssh.mkdir('/home/bilalgnd/saracapp/public/static');
  if (fs.existsSync(path.join(root, 'public', 'static', 'bg_video.mp4'))) {
    await ssh.putFile(path.join(root, 'public', 'static', 'bg_video.mp4'), '/home/bilalgnd/saracapp/public/static/bg_video.mp4');
    console.log('✓ Uploaded public/static/bg_video.mp4');
  }
  if (fs.existsSync(path.join(root, 'public', 'static', 'tv_bg.png'))) {
    await ssh.putFile(path.join(root, 'public', 'static', 'tv_bg.png'), '/home/bilalgnd/saracapp/public/static/tv_bg.png');
    console.log('✓ Uploaded public/static/tv_bg.png');
  }
  console.log('✓ Uploaded public/templates/tv.html');

  console.log('Restarting PM2...');
  const res = await ssh.execCommand('pm2 restart saracapp');
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);

  console.log('TV Fix Upload & PM2 Restart Completed Successfully!');
  process.exit(0);
}

uploadTvFix().catch(err => {
  console.error('Upload failed:', err);
  process.exit(1);
});

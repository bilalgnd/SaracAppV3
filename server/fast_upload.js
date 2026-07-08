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
  await ssh.putFile(path.join(__dirname, 'dist', 'server.js'), '/home/bilalgnd/saracapp/dist/server.js');
  await ssh.putFile(path.join(__dirname, 'src', 'server.ts'), '/home/bilalgnd/saracapp/src/server.ts');
  await ssh.putFile(path.join(__dirname, 'dist', 'models.js'), '/home/bilalgnd/saracapp/dist/models.js');
  await ssh.putFile(path.join(__dirname, 'src', 'models.ts'), '/home/bilalgnd/saracapp/src/models.ts');
  await ssh.putFile(path.join(__dirname, 'public', 'templates', 'admintools.html'), '/home/bilalgnd/saracapp/public/templates/admintools.html');
  await ssh.putFile(path.join(__dirname, 'public', 'templates', 'portfolio.html'), '/home/bilalgnd/saracapp/public/templates/portfolio.html');
  await ssh.putFile(path.join(__dirname, 'public', 'templates', 'tv.html'), '/home/bilalgnd/saracapp/public/templates/tv.html');
  await ssh.putFile(path.join(__dirname, 'public', 'static', 'favicon.png'), '/home/bilalgnd/saracapp/public/static/favicon.png');
  await ssh.putFile(path.join(__dirname, 'public', 'static', 'profile.jpg'), '/home/bilalgnd/saracapp/public/static/profile.jpg');
  await ssh.putFile(path.join(__dirname, 'public', 'static', 'bg.jpg'), '/home/bilalgnd/saracapp/public/static/bg.jpg');
  await ssh.putDirectory(path.join(__dirname, 'public', 'pos_app'), '/home/bilalgnd/saracapp/public/pos_app');
  console.log('Uploaded. Restarting PM2...');
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

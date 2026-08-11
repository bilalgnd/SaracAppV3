require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const fs = require('fs');
const ssh = new NodeSSH();

async function upload() {
  console.log('Connecting via SSH...');
  const sshConfig = {
    host: 'bilalgnd.shop',
    username: 'bilalgnd00'
  };
  if (fs.existsSync('C:/Users/bilal/.ssh/id_ed25519')) {
    sshConfig.privateKeyPath = 'C:/Users/bilal/.ssh/id_ed25519';
  } else if (process.env.SSH_PASSWORD) {
    sshConfig.password = process.env.SSH_PASSWORD;
  }

  await ssh.connect(sshConfig);
  console.log('Connected. Uploading profile images...');
  if (fs.existsSync('server/public/static/profile.jpg')) {
    await ssh.putFile('server/public/static/profile.jpg', '/home/bilalgnd00/saracapp/server/public/static/profile.jpg');
    console.log('Uploaded profile.jpg');
  }
  if (fs.existsSync('server/public/static/profile.png')) {
    await ssh.putFile('server/public/static/profile.png', '/home/bilalgnd00/saracapp/server/public/static/profile.png');
    console.log('Uploaded profile.png');
  }
  if (fs.existsSync('server/public/templates/portfolio.html')) {
    await ssh.putFile('server/public/templates/portfolio.html', '/home/bilalgnd00/saracapp/server/public/templates/portfolio.html');
    console.log('Uploaded portfolio.html');
  }
  console.log('Pulling git & restarting server...');
  const res = await ssh.execCommand('cd /home/bilalgnd00/saracapp && git pull origin main && cd server && npx tsc && pm2 restart saracapp');
  console.log('STDOUT:', res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
  console.log('Server update complete!');
  process.exit(0);
}

upload().catch(e => {
  console.error('Update failed:', e);
  process.exit(1);
});

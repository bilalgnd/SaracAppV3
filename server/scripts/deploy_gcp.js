const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { NodeSSH } = require('node-ssh');
const fs = require('fs');

const ssh = new NodeSSH();

async function deployGcp() {
  console.log('🚀 Connecting to Google Cloud (bilalgnd.shop)...');
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
  console.log('✅ Connected to Google Cloud VM!');

  const serverDir = path.join(__dirname, '..');
  const remoteServerDir = '/home/bilalgnd00/saracapp/server';

  console.log('📦 Uploading server package.json & tsconfig.json...');
  await ssh.putFile(path.join(serverDir, 'package.json'), `${remoteServerDir}/package.json`);
  await ssh.putFile(path.join(serverDir, 'tsconfig.json'), `${remoteServerDir}/tsconfig.json`);
  if (fs.existsSync(path.join(serverDir, 'firebase-adminsdk.json'))) {
    console.log('📦 Uploading firebase-adminsdk.json...');
    await ssh.putFile(path.join(serverDir, 'firebase-adminsdk.json'), `${remoteServerDir}/firebase-adminsdk.json`);
  }

  console.log('📦 Running npm install on GCP...');
  const npmRes = await ssh.execCommand('npm install --production=false', { cwd: remoteServerDir });
  console.log(npmRes.stdout);
  if (npmRes.stderr) console.error(npmRes.stderr);

  console.log('📦 Uploading server/dist...');
  await ssh.putDirectory(path.join(serverDir, 'dist'), `${remoteServerDir}/dist`);

  console.log('📦 Uploading server/src...');
  await ssh.putDirectory(path.join(serverDir, 'src'), `${remoteServerDir}/src`);

  console.log('📦 Uploading server/public/qr_app...');
  await ssh.putDirectory(path.join(serverDir, 'public', 'qr_app'), `${remoteServerDir}/public/qr_app`);

  console.log('📦 Uploading server/public/qr...');
  await ssh.putDirectory(path.join(serverDir, 'public', 'qr'), `${remoteServerDir}/public/qr`);

  console.log('📦 Uploading server/public/templates...');
  await ssh.putDirectory(path.join(serverDir, 'public', 'templates'), `${remoteServerDir}/public/templates`);

  console.log('🔄 Restarting PM2 process (saracapp) on Google Cloud...');
  const res = await ssh.execCommand('pm2 restart saracapp', { cwd: remoteServerDir });
  console.log('STDOUT:', res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);

  console.log('📊 Current PM2 Status:');
  const statusRes = await ssh.execCommand('pm2 list', { cwd: remoteServerDir });
  console.log(statusRes.stdout);

  console.log('✨ Google Cloud Deployment Successful!');
  process.exit(0);
}

deployGcp().catch(err => {
  console.error('❌ GCP Deployment failed:', err);
  process.exit(1);
});

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { NodeSSH } = require('node-ssh');
const fs = require('fs');

const ssh = new NodeSSH();

async function fastDeploy() {
  console.log('🚀 Connecting to bilalgnd.shop VPS (92.205.181.67)...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('✅ SSH Connected!');

  const serverDir = path.join(__dirname, '..');
  const remoteServerDir = '/home/bilalgnd/saracapp';

  console.log('📦 Uploading server/package.json & tsconfig.json...');
  await ssh.putFile(path.join(serverDir, 'package.json'), path.join(remoteServerDir, 'package.json'));
  await ssh.putFile(path.join(serverDir, 'tsconfig.json'), path.join(remoteServerDir, 'tsconfig.json'));

  console.log('📦 Running npm install on server...');
  const npmRes = await ssh.execCommand('npm install --production=false', { cwd: remoteServerDir });
  console.log(npmRes.stdout);
  if (npmRes.stderr) console.error(npmRes.stderr);

  console.log('📦 Uploading server/dist...');
  await ssh.putDirectory(path.join(serverDir, 'dist'), path.join(remoteServerDir, 'dist'));

  console.log('📦 Uploading server/src...');
  await ssh.putDirectory(path.join(serverDir, 'src'), path.join(remoteServerDir, 'src'));

  console.log('📦 Uploading server/public/qr_app...');
  await ssh.putDirectory(path.join(serverDir, 'public', 'qr_app'), path.join(remoteServerDir, 'public', 'qr_app'));

  console.log('📦 Uploading server/public/qr...');
  await ssh.putDirectory(path.join(serverDir, 'public', 'qr'), path.join(remoteServerDir, 'public', 'qr'));

  console.log('📦 Uploading server/public/templates...');
  await ssh.putDirectory(path.join(serverDir, 'public', 'templates'), path.join(remoteServerDir, 'public', 'templates'));

  console.log('🔄 Restarting PM2 process (saracapp)...');
  const res = await ssh.execCommand('pm2 restart saracapp', { cwd: remoteServerDir });
  console.log('STDOUT:', res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);

  // Check pm2 status
  const statusRes = await ssh.execCommand('pm2 list', { cwd: remoteServerDir });
  console.log(statusRes.stdout);

  console.log('✨ Cloud Server Deployment Complete!');
  process.exit(0);
}

fastDeploy().catch(err => {
  console.error('❌ Deployment failed:', err);
  process.exit(1);
});

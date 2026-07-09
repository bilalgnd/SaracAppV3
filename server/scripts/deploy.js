require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function deploy() {
  console.log('Connecting to VPS...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Connected!');

  const runCmd = async (cmd) => {
    console.log(`Running: ${cmd}`);
    const res = await ssh.execCommand(cmd.startsWith('sudo') ? `echo '${process.env.SSH_PASSWORD}' | sudo -S ${cmd.substring(5)}` : cmd, { cwd: '/home/bilalgnd' });
    console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    return res;
  };

  // Install Node.js & Nginx
  await runCmd('sudo apt-get update');
  await runCmd('sudo apt-get install -y curl dirmngr apt-transport-https lsb-release ca-certificates nginx');
  await runCmd('curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -');
  await runCmd('sudo apt-get install -y nodejs');
  await runCmd('sudo npm install -g pm2 typescript');

  // Create project directory
  await runCmd('mkdir -p /home/bilalgnd/saracapp');

  console.log('Uploading files...');
  await ssh.putDirectory(path.join(__dirname, '../src'), '/home/bilalgnd/saracapp/src');
  await ssh.putDirectory(path.join(__dirname, '../public'), '/home/bilalgnd/saracapp/public');
  await ssh.putFile(path.join(__dirname, '../package.json'), '/home/bilalgnd/saracapp/package.json');
  await ssh.putFile(path.join(__dirname, '../tsconfig.json'), '/home/bilalgnd/saracapp/tsconfig.json');
  await ssh.putFile(path.join(__dirname, '../.env'), '/home/bilalgnd/saracapp/.env');
  
  if (require('fs').existsSync(path.join(__dirname, '../firebase-adminsdk.json'))) {
    await ssh.putFile(path.join(__dirname, '../firebase-adminsdk.json'), '/home/bilalgnd/saracapp/firebase-adminsdk.json');
  }
  console.log('Files uploaded.');

  // Install dependencies and start
  await ssh.execCommand('npm install', { cwd: '/home/bilalgnd/saracapp' });
  await ssh.execCommand('npx tsc', { cwd: '/home/bilalgnd/saracapp' });
  
  // Start PM2
  await ssh.execCommand('pm2 stop saracapp || true', { cwd: '/home/bilalgnd/saracapp' });
  await ssh.execCommand('pm2 start dist/server.js --name saracapp', { cwd: '/home/bilalgnd/saracapp' });
  await ssh.execCommand('pm2 save', { cwd: '/home/bilalgnd/saracapp' });

  console.log('Deployment successful!');
  process.exit(0);
}

deploy().catch(err => {
  console.error('Deployment failed:', err);
  process.exit(1);
});

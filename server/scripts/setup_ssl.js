require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function setupSSL() {
  console.log('Connecting to VPS...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Connected!');

  const runCmd = async (cmd) => {
    console.log(`Running: ${cmd}`);
    const res = await ssh.execCommand(`echo '${process.env.SSH_PASSWORD}' | sudo -S bash -c "${cmd.replace(/"/g, '\\"')}"`);
    console.log(res.stdout);
    if (res.stderr) console.error(res.stderr);
    return res;
  };

  // Install Certbot
  await runCmd('apt-get install -y certbot python3-certbot-nginx');

  // Obtain SSL
  await runCmd('certbot --nginx -d bilalgnd.shop -d www.bilalgnd.shop --non-interactive --agree-tos -m bilalgnd00@gmail.com');

  console.log('SSL setup successful!');
  process.exit(0);
}

setupSSL().catch(err => {
  console.error('SSL setup failed:', err);
  process.exit(1);
});

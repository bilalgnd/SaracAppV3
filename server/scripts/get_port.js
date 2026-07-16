const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
require('dotenv').config();

async function getPort() {
    await ssh.connect({
        host: '92.205.181.67',
        username: 'bilalgnd',
        password: process.env.SSH_PASSWORD
    });
    const res = await ssh.execCommand('pm2 logs saracapp --lines 20 --nostream');
    console.log(res.stdout);
    process.exit(0);
}
getPort();

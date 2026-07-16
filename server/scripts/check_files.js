const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
require('dotenv').config();

async function checkFiles() {
    await ssh.connect({
        host: '92.205.181.67',
        username: 'bilalgnd',
        password: process.env.SSH_PASSWORD
    });
    const res = await ssh.execCommand('grep -n "print" "/home/bilalgnd/saracapp/public/trendyol-mock/TGO Yemek.html"');
    console.log(res.stdout);
    process.exit(0);
}
checkFiles();

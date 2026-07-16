const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
require('dotenv').config();

async function testServer() {
    await ssh.connect({
        host: '92.205.181.67',
        username: 'bilalgnd',
        password: process.env.SSH_PASSWORD
    });
    const res = await ssh.execCommand('curl -s "http://localhost:5000/trendyol-mock/TGO%20Yemek.html" | head -n 10');
    console.log(res.stdout);
    
    process.exit(0);
}
testServer();

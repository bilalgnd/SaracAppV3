const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();
require('dotenv').config();

async function uploadHtml() {
    await ssh.connect({
        host: '92.205.181.67',
        username: 'bilalgnd',
        password: process.env.SSH_PASSWORD
    });

    await ssh.putFile(
        'c:/Users/bilal/SARACAPP/SARACAPPV3/server/public/trendyol-mock/TGO Yemek.html',
        '/home/bilalgnd/saracapp/public/trendyol-mock/TGO Yemek.html'
    );
    await ssh.putFile(
        'c:/Users/bilal/SARACAPP/SARACAPPV3/server/public/trendyol-mock/2TGO Yemek.html',
        '/home/bilalgnd/saracapp/public/trendyol-mock/2TGO Yemek.html'
    );
    console.log('Uploaded successfully');
    process.exit(0);
}
uploadHtml();

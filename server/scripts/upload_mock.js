require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

async function uploadMock() {
    await ssh.connect({
        host: '92.205.181.67',
        username: 'bilalgnd',
        password: process.env.SSH_PASSWORD
    });
    
    console.log('Connected, uploading mock files...');
    await ssh.putFiles([
        { local: 'public/trendyol-mock/TGO Yemek.html', remote: '/home/bilalgnd/saracapp/public/trendyol-mock/TGO Yemek.html' },
        { local: 'public/trendyol-mock/2TGO Yemek.html', remote: '/home/bilalgnd/saracapp/public/trendyol-mock/2TGO Yemek.html' },
        { local: 'public/trendyol-mock/fis.pdf', remote: '/home/bilalgnd/saracapp/public/trendyol-mock/fis.pdf' }
    ]);
    console.log('Upload complete.');
    process.exit(0);
}
uploadMock();

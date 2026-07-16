const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function uploadFix() {
    try {
        await ssh.connect({
            host: '92.205.181.67',
            username: 'bilalgnd',
            password: process.env.SSH_PASSWORD
        });

        console.log('Connected to SSH');

        await ssh.putFile(
            path.join(__dirname, '../public/templates/tv.html'),
            '/home/bilalgnd/saracapp/public/templates/tv.html'
        );
        console.log('Uploaded tv.html');

        await ssh.putFile(
            path.join(__dirname, '../src/server.ts'),
            '/home/bilalgnd/saracapp/src/server.ts'
        );
        console.log('Uploaded server.ts');

        console.log('Restarting PM2...');
        const res = await ssh.execCommand('pm2 restart saracapp');
        console.log(res.stdout);

        console.log('Done!');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

uploadFix();

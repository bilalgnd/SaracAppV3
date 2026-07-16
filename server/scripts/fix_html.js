const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
require('dotenv').config();

async function fixHtml() {
    await ssh.connect({
        host: '92.205.181.67',
        username: 'bilalgnd',
        password: process.env.SSH_PASSWORD
    });

    const check = 'if (window.triggerTestPdf) { window.triggerTestPdf(); return; }';

    const tgo1 = await ssh.execCommand('cat "/home/bilalgnd/saracapp/public/trendyol-mock/TGO Yemek.html"');
    const newTgo1 = tgo1.stdout.replace('function printTestPdf() {', 'function printTestPdf() { ' + check);
    await ssh.execCommand(cat << 'EOF' > "/home/bilalgnd/saracapp/public/trendyol-mock/TGO Yemek.html"\n\nEOF);

    const tgo2 = await ssh.execCommand('cat "/home/bilalgnd/saracapp/public/trendyol-mock/2TGO Yemek.html"');
    const newTgo2 = tgo2.stdout.replace('function printTestPdf() {', 'function printTestPdf() { ' + check);
    await ssh.execCommand(cat << 'EOF' > "/home/bilalgnd/saracapp/public/trendyol-mock/2TGO Yemek.html"\n\nEOF);

    console.log('Fixed');
    process.exit(0);
}
fixHtml();

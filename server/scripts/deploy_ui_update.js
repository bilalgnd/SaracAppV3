require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function upload() {
  await ssh.connect({ host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD });
  const localDir = 'C:\\Users\\bilal\\Desktop\\heathapp\\myhealth\\public';
  const remoteDir = '/home/bilalgnd/myhealth/public';
  
  await ssh.putFile(localDir + '\\index.html', remoteDir + '/index.html');
  await ssh.putFile(localDir + '\\styles.css', remoteDir + '/styles.css');
  await ssh.putFile(localDir + '\\app.js', remoteDir + '/app.js');
  
  console.log('✅ Uploaded updated HTML, CSS, JS!');
  process.exit(0);
}
upload();

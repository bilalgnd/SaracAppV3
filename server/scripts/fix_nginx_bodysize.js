require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fix() {
  console.log('Connecting as bilalgnd@92.205.181.67...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('Connected!');

  const pw = process.env.SSH_PASSWORD;

  const sudoCmd = async (cmd) => {
    const res = await ssh.execCommand("echo '" + pw + "' | sudo -S " + cmd, { cwd: '/home/bilalgnd' });
    console.log('CMD:', cmd);
    if (res.stdout) console.log('OUT:', res.stdout);
    if (res.stderr) console.log('ERR:', res.stderr);
    return res;
  };

  // 1. Add client_max_body_size to nginx.conf (in http block)
  console.log('\n--- Adding client_max_body_size 50M to Nginx ---');
  await sudoCmd("sed -i '/http {/a\\\\    client_max_body_size 50M;' /etc/nginx/nginx.conf");

  // 2. Test nginx config
  console.log('\n--- Testing Nginx config ---');
  await sudoCmd('nginx -t');

  // 3. Reload nginx
  console.log('\n--- Reloading Nginx ---');
  await sudoCmd('systemctl reload nginx');

  console.log('\n✅ DONE! client_max_body_size 50M applied to bilalgnd.shop');
  process.exit(0);
}

fix().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

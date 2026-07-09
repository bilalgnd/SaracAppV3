require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function setupNginx() {
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

  const nginxConfig = `
server {
    listen 80;
    server_name bilalgnd.shop www.bilalgnd.shop;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }
}
`;

  // Write config
  await ssh.execCommand(`echo '${process.env.SSH_PASSWORD}' | sudo -S bash -c "cat > /etc/nginx/sites-available/saracapp << 'EOF'\n${nginxConfig}\nEOF"`);

  // Enable site
  await runCmd('ln -sf /etc/nginx/sites-available/saracapp /etc/nginx/sites-enabled/');
  await runCmd('rm -f /etc/nginx/sites-enabled/default');
  await runCmd('nginx -t');
  await runCmd('systemctl restart nginx');

  console.log('Nginx setup successful!');
  process.exit(0);
}

setupNginx().catch(err => {
  console.error('Nginx setup failed:', err);
  process.exit(1);
});

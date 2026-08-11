require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fix() {
  console.log('Connecting...');
  await ssh.connect({ host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD });
  console.log('Connected!');

  const pw = process.env.SSH_PASSWORD;
  const run = async (cmd, cwd = '/home/bilalgnd/myhealth') => {
    console.log(`▶ ${cmd}`);
    const res = await ssh.execCommand(cmd, { cwd });
    if (res.stdout) console.log(res.stdout);
    if (res.stderr && !res.stderr.includes('npm')) console.log('ERR:', res.stderr.slice(0, 200));
    return res;
  };
  const sudo = async (cmd) => {
    const res = await ssh.execCommand(`echo '${pw}' | sudo -S ${cmd}`, { cwd: '/home/bilalgnd' });
    if (res.stdout) console.log(res.stdout);
    if (res.stderr && !res.stderr.includes('[sudo]')) console.log('ERR:', res.stderr.slice(0, 200));
    return res;
  };

  // Check what's on port 3000
  console.log('\n--- Checking ports ---');
  await run('pm2 list', '/home/bilalgnd');
  const portCheck = await run('ss -tlnp | grep 3000', '/home/bilalgnd');

  // Restart myhealth on port 3001
  console.log('\n--- Moving myhealth to port 3001 ---');
  await run('pm2 stop myhealth || true', '/home/bilalgnd');
  await run('pm2 delete myhealth || true', '/home/bilalgnd');
  await run(`PORT=3001 MONGODB_URI="${process.env.MONGODB_URI}" pm2 start server.js --name myhealth`);
  await run('pm2 save', '/home/bilalgnd');

  // Update Nginx to use port 3001
  console.log('\n--- Updating Nginx to port 3001 ---');
  const nginxConfig = `server {
    server_name bilalgnd.shop www.bilalgnd.shop;

    client_max_body_size 50M;

    location /myhealth {
        proxy_pass http://127.0.0.1:3001/myhealth;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/webhook/health {
        proxy_pass http://127.0.0.1:3001/api/webhook/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/health/metrics {
        proxy_pass http://127.0.0.1:3001/api/health/metrics;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/health/seed {
        proxy_pass http://127.0.0.1:3001/api/health/seed;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/bilalgnd.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bilalgnd.shop/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    if ($host = www.bilalgnd.shop) { return 301 https://$host$request_uri; }
    if ($host = bilalgnd.shop) { return 301 https://$host$request_uri; }
    listen 80;
    server_name bilalgnd.shop www.bilalgnd.shop;
    return 404;
}`;

  await run(`cat > /tmp/bilalgnd_nginx.conf << 'NGINXEOF'\n${nginxConfig}\nNGINXEOF`, '/tmp');
  await sudo('cp /tmp/bilalgnd_nginx.conf /etc/nginx/sites-available/saracapp');
  await sudo('nginx -t');
  await sudo('systemctl reload nginx');

  console.log('\n✅ FIXED! myhealth now on port 3001');
  console.log('🌐 https://bilalgnd.shop/myhealth');
  process.exit(0);
}

fix().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixCaseInsensitiveNginx() {
  console.log('Connecting to server...');
  await ssh.connect({ host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD });
  console.log('Connected!');

  const pw = process.env.SSH_PASSWORD;
  const sudo = async (cmd) => {
    const res = await ssh.execCommand(`echo '${pw}' | sudo -S ${cmd}`, { cwd: '/home/bilalgnd' });
    console.log('CMD:', cmd);
    if (res.stdout) console.log('OUT:', res.stdout);
    if (res.stderr && !res.stderr.includes('[sudo]')) console.log('ERR:', res.stderr);
    return res;
  };

  const nginxConfig = `server {
    server_name bilalgnd.shop www.bilalgnd.shop;

    client_max_body_size 500M;

    location /myhealth {
        proxy_pass http://127.0.0.1:3001/myhealth;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Matches /api/webhook/health
    location /api/webhook/health {
        proxy_pass http://127.0.0.1:3001/api/webhook/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 500M;
    }

    # Matches uppercase /API/webhook/health (from Android app)
    location /API/webhook/health {
        proxy_pass http://127.0.0.1:3001/api/webhook/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 500M;
    }

    location /api/health/ {
        proxy_pass http://127.0.0.1:3001/api/health/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /API/health/ {
        proxy_pass http://127.0.0.1:3001/api/health/;
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

  await ssh.execCommand(`cat > /tmp/bilalgnd_nginx.conf << 'NGINXEOF'\n${nginxConfig}\nNGINXEOF`);
  await sudo('cp /tmp/bilalgnd_nginx.conf /etc/nginx/sites-available/saracapp');
  await sudo('nginx -t');
  await sudo('systemctl restart nginx');

  console.log('\n✅ BOTH /api/ AND /API/ WEBHOOK ROUTES ADDED AND NGINX RESTARTED!');
  process.exit(0);
}

fixCaseInsensitiveNginx().catch(e => { console.error('FAILED:', e.message); process.exit(1); });

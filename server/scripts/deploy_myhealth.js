require('dotenv').config({ path: 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\server\\.env' });
const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

const MYHEALTH_LOCAL = 'C:\\Users\\bilal\\Desktop\\heathapp\\myhealth';
const REMOTE_DIR = '/home/bilalgnd/myhealth';

async function deploy() {
  console.log('🔌 Connecting to 92.205.181.67 as bilalgnd...');
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  console.log('✅ Connected!\n');

  const pw = process.env.SSH_PASSWORD;
  const run = async (cmd, cwd = REMOTE_DIR) => {
    console.log(`▶ ${cmd}`);
    const res = await ssh.execCommand(cmd, { cwd });
    if (res.stdout) console.log(res.stdout);
    if (res.stderr && !res.stderr.includes('warn') && !res.stderr.includes('npm')) console.log('ERR:', res.stderr.slice(0, 200));
    return res;
  };
  const sudo = async (cmd, cwd = '/home/bilalgnd') => {
    const res = await ssh.execCommand(`echo '${pw}' | sudo -S ${cmd}`, { cwd });
    if (res.stdout) console.log(res.stdout);
    if (res.stderr && !res.stderr.includes('[sudo]')) console.log('ERR:', res.stderr.slice(0, 200));
    return res;
  };

  // 1. Create remote directory
  console.log('\n📁 Creating remote directory...');
  await run(`mkdir -p ${REMOTE_DIR}`, '/home/bilalgnd');
  await run(`mkdir -p ${REMOTE_DIR}/data`, '/home/bilalgnd');

  // 2. Upload files
  console.log('\n📤 Uploading server.js...');
  await ssh.putFile(`${MYHEALTH_LOCAL}\\server.js`, `${REMOTE_DIR}/server.js`);

  console.log('📤 Uploading package.json...');
  await ssh.putFile(`${MYHEALTH_LOCAL}\\package.json`, `${REMOTE_DIR}/package.json`);

  console.log('📤 Uploading seed_sample_data.js...');
  await ssh.putFile(`${MYHEALTH_LOCAL}\\seed_sample_data.js`, `${REMOTE_DIR}/seed_sample_data.js`);

  console.log('📤 Uploading public/index.html...');
  await run(`mkdir -p ${REMOTE_DIR}/public`, '/home/bilalgnd');
  await ssh.putFile(`${MYHEALTH_LOCAL}\\public\\index.html`, `${REMOTE_DIR}/public/index.html`);

  console.log('📤 Uploading public/styles.css...');
  await ssh.putFile(`${MYHEALTH_LOCAL}\\public\\styles.css`, `${REMOTE_DIR}/public/styles.css`);

  console.log('📤 Uploading public/app.js...');
  await ssh.putFile(`${MYHEALTH_LOCAL}\\public\\app.js`, `${REMOTE_DIR}/public/app.js`);

  console.log('\n✅ All files uploaded!\n');

  // 3. npm install
  console.log('📦 Installing dependencies...');
  await run('npm install --omit=dev', REMOTE_DIR);

  // 4. Stop old PM2 instance if exists
  console.log('\n🔁 Restarting PM2 process...');
  await run('pm2 stop myhealth || true', REMOTE_DIR);
  await run('pm2 delete myhealth || true', REMOTE_DIR);

  // 5. Start with PM2 on port 3000
  await run(`PORT=3000 MONGODB_URI="${process.env.MONGODB_URI}" pm2 start server.js --name myhealth`, REMOTE_DIR);
  await run('pm2 save', REMOTE_DIR);

  // 6. Update Nginx config to add /myhealth and /api/webhook/health routes
  console.log('\n🔧 Updating Nginx config to add /myhealth routes...');
  
  const nginxConfig = `server {
    server_name bilalgnd.shop www.bilalgnd.shop;

    client_max_body_size 50M;

    location /myhealth {
        proxy_pass http://127.0.0.1:3000/myhealth;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/webhook/health {
        proxy_pass http://127.0.0.1:3000/api/webhook/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/health/metrics {
        proxy_pass http://127.0.0.1:3000/api/health/metrics;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /api/health/seed {
        proxy_pass http://127.0.0.1:3000/api/health/seed;
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
    if ($host = www.bilalgnd.shop) {
        return 301 https://$host$request_uri;
    }
    if ($host = bilalgnd.shop) {
        return 301 https://$host$request_uri;
    }
    listen 80;
    server_name bilalgnd.shop www.bilalgnd.shop;
    return 404;
}`;

  // Write nginx config to temp file on server
  await run(`cat > /tmp/bilalgnd_nginx.conf << 'NGINXEOF'\n${nginxConfig}\nNGINXEOF`, '/tmp');
  await sudo('cp /tmp/bilalgnd_nginx.conf /etc/nginx/sites-available/saracapp');
  
  // Test and reload
  const testRes = await sudo('nginx -t');
  console.log('Nginx test result:', testRes.stderr || testRes.stdout);
  await sudo('systemctl reload nginx');

  console.log('\n🎉 DEPLOYMENT COMPLETE!');
  console.log('🌐 Dashboard: https://bilalgnd.shop/myhealth');
  console.log('📥 Webhook:   https://bilalgnd.shop/api/webhook/health');
  process.exit(0);
}

deploy().catch(e => { console.error('❌ FAILED:', e.message); process.exit(1); });

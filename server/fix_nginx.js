require('dotenv').config();
const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function fixNginx() {
  await ssh.connect({
    host: '92.205.181.67',
    username: 'bilalgnd',
    password: process.env.SSH_PASSWORD
  });
  
  const nginxConfig = `
server {
    server_name bilalgnd.shop www.bilalgnd.shop;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \\$host;
        proxy_cache_bypass \\$http_upgrade;
    }

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/bilalgnd.shop/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/bilalgnd.shop/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if (\\$host = www.bilalgnd.shop) {
        return 301 https://\\$host\\$request_uri;
    } # managed by Certbot

    if (\\$host = bilalgnd.shop) {
        return 301 https://\\$host\\$request_uri;
    } # managed by Certbot

    listen 80;
    server_name bilalgnd.shop www.bilalgnd.shop;
    return 404; # managed by Certbot
}
`;

  await ssh.execCommand(`echo '18901745bilalGND!' | sudo -S bash -c "cat > /etc/nginx/sites-available/saracapp << 'EOF'${nginxConfig}EOF"`);
  await ssh.execCommand(`echo '18901745bilalGND!' | sudo -S systemctl restart nginx`);

  console.log('Fixed Nginx WS');
  process.exit(0);
}

fixNginx();

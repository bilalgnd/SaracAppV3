require('dotenv').config();
﻿const { NodeSSH } = require('node-ssh'); const ssh = new NodeSSH(); async function run() { await ssh.connect({host: '92.205.181.67', username: 'bilalgnd', password: process.env.SSH_PASSWORD}); const res = await ssh.execCommand('npx tsc', {cwd: '/home/bilalgnd/saracapp'}); console.log(res.stdout); if (res.stderr) console.error(res.stderr); process.exit(0); } run();

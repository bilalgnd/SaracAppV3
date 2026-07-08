const fs = require('fs');
const filePath = 'c:/Users/bilal/SARACAPP/SARACAPPV3/client/src/renderer/src/components/SettingsModal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/await window\.api\.exportMenu\(token\)/g, 'await (window.api as any).exportMenu(token)');
content = content.replace(/await window\.api\.importMenu\(token, data\)/g, 'await (window.api as any).importMenu(token, data)');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched SettingsModal.tsx (again)');

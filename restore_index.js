const fs = require('fs');
const content = fs.readFileSync('C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\backs\\\\1107_0330\\\\app1_source.md', 'utf8');
const lines = content.split('\\n');
let inTarget = false;
let out = [];
for (let i = 0; i < lines.length; i++) {
  if (!inTarget && (lines[i].includes('## File: app1\\src\\main\\index.ts') || lines[i].includes('## File: app1/src/main/index.ts'))) {
    inTarget = true;
    i++; // skip ```typescript
    continue;
  }
  if (inTarget && lines[i].trim() === '```') {
    break;
  }
  if (inTarget) {
    out.push(lines[i]);
  }
}
fs.writeFileSync('C:\\\\Users\\\\bilal\\\\SARACAPP\\\\SARACAPPV3\\\\app1\\\\src\\\\main\\\\index.ts', out.join('\\n'));
console.log('Restored index.ts with length: ' + out.length);

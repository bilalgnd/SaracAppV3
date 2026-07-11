const fs = require('fs');
const path = require('path');

const projects = ['app1', 'app2', 'qr-app', 'server'];
const outDir = 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3\\backs\\1107_0330';
const rootDir = 'C:\\Users\\bilal\\SARACAPP\\SARACAPPV3';

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function walkSync(dir, filelist = []) {
  if (!fs.existsSync(dir)) return filelist;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      if (['node_modules', 'dist', 'build', 'out', '.git', '.gradle', 'idea', 'app/build'].includes(file)) continue;
      filelist = walkSync(filepath, filelist);
    } else {
      if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.kt') || file.endsWith('.css') || file.endsWith('.json')) {
        filelist.push(filepath);
      }
    }
  }
  return filelist;
}

for (const p of projects) {
  const pPath = path.join(rootDir, p);
  const files = walkSync(pPath);
  let content = `# Project: ${p}\n\n`;
  for (const f of files) {
    // Only include text files
    if (f.includes('package-lock.json') || f.includes('yarn.lock')) continue;
    content += `## File: ${path.relative(rootDir, f)}\n`;
    content += '```' + (f.endsWith('.tsx') || f.endsWith('.ts') ? 'typescript' : f.endsWith('.kt') ? 'kotlin' : f.endsWith('.css') ? 'css' : 'javascript') + '\n';
    try {
        content += fs.readFileSync(f, 'utf8') + '\n';
    } catch(e) {}
    content += '```\n\n';
  }
  fs.writeFileSync(path.join(outDir, `${p}_source.md`), content);
  console.log(`Exported ${p} source to ${p}_source.md`);
}

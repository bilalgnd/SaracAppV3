const fs = require('fs');
const path = require('path');

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const folderName = `${pad(now.getDate())}${pad(now.getMonth() + 1)}_${pad(now.getHours())}${pad(now.getMinutes())}`;
const rootDir = path.resolve(__dirname, '../..');
const targetDir = path.join(rootDir, 'backs', folderName);

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function bundleFiles(baseDir, extensions, outputFile) {
  let content = `# Source Code Backup: ${outputFile}\n# Generated: ${now.toISOString()}\n\n`;
  function traverse(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['node_modules', 'dist', 'out', 'build', '.git', '.kotlin', 'scratch'].includes(entry.name)) continue;
        traverse(fullPath);
      } else {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext) || extensions.includes(entry.name)) {
          const relativePath = path.relative(rootDir, fullPath);
          try {
            const fileText = fs.readFileSync(fullPath, 'utf8');
            const lang = ext.replace('.', '') || 'text';
            content += `## File: \`${relativePath}\`\n\`\`\`${lang}\n${fileText}\n\`\`\`\n\n`;
          } catch (e) {
            // Ignore binary files
          }
        }
      }
    }
  }
  traverse(baseDir);
  const targetPath = path.join(targetDir, outputFile);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log(`Created: ${targetPath} (${Math.round(content.length / 1024)} KB)`);
}

bundleFiles(path.join(rootDir, 'app1', 'src'), ['.ts', '.tsx', '.json', '.css', '.html'], 'app1_source.md');
bundleFiles(path.join(rootDir, 'app2', 'app', 'src', 'main'), ['.kt', '.kts', '.xml'], 'app2_source.md');
bundleFiles(path.join(rootDir, 'server', 'src'), ['.ts', '.js', '.json', '.html', '.css'], 'server_source.md');
bundleFiles(path.join(rootDir, 'qr-app', 'src'), ['.ts', '.tsx', '.json', '.css', '.html'], 'qr_app_source.md');
console.log('Source backup complete in:', targetDir);

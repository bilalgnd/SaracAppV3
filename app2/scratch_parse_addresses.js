const fs = require('fs');
const lines = fs.readFileSync('adresler.txt', 'utf8').split('\n');
const suggestions = new Set();

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;
  const parts = line.split('\t');
  if (parts.length >= 2) {
    if (parts[1] && parts[1].trim()) suggestions.add(parts[1].trim());
  }
  if (parts.length >= 3) {
    let sokak = parts[2].trim();
    if (sokak) {
      if (!sokak.toLowerCase().includes('sok')) {
        if (sokak.match(/^\d+\.?$/)) {
           sokak = sokak + ' SOKAK';
        } else {
           sokak = sokak + ' SOKAK';
        }
      }
      suggestions.add(sokak);
    }
  }
}

fs.writeFileSync('src/renderer/src/utils/addresses.json', JSON.stringify(Array.from(suggestions), null, 2));
console.log('Saved ' + suggestions.size + ' unique addresses.');

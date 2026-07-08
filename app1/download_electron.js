const { downloadArtifact } = require('@electron/get');
const extract = require('extract-zip');
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    console.log("Downloading electron...");
    const zipPath = await downloadArtifact({
      version: '39.8.10',
      artifactName: 'electron',
      platform: process.platform,
      arch: process.arch
    });
    console.log("Downloaded to:", zipPath);
    
    const distPath = path.join(__dirname, 'node_modules', 'electron', 'dist');
    if (!fs.existsSync(distPath)) fs.mkdirSync(distPath, { recursive: true });

    console.log("Extracting...");
    await extract(zipPath, { dir: distPath });
    console.log("Extracted.");

    const platformPath = process.platform === 'win32' ? 'electron.exe' : 'electron';
    fs.writeFileSync(path.join(__dirname, 'node_modules', 'electron', 'path.txt'), platformPath);
    console.log("Wrote path.txt.");
  } catch (err) {
    console.error("FAILED:", err);
  }
}
run();

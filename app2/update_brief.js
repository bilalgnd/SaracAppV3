const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function copyIfExists(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`Copied ${src} to ${dest}`);
    } else {
        console.log(`Not found: ${src}`);
    }
}

// 1. Update App1_UI
copyIfExists('src/renderer/src/App.tsx', 'brief/App1_UI/App.tsx');
copyIfExists('src/renderer/src/components/CartPanel.tsx', 'brief/App1_UI/CartPanel.tsx');
copyIfExists('src/renderer/src/components/MainPanel.tsx', 'brief/App1_UI/MainPanel.tsx');
copyIfExists('src/renderer/src/components/ReportsTab.tsx', 'brief/App1_UI/ReportsTab.tsx');
copyIfExists('src/main/index.ts', 'brief/App1_UI/index.ts');

// 2. Update App1_Server
copyIfExists('src/main/models.ts', 'brief/App1_Server/models.ts');
copyIfExists('src/main/printer.ts', 'brief/App1_Server/printer.ts');
copyIfExists('src/main/server.ts', 'brief/App1_Server/server.ts');
copyIfExists('src/renderer/src/store.ts', 'brief/App1_Server/store.ts');
copyIfExists('src/main/trendyol.ts', 'brief/App1_Server/trendyol.ts');

console.log("Brief files updated successfully.");

// Create ZIP Backup using PowerShell Compress-Archive
try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const zipName = `versions/backup-${timestamp}.zip`;
    // We backup src, package.json
    console.log(`Creating backup zip: ${zipName}...`);
    execSync(`powershell -Command "Compress-Archive -Path src, package.json -DestinationPath ${zipName} -Force"`);
    console.log(`Backup created successfully at ${zipName}`);
} catch (e) {
    console.error("Backup failed:", e);
}

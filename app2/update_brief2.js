const fs = require('fs');

function copyIfExists(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
}

copyIfExists('src/renderer/src/store/index.ts', 'brief/App1_UI/store.ts');
copyIfExists('src/main/store.ts', 'brief/App1_Server/store.ts');

console.log("Remaining files copied.");

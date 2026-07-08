const fs = require('fs');

function copyIfExists(src, dest) {
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
    }
}

copyIfExists('src/renderer/src/utils/addresses.json', 'brief/Eklentiler/addresses.json');
copyIfExists('src/renderer/src/utils/alert.ts', 'brief/Eklentiler/alert.ts');

console.log("Eklentiler kopyalandı.");

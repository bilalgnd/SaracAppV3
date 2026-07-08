const content = `spotify key:
bbfb8b958bde4c07a45c2873ca3c0051
spotify secret:
60e2340ef4ac4006bafe2643fbdb004a

trendyol:
Supplier ID: 6647850
API Key: bYv2F8LWu5QAHfucbind 
API Secret: zCFUGzkEL4kjXkdZ9ZRN`;

const spotifyKeyMatchOld = content.match(/spotify key:\s*\r?\n([a-zA-Z0-9]+)/i);
const spotifyKeyMatchNew = content.match(/spotify key:\s+([a-zA-Z0-9]+)/i);

console.log('OLD Spotify Key:', spotifyKeyMatchOld ? spotifyKeyMatchOld[1] : null);
console.log('NEW Spotify Key:', spotifyKeyMatchNew ? spotifyKeyMatchNew[1] : null);

const trendyolSupplierMatch = content.match(/Supplier ID:\s*([^\r\n]+)/i);
console.log('Trendyol Supplier:', trendyolSupplierMatch ? trendyolSupplierMatch[1] : null);

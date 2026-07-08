const fs = require('fs');
const filePath = 'c:/Users/bilal/SARACAPP/SARACAPPV3/client/src/renderer/src/components/SettingsModal.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Remove tvLink
content = content.replace(/const \[tvLink, setTvLink\] = useState\(''\)/g, '// tvLink unused');
content = content.replace(/window\.api\.getTvLink\(\)\.then\(link => setTvLink\(link\)\)/g, '// window.api.getTvLink()');

// 2. Fix getSpotifyLoginLink
content = content.replace(/const link = await window\.api\.getSpotifyLoginLink\(\);/g, 'const link = await (window.api as any).getSpotifyLoginLink();');

// 3. Remove openWebPanel
content = content.replace(/const openWebPanel = \(\) => window\.open\('http:\/\/127\.0\.0\.1:5000\/', '_blank'\)/g, '// openWebPanel unused');

// 4. Fix globalSettings type errors by casting useStore.getState()
content = content.replace(/useStore\.getState\(\)\.globalSettings\?/g, '(useStore.getState() as any).globalSettings?');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched SettingsModal.tsx');

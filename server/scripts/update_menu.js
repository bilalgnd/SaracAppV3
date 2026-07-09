const fs = require('fs');
const axios = require('axios');
const path = require('path');

const menuPath = 'C:\\Users\\bilal\\AppData\\Roaming\\SaracApp\\custom_menu.json';
const menuData = JSON.parse(fs.readFileSync(menuPath, 'utf8'));

axios.post('https://bilalgnd.shop/menu', menuData, {
    headers: {
        'Authorization': 'Bearer saracoglu_boss_2026_cloud'
    }
}).then(res => {
    console.log('Success:', res.data);
}).catch(err => {
    console.error('Error:', err.response ? err.response.data : err.message);
});

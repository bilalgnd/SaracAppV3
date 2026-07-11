const fs = require('fs');
const pdf = require('pdf-parse');

let dataBuffer = fs.readFileSync('C:\\Users\\bilal\\Desktop\\orders\\TGO Yemek2026-07-1014.16.37.pdf');
pdf(dataBuffer).then(function(data) {
    console.log("PDF TEXT EXTRACTED:");
    console.log(data.text);
}).catch(console.error);

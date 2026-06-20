// Rebuild app.js from app.src.jsx after editing the source.
// Usage:  node build.js
const Babel=require('./babel.min.js');
const fs=require('fs');
const jsx=fs.readFileSync('app.src.jsx','utf8');
const out=Babel.transform(jsx,{presets:[['react',{runtime:'classic'}]]}).code;
fs.writeFileSync('app.js',out);
console.log('Built app.js:',out.length,'bytes');

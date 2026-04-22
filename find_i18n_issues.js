const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const files = walk(srcDir);
const translationKeys = new Set();
const hardcodedSuspicion = [];

const tRegex = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;
const hardcodedRegex = />([^<>{]+)</g;

for (const file of files) {
    if (file.includes('/locales/') || file.includes('test/')) continue;
    const content = fs.readFileSync(file, 'utf-8');
    
    let match;
    while ((match = tRegex.exec(content)) !== null) {
        translationKeys.add(match[1]);
    }
}

console.log("Found keys:", translationKeys.size);
fs.writeFileSync('found_keys.json', JSON.stringify(Array.from(translationKeys), null, 2));

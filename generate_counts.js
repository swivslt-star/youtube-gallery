const fs = require('fs');
const path = require('path');

function getCount(filename, regex) {
    const filePath = path.join(__dirname, filename);
    if (!fs.existsSync(filePath)) return 0;
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(regex);
    if (match) {
        try {
            const arr = JSON.parse(match[1]);
            return arr.length;
        } catch(e) {}
    }
    return 0;
}

function main() {
    console.log('Generating channel counts...');
    
    // Parse channels.js
    const countDefault = getCount('channels.js', /const DEFAULT_CHANNELS = (\[[\s\S]*?\]);/);
    
    // Parse channels1000.js
    const count1000 = getCount('channels1000.js', /const CHANNELS_1000 = (\[[\s\S]*?\]);/);
    
    // Parse channelsAlgorithm.js
    const countAlgorithm = getCount('channelsAlgorithm.js', /const CHANNELS_ALGORITHM = (\[[\s\S]*?\]);/);
    
    const counts = {
        default: countDefault,
        top1000: count1000,
        algorithm: countAlgorithm
    };
    
    const outContent = `const CHANNEL_COUNTS = ${JSON.stringify(counts, null, 4)};\n\nif (typeof module !== 'undefined') {\n    module.exports = { CHANNEL_COUNTS };\n}`;
    fs.writeFileSync(path.join(__dirname, 'counts.js'), outContent);
    
    console.log(`Generated counts.js: 구독(${countDefault}), Top1000(${count1000}), 알고리즘(${countAlgorithm})`);
}

main();

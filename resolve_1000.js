const fs = require('fs');
const path = require('path');

async function extractChannelId(handle) {
    try {
        const url = handle.includes('youtube.com') ? handle : `https://www.youtube.com/@${handle.replace('@', '')}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!res.ok) return null;
        const html = await res.text();
        
        const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
        if (!idMatch) return null;
        const channelId = idMatch[1];

        const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
        const avatar = avatarMatch ? avatarMatch[1].replace(/=s\d+-/, '=s176-') : '';

        // Extract Title from meta tag
        const titleMatch = html.match(/<meta property="og:title" content="(.*?)">/);
        const name = titleMatch ? titleMatch[1] : handle.split('@').pop();

        return { name, id: channelId, avatar };
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('Reading 1000.csv file...');
    const csvContent = fs.readFileSync('1000.csv', 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    
    console.log(`Found ${lines.length} valid lines in 1000.csv. Resolving IDs...`);
    
    const BATCH_SIZE = 50;
    const resolvedChannels = [];
    
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
        const batch = lines.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (line) => {
            const handle = line.trim();
            const result = await extractChannelId(handle);
            return result;
        });
        
        const results = await Promise.all(promises);
        results.forEach(r => {
            if (r) resolvedChannels.push(r);
        });
        
        console.log(`Resolved ${Math.min(i + BATCH_SIZE, lines.length)} / ${lines.length}`);
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`Successfully resolved ${resolvedChannels.length} channels.`);
    
    const fileContent = `const CHANNELS_1000 = ${JSON.stringify(resolvedChannels, null, 4)};\n\nif (typeof module !== 'undefined') {\n    module.exports = { CHANNELS_1000 };\n}`;
    fs.writeFileSync('channels1000.js', fileContent);
    console.log('Saved to channels1000.js!');
}

main();

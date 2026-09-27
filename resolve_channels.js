const fs = require('fs');
const path = require('path');

async function extractChannelId(handle) {
    try {
        const res = await fetch(`https://www.youtube.com/${handle}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
        });
        if (!res.ok) return null;
        const html = await res.text();
        
        // Extract channel ID
        const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
        if (!idMatch) return null;
        const channelId = idMatch[1];

        // Extract avatar
        const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
        const avatar = avatarMatch ? avatarMatch[1].replace(/=s\d+-/, '=s176-') : '';

        return { id: channelId, avatar };
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('Reading CSV file...');
    const csvContent = fs.readFileSync('youtube_top_1000_by_subscribers.csv', 'utf-8');
    const lines = csvContent.split('\n');
    
    // Skip header
    const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
    
    // We will parse the CSV carefully (handling quotes)
    const channels = [];
    
    for (let line of dataLines) {
        // Simple regex to split by comma but ignore commas inside quotes
        const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
        const parts = line.split(regex);
        if (parts.length >= 3) {
            let name = parts[1].replace(/^"|"$/g, '');
            let handle = parts[2].replace(/^"|"$/g, '');
            if (handle.startsWith('@')) {
                channels.push({ name, handle });
            }
        }
    }
    
    console.log(`Found ${channels.length} valid channels in CSV. Resolving IDs... (This may take ~10 minutes)`);
    
    const BATCH_SIZE = 50;
    const resolvedChannels = [];
    
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (ch) => {
            const result = await extractChannelId(ch.handle);
            if (result) {
                return {
                    name: ch.name,
                    id: result.id,
                    avatar: result.avatar
                };
            }
            return null;
        });
        
        const results = await Promise.all(promises);
        results.forEach(r => {
            if (r) resolvedChannels.push(r);
        });
        
        console.log(`Resolved ${Math.min(i + BATCH_SIZE, channels.length)} / ${channels.length}`);
        
        // Small delay to prevent rate limits
        await new Promise(r => setTimeout(r, 1000));
    }
    
    console.log(`Successfully resolved ${resolvedChannels.length} channels.`);
    
    // Save to channels.js
    const fileContent = `const DEFAULT_CHANNELS = ${JSON.stringify(resolvedChannels, null, 4)};\n\nif (typeof module !== 'undefined') {\n    module.exports = { DEFAULT_CHANNELS };\n}`;
    fs.writeFileSync('channels.js', fileContent);
    console.log('Saved to channels.js!');
}

main();

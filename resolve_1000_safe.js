const fs = require('fs');
const path = require('path');

async function extractChannelId(handle) {
    try {
        const url = handle.includes('youtube.com') ? handle : `https://www.youtube.com/@${handle.replace('@', '')}`;
        const res = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (res.status === 429) {
            console.error('Rate limited (429)!');
            return 'RATE_LIMIT';
        }
        if (!res.ok) return null;
        const html = await res.text();
        
        const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/);
        if (!idMatch) return null;
        const channelId = idMatch[1];

        const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
        const avatar = avatarMatch ? avatarMatch[1].replace(/=s\d+-/, '=s176-') : '';

        const titleMatch = html.match(/<meta property="og:title" content="(.*?)">/);
        const name = titleMatch ? titleMatch[1] : handle.split('@').pop();

        return { name, id: channelId, avatar };
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('Loading existing resolved channels...');
    let existingChannels = [];
    if (fs.existsSync('channels1000.js')) {
        const content = fs.readFileSync('channels1000.js', 'utf-8');
        // Hacky way to parse the existing JSON array out of the file
        const match = content.match(/const CHANNELS_1000 = (\[[\s\S]*?\]);/);
        if (match) {
            existingChannels = JSON.parse(match[1]);
        }
    }
    const existingIds = new Set(existingChannels.map(c => c.id));
    
    console.log(`Already resolved: ${existingChannels.length} channels.`);

    const csvContent = fs.readFileSync('1000.csv', 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    
    // Convert lines to handles for comparison (some are URLs, some are just handles)
    const pendingLines = lines; // We'll just try all of them and use a Set to avoid duplicates if possible, or just re-run for missing ones.
    // Actually, to know if we already have it, we compare name/url but it's hard.
    // Let's just fetch sequentially. If we get a valid ID, we check if existingIds has it.

    console.log(`Starting sequential fetch to avoid blocking...`);
    
    let newlyResolved = 0;
    
    for (let i = 0; i < pendingLines.length; i++) {
        const handle = pendingLines[i].trim();
        
        // Skip if already in existing channels by matching name loosely (not perfect, but saves requests)
        // Better: just run it, but maybe wait.
        
        const result = await extractChannelId(handle);
        
        if (result === 'RATE_LIMIT') {
            console.log(`Blocked by YouTube at index ${i}. Pausing for 60 seconds...`);
            await new Promise(r => setTimeout(r, 60000));
            i--; // retry this one
            continue;
        }

        if (result && !existingIds.has(result.id)) {
            existingChannels.push(result);
            existingIds.add(result.id);
            newlyResolved++;
            console.log(`[${i+1}/${pendingLines.length}] Success: ${result.name} (${result.id})`);
            
            // Save incrementally so we don't lose progress
            const fileContent = `const CHANNELS_1000 = ${JSON.stringify(existingChannels, null, 4)};\n\nif (typeof module !== 'undefined') {\n    module.exports = { CHANNELS_1000 };\n}`;
            fs.writeFileSync('channels1000.js', fileContent);
        } else if (result) {
            console.log(`[${i+1}/${pendingLines.length}] Already exists: ${result.name}`);
        } else {
            console.log(`[${i+1}/${pendingLines.length}] Failed to parse: ${handle}`);
        }

        // Wait 1.5 seconds between requests to look like a human
        await new Promise(r => setTimeout(r, 1500));
    }
    
    console.log(`\nFinished! Total channels in list: ${existingChannels.length} (Newly resolved: ${newlyResolved})`);
}

main();

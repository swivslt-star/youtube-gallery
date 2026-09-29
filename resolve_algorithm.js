const fs = require('fs');
const path = require('path');
const os = require('os');

const TARGET_FILE = path.join(__dirname, 'youtube_channels.txt');
const OUTPUT_FILE = path.join(__dirname, 'channelsAlgorithm.js');

async function extractChannelId(handle) {
    try {
        const url = handle.includes('youtube.com') ? handle : `https://www.youtube.com/${handle}`;
        const res = await fetch(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });
        if (res.status === 429) {
            return 'RATE_LIMIT';
        }
        if (!res.ok) return null;
        const html = await res.text();
        
        const idMatch = html.match(/(?:channel_id=|"channelId":"|channel\/|itemprop="identifier" content=")(UC[a-zA-Z0-9_-]{22})/);
        if (!idMatch) return null;
        const channelId = idMatch[1];

        const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
        const avatar = avatarMatch ? avatarMatch[1].replace(/=s\d+-/, '=s176-') : '';

        return { id: channelId, avatar };
    } catch (e) {
        return null;
    }
}

async function main() {
    if (!fs.existsSync(TARGET_FILE)) {
        console.log(`[안내] youtubegallery 폴더 안에 youtube_channels.txt 파일이 없습니다.`);
        console.log(`알고리즘 수집기 북마크를 사용해 먼저 파일을 다운로드해주세요.`);
        return;
    }

    console.log('Loading existing algorithm channels...');
    let existingChannels = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
        const match = content.match(/const CHANNELS_ALGORITHM = (\[[\s\S]*?\]);/);
        if (match) {
            try {
                existingChannels = JSON.parse(match[1]);
            } catch(e) {}
        }
    }
    const existingIds = new Set(existingChannels.map(c => c.id));
    
    console.log(`Already resolved: ${existingChannels.length} channels.`);

    const csvContent = fs.readFileSync(TARGET_FILE, 'utf-8');
    const lines = csvContent.split('\n').filter(l => l.trim().length > 0);
    
    console.log(`Found ${lines.length} channels in downloaded file. Starting sequential fetch...`);
    
    let newlyResolved = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if(!line) continue;
        
        const parts = line.split(',');
        const handle = parts[0];
        const name = parts.slice(1).join(',') || handle;
        
        const result = await extractChannelId(handle);
        
        if (result === 'RATE_LIMIT') {
            console.log(`Blocked by YouTube at index ${i}. Pausing for 60 seconds...`);
            await new Promise(r => setTimeout(r, 60000));
            i--; // retry this one
            continue;
        }

        if (result && !existingIds.has(result.id)) {
            existingChannels.push({ name, id: result.id, avatar: result.avatar });
            existingIds.add(result.id);
            newlyResolved++;
            console.log(`[${i+1}/${lines.length}] Success: ${name} (${result.id})`);
            
            // Save incrementally
            const fileContent = `const CHANNELS_ALGORITHM = ${JSON.stringify(existingChannels, null, 4)};\n\nif (typeof module !== 'undefined') {\n    module.exports = { CHANNELS_ALGORITHM };\n}`;
            fs.writeFileSync(OUTPUT_FILE, fileContent);
        } else if (result) {
            console.log(`[${i+1}/${lines.length}] Already exists: ${name}`);
        } else {
            console.log(`[${i+1}/${lines.length}] Failed to parse: ${handle}`);
        }

        await new Promise(r => setTimeout(r, 1500));
    }
    
    console.log(`\nFinished! Total algorithm channels: ${existingChannels.length} (Newly resolved: ${newlyResolved})`);
    
    // Cleanup downloaded file
    fs.unlinkSync(TARGET_FILE);
    console.log(`[완료] 처리가 완료되어 youtube_channels.txt 파일을 삭제했습니다.`);
}

main();

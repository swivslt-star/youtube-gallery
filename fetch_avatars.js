const fs = require('fs');

async function getAvatar(channelId) {
    try {
        const res = await fetch(`https://www.youtube.com/channel/${channelId}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const text = await res.text();
        const match = text.match(/<meta property="og:image" content="(https:\/\/yt3\.googleusercontent\.com\/[^"]+)"/);
        return match ? match[1] : '';
    } catch(e) {
        return '';
    }
}

async function main() {
    console.log('채널 썸네일(아바타) 추출 시작...');
    let channelsText = fs.readFileSync('channels.js', 'utf8');
    channelsText = channelsText.replace('const DEFAULT_CHANNELS =', 'module.exports =');
    fs.writeFileSync('temp_channels2.js', channelsText);
    const channels = require('./temp_channels2.js');
    fs.unlinkSync('temp_channels2.js');

    const BATCH_SIZE = 15;
    let completed = 0;

    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(async (ch) => {
            if (!ch.avatar) {
                ch.avatar = await getAvatar(ch.id);
            }
        }));
        completed += batch.length;
        process.stdout.write(`\r진행 상황: ${Math.min(completed, channels.length)} / ${channels.length}`);
    }
    
    console.log('\n채널 썸네일 추출 완료. channels.js 저장 중...');
    
    const output = `// 자동 생성된 채널 목록\nconst DEFAULT_CHANNELS = ${JSON.stringify(channels, null, 4)};\n`;
    fs.writeFileSync('channels.js', output);
    console.log('저장 완료!');
}

main();

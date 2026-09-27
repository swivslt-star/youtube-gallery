const fs = require('fs');
const path = require('path');

// 현재 디렉토리 기준으로 처리
const DIR = __dirname;

const { CHANNELS_1000 } = require(path.join(DIR, 'channels1000.js'));
const channels = CHANNELS_1000;

const MAX_VIDEOS_PER_CHANNEL = 1;
const RSS_BASE = 'https://www.youtube.com/feeds/videos.xml?channel_id=';

async function fetchFeed(channel, retries = 2) {
    const url = `${RSS_BASE}${channel.id}`;
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
            }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const xmlText = await response.text();
        return parseRSS(xmlText, channel);
    } catch (e) {
        if (retries > 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchFeed(channel, retries - 1);
        }
        return [];
    }
}

function parseRSS(xmlText, channel) {
    const videos = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    let count = 0;
    
    while ((match = entryRegex.exec(xmlText)) !== null && count < MAX_VIDEOS_PER_CHANNEL) {
        const entryStr = match[1];
        
        const titleMatch = entryStr.match(/<title>(.*?)<\/title>/);
        const videoIdMatch = entryStr.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
        const publishedMatch = entryStr.match(/<published>(.*?)<\/published>/);
        const updatedMatch = entryStr.match(/<updated>(.*?)<\/updated>/);
        const viewsMatch = entryStr.match(/views="(\d+)"/);
        
        if (titleMatch && videoIdMatch) {
            const videoId = videoIdMatch[1];
            const title = titleMatch[1];
            const publishedStr = publishedMatch ? publishedMatch[1] : (updatedMatch ? updatedMatch[1] : '');
            
            videos.push({
                title: title.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'),
                videoId: videoId,
                thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
                published: publishedStr,
                views: viewsMatch ? parseInt(viewsMatch[1], 10) : 0,
                channelName: channel.name,
                channelId: channel.id,
                channelAvatar: channel.avatar || '',
                url: `https://www.youtube.com/watch?v=${videoId}`
            });
            count++;
        }
    }
    return videos;
}

async function main() {
    console.log(`\n============================================`);
    console.log(`유튜브 최신 영상 초고속 동기화 시작... (${channels.length} 채널)`);
    console.log(`============================================\n`);
    
    const allVideos = [];
    let completed = 0;
    
    const BATCH_SIZE = 50;
    for (let i = 0; i < channels.length; i += BATCH_SIZE) {
        const batch = channels.slice(i, i + BATCH_SIZE);
        const promises = batch.map(ch => fetchFeed(ch));
        
        const results = await Promise.all(promises);
        results.forEach(res => {
            if (res.length > 0) {
                allVideos.push(...res);
            }
        });
        
        completed += batch.length;
        process.stdout.write(`\r진행 상황: ${Math.min(completed, channels.length)} / ${channels.length} 채널 완료...`);
    }
    
    console.log(`\n\n데이터 병합 중...`);
    
    const output = `// 이 파일은 동기화 스크립트에 의해 자동 생성되었습니다.
const CACHED_VIDEOS_TIMESTAMP = ${Date.now()};
const CACHED_VIDEOS = ${JSON.stringify(allVideos, null, 4)};
`;
    
    fs.writeFileSync(path.join(DIR, 'cached_videos1000.js'), output);
    console.log(`🎉 동기화 완료! 총 ${allVideos.length}개의 영상을 성공적으로 저장했습니다.`);
    console.log(`이제 갤러리를 새로고침하시면 0.1초 만에 즉시 영상이 뜹니다.\n`);
    
    setTimeout(() => {
        process.exit(0);
    }, 2500);
}

main();

const fs = require('fs');

const urls = fs.readFileSync('urls.txt', 'utf8').split('\n').map(l => l.trim()).filter(l => l);

async function fetchId(url, retryCount = 0) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        const text = await res.text();
        const idMatch = text.match(/"channelId":"(UC[^"]+)"/);
        const titleMatch = text.match(/<title>(.*?) - YouTube<\/title>/) || text.match(/<title>(.*?)<\/title>/);
        
        let title = url.split('@')[1] || url;
        if (titleMatch) title = titleMatch[1].trim();
        
        if (idMatch && idMatch[1]) {
            return { name: title, id: idMatch[1] };
        }
        
        throw new Error('ID not found');
    } catch(e) {
        if (retryCount < 3) {
            await new Promise(r => setTimeout(r, 2000 * (retryCount + 1))); // 백오프 대기
            return fetchId(url, retryCount + 1);
        }
        console.warn('Failed for', url);
        return null;
    }
}

async function main() {
    console.log(`총 ${urls.length}개의 URL 변환을 시작합니다...`);
    const results = [];
    
    for (let i = 0; i < urls.length; i += 5) {
        const batch = urls.slice(i, i + 5);
        const promises = batch.map(fetchId);
        const batchResults = await Promise.all(promises);
        results.push(...batchResults.filter(Boolean));
        console.log(`진행 상황: ${Math.min(i + 5, urls.length)} / ${urls.length} 완료`);
        // 차단 방지를 위해 약간 대기
        await new Promise(r => setTimeout(r, 1000));
    }
    
    const content = `// 자동 생성된 채널 목록\nconst DEFAULT_CHANNELS = ${JSON.stringify(results, null, 4)};\n`;
    fs.writeFileSync('channels.js', content);
    console.log(`\n🎉 변환 완료! 총 ${results.length}개의 채널이 channels.js에 저장되었습니다.`);
}

main();

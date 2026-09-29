const fs = require('fs');
const path = require('path');

const FILE_PATH = path.join(__dirname, 'channelsAlgorithm.js');

if (!fs.existsSync(FILE_PATH)) {
    console.error("channelsAlgorithm.js not found!");
    process.exit(1);
}

const content = fs.readFileSync(FILE_PATH, 'utf-8');
const match = content.match(/const CHANNELS_ALGORITHM = (\[[\s\S]*?\]);/);
if (!match) {
    console.error("Could not parse CHANNELS_ALGORITHM");
    process.exit(1);
}

let channels = JSON.parse(match[1]);

function categorize(name) {
    const n = name.toLowerCase();
    // 뉴스/이슈
    if (n.includes('뉴스') || n.includes('news') || n.includes('mbc') || n.includes('kbs') || n.includes('sbs') || n.includes('ytn') || n.includes('일보') || n.includes('기자') || n.includes('신문') || n.includes('방송') || n.includes('연합') || n.includes('이슈')) return '뉴스/이슈';
    // IT/테크/과학
    if (n.includes('테크') || n.includes('tech') || n.includes('과학') || n.includes('science') || n.includes('it') || n.includes('코딩') || n.includes('coding') || n.includes('개발') || n.includes('컴퓨터') || n.includes('리뷰') || n.includes('긱블') || n.includes('프로그래밍')) return 'IT/과학';
    // 게임/3D/디자인
    if (n.includes('게임') || n.includes('game') || n.includes('3d') || n.includes('blender') || n.includes('fusion') || n.includes('디자인') || n.includes('design') || n.includes('에펙') || n.includes('마인크래프트') || n.includes('play')) return '게임/디자인';
    // 요리/먹방
    if (n.includes('요리') || n.includes('먹방') || n.includes('cook') || n.includes('food') || n.includes('쯔양') || n.includes('백종원') || n.includes('레시피') || n.includes('맛집')) return '요리/먹방';
    // 경제/부동산
    if (n.includes('경제') || n.includes('부동산') || n.includes('주식') || n.includes('투자') || n.includes('돈') || n.includes('재테크') || n.includes('삼프로') || n.includes('슈카') || n.includes('아파트')) return '경제/부동산';
    // 지식/교양
    if (n.includes('지식') || n.includes('교양') || n.includes('ebs') || n.includes('역사') || n.includes('다큐') || n.includes('도서') || n.includes('책') || n.includes('심리') || n.includes('대학')) return '지식/교양';
    // 영화/드라마/애니
    if (n.includes('영화') || n.includes('무비') || n.includes('movie') || n.includes('드라마') || n.includes('애니') || n.includes('리뷰')) return '영화/애니';
    // 스포츠/자동차
    if (n.includes('스포츠') || n.includes('sports') || n.includes('축구') || n.includes('야구') || n.includes('자동차') || n.includes('car') || n.includes('모터')) return '스포츠/자동차';
    // 예능/코미디
    if (n.includes('예능') || n.includes('코미디') || n.includes('개그') || n.includes('썰') || n.includes('피식') || n.includes('스튜디오')) return '예능/코미디';
    // 여행/일상
    if (n.includes('여행') || n.includes('travel') || n.includes('vlog') || n.includes('브이로그') || n.includes('일상')) return '여행/일상';

    return '엔터/기타';
}

channels = channels.map(c => {
    return {
        ...c,
        category: categorize(c.name)
    };
});

const newContent = `const CHANNELS_ALGORITHM = ${JSON.stringify(channels, null, 4)};\n\nif (typeof module !== 'undefined') {\n    module.exports = { CHANNELS_ALGORITHM };\n}`;

fs.writeFileSync(FILE_PATH, newContent);
console.log("Successfully categorized " + channels.length + " channels!");

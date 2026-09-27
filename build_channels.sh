#!/bin/bash
echo "총 $(wc -l < urls.txt | tr -d ' ')개의 URL에서 채널 정보를 추출합니다 (병렬 처리)..."
cat urls.txt | xargs -P 15 -I {} yt-dlp --print "%(uploader)s||%(channel_id)s" --no-warnings --playlist-items 1 "{}" > raw_channels.txt 2>/dev/null

echo "추출 완료. channels.js 파일 생성 중..."
echo "// 자동 생성된 채널 목록" > channels.js
echo "const DEFAULT_CHANNELS = [" >> channels.js

cat raw_channels.txt | awk -F'||' 'NF==2 {
    gsub(/"/, "\\\"", $1);
    print "    { name: \"" $1 "\", id: \"" $2 "\" },"
}' >> channels.js

echo "];" >> channels.js
echo "모든 작업이 완료되었습니다!"

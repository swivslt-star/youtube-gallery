const http = require('http');
const fs = require('fs');
const path = require('path');
const { get } = require('https');

const PORT = 8080;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // API Route for proxying YouTube RSS
    if (req.url.startsWith('/api/feed?id=')) {
        const id = new URL(req.url, `http://${req.headers.host}`).searchParams.get('id');
        const ytUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
        
        get(ytUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0'
            }
        }, (ytRes) => {
            res.writeHead(ytRes.statusCode, {
                'Content-Type': 'application/xml',
                'Access-Control-Allow-Origin': '*'
            });
            ytRes.pipe(res);
        }).on('error', (err) => {
            res.writeHead(500);
            res.end('Error fetching feed');
        });
        return;
    }

    // Static file serving
    let filePath = '.' + req.url;
    if (filePath === './') filePath = './index.html';
    // Remove query params
    filePath = filePath.split('?')[0];
    
    const extname = path.extname(filePath);
    const contentType = MIME_TYPES[extname] || 'text/plain';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            res.writeHead(404);
            res.end('File not found');
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`로컬 고속 프록시 서버 실행 중: http://localhost:${PORT}/`);
});

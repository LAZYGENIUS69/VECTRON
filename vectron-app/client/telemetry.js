const fs = require('fs');
const http = require('http');

console.log("Telemetry server running on 9999...");
http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
        const logData = "\n--- FRONTEND LOG ---\n" + body + "\n--------------------\n";
        fs.appendFileSync('crash.log', logData);
        res.writeHead(200, {
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        });
        res.end('OK');
    });
}).listen(9999);

const http = require('http');

const PORT = 54000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Hello from the Monzo API server on Raspberry Pi!');
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});

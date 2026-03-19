const http = require('http');
const { exec } = require('child_process');
const url = require('url');

const PORT = 8888;
const HOST = '127.0.0.1';

// Antigravity Command (Ensure it's in PATH)
const ANTIGRAVITY_CMD = 'antigravity';

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);

    // Check method and path
    if (req.method === 'POST' && parsedUrl.pathname.startsWith('/webhook/')) {
        const workflowName = parsedUrl.pathname.replace('/webhook/', '');

        console.log(`📥 Received trigger for workflow: ${workflowName}`);

        // Construct command string
        // Using exec() allows proper shell interpretation of the command.
        // We target the current window/session with 'chat'.
        const command = `antigravity chat "Run workflow .agent/workflows/${workflowName}.md"`;

        console.log(`🚀 Executing: ${command}`);

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Process error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.log(`⚠️ Process stderr: ${stderr}`);
            }
            if (stdout) {
                console.log(`📝 Process output: ${stdout}`);
            }
            console.log(`✅ Trigger command executed.`);
        });

        // Respond immediately (Fire and forget)
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            message: `Workflow '${workflowName}' triggered`
        }));
    } else {
        // 404 for other paths
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found. Use POST /webhook/{workflow_name}');
    }
});

server.listen(PORT, HOST, () => {
    console.log(`🚀 Antigravity Node.js Listener running at http://${HOST}:${PORT}/`);
    console.log(`🌊 Ready for Cloudflare Tunnel connection.`);
});

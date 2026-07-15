import fs from "fs";
import path from "path";
import http from "http";

const dirPath = path.resolve(__dirname, "../scratch/extracted_texts");
if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
}

async function startServer() {
    const server = http.createServer(async (req, res) => {
        // Enable CORS and Private Network Access
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Private-Network");
        res.setHeader("Access-Control-Allow-Private-Network", "true");

        if (req.method === "OPTIONS") {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === "POST" && req.url === "/evaluate") {
            let body = "";
            req.on("data", chunk => {
                body += chunk.toString();
            });

            req.on("end", async () => {
                try {
                    const data = JSON.parse(body);
                    const { entregaId, text } = data;

                    if (!entregaId) {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "entregaId is required" }));
                        return;
                    }

                    console.log(`[Server] Received text for delivery ${entregaId}. Length: ${text?.length || 0} chars.`);

                    // Save the text locally!
                    const filePath = path.join(dirPath, `${entregaId}.json`);
                    fs.writeFileSync(filePath, JSON.stringify({ entregaId, text, savedAt: new Date().toISOString() }, null, 2));

                    console.log(`[Server] Saved text to ${filePath}`);

                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ success: true }));
                } catch (err: any) {
                    console.error("[Server] Error saving text:", err);
                    res.writeHead(500, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: err.message || "Internal server error" }));
                }
            });
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    const PORT = 3001;
    server.listen(PORT, () => {
        console.log(`Local saver server listening on http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);

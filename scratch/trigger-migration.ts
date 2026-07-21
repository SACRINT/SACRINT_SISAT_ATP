import "dotenv/config";

async function poll() {
    console.log("Polling migration endpoint...");
    for (let i = 0; i < 20; i++) {
        try {
            const cb = Date.now();
            const res = await fetch(`https://sacrint-sisat-atp.vercel.app/api/restore-cloudinary?cb=${cb}`);
            const data = await res.json();
            
            const logStr = JSON.stringify(data.log);
            if (logStr.includes("public_ids")) {
                console.log("New version deployed successfully!");
                console.log(JSON.stringify(data, null, 2));
                return;
            } else {
                console.log(`[Attempt ${i+1}] Still running old version...`);
            }
        } catch (e) {
            console.error("Error polling:", e);
        }
        await new Promise(r => setTimeout(r, 15000));
    }
    console.log("Polling timed out.");
}

poll();

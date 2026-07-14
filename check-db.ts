import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local" });
const url = process.env.DATABASE_URL || "";
console.log("Database Host:", url.split("@")[1]?.split("/")[0] || "Unknown");
console.log("Entire URL format (masked):", url.replace(/:[^:@]+@/, ":****@"));

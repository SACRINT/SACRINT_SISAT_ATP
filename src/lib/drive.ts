import { google } from "googleapis";
import { PassThrough } from "stream";

// ─── Google Drive client ────────────────────────────────────────────────────

/**
 * Parses the private key from env var, handling all possible formats:
 * - Escaped newlines: \\n → \n
 * - Literal newlines (already correct)
 * - Windows line endings: \r\n → \n
 * - Extra surrounding quotes added accidentally
 */
function parsePrivateKey(raw: string): string {
    return raw
        .replace(/^["']|["']$/g, "")   // remove accidental surrounding quotes
        .replace(/\\n/g, "\n")          // escaped \n → real newline
        .replace(/\r\n/g, "\n")         // Windows CRLF → LF
        .trim();
}

function getDriveClient() {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";

    if (!clientEmail || !rawKey) {
        throw new Error(
            "Google Drive credentials not configured. Set GOOGLE_CLIENT_EMAIL and GOOGLE_PRIVATE_KEY in Vercel env vars."
        );
    }

    const privateKey = parsePrivateKey(rawKey);

    if (!privateKey.includes("BEGIN PRIVATE KEY")) {
        throw new Error(
            `GOOGLE_PRIVATE_KEY format invalid. Key starts with: "${privateKey.slice(0, 40)}...". ` +
            "Make sure to paste the full key including -----BEGIN PRIVATE KEY----- and -----END PRIVATE KEY-----."
        );
    }

    const auth = new google.auth.GoogleAuth({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        },
        scopes: ["https://www.googleapis.com/auth/drive"],
    });

    return google.drive({ version: "v3", auth });
}

// ─── Folder helpers ─────────────────────────────────────────────────────────

/**
 * Finds an existing folder by name inside a parent, or creates it.
 * Returns the folder ID.
 */
export async function getOrCreateFolder(
    parentId: string,
    name: string
): Promise<string> {
    const drive = getDriveClient();

    // Escape single quotes in folder names for Drive query
    const safeName = name.replace(/'/g, "\\'");

    const res = await drive.files.list({
        q: `'${parentId}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
        spaces: "drive",
    });

    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id!;
    }

    const folder = await drive.files.create({
        requestBody: {
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId],
        },
        fields: "id",
    });

    return folder.data.id!;
}

// ─── File upload ────────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to Google Drive.
 * Uses PassThrough stream for better serverless compatibility.
 * Returns { driveId, driveUrl }
 */
export async function uploadFileToDrive(
    parentFolderId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string
): Promise<{ driveId: string; driveUrl: string }> {
    const drive = getDriveClient();

    // Use PassThrough which is more reliable than Readable.from() in serverless
    const stream = new PassThrough();
    stream.end(buffer);

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [parentFolderId],
        },
        media: {
            mimeType,
            body: stream,
        },
        fields: "id, webViewLink",
    });

    if (!res.data.id) {
        throw new Error("Drive upload failed: no file ID returned");
    }

    const driveId = res.data.id;
    const driveUrl = res.data.webViewLink || `https://drive.google.com/file/d/${driveId}/view`;

    // Make file accessible to anyone with the link
    await drive.permissions.create({
        fileId: driveId,
        requestBody: {
            role: "reader",
            type: "anyone",
        },
    });

    return { driveId, driveUrl };
}

// ─── File deletion ─────────────────────────────────────────────────────────

/**
 * Deletes a file from Drive. Silently ignores if not found.
 */
export async function deleteFileFromDrive(driveId: string): Promise<void> {
    const drive = getDriveClient();
    try {
        await drive.files.delete({ fileId: driveId });
    } catch (err: any) {
        // 404 = already deleted, ignore
        if (err?.code === 404 || err?.status === 404) return;
        throw err;
    }
}

// ─── Folder structure ──────────────────────────────────────────────────────

/**
 * Gets (or creates) the Drive folder for a given escuela + programa.
 *
 * Structure: ROOT / "{CCT} - {Nombre}" / "{Programa}"
 */
export async function getEscuelaProgramaFolder(
    cct: string,
    escuelaNombre: string,
    programaNombre: string
): Promise<string> {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

    if (!rootFolderId) {
        throw new Error(
            "GOOGLE_DRIVE_FOLDER_ID environment variable is not set."
        );
    }

    const escuelaFolderName = `${cct} - ${escuelaNombre}`;
    const escuelaFolderId = await getOrCreateFolder(rootFolderId, escuelaFolderName);
    const programaFolderId = await getOrCreateFolder(escuelaFolderId, programaNombre);

    return programaFolderId;
}

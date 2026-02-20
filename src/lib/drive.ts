import { google } from "googleapis";
import { Readable } from "stream";

// ─── Google Drive client ────────────────────────────────────────────────────

function getDriveClient() {
    const auth = new google.auth.JWT({
        email: process.env.GOOGLE_CLIENT_EMAIL,
        key: (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
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

    // Search for existing folder with this name inside parent
    const res = await drive.files.list({
        q: `'${parentId}' in parents and name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: "files(id, name)",
        spaces: "drive",
    });

    if (res.data.files && res.data.files.length > 0) {
        return res.data.files[0].id!;
    }

    // Create folder
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

// ─── File operations ────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to Google Drive.
 * Returns { driveId, driveUrl }
 */
export async function uploadFileToDrive(
    parentFolderId: string,
    fileName: string,
    buffer: Buffer,
    mimeType: string
): Promise<{ driveId: string; driveUrl: string }> {
    const drive = getDriveClient();

    const readable = Readable.from(buffer);

    const res = await drive.files.create({
        requestBody: {
            name: fileName,
            parents: [parentFolderId],
        },
        media: {
            mimeType,
            body: readable,
        },
        fields: "id, webViewLink",
    });

    const driveId = res.data.id!;
    const driveUrl = res.data.webViewLink!;

    // Make file accessible via link (anyone with link can view)
    await drive.permissions.create({
        fileId: driveId,
        requestBody: {
            role: "reader",
            type: "anyone",
        },
    });

    return { driveId, driveUrl };
}

/**
 * Deletes a file from Google Drive by its ID.
 * Silently ignores "not found" errors (file may have been deleted manually).
 */
export async function deleteFileFromDrive(driveId: string): Promise<void> {
    const drive = getDriveClient();
    try {
        await drive.files.delete({ fileId: driveId });
    } catch (err: any) {
        if (err?.code === 404) return; // Already deleted, no problem
        throw err;
    }
}

/**
 * Gets the folder structure for an escuela/programa combination.
 * Creates folders if they don't exist.
 * Returns the program folder ID where files should be uploaded.
 *
 * Structure: ROOT / "{CCT} - {EscuelaNombre}" / "{ProgramaNombre}"
 */
export async function getEscuelaProgramaFolder(
    cct: string,
    escuelaNombre: string,
    programaNombre: string
): Promise<string> {
    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

    // Layer 1: CCT - Nombre folder
    const escuelaFolderName = `${cct} - ${escuelaNombre}`;
    const escuelaFolderId = await getOrCreateFolder(rootFolderId, escuelaFolderName);

    // Layer 2: Programa folder
    const programaFolderId = await getOrCreateFolder(escuelaFolderId, programaNombre);

    return programaFolderId;
}

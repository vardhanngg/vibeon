// ui.js (Next.js API route example)
import { google } from "googleapis";
import { Readable } from "stream";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Authenticate using OAuth tokens (access + refresh)
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set previously obtained tokens
    oauth2Client.setCredentials({
      access_token: process.env.GOOGLE_ACCESS_TOKEN,
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
      scope: "https://www.googleapis.com/auth/drive.file",
      token_type: "Bearer",
      expiry_date: true, // optional
    });

    const drive = google.drive({ version: "v3", auth: oauth2Client });

    // Convert base64 to buffer
    const buffer = Buffer.from(imageBase64, "base64");
    const stream = Readable.from(buffer);

    const fileMetadata = {
      name: `vibron${Date.now()}.jpg`,
      parents: ["1GQLAi4SMzDQiE6xjZ6bqrSiC2nNTOJCj"], // your Drive folder ID
    };

    const media = {
      mimeType: "image/jpeg",
      body: stream,
    };

    // Upload the file
    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id, webViewLink, webContentLink",
    });

    // Optional: make the file publicly readable
    await drive.permissions.create({
      fileId: file.data.id,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    res.status(200).json({
      success: true,
      fileId: file.data.id,
      webViewLink: file.data.webViewLink,
      webContentLink: file.data.webContentLink,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
}

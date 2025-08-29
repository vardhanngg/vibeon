import { google } from "googleapis";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST allowed" });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: process.env.GCP_PROJECT_ID,
        private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
        client_email: process.env.GCP_CLIENT_EMAIL
      },
      scopes: ["https://www.googleapis.com/auth/drive.file"]
    });

    const drive = google.drive({ version: "v3", auth });

    // Convert base64 to buffer
    const buffer = Buffer.from(imageBase64, "base64");

    // Upload to Google Drive
    const fileMetadata = {
      name: `mood_snap_${Date.now()}.jpg`,
      parents: [process.env.GCP_FOLDER_ID]
    };

    const media = {
      mimeType: "image/jpeg",
      body: Buffer.from(buffer)
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media: { mimeType: "image/jpeg", body: buffer },
      fields: "id"
    });

    res.status(200).json({ success: true, fileId: file.data.id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to upload" });
  }
}

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

    // Parse service account credentials from env var
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    const buffer = Buffer.from(imageBase64, "base64");

    const fileMetadata = {
      name: `uploaded_image_${Date.now()}.jpg`,
      parents: [process.env.GCP_FOLDER_ID], // Set your Drive folder ID here
    };

    const media = {
      mimeType: "image/jpeg",
      body: buffer,
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id",
    });

    res.status(200).json({ success: true, fileId: file.data.id });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to upload" });
  }
}

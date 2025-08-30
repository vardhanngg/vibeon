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

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });

    const drive = google.drive({ version: "v3", auth });

    const buffer = Buffer.from(imageBase64, "base64");

    // ✅ Use Readable.from to make a proper readable stream
    const stream = Readable.from(buffer);

    const fileMetadata = {
      name: `uploaded_image_${Date.now()}.jpg`,
      parents: ["1GQLAi4SMzDQiE6xjZ6bqrSiC2nNTOJCj"],
    };

    const media = {
      mimeType: "image/jpeg",
      body: stream,
    };

    const file = await drive.files.create({
      resource: fileMetadata,
      media,
      fields: "id",
    });

    res.status(200).json({ success: true, fileId: file.data.id });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: error.message });
  }
}

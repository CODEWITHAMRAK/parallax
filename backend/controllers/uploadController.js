import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadDocument = async (req, res) => {
  try {
    const { fileDataUrl } = req.body;
    
    if (!fileDataUrl) {
      return res.status(400).json({ message: "No file data provided." });
    }

    const uploadResponse = await cloudinary.uploader.upload(fileDataUrl, {
      folder: "parallax",
      resource_type: "auto", // handles images/pdfs
    });

    res.status(200).json({ url: uploadResponse.secure_url });
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    res.status(500).json({ message: "Failed to upload document", error: error.message });
  }
};

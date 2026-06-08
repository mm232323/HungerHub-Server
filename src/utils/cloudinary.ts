import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from environment variables (Vercel injects these at runtime)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || '',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
});

/**
 * Upload a Base64/Data‑URI image to Cloudinary.
 *
 * @param dataUri - The image as a data‑uri string (e.g. "data:image/png;base64,...")
 * @param folder  - Optional folder in your Cloudinary account to store the image.
 * @returns The secure URL of the uploaded image.
 */
export async function uploadToCloudinary(
  dataUri: string,
  folder?: string
): Promise<{ secure_url: string }> {
  const options = folder ? { folder } : undefined;
  const result = await cloudinary.uploader.upload(dataUri, options);
  return { secure_url: result.secure_url };
}

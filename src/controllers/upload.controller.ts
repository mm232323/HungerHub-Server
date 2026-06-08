import type { Request, Response } from 'express';
import { uploadToCloudinary } from '../utils/cloudinary.js';

/**
 * POST /api/v1/upload
 * Body: { dataUri: string, folder?: string }
 * Returns: { url: string }
 */
export async function uploadImage(req: Request, res: Response) {
  try {
    const { dataUri, folder } = req.body as { dataUri: string; folder?: string };
    if (!dataUri) {
      return res.status(400).json({ error: 'Missing dataUri' });
    }
    const { secure_url } = await uploadToCloudinary(dataUri, folder);
    return res.json({ url: secure_url });
  } catch (err: any) {
    console.error('Cloudinary upload error', err);
    return res.status(500).json({ error: err.message ?? 'Upload failed' });
  }
}

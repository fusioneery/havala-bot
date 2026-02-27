import { mkdirSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config';

/** Directory where avatar images are stored on disk */
const AVATARS_DIR = path.resolve(path.dirname(config.dbFileName), 'avatars');

// Ensure directory exists at startup
mkdirSync(AVATARS_DIR, { recursive: true });

export function getAvatarsDir(): string {
  return AVATARS_DIR;
}

/**
 * Download a user's Telegram profile photo and save it to disk.
 * Returns the public URL path (e.g. `/static/avatars/123456.jpg`) or null on failure.
 */
export async function downloadAndSaveAvatar(telegramUserId: number): Promise<string | null> {
  try {
    // 1. Get profile photo file_id from Telegram
    const photosRes = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getUserProfilePhotos?user_id=${telegramUserId}&limit=1`,
    );
    const photosData = (await photosRes.json()) as {
      ok: boolean;
      result?: { photos?: Array<Array<{ file_id: string; width: number }>> };
    };
    if (!photosData.ok || !photosData.result?.photos?.length) return null;

    const sizes = photosData.result.photos[0];
    if (!sizes?.length) return null;

    // Pick smallest size >= 160px, or largest available
    const target = sizes.find((s) => s.width >= 160) ?? sizes[sizes.length - 1];

    // 2. Get file path from Telegram
    const fileRes = await fetch(
      `https://api.telegram.org/bot${config.botToken}/getFile?file_id=${encodeURIComponent(target.file_id)}`,
    );
    const fileData = (await fileRes.json()) as {
      ok: boolean;
      result?: { file_path: string };
    };
    if (!fileData.ok || !fileData.result?.file_path) return null;

    // 3. Download the image bytes
    const imageRes = await fetch(
      `https://api.telegram.org/file/bot${config.botToken}/${fileData.result.file_path}`,
    );
    if (!imageRes.ok) return null;

    const buffer = Buffer.from(await imageRes.arrayBuffer());

    // 4. Determine extension from file_path (Telegram usually returns .jpg)
    const ext = path.extname(fileData.result.file_path) || '.jpg';
    const filename = `${telegramUserId}${ext}`;
    const filePath = path.join(AVATARS_DIR, filename);

    await writeFile(filePath, buffer);

    return `/static/avatars/${filename}`;
  } catch {
    return null;
  }
}

/**
 * Get the static URL for a user's avatar if it exists on disk.
 */
export function getLocalAvatarUrl(telegramUserId: number): string | null {
  for (const ext of ['.jpg', '.jpeg', '.png']) {
    const filePath = path.join(AVATARS_DIR, `${telegramUserId}${ext}`);
    if (existsSync(filePath)) {
      return `/static/avatars/${telegramUserId}${ext}`;
    }
  }
  return null;
}

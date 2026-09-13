import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

export type NormalizedImage = { uri: string; width: number; height: number; mimeType: string };

/**
 * Resize (preserving aspect ratio) + compress an image to a normalized JPEG.
 * Produces a stable local file/data URI with a known mime type so uploads are reliable
 * across web and native. Only downsizes — never upscales beyond the source width.
 */
export async function normalizeImage(
  uri: string,
  opts: { maxSize?: number; compress?: number; sourceWidth?: number } = {},
): Promise<NormalizedImage> {
  const { maxSize = 1024, compress = 0.8, sourceWidth } = opts;
  const ctx = ImageManipulator.manipulate(uri);
  const targetWidth = sourceWidth ? Math.min(maxSize, sourceWidth) : maxSize;
  ctx.resize({ width: targetWidth });
  const rendered = await ctx.renderAsync();
  const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
  return { uri: out.uri, width: out.width, height: out.height, mimeType: "image/jpeg" };
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

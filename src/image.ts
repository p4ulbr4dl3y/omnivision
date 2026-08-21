import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ProcessedImage } from './types.js';

// Magic-bytes sniffing instead of file extension to verify valid image payloads.
function sniffImageMime(buf: Uint8Array): string | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)
    return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 6 &&
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  )
    return 'image/gif';
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return 'image/webp';
  if (buf.length >= 2 && buf[0] === 0x42 && buf[1] === 0x4d) return 'image/bmp';
  if (
    buf.length >= 4 &&
    ((buf[0] === 0x49 && buf[1] === 0x49 && buf[2] === 0x2a && buf[3] === 0x00) ||
      (buf[0] === 0x4d && buf[1] === 0x4d && buf[2] === 0x00 && buf[3] === 0x2a))
  )
    return 'image/tiff';
  return null;
}

export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max per image

export function resolveHomePath(filePath: string): string {
  if (filePath === '~') {
    return os.homedir();
  }
  if (filePath.startsWith('~/') || filePath.startsWith('~\\')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function isDataUrl(str: string): boolean {
  return str.startsWith('data:image/');
}

export function isHttpUrl(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

export function parseDataUrl(dataUrl: string): ProcessedImage {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1 || !dataUrl.startsWith('data:')) {
    throw new Error('Invalid data URI format for image. Expected data:image/<type>;base64,<data>');
  }

  const meta = dataUrl.slice(5, commaIndex);
  const parts = meta.split(';');
  const mimeType = parts[0]?.trim();
  const isBase64 = parts.some((p) => p.trim() === 'base64');

  if (!mimeType || !isBase64) {
    throw new Error('Invalid data URI format for image. Expected data:image/<type>;base64,<data>');
  }

  if (!mimeType.startsWith('image/')) {
    throw new Error(`Invalid MIME type: ${mimeType}. Only image/* formats are supported.`);
  }

  const base64Data = dataUrl.slice(commaIndex + 1);
  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0) {
    throw new Error('Base64 image payload is empty.');
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Base64 image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`);
  }

  const detectedMime = sniffImageMime(new Uint8Array(buffer));
  if (!detectedMime) {
    throw new Error('Decoded base64 data is not a recognized image format.');
  }

  return {
    image: new Uint8Array(buffer),
    mimeType: detectedMime,
    sourceType: 'base64',
  };
}

function isPrivateOrLoopbackHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '169.254.169.254'
  ) {
    return true;
  }
  const parts = lower.split('.').map((p) => parseInt(p, 10));
  if (parts.length === 4 && parts.every((p) => !Number.isNaN(p))) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

export async function fetchRemoteImage(urlStr: string): Promise<ProcessedImage> {
  const parsed = new URL(urlStr);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported protocol: ${parsed.protocol}`);
  }
  if (isPrivateOrLoopbackHost(parsed.hostname)) {
    throw new Error(`Access to private or loopback host is forbidden: ${parsed.hostname}`);
  }

  try {
    const response = await fetch(urlStr, {
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch image from URL: ${urlStr} (HTTP ${response.status} ${response.statusText})`,
      );
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const parsedLength = parseInt(contentLength, 10);
      if (!Number.isNaN(parsedLength) && parsedLength > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(
          `Remote image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`,
        );
      }
    }

    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            totalLength += value.byteLength;
            if (totalLength > MAX_IMAGE_SIZE_BYTES) {
              await reader.cancel();
              throw new Error(
                `Remote image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`,
              );
            }
            chunks.push(value);
          }
        }
      } finally {
        reader.releaseLock();
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
        throw new Error(
          `Remote image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`,
        );
      }
      chunks.push(new Uint8Array(arrayBuffer));
      totalLength = arrayBuffer.byteLength;
    }

    if (totalLength === 0) {
      throw new Error(`Remote image at ${urlStr} is empty (0 bytes).`);
    }

    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const mimeType = sniffImageMime(combined);
    if (!mimeType) {
      throw new Error(`Remote URL did not return a recognized image format: ${urlStr}`);
    }

    return {
      image: combined,
      mimeType,
      sourceType: 'url',
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Network timeout (15s) while fetching image from: ${urlStr}`);
    }
    throw error;
  }
}

export function isAllowedLocalPath(resolvedPath: string): boolean {
  const allowed = process.env.ALLOWED_IMAGE_DIRS;
  if (!allowed) return true;
  const dirs = allowed
    .split(path.delimiter)
    .map((d) => path.resolve(resolveHomePath(d.trim())))
    .filter(Boolean);
  if (dirs.length === 0) return true;
  return dirs.some((dir) => resolvedPath === dir || resolvedPath.startsWith(dir + path.sep));
}

export async function loadLocalImage(filePath: string): Promise<ProcessedImage> {
  const resolved = path.resolve(resolveHomePath(filePath));

  if (!isAllowedLocalPath(resolved)) {
    throw new Error(`Access to file path is outside allowed image directories: ${resolved}`);
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(resolved);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Image file not found at path: ${resolved}`);
    }
    throw err;
  }

  if (!stat.isFile()) {
    throw new Error(`Path is not a regular file (is directory or socket): ${resolved}`);
  }

  if (stat.size === 0) {
    throw new Error(`Image file is empty (0 bytes): ${resolved}`);
  }

  if (stat.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(
      `File size (${(stat.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`,
    );
  }

  const buffer = await fs.promises.readFile(resolved);

  const detectedMime = sniffImageMime(new Uint8Array(buffer));
  if (!detectedMime) {
    throw new Error(`File is not a recognized image format: ${resolved}`);
  }

  return {
    image: new Uint8Array(buffer),
    mimeType: detectedMime,
    sourceType: 'local',
  };
}

export async function loadImage(input: string): Promise<ProcessedImage> {
  if (!input || typeof input !== 'string') {
    throw new Error('Image input must be a non-empty string (path, URL, or data URI)');
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('Image input cannot be empty or whitespace.');
  }

  if (isDataUrl(trimmed)) {
    return parseDataUrl(trimmed);
  }

  if (isHttpUrl(trimmed)) {
    return await fetchRemoteImage(trimmed);
  }

  return await loadLocalImage(trimmed);
}

export async function loadImages(inputs: string[]): Promise<ProcessedImage[]> {
  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error('Images must be a non-empty array of image sources');
  }

  if (inputs.length > 10) {
    throw new Error('Maximum of 10 images allowed per request.');
  }

  return await Promise.all(inputs.map((img) => loadImage(img)));
}

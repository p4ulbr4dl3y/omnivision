import fs from 'fs';
import path from 'path';
import os from 'os';
import mime from 'mime-types';
import type { ProcessedImage } from './types.js';

export const MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB max per image

export function resolveHomePath(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return path.join(os.homedir(), filePath.slice(1));
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
  const matches = dataUrl.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches) {
    throw new Error('Invalid data URI format for image. Expected data:image/<type>;base64,<data>');
  }

  const mimeType = matches[1];
  const base64Data = matches[2];
  
  if (!mimeType.startsWith('image/')) {
    throw new Error(`Invalid MIME type: ${mimeType}. Only image/* formats are supported.`);
  }

  const buffer = Buffer.from(base64Data, 'base64');
  if (buffer.length === 0) {
    throw new Error('Base64 image payload is empty.');
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`Base64 image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`);
  }

  return {
    image: new Uint8Array(buffer),
    mimeType,
    sourceType: 'base64',
  };
}

export async function fetchRemoteImage(urlStr: string): Promise<ProcessedImage> {
  try {
    const response = await fetch(urlStr, {
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch image from URL: ${urlStr} (HTTP ${response.status} ${response.statusText})`);
    }

    const contentType = response.headers.get('content-type') || '';
    const cleanMime = contentType.split(';')[0].trim();

    if (!cleanMime || !cleanMime.startsWith('image/')) {
      throw new Error(`Remote URL did not return an image content-type (received: '${contentType || 'empty'}')`);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Remote image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
      throw new Error(`Remote image at ${urlStr} is empty (0 bytes).`);
    }

    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      throw new Error(`Remote image exceeds ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB size limit.`);
    }

    return {
      image: new Uint8Array(arrayBuffer),
      mimeType: cleanMime,
      sourceType: 'url',
    };
  } catch (error: any) {
    if (error.name === 'TimeoutError') {
      throw new Error(`Network timeout (15s) while fetching image from: ${urlStr}`);
    }
    throw error;
  }
}

export async function loadLocalImage(filePath: string): Promise<ProcessedImage> {
  const resolved = path.resolve(resolveHomePath(filePath));

  if (!fs.existsSync(resolved)) {
    throw new Error(`Image file not found at path: ${resolved}`);
  }

  const stat = await fs.promises.stat(resolved);
  if (!stat.isFile()) {
    throw new Error(`Path is not a regular file (is directory or socket): ${resolved}`);
  }

  if (stat.size === 0) {
    throw new Error(`Image file is empty (0 bytes): ${resolved}`);
  }

  if (stat.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error(`File size (${(stat.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)}MB.`);
  }

  const detectedMime = mime.lookup(resolved);
  // Strict security check: prevent reading non-image or arbitrary text files (e.g. .ssh/id_rsa, /etc/passwd)
  if (!detectedMime || !detectedMime.startsWith('image/')) {
    throw new Error(`File is not a valid image format: ${resolved} (detected MIME: ${detectedMime || 'unknown'})`);
  }

  const buffer = await fs.promises.readFile(resolved);

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

  return await Promise.all(inputs.map(img => loadImage(img)));
}

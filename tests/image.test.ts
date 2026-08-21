import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchRemoteImage,
  isDataUrl,
  isHttpUrl,
  loadImage,
  loadImages,
  loadLocalImage,
  parseDataUrl,
  resolveHomePath,
} from '../src/image.js';

describe('Image Module', () => {
  const tempDir = path.join(os.tmpdir(), 'mcp-vision-test');
  const sampleImagePath = path.join(tempDir, 'test-image.png');
  const emptyImagePath = path.join(tempDir, 'empty.png');
  const nonImageFilePath = path.join(tempDir, 'text.txt');
  const noExtensionSecretPath = path.join(tempDir, 'id_rsa');

  // 1x1 transparent PNG base64
  const sampleBase64Png =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const sampleDataUrl = `data:image/png;base64,${sampleBase64Png}`;

  beforeEach(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(sampleImagePath, Buffer.from(sampleBase64Png, 'base64'));
    fs.writeFileSync(emptyImagePath, Buffer.alloc(0));
    fs.writeFileSync(nonImageFilePath, 'Hello plain text file');
    fs.writeFileSync(noExtensionSecretPath, 'SECRET_KEY_DATA');
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    vi.restoreAllMocks();
  });

  describe('resolveHomePath', () => {
    it('should expand ~ to home directory', () => {
      const result = resolveHomePath('~/test.png');
      expect(result).toBe(path.join(os.homedir(), 'test.png'));
    });

    it('should leave absolute and relative paths untouched', () => {
      expect(resolveHomePath('/tmp/test.png')).toBe('/tmp/test.png');
      expect(resolveHomePath('./test.png')).toBe('./test.png');
    });
  });

  describe('URL / format detection', () => {
    it('should identify data URLs', () => {
      expect(isDataUrl(sampleDataUrl)).toBe(true);
      expect(isDataUrl('http://example.com/img.png')).toBe(false);
      expect(isDataUrl('/path/img.png')).toBe(false);
    });

    it('should identify HTTP/HTTPS URLs', () => {
      expect(isHttpUrl('http://example.com/img.png')).toBe(true);
      expect(isHttpUrl('https://example.com/img.png')).toBe(true);
      expect(isHttpUrl(sampleDataUrl)).toBe(false);
      expect(isHttpUrl('/path/img.png')).toBe(false);
    });
  });

  describe('parseDataUrl', () => {
    it('should parse valid base64 data URI correctly', () => {
      const result = parseDataUrl(sampleDataUrl);
      expect(result.sourceType).toBe('base64');
      expect(result.mimeType).toBe('image/png');
      expect(result.image).toBeInstanceOf(Uint8Array);
      expect(result.image.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid data URI format', () => {
      expect(() => parseDataUrl('data:invalid')).toThrow('Invalid data URI format');
    });

    it('should throw error if MIME is not image/*', () => {
      expect(() => parseDataUrl('data:text/plain;base64,SGVsbG8=')).toThrow(
        'Only image/* formats are supported',
      );
    });
  });

  describe('loadLocalImage security & validation', () => {
    it('should read existing local image and infer MIME type', async () => {
      const result = await loadLocalImage(sampleImagePath);
      expect(result.sourceType).toBe('local');
      expect(result.mimeType).toBe('image/png');
      expect(result.image).toBeInstanceOf(Uint8Array);
      expect(result.image.length).toBeGreaterThan(0);
    });

    it('should throw error if file does not exist', async () => {
      await expect(loadLocalImage('/non/existent/path/photo.jpg')).rejects.toThrow(
        'Image file not found',
      );
    });

    it('should throw error if file is empty', async () => {
      await expect(loadLocalImage(emptyImagePath)).rejects.toThrow('Image file is empty');
    });

    it('should throw error if file is not an image', async () => {
      await expect(loadLocalImage(nonImageFilePath)).rejects.toThrow('recognized image format');
    });

    it('should block reading non-image files without extension (arbitrary file read protection)', async () => {
      await expect(loadLocalImage(noExtensionSecretPath)).rejects.toThrow(
        'recognized image format',
      );
    });
  });

  describe('fetchRemoteImage', () => {
    it('should fetch remote image and return buffer + mime', async () => {
      const mockBuffer = Buffer.from(sampleBase64Png, 'base64');
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: async () => new Uint8Array(mockBuffer).buffer,
      } as any);

      const result = await fetchRemoteImage('https://example.com/photo.png');
      expect(result.sourceType).toBe('url');
      expect(result.mimeType).toBe('image/png');
      expect(result.image).toBeInstanceOf(Uint8Array);
    });

    it('should throw error if remote URL returns non-image bytes', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
        arrayBuffer: async () => new Uint8Array(Buffer.from('<html></html>')).buffer,
      } as any);

      await expect(fetchRemoteImage('https://example.com/not-an-image')).rejects.toThrow(
        'recognized image format',
      );
    });

    it('should throw error if fetch returns non-200 status', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

      await expect(fetchRemoteImage('https://example.com/404.png')).rejects.toThrow('HTTP 404');
    });
  });

  describe('loadImage & loadImages', () => {
    it('should dispatch to data url parser for data uris', async () => {
      const res = await loadImage(sampleDataUrl);
      expect(res.sourceType).toBe('base64');
    });

    it('should dispatch to local file reader for local files', async () => {
      const res = await loadImage(sampleImagePath);
      expect(res.sourceType).toBe('local');
    });

    it('should process multiple images via loadImages', async () => {
      const results = await loadImages([sampleImagePath, sampleDataUrl]);
      expect(results).toHaveLength(2);
      expect(results[0].sourceType).toBe('local');
      expect(results[1].sourceType).toBe('base64');
    });

    it('should reject batch of more than 10 images to prevent DoS', async () => {
      const elevenImages = Array(11).fill(sampleImagePath);
      await expect(loadImages(elevenImages)).rejects.toThrow('Maximum of 10 images allowed');
    });

    it('should throw error on empty input', async () => {
      await expect(loadImage('')).rejects.toThrow();
      await expect(loadImages([])).rejects.toThrow();
    });
  });
});

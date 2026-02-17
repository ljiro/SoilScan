/**
 * Write a ZIP (Uint8Array) to cache in chunks to avoid OOM on Android
 * when passing a huge base64 string to writeAsStringAsync.
 * Uses expo-file-system/next FileHandle.writeBytes (requires dev build).
 * Falls back to legacy single-write if next is unavailable.
 */

import * as FileSystem from 'expo-file-system/legacy';

const CHUNK_SIZE = 1024 * 1024; // 1MB per write

/**
 * Write zipBytes to a file in the cache directory in chunks.
 * @param {string} zipFilename - e.g. 'AgriCapture_20250127.zip'
 * @param {Uint8Array} zipBytes - ZIP binary from JSZip generateAsync({ type: 'uint8array' })
 * @returns {Promise<string>} Full URI of the written file (for sharing)
 * @throws If chunked write fails (caller can fall back to base64 + writeAsStringAsync)
 */
export async function writeZipToFileChunked(zipFilename, zipBytes) {
  let FileNext;
  let Paths;
  try {
    const next = require('expo-file-system/next');
    FileNext = next.File;
    Paths = next.Paths;
  } catch (e) {
    throw new Error('expo-file-system/next not available');
  }

  const file = new FileNext(Paths.cache, zipFilename);
  file.create({ overwrite: true, intermediates: true });
  const handle = file.open();

  try {
    for (let i = 0; i < zipBytes.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, zipBytes.length);
      const chunk = zipBytes.subarray(i, end);
      handle.writeBytes(chunk);
    }
  } finally {
    handle.close();
  }

  return file.uri;
}

/**
 * Write ZIP using chunked write if possible, otherwise legacy base64 write.
 * @param {string} zipFilename - filename for the ZIP
 * @param {object} zip - JSZip instance (will be generated as uint8array then optionally base64)
 * @param {string} cacheDirectory - legacy cache path (e.g. FileSystem.cacheDirectory)
 * @param {Function} setProgress - optional (phase) => {} for UI
 * @returns {Promise<string>} Full path/URI to the written file for sharing
 */
export async function writeZipWithChunkedFallback(zipFilename, zip, cacheDirectory, setProgress) {
  const genOpts = { compression: 'DEFLATE', compressionOptions: { level: 3 } };

  try {
    if (setProgress) setProgress('Creating ZIP...');
    const zipBytes = await zip.generateAsync({ ...genOpts, type: 'uint8array' });
    if (setProgress) setProgress('Writing ZIP...');
    const uri = await writeZipToFileChunked(zipFilename, zipBytes);
    return uri;
  } catch (chunkError) {
    console.warn('[zipChunkedWrite] Chunked write failed, using legacy:', chunkError?.message);
    if (setProgress) setProgress('Writing ZIP (legacy)...');
    const zipBase64 = await zip.generateAsync({ ...genOpts, type: 'base64' });
    const fullPath = `${cacheDirectory}${zipFilename}`;
    await FileSystem.writeAsStringAsync(fullPath, zipBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return fullPath;
  }
}

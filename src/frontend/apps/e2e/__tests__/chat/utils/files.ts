import { deflateSync } from "zlib";

import { Download } from "@playwright/test";

/** A file sent or received in a test, with its exact bytes. */
export type TestFile = { name: string; mimeType: string; data: Buffer };

const crc32 = (data: Buffer): number => {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index++) {
    crc ^= data[index];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type: string, data: Buffer): Buffer => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

/** Side of the test images: big enough to be clicked as a thumbnail. */
export const IMAGE_SIZE = 64;

/** A plain-colour PNG whose colour, and so bytes, come from `seed`. */
export const pngImage = (seed: string, size = IMAGE_SIZE): Buffer => {
  const hash = crc32(Buffer.from(seed));
  const color = Buffer.from(
    [hash >>> 16, hash >>> 8, hash].map((v) => v & 255),
  );
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  // Each row starts with its filter type (0: none).
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, color)]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(Array(size).fill(row)))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
};

const minimalPdf = (text: string): Buffer =>
  Buffer.from(
    [
      "%PDF-1.4",
      "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
      "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
      "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >> endobj",
      `% ${text}`,
      "trailer << /Root 1 0 R >>",
      "%%EOF",
    ].join("\n"),
  );

/** A PNG image named after `label`. */
export const testImage = (label: string): TestFile => ({
  name: `${label}.png`,
  mimeType: "image/png",
  data: pngImage(label),
});

/** A PDF document whose bytes are unique to `label`. */
export const testPdf = (label: string): TestFile => ({
  name: `${label}.pdf`,
  mimeType: "application/pdf",
  data: minimalPdf(label),
});

/** A text file whose bytes are unique to `label`. */
export const testTextFile = (label: string): TestFile => ({
  name: `${label}.txt`,
  mimeType: "text/plain",
  data: Buffer.from(`Content of ${label}\n`),
});

/** Bytes of a file downloaded by the browser. */
export const downloadedBytes = async (download: Download): Promise<Buffer> => {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

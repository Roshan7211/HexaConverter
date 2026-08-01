/**
 * Generates one small sample file per input format, for exercising every
 * conversion route against a running server. Output goes to a directory given
 * as argv[2]. Formats that cannot be produced without the very tooling under
 * test (odt/ods/odp need LibreOffice; doc/xls/ppt are legacy binaries; rar
 * needs a proprietary compressor) are skipped and reported.
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import archiver from 'archiver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import ffmpegPath from 'ffmpeg-static';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import sharp from 'sharp';
import * as tar from 'tar';

const run = promisify(execFile);
const out = process.argv[2];
await fs.mkdir(out, { recursive: true });

const written = [];
const skipped = [];
const write = async (name, data) => {
  await fs.writeFile(path.join(out, name), data);
  written.push(name);
};

// ---------------------------------------------------------------- images
const base = sharp({
  create: {
    width: 320,
    height: 240,
    channels: 3,
    background: { r: 200, g: 60, b: 40 },
  },
});
await write('sample.png', await base.clone().png().toBuffer());
await write('sample.jpg', await base.clone().jpeg().toBuffer());
await write('sample.webp', await base.clone().webp().toBuffer());
await write('sample.avif', await base.clone().avif().toBuffer());
await write('sample.tiff', await base.clone().tiff().toBuffer());
await write('sample.gif', await base.clone().gif().toBuffer());
await write(
  'sample.bmp',
  // sharp cannot encode BMP, so build a 24-bit one by hand: a 14-byte file
  // header, a 40-byte info header, then bottom-up BGR rows padded to 4 bytes.
  await (async () => {
    const w = 8;
    const h = 8;
    const rowSize = Math.ceil((w * 3) / 4) * 4;
    const pixels = Buffer.alloc(rowSize * h);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const o = y * rowSize + x * 3;
        pixels[o] = 40;
        pixels[o + 1] = 60;
        pixels[o + 2] = 200;
      }
    }
    const header = Buffer.alloc(54);
    header.write('BM', 0);
    header.writeUInt32LE(54 + pixels.length, 2);
    header.writeUInt32LE(54, 10);
    header.writeUInt32LE(40, 14);
    header.writeInt32LE(w, 18);
    header.writeInt32LE(h, 22);
    header.writeUInt16LE(1, 26);
    header.writeUInt16LE(24, 28);
    header.writeUInt32LE(pixels.length, 34);
    return Buffer.concat([header, pixels]);
  })(),
);
await write(
  'sample.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240"><rect width="320" height="240" fill="#c83c28"/><circle cx="160" cy="120" r="70" fill="#ffffff"/></svg>`,
);
skipped.push('heic (no encoder available; heic is input-only anyway)');

// ------------------------------------------------------------- documents
const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
for (let i = 0; i < 2; i += 1) {
  const page = pdf.addPage([595.28, 841.89]);
  page.drawText(`HexaConverter fixture page ${i + 1}`, {
    x: 60,
    y: 760,
    size: 22,
    font,
  });
  page.drawText('The quick brown fox jumps over the lazy dog.', {
    x: 60,
    y: 720,
    size: 12,
    font,
  });
  page.drawRectangle({
    x: 60,
    y: 480,
    width: 240,
    height: 160,
    color: rgb(0.2, 0.4, 0.8),
  });
}
await write('sample.pdf', Buffer.from(await pdf.save()));

const docx = new Document({
  sections: [
    {
      children: [
        new Paragraph({
          children: [new TextRun({ text: 'HexaConverter fixture', bold: true })],
        }),
        new Paragraph('The quick brown fox jumps over the lazy dog.'),
      ],
    },
  ],
});
await write('sample.docx', await Packer.toBuffer(docx));

const wb = new ExcelJS.Workbook();
const sheet = wb.addWorksheet('Data');
sheet.addRow(['name', 'qty', 'price']);
sheet.addRow(['widget', 4, 9.99]);
sheet.addRow(['gadget', 7, 14.5]);
await write('sample.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));

await write('sample.txt', 'HexaConverter fixture\nSecond line of plain text.\n');
await write(
  'sample.md',
  '# HexaConverter fixture\n\nSome **bold** text and a [link](https://example.com).\n\n- one\n- two\n',
);
await write(
  'sample.html',
  '<!doctype html><html><head><title>Fixture</title></head><body><h1>HexaConverter fixture</h1><p>The quick brown fox.</p></body></html>',
);
await write('sample.csv', 'name,qty,price\nwidget,4,9.99\ngadget,7,14.5\n');
await write(
  'sample.json',
  JSON.stringify(
    [
      { name: 'widget', qty: 4, price: 9.99 },
      { name: 'gadget', qty: 7, price: 14.5 },
    ],
    null,
    2,
  ),
);
await write(
  'sample.rtf',
  '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Helvetica;}}\\f0\\fs24 HexaConverter fixture\\par The quick brown fox.\\par}',
);
skipped.push('odt/ods/odp (need LibreOffice to author)');
skipped.push('doc/xls/ppt (legacy binary formats; input-only)');
skipped.push('pptx (no authoring library in the dependency tree)');

// ------------------------------------------------------- audio and video
const ff = (args) => run(ffmpegPath, ['-y', '-loglevel', 'error', ...args]);
const tone = ['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'];
await ff([...tone, path.join(out, 'sample.wav')]);
await ff([...tone, '-b:a', '96k', path.join(out, 'sample.mp3')]);
await ff([...tone, path.join(out, 'sample.flac')]);
await ff([...tone, '-c:a', 'libvorbis', path.join(out, 'sample.ogg')]);
await ff([...tone, '-c:a', 'libopus', path.join(out, 'sample.opus')]);
await ff([...tone, '-c:a', 'aac', path.join(out, 'sample.aac')]);
await ff([...tone, '-c:a', 'aac', path.join(out, 'sample.m4a')]);
written.push(
  'sample.wav',
  'sample.mp3',
  'sample.flac',
  'sample.ogg',
  'sample.opus',
  'sample.aac',
  'sample.m4a',
);

const clip = [
  '-f',
  'lavfi',
  '-i',
  'testsrc=size=320x240:rate=15:duration=2',
  '-f',
  'lavfi',
  '-i',
  'sine=frequency=440:duration=2',
  '-shortest',
];
await ff([...clip, '-c:v', 'libx264', '-c:a', 'aac', path.join(out, 'sample.mp4')]);
await ff([...clip, '-c:v', 'libvpx-vp9', '-c:a', 'libopus', '-b:v', '200k', path.join(out, 'sample.webm')]);
await ff([...clip, '-c:v', 'libx264', '-c:a', 'aac', path.join(out, 'sample.mkv')]);
await ff([...clip, '-c:v', 'libx264', '-c:a', 'aac', path.join(out, 'sample.mov')]);
await ff([...clip, '-c:v', 'mpeg4', '-c:a', 'libmp3lame', path.join(out, 'sample.avi')]);
written.push(
  'sample.mp4',
  'sample.webm',
  'sample.mkv',
  'sample.mov',
  'sample.avi',
);

// -------------------------------------------------------------- archives
const payload = path.join(out, '_payload');
await fs.mkdir(payload, { recursive: true });
await fs.writeFile(path.join(payload, 'readme.txt'), 'inside the archive\n');
await fs.writeFile(path.join(payload, 'data.csv'), 'a,b\n1,2\n');

await new Promise((resolve, reject) => {
  const zip = archiver('zip');
  const chunks = [];
  zip.on('data', (c) => chunks.push(c));
  zip.on('error', reject);
  zip.on('end', async () => {
    await write('sample.zip', Buffer.concat(chunks));
    resolve();
  });
  zip.directory(payload, false);
  zip.finalize();
});

await tar.create({ file: path.join(out, 'sample.tar'), cwd: payload }, [
  'readme.txt',
  'data.csv',
]);
await tar.create(
  { file: path.join(out, 'sample.tgz'), cwd: payload, gzip: true },
  ['readme.txt', 'data.csv'],
);
written.push('sample.tar', 'sample.tgz');

const { gzipSync } = await import('node:zlib');
await write('sample.gz', gzipSync(await fs.readFile(path.join(payload, 'readme.txt'))));

const sevenZip = (await import('7zip-bin')).default;
await run(sevenZip.path7za, [
  'a',
  '-y',
  path.join(out, 'sample.7z'),
  path.join(payload, '*'),
]).catch((error) => {
  skipped.push(`7z (${error.message.split('\n')[0]})`);
});
if (!(await fs.stat(path.join(out, 'sample.7z')).catch(() => null))) {
  skipped.push('7z (archiver produced nothing)');
} else {
  written.push('sample.7z');
}
skipped.push('rar (no free encoder; rar is input-only)');

await fs.rm(payload, { recursive: true, force: true });

console.log(JSON.stringify({ written: written.sort(), skipped }, null, 2));

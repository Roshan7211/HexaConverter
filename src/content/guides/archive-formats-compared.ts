import type { Guide } from '@/content/guides/types';

export const archiveFormatsCompared: Guide = {
  slug: 'zip-vs-tar-gz-vs-7z',
  title: 'ZIP, TAR.GZ and 7z: which archive format, and why',
  metaTitle:
    'ZIP vs TAR.GZ vs 7z — solid compression, permissions and choosing between them',
  description:
    'The archive formats differ in one structural way that explains almost everything else about them: whether they compress each file separately or all of them together.',
  published: '2026-08-22',
  topic: 'archive',
  formats: ['zip', 'tar', 'tgz', '7z', 'gz', 'rar'],
  intro: [
    'Archiving is really two jobs. One is bundling — turning many files into one, keeping the folder structure intact. The other is compression — making the result smaller. Different formats draw the line between those two jobs in different places, and that single design decision explains most of what follows.',
    'ZIP does both at once and compresses each file separately. TAR does only the bundling and leaves compression to something else. That difference decides how small your archive gets, how fast you can pull one file out of it, and whether the permissions on your files survive the trip.',
  ],
  sections: [
    {
      heading: 'Per-file compression versus solid compression',
      body: [
        'A ZIP compresses every file inside it on its own. Each entry is squeezed independently and stored with its own index entry, which means a tool can jump straight to any single file, decompress just that one and hand it to you. Opening a 4 GB ZIP to read one small text file is nearly instant.',
        'A TAR.GZ works the other way. The tar step concatenates everything into one continuous stream, and then gzip compresses that entire stream in a single pass. Because the compressor sees all the files as one long run of data, it can spot patterns that repeat **across** files — and in a folder of a thousand similar source files or documents, almost everything repeats across files.',
        'That is why a TAR.GZ is usually meaningfully smaller than a ZIP of the same folder. The cost is that there is no index and no random access: pulling one file out means decompressing everything that comes before it. This trade — better ratio, slower single-file access — is called solid compression, and it is the fundamental difference between the two families.',
      ],
      callout: {
        title: 'The short version',
        body: 'Many similar small files? TAR.GZ will be notably smaller. Need to open one file out of thousands, repeatedly? ZIP will be much faster.',
      },
    },
    {
      heading: 'Permissions and symbolic links',
      body: [
        'TAR was designed for Unix systems and records what Unix filesystems care about: ownership, permission bits and symbolic links. That is not a detail — it is why every piece of server software in existence ships as a tarball.',
        'ZIP has no dependable place to put any of it. The executable bit is the one that bites most often: unpack a ZIP containing a shell script and the script may well arrive without permission to run, needing `chmod` before it will do anything. On Windows, where these concepts do not apply in the same way, none of this matters at all.',
        'It is worth being precise about what conversion can and cannot do here. Converting a ZIP to a TAR.GZ does not invent permissions the ZIP never stored — the information was not there to carry across. It only means that from this point on, there is somewhere to record it.',
      ],
    },
    {
      heading: 'How they compare',
      body: ['The practical differences, side by side.'],
      table: {
        columns: [
          'Format',
          'Compression',
          'Single-file access',
          'Unix permissions',
        ],
        rows: [
          [
            'ZIP',
            'Per file, with deflate',
            'Fast — jump straight to any entry',
            'Not reliably',
          ],
          ['TAR', 'None at all', 'Read through from the start', 'Yes'],
          [
            'TAR.GZ',
            'Solid, over the whole stream',
            'Decompress everything before it',
            'Yes',
          ],
          [
            '7z',
            'Solid, with LZMA — usually the tightest',
            'Supported, at a higher cost',
            'Not reliably',
          ],
          [
            'RAR',
            'Proprietary; readable but not writable by open tools',
            'Yes',
            'Not reliably',
          ],
        ],
      },
    },
    {
      heading: 'Why TAR compresses nothing',
      body: [
        'People are often surprised that a plain `.tar` is roughly the combined size of everything inside it. That is correct behaviour, not a failure. TAR does one job — turning many files into one, preserving structure and metadata — and deliberately leaves compression to a separate tool.',
        'It is a genuinely good design. Because compression is a separate step, the same tar can be paired with gzip for speed, bzip2 for a better ratio, or xz for the best ratio, without the archive format needing to know anything about any of them. `.tar.gz` is simply a tar that has been through gzip, which is why it is sometimes written `.tgz`.',
        'If you have produced a TAR and wanted it smaller, [converting it to TAR.GZ](/tools/tar-to-tgz) applies exactly that second step.',
      ],
    },
    {
      heading: 'The formats we read but do not write',
      body: [
        'RAR, 7z and plain gzip can be uploaded as sources, and the contents repackaged into an open format. None of them can be produced, and the reasons differ.',
        'RAR is proprietary. It may be read freely but not written by open tools — a licensing boundary rather than a technical one. If you have been sent a RAR and need something everyone can open, [converting it to ZIP](/tools/rar-to-zip) is the usual move.',
        'Plain gzip is a different case: it compresses a single stream and has no concept of files or folders at all. A `.gz` holds one thing. That is precisely why it is nearly always paired with tar, and why a bare `.gz` of a folder is not a thing that exists.',
      ],
    },
    {
      heading: 'What happens when you convert one to another',
      body: [
        'The archive is not renamed or re-wrapped — it is unpacked in full and its contents written into a new archive from scratch. That has one consequence worth planning around: the compression is redone at the level you choose, so the resulting size depends on that setting rather than on how the original was made.',
        'The default is level 6, which has been the sensible middle ground for deflate for thirty years. Raising it buys a few percent for a disproportionate amount of time. Lowering it is genuinely worth doing for large archives of already-compressed material — a folder of JPEGs, MP3s or video has essentially nothing left to squeeze, and running it through maximum compression spends a long time achieving nothing.',
        'One safety note that applies to any archive from an untrusted source: an archive can be crafted to expand to an enormous size from a tiny file. Uploads with an abnormal compression ratio are rejected rather than unpacked.',
      ],
    },
  ],
  related: [
    'zip-to-tgz',
    'tar-to-tgz',
    'rar-to-zip',
    '7z-to-zip',
    'tgz-to-zip',
  ],
  faq: [
    {
      question: 'Is TAR.GZ smaller than ZIP?',
      answer:
        'Usually, yes — often noticeably so on many small similar files, because gzip compresses the whole bundle as one stream and can exploit patterns that repeat across files. On a handful of large, already-compressed files the difference is negligible.',
    },
    {
      question: 'Why is my TAR file not smaller than the folder?',
      answer:
        'Because tar does not compress at all. It only bundles many files into one, preserving structure and permissions. Applying gzip on top is what makes it smaller, giving you a .tar.gz.',
    },
    {
      question: 'Can I create a RAR file?',
      answer:
        'No. RAR compression is proprietary and cannot be written by open tools. RAR archives can be read here and their contents repackaged into ZIP, TAR or TAR.GZ.',
    },
    {
      question: 'Which archive format should I use?',
      answer:
        'ZIP if a Windows user will open it or you need fast access to individual files. TAR.GZ for anything Unix-flavoured, anything destined for a server, or when the smallest result matters most.',
    },
  ],
};

import type { Guide } from '@/content/guides/types';

export const photoMetadataExif: Guide = {
  slug: 'what-happens-to-exif-data-when-you-convert-a-photo',
  title: 'The data hiding in your photos, and what conversion does to it',
  metaTitle:
    'EXIF data explained: what your photos reveal and how conversion strips it',
  description:
    'Every photo from a phone carries a record of the camera, the settings, the time and often the exact place it was taken. Here is what is in there, how it leaks, and what happens to it when you convert the file.',
  published: '2026-08-22',
  topic: 'image',
  formats: ['jpg', 'heic', 'png', 'tiff', 'webp'],
  intro: [
    'A photograph is not only a picture. Alongside the pixels, most cameras write a block of metadata called EXIF: the make and model of the device, the lens, the shutter speed and aperture, the date and time to the second, and — if location services were on — the latitude and longitude where you were standing.',
    'None of this is visible when you look at the image. All of it travels with the file when you send it to someone, and quite a lot of it is more revealing than people expect.',
  ],
  sections: [
    {
      heading: 'What is actually in there',
      body: [
        'The exact contents vary by device, but a photo taken on a modern phone typically carries most of the following.',
      ],
      list: [
        'Camera make and model, and often the specific lens used',
        'Date and time the shutter fired, usually to the second',
        'GPS latitude, longitude and sometimes altitude and compass heading',
        'Exposure settings: shutter speed, aperture, ISO, whether the flash fired',
        'Orientation — which way up the camera was held',
        'Software that last touched the file, including any editing app',
        'Sometimes a thumbnail of the **original** image, which survives cropping',
      ],
      callout: {
        title: 'The thumbnail catch',
        body: 'Some editors update the main image but leave the embedded thumbnail alone. A photo cropped to hide something can still carry a small copy of the uncropped original inside it.',
      },
    },
    {
      heading: 'Why the location field matters more than the rest',
      body: [
        'Camera settings are harmless. The timestamp is rarely sensitive. GPS coordinates are a different category of information: they place a specific person at a specific place at a specific moment, accurate to within a few metres.',
        "The practical risk is not usually dramatic. It is that people do not realise it is happening. A photo of something for sale, posted online, can carry the coordinates of the seller's home. A picture sent to a stranger can do the same. Photographs of children are the case that most often gives people pause once they know.",
        'Many social platforms strip metadata on upload, which has quietly trained people to assume it always goes away. Direct file transfers — email attachments, messaging apps in "send as file" mode, cloud folders, anything you hand over as an actual file — generally preserve it exactly.',
      ],
    },
    {
      heading: 'What conversion does to it here',
      body: [
        'When you convert an image on this site, the metadata is **removed by default**. The converted file carries the picture and nothing else. That is a deliberate choice rather than a side effect: the common reason to convert a photo is to send it somewhere, and it should not quietly carry your location when you do.',
        'One piece of metadata gets special treatment before the rest is discarded. The orientation flag records which way up the camera was held, and the pixels themselves are stored the way the sensor read them — so if you simply deleted the flag, a photo taken in portrait would come out on its side. The flag is read first and the rotation is applied to the actual pixels, then the metadata is dropped. The image comes out the right way up with nothing left to strip.',
        'If you need the metadata kept — photographers cataloguing work, anyone who relies on capture dates for sorting — there is a setting to preserve it. It is off by default because the safer behaviour should be the one you get without thinking about it.',
      ],
    },
    {
      heading: 'HEIC is a special case worth knowing about',
      body: [
        'An iPhone photograph is not just an image with metadata attached. HEIC files can hold depth maps used for portrait mode, several frames from a burst, the short video clip that makes up a Live Photo, and edit histories that let the original be recovered.',
        "When you [convert HEIC to JPEG](/tools/heic-to-jpg) here, what comes out is the photograph. The auxiliary data is not carried across, because JPEG has nowhere to put most of it. That is usually exactly what you want — the reason for converting is almost always that something outside Apple's ecosystem will not open HEIC at all — but it is worth knowing before you delete the originals. If the Live Photo motion or the depth information matters to you, keep the HEIC.",
      ],
    },
    {
      heading: 'Which formats carry metadata at all',
      body: [
        'Not every format has somewhere to put it, which is occasionally a useful property in itself.',
      ],
      table: {
        columns: ['Format', 'Metadata support', 'In practice'],
        rows: [
          [
            'JPEG',
            'Full EXIF, plus IPTC and XMP',
            'The usual source of the problem — camera output, and it keeps everything',
          ],
          [
            'HEIC',
            'Full EXIF, plus depth maps and image sequences',
            'iPhone default; carries more than any other consumer format',
          ],
          [
            'TIFF',
            'Full EXIF',
            'Common in scanning and archives, where the metadata is often the point',
          ],
          [
            'PNG',
            'Text chunks; can carry EXIF but often does not',
            'Screenshots rarely carry anything sensitive',
          ],
          [
            'WebP / AVIF',
            'Supports EXIF and XMP',
            'Depends entirely on what wrote the file',
          ],
          [
            'BMP',
            'Essentially none',
            'Nothing to strip, because there is nowhere to put it',
          ],
        ],
      },
    },
    {
      heading: 'A practical routine',
      body: [
        'You do not need to think about this for most photographs. It is worth being deliberate in three situations: anything going to a stranger, anything published on a site that does not strip metadata itself, and any photograph taken at home.',
        'The simplest reliable approach is to convert the file before sending it. [HEIC to JPEG](/tools/heic-to-jpg) for iPhone photos; for a file already in the right format, running it through the [image converter](/convert/image) to the same format strips the metadata while leaving the picture alone. Then check the result: inspect the file properties, or open it in any EXIF viewer. Verifying once teaches you what your own devices actually write.',
        'Do keep an original somewhere if the capture dates matter to you. Metadata is genuinely useful — it is what lets photo libraries sort by date and place. The goal is not to destroy it everywhere, only to stop it travelling with files you hand to other people.',
      ],
    },
  ],
  related: [
    'heic-to-jpg',
    'heic-to-png',
    'jpg-to-png',
    'png-to-jpg',
    'tiff-to-jpg',
  ],
  faq: [
    {
      question: 'Does converting a photo remove EXIF data?',
      answer:
        'On this site, yes — metadata is stripped by default, including GPS coordinates. The orientation is applied to the pixels first so the image is not rotated incorrectly. You can turn preservation on if you need the metadata kept.',
    },
    {
      question: 'Can EXIF data be recovered after it has been stripped?',
      answer:
        'Not from the converted file. The information is simply not written into it. It still exists in whatever original you kept, so keep that original if the capture data matters to you.',
    },
    {
      question: 'Do screenshots contain EXIF data?',
      answer:
        'Screenshots have no camera, no lens and no GPS fix, so there is nothing of that kind to record. They may carry the device and software that produced them, but not the personal information people are usually worried about.',
    },
    {
      question: 'Does social media strip metadata automatically?',
      answer:
        'Most large platforms do strip it on upload. Do not rely on that as a general rule: direct transfers such as email attachments, cloud folders and files sent through messaging apps usually preserve it exactly as it was.',
    },
  ],
};

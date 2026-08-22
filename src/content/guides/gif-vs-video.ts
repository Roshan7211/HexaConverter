import type { Guide } from '@/content/guides/types';

export const gifVsVideo: Guide = {
  slug: 'gif-vs-video-for-short-clips',
  title: 'GIF is a terrible video format, and sometimes the right one',
  metaTitle: 'GIF vs MP4: why animated GIFs are so large, and when to use one',
  description:
    'A three-second GIF can be larger than the minute-long video it came from. Here is why that happens, and the narrow set of cases where GIF still wins anyway.',
  published: '2026-08-22',
  topic: 'video',
  formats: ['gif', 'mp4', 'webm', 'webp'],
  intro: [
    'GIF was designed in 1987 to move small images across dial-up connections. It was never meant to carry video, and by every technical measure it is bad at it: larger files, worse colour, no sound, and more work for the device playing it.',
    'It has nonetheless outlived almost everything from its era, because it does one thing nothing else quite manages — it plays anywhere, automatically, silently, with no player and no permission. That combination is worth more than efficiency in a surprising number of places.',
  ],
  sections: [
    {
      heading: 'Why a GIF is so much larger than a video',
      body: [
        'Video codecs compress across time. H.264 stores a full frame occasionally and then, for the frames in between, stores only what changed — and even that is described as motion rather than as pixels. A shot of someone talking against a static background costs almost nothing after the first frame, because almost nothing moves.',
        'GIF has no concept of any of that. Each frame is compressed on its own, as a separate image, using a scheme from the 1980s. A background that is identical in all ninety frames is stored ninety times. There is no motion estimation, no prediction between frames, nothing.',
        'The result is routinely a file ten to twenty times larger than an MP4 of the same clip, and the MP4 will look better while it is at it. A three-second reaction GIF at a decent size can easily exceed the file size of a minute of compressed video.',
      ],
    },
    {
      heading: 'And why it looks worse',
      body: [
        'GIF stores at most 256 colours per frame. A photograph or a video frame contains far more than that, so converting means picking 256 representative colours and mapping everything else onto the nearest one.',
        'On flat graphics — a logo animation, a simple diagram — 256 colours is plenty and the result is perfect. On anything filmed it is not close to enough. Skies band into visible stripes, skin tones go blotchy, and gradients become steps. Dithering, which scatters pixels of two colours to fake a third, softens this at the cost of a grainy texture — and because dithering adds noise, it also makes the file larger.',
        'There is no transparency subtlety either. GIF transparency is a single on-or-off bit per pixel, so an anti-aliased edge that should fade smoothly instead gets a hard jagged boundary. It is the reason GIF logos on coloured backgrounds always look slightly wrong.',
      ],
    },
    {
      heading: 'What we do to make it as good as it can be',
      body: [
        'The difference between an acceptable GIF and a terrible one is almost entirely in how the 256 colours are chosen. A fixed, generic palette produces the muddy results people associate with the format.',
        'So [converting video to GIF](/tools/mp4-to-gif) here analyses your specific clip first, builds a palette that suits the colours actually in it, and then applies that palette with dithering to soften the banding. A clip with one consistent colour scheme converts far better than one cutting between very different scenes, because a single palette has to serve every frame.',
        'The defaults are deliberately conservative, because GIF size grows so fast: 15 frames per second, 480 pixels tall, and the first 30 seconds. All three are adjustable and the export is capped at a minute. Audio is dropped, because GIF has nowhere at all to put it — that is the single most common surprise people hit.',
      ],
      callout: {
        title: 'The three dials that matter',
        body: 'Length, then height, then frame rate — in that order. Halving the duration halves the file. Dropping from 30 fps to 15 is usually invisible in a short loop and saves nearly half again.',
      },
    },
    {
      heading: 'When GIF is genuinely the right choice',
      body: [
        'Given all that, it still wins in specific places, and it is worth being clear about which.',
      ],
      list: [
        'Anywhere that will not autoplay a video but will animate a GIF — some email clients, some forums, some chat and documentation systems.',
        'Short UI demonstrations in documentation and bug reports, where the clip must play inline with no controls and no click.',
        'Flat-colour animation — logos, diagrams, loading indicators — where 256 colours is not a limitation at all.',
        'Anywhere the file will be pasted between systems that all understand images and do not all understand video.',
      ],
    },
    {
      heading: 'And what to use instead when you can',
      body: [
        'If the destination supports video, an MP4 will be smaller and look better in every case. For the specific job of a silent auto-looping clip on the web, MP4 with the autoplay, loop and muted attributes does exactly what a GIF does, at a fraction of the size.',
        'Animated WebP is the interesting middle option: it animates like a GIF, is treated as an image by most software that handles images, and compresses far better while supporting full colour and proper alpha transparency. [Converting a GIF to WebP](/tools/gif-to-webp) frequently cuts the size substantially with no visible loss.',
        'One thing no conversion can do is undo the damage. Converting a GIF to MP4 gives you a much smaller file, but the palette was reduced when the GIF was made and the banding is baked into the frames. You get GIF-quality footage in an efficient container. If you still have the original video, [convert from that](/tools/mp4-to-webm) instead.',
      ],
    },
  ],
  related: [
    'mp4-to-gif',
    'gif-to-mp4',
    'gif-to-webp',
    'webm-to-gif',
    'mov-to-gif',
  ],
  faq: [
    {
      question: 'Why is my GIF bigger than the video I made it from?',
      answer:
        'Because GIF compresses each frame separately, with no compression across time at all, while video codecs store only what changes between frames. On most footage that difference is a factor of ten or more.',
    },
    {
      question: 'Can a GIF have sound?',
      answer:
        'No. The format has no provision for audio whatsoever. If your clip needs sound, it needs to be a video.',
    },
    {
      question: 'How do I make my GIF smaller?',
      answer:
        'Shorten it first — file size scales almost linearly with duration. Then reduce the height, then drop the frame rate to around 15 fps, which is rarely noticeable in a short loop.',
    },
    {
      question: 'Is animated WebP better than GIF?',
      answer:
        'Technically, in every respect: far smaller files, full colour rather than 256, and proper partial transparency. GIF is still ahead on universal support, which is the only reason to prefer it.',
    },
  ],
};

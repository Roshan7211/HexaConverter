import type { FormatSpec } from '@/types';
import { profileFor, type FormatProfile } from '@/content/format-profiles';

/**
 * The explanatory half of a conversion landing page.
 *
 * Two things make this worth rendering rather than repeating the same template
 * copy 214 times. The per-format profiles say something true and specific about
 * each side, and `conversionNotes` derives what *this particular* conversion
 * costs from the two formats' actual properties — alpha, compression kind,
 * animation, vector versus raster. A page about PNG to JPEG therefore warns
 * about flattened transparency, and a page about JPEG to PNG warns that the
 * file will grow without recovering any detail. Neither sentence appears on the
 * other page.
 *
 * Rendered on the server with no interactivity, so every word is in the HTML a
 * crawler receives rather than behind hydration.
 */

interface Note {
  heading: string;
  body: string;
}

/**
 * What changes in this specific conversion.
 *
 * Ordered by how much it can surprise someone: silent data loss first, size and
 * fidelity after. Each note is derived from a real property of the two formats,
 * so nothing here is generic filler — if no rule matches, nothing is claimed.
 */
function conversionNotes(
  from: FormatSpec,
  to: FormatSpec,
  fromProfile: FormatProfile,
  toProfile: FormatProfile,
): Note[] {
  const notes: Note[] = [];
  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();

  const lossy = (k: FormatProfile['kind']) => k === 'lossy';
  const exact = (k: FormatProfile['kind']) =>
    k === 'lossless' || k === 'uncompressed';

  // Transparency is the one that catches people out, because the damage is
  // invisible until the image sits on a coloured background.
  if (from.supportsAlpha && !to.supportsAlpha) {
    notes.push({
      heading: 'Transparency is flattened',
      body: `${F} carries an alpha channel and ${T} has none, so anything transparent has to become a solid colour. We composite onto white. If the image was designed to sit over a coloured background, convert to a format that keeps alpha instead — or expect a white box around it.`,
    });
  }

  if (fromProfile.kind === 'vector' && to.category === 'image') {
    notes.push({
      heading: 'Scalability is lost here',
      body: `${F} describes shapes, so it is sharp at any size. ${T} is a fixed grid of pixels. Once converted, enlarging the result will blur it — so choose the output size before converting, not after, and pick the largest size you will ever need.`,
    });
  }

  if (toProfile.kind === 'vector' && from.category === 'image') {
    notes.push({
      heading: 'This does not trace your image',
      body: `Converting pixels to ${T} does not turn a photograph into editable shapes — real vectorisation is a different job with different results. The image is embedded in the ${T} wrapper, so it stays a bitmap and will not gain the scalability ${T} is usually chosen for.`,
    });
  }

  if (lossy(fromProfile.kind) && exact(toProfile.kind)) {
    notes.push({
      heading: 'Quality cannot come back',
      body: `${F} already discarded detail permanently, and ${T} stores exactly what it is given. The result will be noticeably larger while looking identical to the ${F} you started from — lossless preserves, it does not restore. That is still the right move if you are about to edit, because further saves will not degrade it again.`,
    });
  }

  if (exact(fromProfile.kind) && lossy(toProfile.kind)) {
    notes.push({
      heading: 'This step is irreversible',
      body: `${F} holds every detail; ${T} keeps an approximation. The file gets much smaller, and converting back later will not undo it. Keep the ${F} original if the file is a master you will work from again.`,
    });
  }

  if (lossy(fromProfile.kind) && lossy(toProfile.kind)) {
    notes.push({
      heading: 'Re-encoding costs a little quality',
      body: `Both formats are lossy, so this decodes ${F} and compresses again as ${T}. That second pass loses a small amount on top of what was already gone. It is barely visible once, and it accumulates if a file is converted repeatedly — so convert from the original rather than from a previous conversion.`,
    });
  }

  // Both sides must be still-image formats for this to be true. Checking only
  // that the target does not animate was wrong: video targets report animation
  // as not applicable, so GIF to MP4 claimed to drop every frame but the first
  // when keeping the motion is the entire reason for that conversion. Vector
  // sources are excluded too — an animated SVG renders its initial state, which
  // is not the same thing as discarding frames.
  const fromAnimates = fromProfile.animation.startsWith('Yes');
  const toAnimates = toProfile.animation.startsWith('Yes');
  if (
    fromAnimates &&
    !toAnimates &&
    from.category === 'image' &&
    to.category === 'image' &&
    fromProfile.kind !== 'vector'
  ) {
    notes.push({
      heading: 'Only the first frame survives',
      body: `${F} can hold an animation and ${T} holds a single still image, so the result is the first frame and the rest is discarded. To keep the motion, convert to a video format instead, or to a still format that animates.`,
    });
  }

  if (from.category === 'document' && to.category === 'image') {
    notes.push({
      heading: 'Pages become separate images',
      body: `A ${F} can run to many pages, while each ${T} holds one image. Every page is rendered separately, so a ten-page document produces ten files. Text stops being text at that point — it becomes pixels, no longer selectable or searchable.`,
    });
  }

  if (
    from.category === 'image' &&
    to.category === 'document' &&
    to.id === 'pdf'
  ) {
    notes.push({
      heading: 'The image is placed, not read',
      body: `Your ${F} is embedded on a PDF page as a picture. Any text visible in the image stays part of the picture and is not searchable. To make it selectable, run text recognition on the resulting PDF afterwards.`,
    });
  }

  // Pulling audio out of a video is the single most common cross-category
  // conversion here, and it deserves saying plainly rather than being lumped in
  // with page splitting.
  if (from.category === 'video' && to.category === 'audio') {
    notes.push({
      heading: 'Only the sound is kept',
      body: `This takes the audio track out of the ${F} and writes it as ${T}. The picture is discarded entirely, and no conversion back will return it — keep the ${F} if you still need the video.`,
    });
  }

  if (from.category === 'video' && to.category === 'image' && toAnimates) {
    notes.push({
      heading: 'A video becomes an animation',
      body: `The motion survives, but ${T} is a far blunter instrument than video: it has no sound, and its 256-colour palette shows as banding on anything filmed. Expect the result to be larger than the ${F} it came from, despite looking worse — which is why short clips work and long ones do not.`,
    });
  }

  if (to.id === 'txt' && from.category === 'document' && from.id !== 'txt') {
    notes.push({
      heading: 'Only the words survive',
      body: `${T} stores characters and nothing else, so fonts, sizes, colours, images, tables and page layout are all dropped. What you get back is the text itself — which is the point when you want the content free of the formatting around it.`,
    });
  }

  if (['xlsx', 'xls', 'ods'].includes(from.id) && to.id === 'csv') {
    notes.push({
      heading: 'One sheet, values only',
      body: `A CSV is a single table of plain values. Formulas are replaced by the results they had calculated, and formatting, charts and any additional sheets have nowhere to go in the format. It travels everywhere in exchange for holding a good deal less.`,
    });
  }

  // Stated as a property of the formats rather than a promise about how many
  // files come back, which depends on the source and is not ours to guarantee.
  if (from.id === 'tiff' && to.category === 'image' && to.id !== 'tiff') {
    notes.push({
      heading: 'TIFF can hold more than one page',
      body: `A single ${F} may contain several pages, and a ${T} holds exactly one image. A multi-page ${F} therefore cannot be represented as one ${T} — each page needs a file of its own.`,
    });
  }

  // Fills the gap for pairs where nothing is lost and nothing is approximated,
  // which was previously silent: the reader still wants to know that.
  if (exact(fromProfile.kind) && exact(toProfile.kind)) {
    notes.push({
      heading: 'Nothing is lost in this step',
      body: `Both ${F} and ${T} store every pixel exactly, so this conversion changes the container rather than the content. What changes is file size and what will open it — convert freely, and as often as you like, without degrading anything.`,
    });
  }

  // WebP and AVIF can go either way, so the outcome is set by the quality
  // control rather than by the format. Claiming a specific default here would
  // be asserting behaviour this component cannot see.
  if (toProfile.kind === 'either' && from.category === 'image') {
    notes.push({
      heading: 'You choose how much to keep',
      body: `${T} can compress either lossily or losslessly, so the quality setting decides the outcome rather than the format. High quality stays close to the ${F} you started with; lower settings trade visible detail for a much smaller file.`,
    });
  }

  return notes;
}

function Panel({
  spec,
  profile,
}: {
  spec: FormatSpec;
  profile: FormatProfile;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="font-semibold">
        {spec.label}{' '}
        <span className="font-mono text-xs font-normal text-muted-foreground">
          .{spec.id}
        </span>
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {profile.what}
      </p>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Good for
      </p>
      <ul className="mt-1.5 space-y-1">
        {profile.strengths.map((item) => (
          <li
            key={item}
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Trade-offs
      </p>
      <ul className="mt-1.5 space-y-1">
        {profile.limits.map((item) => (
          <li
            key={item}
            className="text-sm leading-relaxed text-muted-foreground"
          >
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-4 font-mono text-xs text-muted-foreground">
        {spec.mime}
      </p>
    </div>
  );
}

export function FormatGuide({
  from,
  to,
}: {
  from: FormatSpec;
  to: FormatSpec;
}) {
  const fromProfile = profileFor(from.id);
  const toProfile = profileFor(to.id);

  // A format without a profile yet falls back to nothing rather than to filler.
  if (!fromProfile || !toProfile) return null;

  const F = from.id.toUpperCase();
  const T = to.id.toUpperCase();
  const notes = conversionNotes(from, to, fromProfile, toProfile);

  // Rows where neither side has anything to say are dropped, so audio pages do
  // not carry an empty transparency row.
  const rows = (
    [
      ['Compression', fromProfile.compression, toProfile.compression],
      ['Transparency', fromProfile.transparency, toProfile.transparency],
      ['Animation', fromProfile.animation, toProfile.animation],
      ['Typically used for', fromProfile.typicalUse, toProfile.typicalUse],
    ] as const
  ).filter(([, a, b]) => !(a === 'n/a' && b === 'n/a'));

  return (
    <>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <Panel spec={from} profile={fromProfile} />
        <Panel spec={to} profile={toProfile} />
      </div>

      <h3 className="mt-10 text-lg font-semibold tracking-tight">
        {F} and {T} side by side
      </h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <caption className="sr-only">
            {from.label} compared with {to.label}
          </caption>
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 pr-4 font-medium" />
              <th scope="col" className="py-2 pr-4 font-semibold">
                {F}
              </th>
              <th scope="col" className="py-2 font-semibold">
                {T}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, a, b]) => (
              <tr key={label} className="border-b align-top last:border-0">
                <th
                  scope="row"
                  className="py-2.5 pr-4 text-left font-medium text-muted-foreground"
                >
                  {label}
                </th>
                <td className="py-2.5 pr-4">{a}</td>
                <td className="py-2.5">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notes.length > 0 ? (
        <>
          <h3 className="mt-10 text-lg font-semibold tracking-tight">
            What changes when you convert {F} to {T}
          </h3>
          <div className="mt-4 space-y-5">
            {notes.map((note) => (
              <div key={note.heading}>
                <h4 className="text-sm font-semibold">{note.heading}</h4>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {note.body}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

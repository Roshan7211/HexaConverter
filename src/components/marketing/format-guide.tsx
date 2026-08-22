import type { FormatSpec } from '@/types';
import { conversionNotes } from '@/content/conversion-notes';
import { profileFor, type FormatProfile } from '@/content/format-profiles';

/**
 * The explanatory half of a conversion landing page.
 *
 * Three layers, in ascending order of how specific they are. The two format
 * panels describe each side on its own terms and repeat across every route
 * touching that format. The comparison table is assembled from the pair. The
 * notes below it belong to this conversion and no other — see
 * `@/content/conversion-notes` for the rules that derive them and for why a
 * page is allowed to say nothing rather than pad.
 *
 * Rendered on the server with no interactivity, so every word is in the HTML a
 * crawler receives rather than behind hydration.
 */

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

      {/* `break-all` because a MIME type is one unbreakable token, and the
          OOXML ones run to 73 characters. Without it the panel cannot shrink
          below that token's width, and every page featuring DOCX, XLSX, PPTX,
          ODS or ODP pushed a 320px screen sideways by around 27px. */}
      <p className="mt-4 break-all font-mono text-xs text-muted-foreground">
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

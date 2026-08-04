import Script from 'next/script';

/**
 * The AdSense tag.
 *
 * Rendered server-side from the requester's own plan, so a signed-in visitor
 * never receives the script at all — not hidden with CSS, not loaded and left
 * idle, simply absent from the document. Deciding this on the client would mean
 * shipping the tag to everyone and asking it not to run, which is both slower
 * and easy to get wrong.
 *
 * `afterInteractive` keeps it off the critical path: advertising must never
 * delay the converter becoming usable.
 *
 * Auto Ads are deliberately not enabled. Left to place units itself, AdSense
 * inserts them wherever it likes, at whatever height it likes, after the page
 * has already rendered — which is the single most common way a site destroys
 * its Cumulative Layout Shift. This site measures 0.0006, and the search
 * ranking of 214 landing pages depends on keeping it there, so units go in
 * deliberately chosen slots with reserved height instead.
 */
export function AdSenseScript({ client }: { client: string }) {
  return (
    <Script
      id="adsense"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
    />
  );
}

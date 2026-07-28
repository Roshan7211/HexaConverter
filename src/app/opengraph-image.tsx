import { ImageResponse } from 'next/og';

import { TOTAL_ROUTES } from '@/services/conversion/registry';
import { SITE } from '@/lib/seo';

/**
 * Default social sharing card, rendered at build time. Drawn entirely from
 * primitives so no external image or font is fetched.
 */

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background:
          'linear-gradient(135deg, #0b0b12 0%, #171733 55%, #241f4d 100%)',
        color: '#ffffff',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <div
          style={{
            width: 64,
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 18,
            background: 'linear-gradient(135deg, #fda50d, #fd5100)',
            fontSize: 34,
            fontWeight: 700,
          }}
        >
          H
        </div>
        <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.5 }}>
          HexaConverter
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Convert any file in seconds
        </div>
        {/* Satori requires a single text child unless the node is flex. */}
        <div
          style={{
            fontSize: 30,
            color: '#e8d9c8',
            maxWidth: 860,
            lineHeight: 1.4,
          }}
        >
          {`Documents, images, video, audio and archives — ${TOTAL_ROUTES}+ conversions, no watermarks, files deleted automatically.`}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 14 }}>
        {['PDF', 'DOCX', 'PNG', 'WEBP', 'MP4', 'MP3', 'ZIP'].map((label) => (
          <div
            key={label}
            style={{
              display: 'flex',
              padding: '10px 20px',
              borderRadius: 999,
              border: '1px solid #5a3a1e',
              fontSize: 24,
              color: '#f0dfcc',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>,
    size,
  );
}

/**
 * `heic-decode` ships no type declarations. It is only used as a fallback path
 * for HEIC input when the local libvips build lacks HEIF support, so the
 * surface we depend on is tiny.
 */
declare module 'heic-decode' {
  interface DecodeInput {
    buffer: Buffer | Uint8Array;
  }

  interface DecodedImage {
    width: number;
    height: number;
    /** Non-premultiplied RGBA, 8 bits per channel. */
    data: Uint8ClampedArray;
  }

  export default function decode(input: DecodeInput): Promise<DecodedImage>;
}

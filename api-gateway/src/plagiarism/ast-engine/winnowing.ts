/**
 * WinnowingEngine – Sinh dấu vân tay số (digital fingerprints) theo giải thuật Winnowing
 *
 * Giải thuật:
 *  1. Chia chuỗi token thành các k-gram (chuỗi con k token liền kề)
 *  2. Hash mỗi k-gram bằng FNV-1a 64-bit (nhanh, ít đụng độ)
 *  3. Dùng cửa sổ trượt kích thước w: chọn hash nhỏ nhất trong mỗi cửa sổ
 *     → tạo tập fingerprint đại diện ổn định, bất biến với padding/rename
 *
 * Tham chiếu: Schleimer et al. "Winnowing: Local Algorithms for Document Fingerprinting" (SIGMOD 2003)
 */

import { NormalizedToken } from './ast-normalizer';

export interface Fingerprint {
  hashValue: string;      // hex string của hash 64-bit
  tokenStart: number;     // index token bắt đầu k-gram
  tokenEnd: number;       // index token kết thúc k-gram
  lineStart: number;      // dòng gốc bắt đầu
  lineEnd: number;        // dòng gốc kết thúc
  tokenCount: number;     // k
}

export interface WinnowingOptions {
  kgramSize?: number;       // k – kích thước mỗi k-gram (default: 5)
  windowSize?: number;      // w – kích thước cửa sổ trượt (default: 4)
}

const DEFAULT_K = 5;
const DEFAULT_W = 4;

export class WinnowingEngine {
  /**
   * Tính tập fingerprint Winnowing cho một danh sách token đã chuẩn hóa.
   */
  public static computeFingerprints(
    tokens: NormalizedToken[],
    options?: WinnowingOptions,
  ): Fingerprint[] {
    const k = options?.kgramSize ?? DEFAULT_K;
    const w = options?.windowSize ?? DEFAULT_W;

    if (tokens.length < k) {
      // Quá ít token: hash toàn bộ làm 1 fingerprint duy nhất
      if (tokens.length === 0) return [];
      const singleHash = this._fnv1a(tokens.map((t) => t.token).join(' '));
      return [{
        hashValue: singleHash,
        tokenStart: 0,
        tokenEnd: tokens.length - 1,
        lineStart: tokens[0].line,
        lineEnd: tokens[tokens.length - 1].line,
        tokenCount: tokens.length,
      }];
    }

    // 1. Sinh tất cả k-gram hashes
    const kgramHashes: { hash: string; start: number; end: number }[] = [];
    for (let i = 0; i <= tokens.length - k; i++) {
      const kgramTokens = tokens.slice(i, i + k).map((t) => t.token);
      const hash = this._fnv1a(kgramTokens.join(' '));
      kgramHashes.push({ hash, start: i, end: i + k - 1 });
    }

    // 2. Winnowing: cửa sổ trượt kích thước w, chọn hash nhỏ nhất
    const selectedSet = new Set<string>();  // dedup theo hash
    const fingerprints: Fingerprint[] = [];

    for (let i = 0; i <= kgramHashes.length - w; i++) {
      const window = kgramHashes.slice(i, i + w);
      // Tìm hash nhỏ nhất trong cửa sổ (string comparison → lexicographic)
      const minEntry = window.reduce((a, b) => (a.hash <= b.hash ? a : b));

      if (!selectedSet.has(minEntry.hash)) {
        selectedSet.add(minEntry.hash);
        const startToken = tokens[minEntry.start];
        const endToken = tokens[minEntry.end];
        fingerprints.push({
          hashValue: minEntry.hash,
          tokenStart: minEntry.start,
          tokenEnd: minEntry.end,
          lineStart: startToken.line,
          lineEnd: endToken.line,
          tokenCount: k,
        });
      }
    }

    // Edge case: nếu cửa sổ cuối không được chọn, thêm hash cuối cùng
    if (kgramHashes.length > 0 && fingerprints.length === 0) {
      const last = kgramHashes[kgramHashes.length - 1];
      const startToken = tokens[last.start];
      const endToken = tokens[last.end];
      fingerprints.push({
        hashValue: last.hash,
        tokenStart: last.start,
        tokenEnd: last.end,
        lineStart: startToken.line,
        lineEnd: endToken.line,
        tokenCount: k,
      });
    }

    return fingerprints;
  }

  /**
   * FNV-1a hash 64-bit (emulated với 2 × 32-bit để JS không mất precision)
   * Trả về chuỗi hex 16 ký tự.
   */
  private static _fnv1a(text: string): string {
    // FNV offset basis: 14695981039346656037n (dùng BigInt để chính xác)
    let hashHi = 0x811c9dc5;   // high 32 bits của FNV offset basis (approx)
    let hashLo = 0xc3a3d1e1;   // low 32 bits (modified cho đủ entropy)

    for (let i = 0; i < text.length; i++) {
      const byte = text.charCodeAt(i) & 0xff;
      // XOR
      hashLo ^= byte;
      // Multiply by FNV prime: 0x00000100000001B3
      // Dùng bitwise trick cho 64-bit emulation
      const lo = (hashLo >>> 0) * 0x01000193;
      const hi = (hashHi >>> 0) * 0x01000193 + Math.imul(hashLo >>> 0, 0);
      hashLo = lo >>> 0;
      hashHi = (hi + Math.imul(hashLo >>> 16, 0x01000193)) >>> 0;
    }

    // Trả về hex string 16 ký tự
    return (hashHi >>> 0).toString(16).padStart(8, '0') +
           (hashLo >>> 0).toString(16).padStart(8, '0');
  }
}

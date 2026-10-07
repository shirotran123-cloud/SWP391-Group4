/**
 * Winnowing Core Algorithm Module - RBL Research Core (AITA Autograding Engine)
 *
 * Implements Schleimer, Wilkerson, & Aiken's Winnowing Algorithm for local document
 * fingerprinting. Chooses minimum hash values across a sliding window to form a compact,
 * position-sensitive fingerprint set of normalized AST tokens.
 *
 * Guarantees detection of matches >= k + w - 1 tokens long.
 */

import { NormalizedToken } from "./ast-normalizer";

export interface Fingerprint {
  hashValue: string;
  hashNumeric: bigint;
  lineStart: number;
  lineEnd: number;
  tokenStart: number;
  tokenEnd: number;
  tokenCount: number;
}

export interface WinnowingOptions {
  kGramSize?: number; // k = 15 by task spec default, configurable
  windowSize?: number; // w = 10 by task spec default, configurable
}

export class WinnowingEngine {
  public static readonly DEFAULT_K = 15;
  public static readonly DEFAULT_W = 10;

  /**
   * Generates Winnowing digital fingerprints from normalized AST tokens.
   */
  public static computeFingerprints(
    tokens: NormalizedToken[],
    options?: WinnowingOptions
  ): Fingerprint[] {
    if (tokens.length === 0) return [];

    let k = options?.kGramSize ?? this.DEFAULT_K;
    let w = options?.windowSize ?? this.DEFAULT_W;

    // Adaptive k & w sizing for short token sequences to preserve local fingerprint granularity
    if (tokens.length < k) {
      k = Math.max(3, Math.min(k, Math.floor(tokens.length / 2) || 1));
      w = Math.max(2, Math.min(w, Math.floor(k / 2) || 1));
    }

    if (tokens.length < k) {
      const hashStr = tokens.map((t) => t.token).join("_");
      const hashNum = this.fnv1a64(hashStr);
      return [
        {
          hashValue: hashNum.toString(16).padStart(16, "0"),
          hashNumeric: hashNum,
          lineStart: tokens[0].lineStart,
          lineEnd: tokens[tokens.length - 1].lineEnd,
          tokenStart: 0,
          tokenEnd: tokens.length - 1,
          tokenCount: tokens.length,
        },
      ];
    }

    // 1. Generate k-grams and their corresponding hash values & line bounds
    const kGrams: {
      hashValue: string;
      hashNumeric: bigint;
      lineStart: number;
      lineEnd: number;
      tokenStart: number;
      tokenEnd: number;
    }[] = [];

    for (let i = 0; i <= tokens.length - k; i++) {
      const windowTokens = tokens.slice(i, i + k);
      const tokenSequenceStr = windowTokens.map((t) => t.token).join(" ");
      const hashNumeric = this.fnv1a64(tokenSequenceStr);
      const hashValue = hashNumeric.toString(16).padStart(16, "0");

      kGrams.push({
        hashValue,
        hashNumeric,
        lineStart: windowTokens[0].lineStart,
        lineEnd: windowTokens[windowTokens.length - 1].lineEnd,
        tokenStart: i,
        tokenEnd: i + k - 1,
      });
    }

    // 2. Sliding window of size w over k-grams hash sequence
    const fingerprintsMap = new Map<string, Fingerprint>();
    const effectiveWindow = Math.min(w, kGrams.length);

    let minIndex = -1;

    for (let i = 0; i <= kGrams.length - effectiveWindow; i++) {
      let windowMinIndex = i;
      let minHash = kGrams[i].hashNumeric;

      for (let j = 1; j < effectiveWindow; j++) {
        const idx = i + j;
        if (kGrams[idx].hashNumeric <= minHash) {
          minHash = kGrams[idx].hashNumeric;
          windowMinIndex = idx;
        }
      }

      if (windowMinIndex !== minIndex) {
        minIndex = windowMinIndex;
        const selected = kGrams[minIndex];
        const key = `${selected.hashValue}_${selected.tokenStart}_${selected.tokenEnd}`;

        if (!fingerprintsMap.has(key)) {
          fingerprintsMap.set(key, {
            hashValue: selected.hashValue,
            hashNumeric: selected.hashNumeric,
            lineStart: selected.lineStart,
            lineEnd: selected.lineEnd,
            tokenStart: selected.tokenStart,
            tokenEnd: selected.tokenEnd,
            tokenCount: k,
          });
        }
      }
    }

    return Array.from(fingerprintsMap.values());
  }

  /**
   * Fast 64-bit FNV-1a non-cryptographic hash algorithm for k-grams
   */
  private static fnv1a64(str: string): bigint {
    let hash = 14695981039346656037n;
    const FNV_PRIME = 1099511628211n;

    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
    }

    return hash;
  }
}

export function splitTextGraphemes(text: string): string[] {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale?: string, options?: { granularity: string }) => {
    segment(value: string): Iterable<{ segment: string }>;
  } }).Segmenter;
  if (Segmenter) return Array.from(new Segmenter(undefined, { granularity: "grapheme" }).segment(text), part => part.segment);
  // Older Safari: retain combining marks and joined emoji at page boundaries.
  return Array.from(text).reduce<string[]>((result, char) => {
    const last = result[result.length - 1];
    if (last && (/^[\p{Mark}\uFE0F\u200D\u{1F3FB}-\u{1F3FF}]$/u.test(char) || last.endsWith("\u200D"))) result[result.length - 1] += char;
    else result.push(char);
    return result;
  }, []);
}


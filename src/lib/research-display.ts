/** Presentation only. Original text is always retained and available verbatim. */
export function researchDisplay(text: string) {
  const sentences = text
    .trim()
    .split(/(?<=[.!?])\s+(?=[A-Z])|\n+/)
    .filter(Boolean);
  const technical: string[] = [];
  const readable: string[] = [];
  for (const sentence of sentences) {
    // Keep mixed prose/formulas intact in details rather than silently dropping terms.
    const hasJson = /[\[{]\s*(?:"[^"\n]+"\s*:|\{)/.test(sentence);
    const hasFormula =
      /(?:\b(?:ceil|sqrt|log5|variance|logistic)\b[^.!?]*[=(*^]|[=^]|\d\s*[×*]\s*[\d(]|\b\w+\([^)]*\)\s*[+*/-])/.test(
        sentence,
      );
    (hasJson || hasFormula ? technical : readable).push(sentence);
  }
  const paragraphs: string[] = [];
  for (let i = 0; i < readable.length; i += 2)
    paragraphs.push(readable.slice(i, i + 2).join(" "));
  return { paragraphs, technical };
}

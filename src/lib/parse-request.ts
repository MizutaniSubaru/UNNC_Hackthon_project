function normalizeParseSection(value: string | null | undefined) {
  return (value ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function buildParseRequestText(input: {
  imageText?: string | null;
  text: string;
}) {
  const text = normalizeParseSection(input.text);
  const imageText = normalizeParseSection(input.imageText);

  if (text && imageText) {
    return `User request:\n${text}\n\nExtracted from image:\n${imageText}`;
  }

  return text || imageText;
}

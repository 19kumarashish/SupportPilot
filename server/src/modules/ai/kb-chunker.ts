export interface ArticleChunk {
  chunkIndex: number;
  heading: string | null;
  content: string;
  tokenCount: number;
}

const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

const MAX_TOKENS = 600;
const MIN_TOKENS = 50;
const OVERLAP_CHARS = 200; // ~50 tokens overlap

function splitBySections(body: string): Array<{ heading: string | null; content: string }> {
  const lines = body.split(/\r?\n/);
  const sections: Array<{ heading: string | null; content: string }> = [];
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  for (const line of lines) {
    const match = /^#{2,3}\s+(.+)$/.exec(line);
    if (match) {
      const content = currentLines.join("\n").trim();
      if (content.length > 0 || currentHeading !== null) {
        sections.push({ heading: currentHeading, content });
      }
      currentHeading = (match[1] ?? "").trim() || null;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  const trailing = currentLines.join("\n").trim();
  if (trailing.length > 0 || currentHeading !== null) {
    sections.push({ heading: currentHeading, content: trailing });
  }

  return sections;
}

function splitLargeText(text: string): string[] {
  const paragraphs = text.split(/\n\n+/);
  const parts: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) continue;

    const candidate = current ? `${current}\n\n${trimmed}` : trimmed;
    if (estimateTokens(candidate) <= MAX_TOKENS) {
      current = candidate;
      continue;
    }

    if (current) {
      parts.push(current);
      const overlap = current.slice(-OVERLAP_CHARS).trim();
      current = overlap ? `${overlap}\n\n${trimmed}` : trimmed;
    } else {
      current = trimmed;
    }

    while (estimateTokens(current) > MAX_TOKENS) {
      const maxChars = MAX_TOKENS * 4;
      const slice = current.slice(0, maxChars).trim();
      parts.push(slice);
      const overlap = slice.slice(-OVERLAP_CHARS).trim();
      const rest = current.slice(maxChars).trim();
      current = overlap && rest ? `${overlap} ${rest}` : rest;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

export function chunkArticle(title: string, body: string): ArticleChunk[] {
  const trimmedTitle = title.trim();
  const sections = splitBySections(body);
  const rawChunks: Array<{ heading: string | null; content: string }> = [];

  if (sections.length === 0) {
    return [
      {
        chunkIndex: 0,
        heading: null,
        content: trimmedTitle,
        tokenCount: estimateTokens(trimmedTitle),
      },
    ];
  }

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    if (!section) continue;
    const baseContent =
      i === 0 && section.heading === null
        ? [trimmedTitle, section.content].filter(Boolean).join("\n\n")
        : section.content || trimmedTitle;

    if (estimateTokens(baseContent) <= MAX_TOKENS) {
      rawChunks.push({ heading: section.heading, content: baseContent });
    } else {
      const parts = splitLargeText(baseContent);
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j];
        if (!part) continue;
        rawChunks.push({ heading: section.heading, content: part });
      }
    }
  }

  const merged: Array<{ heading: string | null; content: string }> = [];
  for (const chunk of rawChunks) {
    const prev = merged[merged.length - 1];
    if (prev && estimateTokens(chunk.content) < MIN_TOKENS && prev.heading === chunk.heading) {
      prev.content = `${prev.content}\n\n${chunk.content}`;
    } else {
      merged.push({ heading: chunk.heading, content: chunk.content });
    }
  }

  return merged.map((chunk, index) => ({
    chunkIndex: index,
    heading: chunk.heading,
    content: chunk.content,
    tokenCount: estimateTokens(chunk.content),
  }));
}

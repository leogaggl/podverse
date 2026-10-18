export type FaqSection = {
  body: string;
  title: string;
};

export type FaqLevel1Split = {
  preamble: string;
  sections: FaqSection[];
};

/**
 * Split managed FAQ markdown into a preamble and one section per level-1 heading.
 * A level-1 heading is a line that starts with `# `; `##` stays inside the section body.
 */
export function splitFaqLevel1Sections(markdown: string): FaqLevel1Split {
  const preambleLines: string[] = [];
  const sections: FaqSection[] = [];
  let current: { lines: string[]; title: string } | null = null;

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith('# ')) {
      const title = line.slice(2).trim();
      if (title !== '') {
        if (current !== null) {
          sections.push({ body: current.lines.join('\n').trim(), title: current.title });
        }
        current = { lines: [], title };
        continue;
      }
    }
    if (current === null) {
      preambleLines.push(line);
    } else {
      current.lines.push(line);
    }
  }

  if (current !== null) {
    sections.push({ body: current.lines.join('\n').trim(), title: current.title });
  }

  return {
    preamble: preambleLines.join('\n').trim(),
    sections,
  };
}

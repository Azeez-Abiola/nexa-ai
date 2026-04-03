import React from 'react';

// Parse and render markdown in text
export const parseMarkdown = (text: string) => {
  let parts: (string | React.ReactNode)[] = [];
  const lines = text.split('\n');
  
  lines.forEach((line, lineIdx) => {
    let processedLine: (string | React.ReactNode)[] = [];
    let lastIndex = 0;

    // Handle headers (###, ##, #) - render as bold inline text to avoid nesting issues
    const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      const headerText = headerMatch[2];
      const fontSizes = ['13px', '14px', '15px'];
      const fontSize = fontSizes[level - 1];
      
      if (lineIdx > 0) {
        parts.push(<br key={`br-before-${lineIdx}`} />);
      }
      parts.push(
        <span key={`header-${lineIdx}`} style={{ fontWeight: 'bold', fontSize, display: 'inline-block', marginBottom: '4px' }}>
          {headerText}
        </span>
      );
      if (lineIdx < lines.length - 1) {
        parts.push(<br key={`br-after-${lineIdx}`} />);
      }
      return;
    }

    // Handle markdown links [text](url) and plain URLs
    const linkRegex = /(\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s]+)/g;
    const linkMatches: Array<{ start: number; end: number; text: string; url: string }> = [];

    let match: RegExpExecArray | null;
    while ((match = linkRegex.exec(line)) !== null) {
      if (match[3]) {
        // Markdown link format
        linkMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[2],
          url: match[3]
        });
      } else if (match[1]) {
        // Plain URL
        linkMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[1],
          url: match[1]
        });
      }
    }

    // Handle bold **text**
    const boldRegex = /\*\*(.+?)\*\*/g;
    const boldMatches: Array<{ start: number; end: number; text: string }> = [];

    while ((match = boldRegex.exec(line)) !== null) {
      boldMatches.push({ start: match!.index, end: match!.index + match![0].length, text: match![1] });
    }

    // Handle italic *text* (that's not part of bold)
    const italicRegex = /(?<!\*)\*(.+?)(?<!\*)\*(?!\*)/g;
    const italicMatches: Array<{ start: number; end: number; text: string }> = [];

    while ((match = italicRegex.exec(line)) !== null) {
      // Skip if it overlaps with bold
      if (!boldMatches.some(b => match!.index >= b.start && match!.index < b.end)) {
        italicMatches.push({ start: match!.index, end: match!.index + match![0].length, text: match![1] });
      }
    }

    const allMatches = [...boldMatches, ...italicMatches, ...linkMatches].sort((a, b) => a.start - b.start);

    allMatches.forEach((m, idx) => {
      if (m.start > lastIndex) {
        processedLine.push(line.substring(lastIndex, m.start));
      }

      if (linkMatches.includes(m as any)) {
        const linkMatch = m as any;
        processedLine.push(
          <a key={`link-${lineIdx}-${idx}`} href={linkMatch.url} target="_blank" rel="noopener noreferrer">
            {linkMatch.text}
          </a>
        );
      } else if (boldMatches.some(b => b === m)) {
        processedLine.push(<strong key={`bold-${lineIdx}-${idx}`}>{m.text}</strong>);
      } else {
        processedLine.push(<em key={`italic-${lineIdx}-${idx}`}>{m.text}</em>);
      }

      lastIndex = m.end;
    });

    if (lastIndex < line.length) {
      processedLine.push(line.substring(lastIndex));
    }

    // Only add line if it has content
    if (processedLine.length > 0 && !(processedLine.length === 1 && processedLine[0] === '')) {
      if (lineIdx > 0) {
        parts.push(<br key={`br-${lineIdx}`} />);
      }
      parts.push(...processedLine);
    } else if (lineIdx > 0 && lineIdx < lines.length - 1) {
      // Add line break for empty lines to preserve spacing
      parts.push(<br key={`br-empty-${lineIdx}`} />);
    }
  });

  return parts.length === 0 ? text : parts;
};

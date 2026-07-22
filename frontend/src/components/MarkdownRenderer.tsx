import { JSX } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github-dark.css";

import classes from "./markdownRenderer.module.css";

interface MarkdownRendererProps {
  content: string;
}

// Renders a model's raw markdown output (headers, lists, tables, code
// blocks, links, etc.) instead of the previous regex-based partial parser.
export const MarkdownRenderer = ({ content }: MarkdownRendererProps): JSX.Element => {
  return (
    <div className={classes.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

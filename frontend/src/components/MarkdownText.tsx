import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// User-written markdown (build description, "How to Play" guide), with the
// GitHub extensions: tables, ~~strikethrough~~, task lists, bare URLs as links.
// Raw HTML is still not rendered (react-markdown's default).
export const MarkdownText: React.FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      // Wide tables scroll horizontally instead of breaking the layout on mobile
      table: ({ node: _node, ...props }) => (
        <div className="table-responsive">
          <table className="table table-dark table-sm table-bordered" {...props} />
        </div>
      ),
      a: ({ node: _node, ...props }) => <a target="_blank" rel="noopener noreferrer nofollow" {...props} />,
    }}
  >
    {children}
  </ReactMarkdown>
);

export default MarkdownText;

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, User, Copy, Check } from "lucide-react";

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ChatMessage({ role, content, timestamp }) {
  const isAI = role === "assistant";
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 ${isAI ? "animate-slide-left" : "animate-slide-right"} ${
        isAI ? "justify-start" : "justify-end"
      }`}
    >
      {/* AI Avatar */}
      {isAI && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl gradient-accent flex items-center justify-center mt-1 glow-accent-sm">
          <Bot size={15} className="text-white" />
        </div>
      )}

      {/* Bubble */}
      <div className="max-w-[75%] group">
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isAI
              ? "glass-card text-text-primary"
              : "gradient-accent text-white shadow-lg glow-accent-sm"
          }`}
        >
          {isAI ? (
            <div className="prose prose-sm prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-2 rounded-lg border border-white/5">
                      <table>{children}</table>
                    </div>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:text-accent-hover underline"
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : (
            <p>{content}</p>
          )}
        </div>

        {/* Meta row: timestamp + copy button */}
        <div
          className={`flex items-center gap-2 mt-1.5 px-1 ${isAI ? "" : "justify-end"}`}
        >
          <span className="text-[10px] text-text-muted">
            {timestamp ? formatTime(new Date(timestamp)) : ""}
          </span>
          {isAI && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200
                         p-1 rounded-md hover:bg-white/5 text-text-muted hover:text-text-secondary"
              title="Copy response"
            >
              {copied ? (
                <Check size={12} className="text-success" />
              ) : (
                <Copy size={12} />
              )}
            </button>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {!isAI && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl gradient-accent flex items-center justify-center mt-1 opacity-80">
          <User size={15} className="text-white" />
        </div>
      )}
    </div>
  );
}

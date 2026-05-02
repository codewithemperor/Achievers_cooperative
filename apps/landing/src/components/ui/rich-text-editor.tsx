"use client";

import { useEffect, useRef } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: number;
}

const actions = [
  { label: "Bold", command: "bold" },
  { label: "Italic", command: "italic" },
  { label: "Underline", command: "underline" },
  { label: "H2", command: "formatBlock", value: "<h2>" },
  { label: "P", command: "formatBlock", value: "<p>" },
  { label: "Bullets", command: "insertUnorderedList" },
  { label: "Numbered", command: "insertOrderedList" },
];

export function RichTextEditor({ value, onChange, minHeight = 260 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "<p></p>";
    }
  }, [value]);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-primary-900/12 bg-white">
      <div className="flex flex-wrap gap-2 border-b border-primary-900/8 bg-background-50/75 px-4 py-3">
        {actions.map((action) => (
          <button
            key={action.label}
            className="rounded-full border border-primary-900/12 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-900)]"
            onClick={() => {
              document.execCommand(action.command, false, action.value);
              onChange(editorRef.current?.innerHTML || "");
            }}
            type="button"
          >
            {action.label}
          </button>
        ))}
      </div>
      <div
        ref={editorRef}
        className="prose prose-sm max-w-none px-4 py-4 text-[var(--text-900)] outline-none"
        contentEditable
        onInput={() => onChange(editorRef.current?.innerHTML || "")}
        style={{ minHeight }}
        suppressContentEditableWarning
      />
    </div>
  );
}

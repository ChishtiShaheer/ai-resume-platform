import { useRef, useState } from "react";

export function FileDropzone({ onFiles, disabled }: { onFiles: (files: FileList) => void; disabled?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled && e.dataTransfer.files.length) onFiles(e.dataTransfer.files);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`rounded border-2 border-dashed p-10 text-center cursor-pointer transition ${
        dragging ? "border-signal bg-signal-light" : "border-line hover:border-slate/50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => e.target.files && onFiles(e.target.files)}
      />
      <p className="text-sm font-medium text-ink">Drop resumes here, or click to browse</p>
      <p className="text-xs text-slate mt-1">PDF or DOCX — multiple files supported — scanned PDFs are OCR'd automatically</p>
    </div>
  );
}

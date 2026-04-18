"use client";

interface AvatarUploadProps {
  currentUrl?: string;
  onUpload?: (file: File) => void;
  onRemove?: () => void;
}

export function AvatarUpload({ currentUrl, onUpload, onRemove }: AvatarUploadProps) {
  return (
    <div className="flex items-center gap-4 rounded-[1.5rem] border border-[rgba(26,46,26,0.12)] bg-white p-4">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[rgba(45,90,39,0.14)] text-sm font-semibold text-[var(--color-green)]">
        {currentUrl ? <img alt="Avatar preview" className="h-full w-full object-cover" src={currentUrl} /> : "Photo"}
      </div>
      <div className="space-y-2">
        <label className="inline-flex cursor-pointer rounded-full bg-[var(--color-green)] px-4 py-2 text-sm font-medium text-white">
          Upload avatar
          <input
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && onUpload) {
                onUpload(file);
              }
            }}
            type="file"
          />
        </label>
        {onRemove ? (
          <button
            className="block text-sm font-medium text-[var(--color-mid)]"
            onClick={onRemove}
            type="button"
          >
            Remove image
          </button>
        ) : null}
      </div>
    </div>
  );
}

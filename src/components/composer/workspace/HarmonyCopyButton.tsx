import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

export function HarmonyCopyButton({ text, label, iconOnly = false }: {
  text: string;
  label: string;
  iconOnly?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  };

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <span role="status" className="text-xs text-zinc-500 dark:text-zinc-400">
        {status === "copied" ? "Copied!" : status === "failed" ? "Unable to copy. Try again." : ""}
      </span>
      <Button type="button" variant="secondary" size="sm" iconOnly={iconOnly} onClick={copy} aria-label={label} title={label}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        {!iconOnly && "Copy"}
      </Button>
    </div>
  );
}

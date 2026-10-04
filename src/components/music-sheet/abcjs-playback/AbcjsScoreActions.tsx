import { Button } from "@/components/ui/Button";
interface AbcjsScoreActionsProps {
  allowPdfDownload: boolean;
  showExactRenderAbcCopy: boolean;
  isDownloadingPdf: boolean;
  copied: boolean;
  onDownloadPdf: () => void;
  onCopyAbc: () => void;
}

export function AbcjsScoreActions({ allowPdfDownload, showExactRenderAbcCopy, isDownloadingPdf, copied, onDownloadPdf, onCopyAbc }: AbcjsScoreActionsProps) {

  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Score actions">
      {allowPdfDownload && (
        <Button variant="ghost" size="sm" iconOnly type="button" onClick={onDownloadPdf} disabled={isDownloadingPdf} aria-busy={isDownloadingPdf}
          aria-label={isDownloadingPdf ? "Generating PDF..." : "Download PDF"} title={isDownloadingPdf ? "Generating PDF..." : "Download PDF"} >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" />
          </svg>
        </Button>
      )}
      {showExactRenderAbcCopy && (
        <Button variant="ghost" size="sm" iconOnly type="button" onClick={onCopyAbc} aria-label={copied ? "Copied ABCJS ABC" : "Copy ABCJS ABC"}
          title={copied ? "Copied ABCJS ABC" : "Copy ABCJS ABC"} >
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {copied ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4" /></>}
          </svg>
        </Button>
      )}
      <span role="status" className="sr-only">{copied ? "Copied ABCJS ABC" : isDownloadingPdf ? "Generating PDF..." : ""}</span>
    </div>
  );
}

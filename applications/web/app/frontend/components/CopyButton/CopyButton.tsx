import { useEffect, useId, useRef, useState } from "react";
import type { CopyButtonProps } from "../../contracts/ui";
import "./styles/index.scss";

const COPY_FEEDBACK = {
  idle: { buttonText: "Copy", statusMessage: "" },
  copying: { buttonText: "Copying…", statusMessage: "" },
  copied: { buttonText: "Copied", statusMessage: "Link copied to clipboard." },
  failed: {
    buttonText: "Copy",
    statusMessage: "Clipboard unavailable. Copy this link:",
  },
} as const;

export function CopyButton({ shortenedUrl }: CopyButtonProps) {
  const [copyState, setCopyState] =
    useState<keyof typeof COPY_FEEDBACK>("idle");
  const manualInputRef = useRef<HTMLInputElement>(null);
  const statusMessageId = useId();
  const isCopying = copyState === "copying";
  const isCopied = copyState === "copied";
  const requiresManualCopy = copyState === "failed";
  const { buttonText, statusMessage } = COPY_FEEDBACK[copyState];

  useEffect(() => {
    if (requiresManualCopy) {
      manualInputRef.current?.focus();
      manualInputRef.current?.select();
    }
  }, [requiresManualCopy]);

  async function copyToClipboard() {
    setCopyState("copying");
    try {
      await navigator.clipboard.writeText(shortenedUrl);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div
      className={`copy-control${requiresManualCopy ? " copy-control--manual" : ""}`}
    >
      <button
        type="button"
        className={`button button--secondary copy-control__button${isCopied ? " button--copied" : ""}`}
        aria-label={`Copy link ${shortenedUrl}`}
        disabled={isCopying}
        onClick={copyToClipboard}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          aria-hidden="true"
        >
          {isCopied ? (
            <path d="m5 12 4 4L19 6" />
          ) : (
            <>
              <rect x="8" y="8" width="12" height="12" rx="2" />
              <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
            </>
          )}
        </svg>
        {buttonText}
      </button>
      <p
        className={`copy-control__status${requiresManualCopy ? "" : " visually-hidden"}`}
        id={statusMessageId}
        role="status"
        aria-live="polite"
      >
        {statusMessage}
      </p>
      {requiresManualCopy && (
        <input
          ref={manualInputRef}
          className="copy-control__manual"
          aria-label="Link for manual copying"
          aria-describedby={statusMessageId}
          value={shortenedUrl}
          readOnly
          onFocus={(event) => event.currentTarget.select()}
          onClick={(event) => event.currentTarget.select()}
        />
      )}
    </div>
  );
}

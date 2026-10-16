import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Form } from "react-router";
import type { ShortenFormProps } from "../../contracts/ui";
import { ShortLinkResult } from "../ShortLinkResult/ShortLinkResult";
import "./styles/index.scss";

export function ShortenForm({ creationResult, isPending }: ShortenFormProps) {
  const [originalUrl, setOriginalUrl] = useState(
    creationResult?.submittedUrl ?? "",
  );
  const [isErrorDismissed, setIsErrorDismissed] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const errorMessage =
    !isPending && !isErrorDismissed ? creationResult?.error : undefined;
  const isUrlInvalid = Boolean(errorMessage && creationResult?.invalidUrl);

  useEffect(() => {
    if (!isPending && creationResult?.error) urlInputRef.current?.focus();
  }, [isPending, creationResult]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (isPending) {
      event.preventDefault();
      return;
    }
    setIsErrorDismissed(false);
  }

  function handleUrlChange(event: ChangeEvent<HTMLInputElement>) {
    setOriginalUrl(event.currentTarget.value);
    setIsErrorDismissed(true);
  }

  return (
    <section className="shortener" aria-labelledby="shortener-title">
      <h2 id="shortener-title" className="visually-hidden">
        Make a short link
      </h2>
      <Form
        method="post"
        className="shortener__form"
        aria-busy={isPending}
        onSubmit={handleSubmit}
      >
        <label className="shortener__label" htmlFor="original-url">
          Paste your link
        </label>
        <div className="shortener__controls">
          <input
            ref={urlInputRef}
            className={`shortener__input${isUrlInvalid ? " shortener__input--invalid" : ""}`}
            id="original-url"
            type="url"
            inputMode="url"
            name="url"
            value={originalUrl}
            onChange={handleUrlChange}
            placeholder="https://example.com/something-lovely"
            autoComplete="url"
            spellCheck={false}
            readOnly={isPending}
            required
            aria-invalid={isUrlInvalid || undefined}
            aria-describedby={`url-hint${errorMessage ? " url-error" : ""}`}
          />
          <button
            className="button button--primary"
            type="submit"
            disabled={isPending}
          >
            {isPending ? (
              <span className="button__spinner" aria-hidden="true" />
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
              >
                <path d="M8 12h8m-3-3 3 3-3 3M9 5H7a7 7 0 0 0 0 14h2m6-14h2a7 7 0 0 1 0 14h-2" />
              </svg>
            )}
            {isPending ? "Creating link…" : "Shorten link"}
          </button>
        </div>
        <p className="shortener__hint" id="url-hint">
          Up to 2,048 characters.
        </p>
        {errorMessage && (
          <p className="shortener__error" id="url-error" role="alert">
            {errorMessage}
          </p>
        )}
      </Form>
      <p className="visually-hidden" role="status" aria-live="polite">
        {isPending && "Creating your short link. Please wait."}
        {!isPending &&
          creationResult?.shortenedUrl &&
          "Your short link is ready below."}
      </p>
      {!isPending && creationResult?.shortenedUrl && (
        <ShortLinkResult
          key={creationResult.shortenedUrl}
          shortenedUrl={creationResult.shortenedUrl}
        />
      )}
    </section>
  );
}

import type { ShortLinkResultProps } from "../../contracts/ui";
import { CopyButton } from "../CopyButton/CopyButton";
import "./styles/index.scss";

export function ShortLinkResult({ shortenedUrl }: ShortLinkResultProps) {
  return (
    <section className="link-result" aria-labelledby="link-result-title">
      <h3 className="link-result__title" id="link-result-title">
        Ready to share.
      </h3>
      <div className="link-result__link">
        <a
          className="link-result__url"
          href={shortenedUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {shortenedUrl}
        </a>
        <CopyButton shortenedUrl={shortenedUrl} />
      </div>
    </section>
  );
}

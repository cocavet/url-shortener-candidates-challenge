import type { LinkRowProps } from "../../contracts/ui";
import { CopyButton } from "../CopyButton/CopyButton";
import "./styles/index.scss";

const creationDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const clickCountFormatter = new Intl.NumberFormat("en-GB");

export function LinkRow({ link }: LinkRowProps) {
  return (
    <li className="link-row">
      <div className="link-row__links">
        <a
          className="link-row__short"
          href={link.shortenedUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.shortenedUrl.replace(/^https?:\/\//, "")}
          <span aria-hidden="true"> ↗</span>
        </a>
        <a
          className="link-row__destination"
          href={link.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={link.originalUrl}
        >
          {link.originalUrl}
        </a>
      </div>
      <dl className="link-row__stats">
        <div>
          <dt className="visually-hidden">Created (UTC)</dt>
          <dd>
            <time dateTime={link.createdAt}>
              {creationDateFormatter.format(new Date(link.createdAt))}
            </time>
          </dd>
        </div>
        <div>
          <dt>Clicks</dt>
          <dd className="link-row__clicks">
            {clickCountFormatter.format(link.clickCount)}
          </dd>
        </div>
      </dl>
      <CopyButton shortenedUrl={link.shortenedUrl} />
    </li>
  );
}

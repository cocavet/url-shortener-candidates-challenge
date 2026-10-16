import type { LinkListProps } from "../../contracts/ui";
import { LinkRow } from "../LinkRow/LinkRow";
import "./styles/index.scss";

export function LinkList({ links }: LinkListProps) {
  return (
    <section className="link-list" aria-labelledby="link-list-title">
      <h2 className="link-list__heading" id="link-list-title">
        Shared links <span className="link-list__count">{links.length}</span>
      </h2>
      {links.length ? (
        <ul className="link-list__items">
          {links.map((link) => (
            <LinkRow key={link.code} link={link} />
          ))}
        </ul>
      ) : (
        <div className="link-list__empty">
          <span className="link-list__empty-mark" aria-hidden="true">
            ↗
          </span>
          <h3>No links yet</h3>
          <p>Make your first one above.</p>
        </div>
      )}
    </section>
  );
}

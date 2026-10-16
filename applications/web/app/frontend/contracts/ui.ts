import type { CreationResult, ListedLink } from "../../contracts/short-links";

export interface ShortenFormProps {
  creationResult?: CreationResult;
  isPending: boolean;
}

export interface ShortLinkResultProps {
  shortenedUrl: string;
}

export interface CopyButtonProps {
  shortenedUrl: string;
}

export interface LinkListProps {
  links: readonly ListedLink[];
}

export interface LinkRowProps {
  link: ListedLink;
}

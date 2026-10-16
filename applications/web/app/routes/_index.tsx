import { useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/_index";
import { createLink, listLinks } from "../server/links.server";
import { ShortenForm } from "../frontend/components/ShortenForm/ShortenForm";
import { LinkList } from "../frontend/components/LinkList/LinkList";

export function loader({ context }: Route.LoaderArgs) {
  return listLinks(context);
}

export function action({ request, context }: Route.ActionArgs) {
  return createLink(request, context);
}

export function headers({ actionHeaders }: Route.HeadersArgs) {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of ["Retry-After", "Allow", "Connection"]) {
    const value = actionHeaders.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}

export function meta() {
  return [
    { title: "Shortlink — URL shortener" },
    {
      name: "description",
      content: "Create short links and view their recorded clicks.",
    },
  ];
}

export default function Index({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isCreatingLink =
    navigation.state !== "idle" &&
    navigation.formMethod?.toUpperCase() === "POST";

  return (
    <div className="page">
      <a className="page__skip-link" href="#main">
        Skip to content
      </a>
      <main className="page__main" id="main" tabIndex={-1}>
        <h1 className="visually-hidden">URL shortener</h1>
        <ShortenForm creationResult={actionData} isPending={isCreatingLink} />
        <LinkList links={loaderData.links} />
      </main>
    </div>
  );
}

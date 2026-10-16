import type { Route } from "./+types/s.$code";
import { redirectLink } from "../server/links.server";

export function loader({ request, params, context }: Route.LoaderArgs) {
  return redirectLink(request, params.code, context);
}

export function action({ request, params, context }: Route.ActionArgs) {
  return redirectLink(request, params.code, context);
}

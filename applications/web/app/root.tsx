import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import type { Route } from "./+types/root";
import type { PropsWithChildren } from "react";
import "./frontend/app.scss";

export function Layout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Something went wrong.";
  let details = "We couldn’t load this page. Please try again.";

  if (isRouteErrorResponse(error)) {
    message =
      error.status === 404
        ? "This link wasn’t found."
        : "We couldn’t load your links.";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  }

  return (
    <main className="error-page">
      <p className="error-page__eyebrow">SHORTLINK</p>
      <h1>{message}</h1>
      <p>{details}</p>
      <a className="button button--primary" href="/">
        Back to shortener
      </a>
    </main>
  );
}

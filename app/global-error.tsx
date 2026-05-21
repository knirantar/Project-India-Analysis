"use client";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body>
        <main className="error-shell">
          <h1>Intelligence surface unavailable</h1>
          <p>{error.message || "The application hit an unexpected rendering error."}</p>
        </main>
      </body>
    </html>
  );
}

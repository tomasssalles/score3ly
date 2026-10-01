# score3ly
Convert printed musical scores into lilypond format (upgrade of score2ly).

## Development

Requires Node.js. Install dependencies once with `npm install`.

Run the app locally in two terminals:

```sh
npm run dev:worker   # API (Wrangler), http://localhost:8787
npm run dev:web      # UI (Vite), http://localhost:5173 — open this one
```

The Vite dev server forwards `/api` requests to Wrangler.

To deploy the app and API to Cloudflare as one Worker: `npm run deploy`.

## Evaluation

The test set and its tooling are described in [testset/README.md](testset/README.md).

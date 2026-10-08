# score3ly
Convert printed musical scores into lilypond format (upgrade of score2ly).

## Development

Requires Node.js. Install dependencies once with `npm install`.

Create or update the local database with `npm run migrate:local`. Run it once before the first start, and again whenever a file is added to `apps/worker/migrations/`.

Run the app locally in two terminals:

```sh
npm run dev:worker   # API (Wrangler), http://localhost:8787
npm run dev:web      # UI (Vite), http://localhost:5173 — open this one
```

The Vite dev server forwards `/api` requests to Wrangler.

Locally, Wrangler simulates the database (D1) and the PDF storage (R2) with files under `apps/worker/.wrangler/state/`. Nothing is sent to Cloudflare. To query the local database, run in `apps/worker`:

```sh
npx wrangler d1 execute score3ly --local --command "SELECT * FROM projects"
```

Run the tests with `npm test`.

To look at page images and skew detection on a PDF (writes each page as extracted, and as the pipeline would use it: straightened if staves were found and the angle matters):

```sh
npm run pages -w packages/imaging -- testset/bendel_la_cascade_p4.orig.pdf /tmp/pages
```

To cut named regions (systems, measures, details) out of page images, as `<name>.png` files, e.g. out of the straightened pages written by `npm run pages` (`{n}` stands for the page number):

```sh
npm run crops -w packages/imaging -- "/tmp/pages/page-{n}.straight.png" regions.json /tmp/crops
```

where `regions.json` maps names to a page (from 1) and a box: `{"system_1": {"page": 1, "bbox": {"left": 0.05, "right": 0.95, "top": 0.1, "bottom": 0.28}}}`.

To send one image and a question to a vision LLM with a real key:

```sh
ANTHROPIC_API_KEY=... npm run llm:try -w apps/worker -- anthropic claude-opus-5-5 page.png "How many systems are on this page?"
GEMINI_API_KEY=...    npm run llm:try -w apps/worker -- google <gemini model> page.png "How many systems are on this page?"
VERTEX_SERVICE_ACCOUNT=key.json VERTEX_REGION=eu npm run llm:try -w apps/worker -- anthropic-vertex claude-opus-5-5 page.png "How many systems are on this page?"
```

For Claude on Vertex AI, `VERTEX_SERVICE_ACCOUNT` is the path of a service account's key file (JSON), `VERTEX_REGION` the region (`eu` if left out), and `VERTEX_PROJECT` the project (the key file's if left out).

After changing the app icon (`apps/web/public/icon.svg`), make its PNG versions again with `npm run icons -- --force`.

To deploy the app and API to Cloudflare as one Worker: `npm run deploy`.

## Evaluation

The test set and its tooling are described in [testset/README.md](testset/README.md).

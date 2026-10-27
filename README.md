<p align="center"><img src="apps/web/public/icon.svg" width="128" alt="The score3ly logo"></p>

# score3ly
Convert printed musical scores into lilypond format (upgrade of score2ly).

## Docs

How score3ly works and why: [docs/overview.md](docs/overview.md), which lists the other docs.

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

### Desktop version

The same app runs on one computer, with everything stored locally (a SQLite database, a folder of files and a secrets file in the app's data folder):

```sh
npm run desktop   # builds the web app and opens it in an Electron window
npm run serve     # development helper: the same server without Electron, at http://127.0.0.1:8790 (data in ~/.score3ly)
```

The API keys go into the secrets file (Settings, "Open the secrets file"), one `NAME=value` per line. To install it as an app (built on your own computer, for macOS, Windows or Linux), see [apps/desktop/README.md](apps/desktop/README.md); in short: `npm run package:desktop`.

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
BEDROCK_API_KEY=... BEDROCK_REGION=eu-central-1 npm run llm:try -w apps/worker -- anthropic-bedrock <Bedrock model ID> page.png "How many systems are on this page?"
```

For Claude on Bedrock, `BEDROCK_API_KEY` is a Bedrock API key; instead, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` can give an access key pair. `BEDROCK_REGION` is the region (`eu-central-1` if left out), and the model is Bedrock's own ID for it. For Claude on Vertex AI, `VERTEX_SERVICE_ACCOUNT` is the path of a service account's key file (JSON), `VERTEX_REGION` the region (`eu` if left out), and `VERTEX_PROJECT` the project (the key file's if left out).

To see the app in every theme and at both widths without clicking through it, run `npm run screenshots`: it starts its own servers on a fresh database, runs a few projects with the fake model, and writes PNGs and a contact sheet (`index.html`) to `screenshots/`. It needs Playwright's Chromium: run `npx playwright install chromium` once.

After changing dependencies, make `THIRD_PARTY_NOTICES.md` again with `npm run notices` (a test fails while it is out of date).

After changing the app icon (`apps/web/public/icon.svg`), make its PNG versions again with `npm run icons -- --force`.

To deploy the app and API to Cloudflare as one Worker: `npm run deploy`.

## Evaluation

The test set and its tooling are described in [testset/README.md](testset/README.md).

## License

score3ly is licensed under the GNU Affero General Public License, version 3 or (at your option) any later version: see [LICENSE](LICENSE). Code, fonts and other material by others that its builds include are listed, with their licenses, in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

```text
score3ly: converts printed music scores into MEI, with vision LLMs.
Copyright (C) 2026  Tomás Silveira Salles

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
```

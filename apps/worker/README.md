# score3ly concerto: on Cloudflare

*concerto* is score3ly as a web app on your own Cloudflare account: open it from any browser, on a computer or a
phone, and continue where you left off. Cloudflare's free plans cover it; the LLM calls go to the provider you pick,
with your own API key, and are the only expected cost. Only you can open it: Cloudflare Access asks you to log in
first, with your Cloudflare account.

Setting it up takes about half an hour, once. The steps below are in the order that works; the Cloudflare dashboard
changes its labels from time to time, so a button may be called slightly differently.

## What you need

- **Node.js**, version 22.13 or newer (the current LTS version is fine): [nodejs.org](https://nodejs.org/).
- **The code:** on [GitHub](https://github.com/tomasssalles/score3ly), *Code* → *Download ZIP*, and unpack it (or
  `git clone https://github.com/tomasssalles/score3ly.git`). Open a terminal in that folder and run `npm install`.
- **An API key** of the LLM provider you want to use.

## 1. The Cloudflare account (in the dashboard)

1. **Create an account** at [dash.cloudflare.com](https://dash.cloudflare.com/sign-up). The free plan is enough.
   Cloudflare recommends turning on two-factor authentication; do, since this account will be the key to the app.
2. **Add a payment method:** *Billing* → *Subscriptions* → *Payment methods*. R2 and Zero Trust (next steps) require
   one, although you use them for free: R2's free tier is 10 GB of storage a month, with no fees for downloads, and
   Zero Trust's Free plan costs nothing.
3. **Subscribe to R2:** *Storage & databases* → *R2* → *Overview*, and complete the checkout.
4. **Choose your workers.dev subdomain:** *Workers & Pages*, then *Change* next to *Your subdomain*. It is one for
   the whole account, and the app's address will be `https://score3ly.<your subdomain>.workers.dev`, so pick
   something you don't mind being visible.
5. **Set up Zero Trust,** which Cloudflare Access belongs to: *Zero Trust* in the dashboard's menu. Choose a team name
   (an identifier of your own, e.g. your name; it isn't part of the app's address), then the **Free** plan; it asks
   for the payment details again, without charging anything.
6. **Make every Worker private:** *Workers & Pages*, the card *Protect all Workers* → *Enable Access*:
   - choose **All traffic** (not *Previews only*);
   - under *Authentication policy*, choose **Cloudflare account**: only members of your Cloudflare account, which is
     you, can open the app, by logging in with your Cloudflare account. (Not *Email domain* with a public domain like
     `gmail.com`: that would let in everyone with an address there.)
   - *Enable Access*, then *Apply Access*.

   This protects the Worker from the moment it is first deployed, including its preview addresses, so the app is
   never open to others.

## 2. Create the storage (in the terminal)

In the folder with the code:

```sh
npx wrangler login
npm run setup:cloudflare -w apps/worker -- --jurisdiction <jurisdiction>
```

- `wrangler login` opens a browser, where you log in to Cloudflare and allow Wrangler (Cloudflare's tool) to act on
  your account.
- The setup creates the database and the storage for the PDFs. **`--jurisdiction` says where your data is stored,
  and can't be changed later:**
  - `eu`: in the European Union.
  - `fedramp`: FedRAMP-certified data centres in the US (for US government work; Cloudflare Enterprise only).
  - `none`: wherever Cloudflare stores it.
- It writes `apps/worker/cloudflare.env`, with your database's id. Keep that file, and don't edit it: the deployment
  needs it, and the setup refuses to run again while it exists.

## 3. Deploy (in the terminal)

```sh
npm run deploy
```

It builds the app, prepares the database and uploads both. At the end it prints the app's address.

Try it: open the address in a private window. Cloudflare should ask you to log in before showing the app. If it shows
the app right away, step 1.6 is missing: do it now (or, for this Worker only: *Workers & Pages* → *score3ly* →
*Access* → *Protect this Worker behind Access*, with the same choices), and add no API keys until it asks.

## 4. Your API keys (in the dashboard)

*Workers & Pages* → *score3ly* → *Settings* → *Variables and Secrets* → *Add*. Choose the type **Secret** (not
*Text*), give it a name of your choice (e.g. `ANTHROPIC_API_KEY`) and paste the key. It takes effect within seconds,
without deploying again, and later deployments leave it as it is.

Then, in the app: *Settings* → *Model configs* → *+* (New model config), pick the provider and the model, and choose
your secret by its name.

(From the terminal instead: `npx wrangler secret put <NAME> -c apps/worker/wrangler.deploy.jsonc`, which asks for the
value.)

## Updating

Get the latest code (`git pull` on `main`, or download the ZIP again into the same folder, keeping
`apps/worker/cloudflare.env`), then:

```sh
npm install
npm run deploy
```

Your projects, settings and keys stay as they are.

## The files the setup makes

None of these is meant to be edited, and none is committed:
- `apps/worker/cloudflare.env`: your account's part (the jurisdiction and the database's id), written once by the
  setup.
- `apps/worker/wrangler.deploy.jsonc` and `apps/worker/wrangler.local-dev.jsonc`: Wrangler's configuration, made
  again from `apps/worker/wrangler.jsonc.template` each time it is used.

How and why it works this way: [docs/database.md](../../docs/database.md), "Deploying".

# score3ly cadenza: the desktop app

*cadenza* runs score3ly on your own computer: the app, its database and every file it makes stay there, and there is
no account to log into. (The LLM calls still go to the provider you pick, with your own API key.) You build the app
yourself from the code, once, which takes a few minutes and about 1 GB of downloads; after that it starts from its
icon like any other app.

## What you need

- **Node.js**, version 22.13 or newer (the current LTS version is fine): [nodejs.org](https://nodejs.org/).
- An internet connection while building.

## Build and install

1. **Get the code:** on [GitHub](https://github.com/tomasssalles/score3ly), *Code* → *Download ZIP*, and unpack it
   (or `git clone https://github.com/tomasssalles/score3ly.git`).
2. **Open a terminal in that folder** and run:

   ```sh
   npm install
   npm run package:desktop
   ```

   The result is in `apps/desktop/release/`.
3. **Install it**, the usual way for your system:
   - **macOS:** drag `score3ly cadenza.app` from `apps/desktop/release/mac-arm64/` (on an Intel Mac,
     `apps/desktop/release/mac/`) into *Applications*.
   - **Windows:** run `score3ly-cadenza-<version>-x64.exe` from `apps/desktop/release/`. It adds score3ly cadenza to
     the Start menu and the desktop.
   - **Linux (Debian, Ubuntu and the like):**
     `sudo apt install ./apps/desktop/release/score3ly-cadenza-<version>-amd64.deb`. It adds score3ly cadenza to the
     applications menu.
   - **Linux (Fedora, openSUSE and the like):** build an `.rpm` instead with `npm run package:rpm -w apps/desktop`
     (it needs `rpmbuild`, e.g. `sudo dnf install rpm-build`), then
     `sudo dnf install ./apps/desktop/release/score3ly-cadenza-<version>-x86_64.rpm`.

macOS and Windows don't warn about an app you built yourself: their warnings are for apps downloaded from the
internet.

## Your API keys

Open the app's *Settings*, then *Open the secrets file*: one `NAME=value` per line (the file explains it). Changes
take effect at once.

## Updating

Get the new code and repeat the steps above: the new version installs over the old one. Your projects stay.

## Where your data is

| System | Folder |
|---|---|
| macOS | `~/Library/Application Support/score3ly/` |
| Windows | `%APPDATA%\score3ly\` |
| Linux | `~/.config/score3ly/` |

It holds the database (`score3ly.sqlite`), the files (`files/`) and the secrets file (`secrets.env`). **Don't change
these files by hand:** projects that already ran can stop matching what is stored. Uninstalling the app leaves the
folder; delete it yourself for a clean slate (quit the app first, and keep `secrets.env` if you want your keys).

# Typography setup — مافيا المذخر v1.4

The typography is controlled by `public/theme.css`, without changing the game logic.

| Use | Typeface | Source |
|---|---|---|
| Large Arabic headlines | Retro Brush Arabic | Optional locally supplied file, **personal-use-only license** |
| Main buttons and role names | Lalezar | Google Fonts fallback, optionally local |
| Smaller secondary buttons | Digi Maryam | Optional locally supplied file |
| Long Arabic descriptions, rules and forms | Tajawal | Google Fonts |
| English text, room codes and credit | Outfit | Google Fonts |

## Supplying your own font files

Create or open `public/fonts/` in the extracted project. Copy the following files **from your originals** into that directory (the ZIP contains only the empty folder placeholder):

- `Digi-Maryam-Regular.ttf`
- `Lalezar-Regular-5.ttf` (optional; Lalezar also loads through Google Fonts)
- `retro-brush-arabic-personal-use-only.regular.otf` (ONLY when the appropriate website/web-embedding license permits your use)

The CSS detects the local font assets at those exact paths. If you do not supply them, it falls back to hosted Lalezar / Tajawal / Outfit and system fonts. This is intentional: the distribution ZIP does not redistribute uploaded font binaries.

**License note:** Retro Brush Arabic's embedded name expressly states *Personal Use Only*. Do not deploy/embed this font on a public or commercial game without verifying or obtaining the necessary license from the author. Digi Maryam does not contain a clear grant for web distribution, so verify its terms too. Lalezar's metadata references the SIL OFL.

### Easy future edits

Change the following CSS variables in `public/theme.css`: `--font-headline`, `--font-heading`, `--font-body`, `--font-button`, `--font-button-secondary`, and `--font-latin`.

For the version number, update `GAME_VERSION` in `public/app.js` and the version in `package.json`.

The gameplay server (`game-logic.js`, `server.js`) is unchanged in this release.

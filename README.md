# TEZZ — Terence Honeyford

Personal portfolio & CV site — static HTML/CSS/JS hosted on GitHub Pages.
Live: https://tezeroth.github.io/TEZZCV2026/

> **Handover notes for AI agents / LLMs** — read this before editing anything.
> It explains the architecture, the landmines, recent work and what's left to do.

## Pages

- `index.html` — main portfolio (web developer / WebXR / 3D). Theme system + Three.js gimbal hero background.
- `cv.html` — Curriculum Vitæ.
- `graphic-design-portfolio.html` — **still lorem-ipsum placeholder content** (see TODO).

## Running / testing

- Static site, no build step. Open the file directly or serve the folder:

  ```sh
  python -m http.server 8000
  ```

- JS libraries are vendored locally (`gsap.min.js`, `three.min.js`) so the site works over `file://` and offline.
- For layout verification the project has been audited with headless Chrome (DevTools Protocol); a quick smoke test is to load each page at 320 / 390 / 640 / 800 / 1024 / 1440 px and check for console errors and horizontal overflow.

## File map

| File | Purpose |
|---|---|
| `index.html` / `cv.html` / `graphic-design-portfolio.html` | Self-contained pages: inline `<style>`, inline scripts, JSON-LD in `<head>`. |
| `gsap.min.js` | GSAP (marquee ticker) — vendored, must stay local (see marquee rules). |
| `three.min.js` | Three.js r128 (UMD, MIT) — used by the hero gimbal. |
| `hero-gimbal.js` | Self-contained Three.js wireframe gyroscope (hero background). |
| `Assets/*.png` | Project thumbnails + `og-image.png` (1200×630 social card). |
| `favicon.svg`, `apple-touch-icon.png` | Favicons. |
| `robots.txt`, `sitemap.xml` | SEO. |

## Architecture & conventions (READ ME)

- **CSS is inline per page** (one `<style>` block each). The three pages share near-identical CSS — keep them in sync when editing.
- **Theme system**: `html[data-theme=...]` CSS variables (`--ink`, `--paper`, `--acid`, `--signal`, `--dim`, `--on-acid`, `--hover`, `--on-hover`). The theme toggle cycles themes; the default is `wipeout`. Use these variables for any new colour — never hard-coded hex — so the theme toggle keeps working on every theme.
- **Marquee (kinetic strips)**: GSAP-driven. A long comment in each page lists HARD RULES — do NOT replace with CSS keyframes, keep `flex: 0 0 auto` on `.marquee-chunk`, keep the JS clone/tween approach and the IntersectionObserver/resize/fonts gating. Violating this reintroduces a Chrome seam/blank-gap bug.
- **notranslate**: `<html lang="en" translate="no">` + `<meta name="google" content="notranslate">` on every page. Do NOT remove — auto-translate shreds the split-letter "TEZZ" wordmark and the stylised display type.
- **Responsive breakpoints**: 500 / 560 / 640 / 760 / 1020 / 1100 / 1240 px. Hero display type scales at ≤560px; the burger/mobile menu activates at ≤1020px; a tightened desktop header applies 1021–1240px; the brand wordmark hides at ≤500px.
- **Hero gimbal (`hero-gimbal.js`)**: transparent canvas behind hero text (`z-index:-1`, `pointer-events:none`). It reads the theme CSS variables and follows the theme toggle via `MutationObserver`. Adaptive positioning: at narrow/tablet widths it measures the hero's small mono text and parks the central core (and rings) clear of it, scaling down when the hero is too narrow to fit both; on light themes (paper/sky/earth/pastelpurple/sumi) the outer ring switches to the dark `--paper` colour because additive blending washes mid-tones out on light backgrounds. Performance guards: capped pixel ratio (1.5 low-power / 2 otherwise), fewer ring segments on low-power/touch, pauses rendering when off-screen or the tab is hidden, static frame for `prefers-reduced-motion`. Diagnostic handle `window.__HERO_GIMBAL__` exposes the renderer/scene/camera/assembly.
- **Headings**: exactly one `<h1>` per page (the brand wordmark in the header). Section titles are `<h2>`, sub-headings `<h3>`. Keep this hierarchy when adding content.
- **SEO**: canonical URLs, Open Graph, Twitter cards, JSON-LD (WebSite + Person on index, ProfilePage on CV, WebPage on the design page), `robots.txt`, `sitemap.xml`. Base URL is the GitHub Pages subpath `https://tezeroth.github.io/TEZZCV2026/`. Copy deliberately positions the owner as a freelance web developer building custom websites and web applications (booking systems, invoicing, e-commerce) plus WebXR — keep that messaging consistent and natural; no keyword-stuffing.

## Recent work (commit history)

- Mobile layout polish across all pages: hero display type scaling, project-card alignment, consistent section-header grid, burger-menu breakpoint raised to 1020px, header overflow fixes at 761–1230px, brand border fix.
- Three.js wireframe gyroscope hero background (added, refined, positioned, light-theme colour fix).
- Full SEO/technical pass: canonical/OG/Twitter/JSON-LD, robots.txt, sitemap.xml, single H1, favicons, descriptive asset filenames + lazy loading, copy updates (commit `d486461`).

## TODO / open items

1. **`graphic-design-portfolio.html` is still lorem-ipsum placeholder** — replace with real case studies. Until then, consider switching that page to `noindex` (currently `index, follow`) so a placeholder isn't promoted in search results.
2. Submit the sitemap in Google Search Console: `https://tezeroth.github.io/TEZZCV2026/sitemap.xml`.
3. The OG image (`Assets/og-image.png`) was generated from a branded template (dark bg, "T—H" mark, wipeout colours) at 1200×630 — regenerate if branding changes.
4. Run Lighthouse on all three pages after any significant change.
5. Booking / invoicing / e-commerce are currently service mentions in copy — dedicated project pages or demos would strengthen that positioning.

## Git notes

- Local restore-point tag `before-hero-gimbal` exists (state before the gimbal work) — reset to it with `git reset --hard before-hero-gimbal` if ever needed.
- Commit messages are descriptive and follow the "Summary: detail" style — keep that pattern.

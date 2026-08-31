# آکادمی تخصصی آلمانی سامان — Saman German Academy

A Persian-language (RTL) marketing homepage for a German-language teaching academy.

---

## Technology Stack

| Layer        | Technology                                     |
|--------------|------------------------------------------------|
| Markup       | Vanilla HTML5 (semantic, RTL)                  |
| Styling      | Vanilla CSS (custom properties / variables)    |
| Scripting    | Vanilla JavaScript (ES Modules)                |
| Animations   | GSAP 3.12 + ScrollTrigger plugin (CDN)         |
| Smooth Scroll| Lenis 1.1.2 (CDN)                              |
| Fonts        | Kalameh (self-hosted), Fraunces, JetBrains Mono (Google Fonts) |

No build step, no bundler, no framework. Open `index.html` directly in a browser.

---

## Project Structure

```
saman-academy/
│
├── index.html                  # Homepage — the only HTML file so far
│
├── css/
│   ├── tokens.css              # Design tokens: @font-face, :root variables
│   ├── base.css                # Reset, body, shared utilities (.teacher-underline, .main-container)
│   ├── components.css          # Reusable UI: .btn-cta, .btn-outline, .btn-dark-reserve
│   ├── background.css          # Interactive German-pattern grid styles
│   ├── header.css              # Floating pill header + mobile bottom sheet
│   ├── sections.css            # All homepage sections (hero, cinematic, features, info cards, placement)
│   ├── footer.css              # Footer layout + dynamic tab panel
│   └── responsive.css          # All @media queries in one file, ordered largest → smallest
│
├── js/
│   ├── main.js                 # Entry point — imports & calls all feature modules
│   ├── animations.js           # GSAP hero scroll, scroll-fade-up, Lenis cinematic
│   ├── mouse-grid.js           # Interactive background German pattern (flags + symbols)
│   ├── footer.js               # Footer tab switching with fade animation
│   └── mobile-menu.js          # Mobile hamburger + bottom sheet toggle
│
└── assets/
    ├── fonts/                  # Kalameh typeface (.ttf, 9 weights)
    └── images/                 # All site images with descriptive names
        ├── hero-bg.png
        ├── hero-character.png
        ├── kid-online-class.png
        ├── kid-self-study.png
        ├── placement-title.png
        ├── placement-level-1.png
        ├── placement-level-2.png
        ├── icon-left.png
        └── icon-right.png
```

---

## Installation & Running

No installation required. Open `index.html` in any modern browser.

For local development with a proper origin (required for `type="module"` JS):

```bash
# Python
python3 -m http.server 8080

# Node.js
npx serve .

# VS Code — install "Live Server" extension, then click "Go Live"
```

---

## CSS Architecture

CSS is split into **8 files**, loaded in the `<head>` in this order:

1. **tokens.css** — All `@font-face` declarations and `:root` custom properties. Change a colour or font once here to update it everywhere.
2. **base.css** — Reset (`*`), `body`, shared utility classes.
3. **components.css** — Reusable, page-agnostic UI components (buttons). Add new shared components here.
4. **background.css** — Styles for the interactive mouse-proximity grid.
5. **header.css** — The floating pill header, logo, nav, and mobile bottom sheet.
6. **sections.css** — All homepage section styles (hero, cinematic, features, info cards, placement banner, self-study).
7. **footer.css** — Footer-specific layout.
8. **responsive.css** — Every `@media` query in a single file, ordered `1400px → 991px → 768px → hover:none`.

### Adding styles for a new page

Create `css/pages/about.css` and link it **only** in `about.html`. Do not add page-specific styles to any of the shared files above.

---

## JavaScript Architecture

All JavaScript uses **ES Modules** (`type="module"` on the `<script>` tag in `index.html`). No globals, no inline scripts.

| File             | Responsibility                                                         |
|------------------|------------------------------------------------------------------------|
| `main.js`        | Imports all modules and calls their init functions on `DOMContentLoaded` |
| `animations.js`  | GSAP hero scroll transformation, `.scroll-fade-up` entrance, Lenis cinematic clip-path reveal |
| `mouse-grid.js`  | Builds and animates the full-screen German background pattern          |
| `footer.js`      | Footer tab switching with CSS class-based fade animation               |
| `mobile-menu.js` | Hamburger button ↔ bottom sheet toggle                                 |

### Key constants in mouse-grid.js

```js
const CELL_SIZE        = 95;   // px grid cell size
const PROXIMITY_RADIUS = 140;  // px mouse influence radius
```

---

## Animation Architecture

All animations live in `js/animations.js` and use **GSAP 3 + ScrollTrigger**.

### Hero Scroll Transformation (`initHeroScrollAnimation`)
- Fires only on `(min-width: 992px)` via `gsap.matchMedia()`.
- A 250vh scroll track pins the hero section.
- As the user scrolls: the card expands, the poster shrinks into a corner, the background/character images shift, and the content panel fades in.
- Uses `invalidateOnRefresh: true` so dimensions recalculate on window resize.

### Scroll Fade-Up (`initScrollFadeAnimations`)
- Any element with class `scroll-fade-up` will animate in (fade + rise 80px) when it enters the viewport.
- Easily extendable: just add `scroll-fade-up` to any new card or section.

### Cinematic Clip-Path Reveal (`initCinematicScroll`)
- Lenis is initialised here and wired to `ScrollTrigger.update` and `gsap.ticker`.
- The stacked benefit titles (`clip-title`) are hidden via `clip-path: inset(... 120%)` and revealed as the section scrolls into view.

---

## Naming Conventions

### CSS classes
- **BEM-lite**: block-component (`.feature-card`, `.feature-title`, `.feature-content`)
- **Section prefix**: `.hero-*`, `.footer-*`, `.placement-*`, `.online-class-*`, `.self-study-*`
- **Utility**: `.scroll-fade-up`, `.teacher-underline`
- **State**: `.active`, `.is-animating`, `.hovered`

### JavaScript
- `camelCase` for all variables and functions
- `init*` prefix for module initialiser functions
- `UPPER_SNAKE_CASE` for module-level constants
- Descriptive names: `gridItems`, `tabButtons`, `buildGrid`, `animateItems`, `switchTab`

---

## How to Add a New Page

1. Copy `index.html` → `about.html` (or whatever the page name is).
2. Remove homepage-specific sections (hero, features, info cards, etc.) from the copy.
3. Keep the `<head>` stylesheet links, header, footer, and script tags unchanged.
4. Create `css/pages/about.css` for page-specific styles and link it in `about.html`.
5. Create `js/about.js` for page-specific JS, import it from a new `js/pages/about-main.js`, and reference that in `about.html` as `<script type="module" src="js/pages/about-main.js"></script>`.
6. The global header, footer, background grid, and mobile menu will work automatically.

---

## How to Add a New Section

1. Write the HTML inside `<main class="main-container">` in the relevant HTML file.
2. Add section-specific CSS to `css/sections.css` (homepage) or to a page-specific CSS file.
3. Add `class="scroll-fade-up"` to the section's outer element for a free entrance animation.
4. If the section needs JS behaviour, add a function to the relevant JS file and call it from `main.js`.

---

## How to Add a New Reusable Component

1. Add the CSS to `css/components.css`.
2. Use the component's class name in any HTML file — no JS wiring needed for pure CSS components.
3. If the component needs JS, add it as an exported function in a new file under `js/` and import it in `main.js`.

---

## How to Add an Animation

### Scroll entrance: 
Add `class="scroll-fade-up"` to your element. Done — `initScrollFadeAnimations()` picks it up automatically.

### Custom GSAP animation:
Add your animation inside `js/animations.js` as a new exported function, then import and call it from `js/main.js`.

### CSS animation:
Define `@keyframes` and use it in `css/sections.css` (or a page file). The floating icon animations (`slow-float-left`, `slow-float-right`) in `sections.css` are a good reference.

---

## Where to Place Things

| What               | Where                                       |
|--------------------|---------------------------------------------|
| New images         | `assets/images/`                            |
| New fonts          | `assets/fonts/`                             |
| Shared CSS         | `css/components.css`                        |
| Homepage section CSS | `css/sections.css`                        |
| Other page CSS     | `css/pages/<page-name>.css`                 |
| Responsive rules   | `css/responsive.css`                        |
| Design tokens      | `css/tokens.css`                            |
| Shared JS          | `js/<feature>.js`                           |
| Page-specific JS   | `js/pages/<page>-main.js`                   |

---

## Important Development Notes

- **`type="module"`** — All `<script>` tags use ES Modules. Relative imports inside JS files must include the file extension (`.js`).
- **No bundler** — There is no Webpack/Vite/Rollup. The browser resolves imports natively. This means a local server is required (not `file://` protocol) when testing.
- **GSAP is a global** — GSAP is loaded via CDN `<script>` before the module scripts, so `gsap`, `ScrollTrigger`, and `Lenis` are available as global variables inside ES modules without importing them.
- **RTL layout** — `html[dir="rtl"]` and `body { direction: rtl }` are set globally. Keep this in mind when writing new CSS (e.g. `right` = visual start, `left` = visual end for Persian text).
- **CSS custom properties** — All colours, fonts, and radii live in `css/tokens.css`. Never hardcode colours directly in component or section CSS. Use `var(--token-name)`.

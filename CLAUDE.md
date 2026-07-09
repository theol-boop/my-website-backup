# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a static personal website for Theo Lebeaux — a creative technologist, musician, and artist. There is no build system, package manager, or framework. Files are plain HTML, CSS, and JavaScript served directly in the browser.

## Development

To preview the site, serve files with any static file server from the repo root:

```bash
# Python
python -m http.server 8080

# Node (if npx is available)
npx serve .
```

There are no lint, test, or compile steps.

## Architecture

### Shared Header Pattern
All pages use a consistent 3-column header structure:
```html
<header class="site-header">
  <div class="header-left">  <!-- back button here -->
  <div class="header-center"> <!-- logo -->
  <div class="header-right">  <!-- empty / future use -->
```
Use `<a href="javascript:history.back()" class="back-button">` for sub-pages, or a specific `href` when the destination is always the same page.

### Stylesheet Strategy
- `style.css` — shared across all pages (header, back button, icon grid, info boxes, common layout)
- Page-specific stylesheets (`music.css`, `art.css`) are added on top of `style.css`
- Some pages use inline `<style>` blocks for local overrides (e.g. `project-x.html`)

### Key Pages & Their Scripts

| Page | Script | Notes |
|------|--------|-------|
| `index.html` | `script.js` | Hover info boxes, red button easter egg (apocalypse sequence), animated comet |
| `music.html` | `music.js` | Tab navigation toggling `.active-section` on content sections |
| `art.html` | `art.js` | Click-to-expand gallery items using `expanded` class on `.art-item` |
| `utility.html` | inline JS | Canvas-based image pixelation tool ("imageMog") |
| `project-x.html` | `project-x-script.js` | Three.js shader/gradient experiment with slide layout |
| `three-sphere-experiment.html` | `sphere-script.js` | Three.js sphere with animated GIF texture via gifler library |

### External Libraries
Only used in specific experiment pages, loaded via CDN (no local copies):
- **Three.js** — `project-x.html`, `three-sphere-experiment.html`
- **gifler** — `three-sphere-experiment.html` (renders animated GIF frames onto a canvas as a Three.js texture)

### Homepage (`index.html` + `script.js`)
The homepage uses an `.icon-grid` of clickable icons. Some icons trigger hover popups (`.info-box` elements positioned via JS using `getBoundingClientRect`). The red button icon has a multi-click "apocalypse sequence" that hides the page and plays an animation.

### Art Gallery (`art.html` + `art.css` + `art.js`)
Gallery items use a two-state pattern: default thumbnail (`.preview`) and expanded full image (`.full-image-container`). Only one item can be expanded at a time, enforced via a `gallery-active` class on `<body>`.

### Utility Page (`utility.html`)
The image pixelation tool ("imageMog") uses two `<canvas>` elements side-by-side — one for the original and one for the pixelated output. All logic is inline JS within the HTML file.

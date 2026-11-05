'use strict';

/** Page shell CSS for /ports/index.html — shared by regenerate-ports-index.js and generateBlogs --ports-only. */
const PORTS_DIRECTORY_PAGE_SHELL_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --dark-bg: #0a0a0a; --neon-red: #FF0033; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: var(--dark-bg); color: white; line-height: 1.6; overflow-x: hidden; }
.starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); overflow: hidden; }
.star { position: absolute; width: 2px; height: 2px; background: rgba(255,255,255,0.5); border-radius: 50%; animation: twinkle 3s infinite ease-in-out; }
@keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
.grid-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; background-image: linear-gradient(rgba(255, 0, 51, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 0, 51, 0.02) 1px, transparent 1px); background-size: 100px 100px; opacity: 0.4; pointer-events: none; }
.content-layer { position: relative; z-index: 10; }
/* Header chrome owned by /assets/css/site-shell.css — do not override position here. */
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.footer { padding: 60px 0 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; background: #050505; }
/* Footer column layout is owned by /assets/css/site-shell.css — do not reintroduce auto-fit here. */
.footer-bottom { padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); font-size: 14px; }
img { transition: filter 0.35s ease, transform 0.35s ease; }
img.img-loading { filter: blur(8px); transform: scale(1.03); }
`;

module.exports = { PORTS_DIRECTORY_PAGE_SHELL_STYLES };

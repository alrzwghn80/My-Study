/**
 * main.js
 * Entry point — imports all feature modules and initialises them
 * once the DOM is ready.
 *
 * Execution order matters for GSAP / ScrollTrigger timing:
 *   1. Mouse grid (no GSAP dependency)
 *   2. Hero scroll animation (registers ScrollTrigger)
 *   3. Scroll fade animations (uses ScrollTrigger)
 *   4. Cinematic scroll (initialises Lenis + wires to ScrollTrigger)
 *   5. Footer tabs (pure DOM)
 *   6. Mobile menu (pure DOM)
 */

import { initMouseGrid }            from './mouse-grid.js';
import { initHeroScrollAnimation,
         initScrollFadeAnimations,
         initCinematicScroll }      from './animations.js';
import { initFooterTabs }           from './footer.js';
import { initMobileMenu }           from './mobile-menu.js';

document.addEventListener('DOMContentLoaded', () => {
    initMouseGrid();
    initHeroScrollAnimation();
    initScrollFadeAnimations();
    initCinematicScroll();
    initFooterTabs();
    initMobileMenu();
});

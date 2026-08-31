/**
 * animations.js
 * All GSAP and ScrollTrigger animations for the homepage.
 *
 * Three sections:
 *  1. initHeroScrollAnimation  — pinned hero card transformation on scroll
 *  2. initScrollFadeAnimations — generic .scroll-fade-up card entrance
 *  3. initCinematicScroll      — Lenis smooth scroll + clip-path title reveal
 */

/* ─── 1. HERO PINNED SCROLL TRANSFORMATION ─────────────────────────────── */

/**
 * On desktop (≥ 992px) the hero card expands and reveals its content panel
 * as the user scrolls through the 250vh scroll track.
 */
export function initHeroScrollAnimation() {
    gsap.registerPlugin(ScrollTrigger);

    const heroTrack      = document.getElementById('heroPinnedScrollTrack');
    const heroSection    = document.getElementById('heroTransformationContent');
    const visualCard     = document.getElementById('heroVisualCard');
    const unifiedPoster  = document.getElementById('unifiedPosterContainer');
    const contentPanel   = document.getElementById('heroContentPanel');
    const bgLayer        = document.getElementById('heroBgLayer');
    const characterLayer = document.getElementById('heroCharacterLayer');

    if (!heroTrack || !heroSection || !visualCard || !unifiedPoster || !contentPanel) return;

    // Responsive target dimensions (computed fresh on each resize via GSAP callbacks)
    const getTargetCardWidth   = () => { if (window.innerWidth > 1750) return "1700px"; if (window.innerWidth > 1400) return "1350px"; return "950px"; };
    const getTargetCardHeight  = () => { if (window.innerWidth > 1750) return "750px";  if (window.innerWidth > 1400) return "600px";  return "440px"; };
    const getTargetPosterSize  = () => { if (window.innerWidth > 1750) return "670px";  if (window.innerWidth > 1400) return "520px";  return "360px"; };
    const getTargetPosterOffset = () => "40px";

    const matchMedia = gsap.matchMedia();

    matchMedia.add("(min-width: 992px)", () => {
        const transformationTl = gsap.timeline({
            scrollTrigger: {
                trigger:    heroTrack,
                start:      "top top",
                end:        "bottom bottom",
                scrub:      true,
                pin:        heroSection,
                pinType:    "fixed",
                pinSpacing: true,
                invalidateOnRefresh: true,
            }
        });

        // Small buffer at the start before the card begins transforming
        transformationTl.to({}, { duration: 0.1 });

        // Card expands
        transformationTl.fromTo(visualCard,
            { width: () => visualCard.offsetWidth + "px", height: () => visualCard.offsetHeight + "px", borderRadius: "40px" },
            { width: getTargetCardWidth, height: getTargetCardHeight, borderRadius: "36px", duration: 0.7, ease: "power2.inOut" },
            0.1
        );

        // Poster shrinks and moves to a corner
        transformationTl.fromTo(unifiedPoster,
            { width: () => unifiedPoster.offsetWidth + "px", height: () => unifiedPoster.offsetHeight + "px", top: "0px", right: "0px", borderRadius: "40px" },
            { width: getTargetPosterSize, height: getTargetPosterSize, top: getTargetPosterOffset, right: getTargetPosterOffset, borderRadius: "24px", duration: 0.7, ease: "power2.inOut" },
            0.1
        );

        // Background image shifts and scales
        transformationTl.fromTo(bgLayer,
            { objectPosition: "50% 50%", scale: 1 },
            { objectPosition: "28% 50%", scale: 1.12, duration: 0.7, ease: "power2.inOut" },
            0.1
        );

        // Character image repositions
        transformationTl.fromTo(characterLayer,
            { objectPosition: "50% 100%", scale: 0.95 },
            { objectPosition: "72% 100%", scale: 0.88, duration: 0.7, ease: "power2.inOut" },
            0.1
        );

        // Content panel fades in from the right
        transformationTl.fromTo(contentPanel,
            { opacity: 0, x: 60, scale: 0.95 },
            { opacity: 1, x: 0, scale: 1, pointerEvents: "auto", duration: 0.5, ease: "power2.out" },
            0.25
        );

        // Small buffer at the end
        transformationTl.to({}, { duration: 0.2 });

        // Cleanup on breakpoint exit
        return () => {
            gsap.set([visualCard, unifiedPoster, contentPanel, bgLayer, characterLayer], { clearProps: "all" });
        };
    });

    // Ensure ScrollTrigger recalculates after all assets have loaded
    window.addEventListener('load', () => { ScrollTrigger.refresh(); });
}


/* ─── 2. GENERIC SCROLL FADE-UP (for .scroll-fade-up elements) ─────────── */

/**
 * Any element with class `scroll-fade-up` will fade in and rise from below
 * when it enters the viewport. Add this class to new cards/sections as needed.
 */
export function initScrollFadeAnimations() {
    gsap.utils.toArray('.scroll-fade-up').forEach(element => {
        gsap.from(element, {
            scrollTrigger: {
                trigger:       element,
                start:         "top 85%",
                toggleActions: "play none none reverse",
            },
            y:        80,
            opacity:  0,
            duration: 1,
            ease:     "power3.out",
        });
    });
}


/* ─── 3. CINEMATIC SCROLL (Lenis + clip-path title reveal) ─────────────── */

/**
 * Initialises Lenis smooth scrolling and wires it into GSAP/ScrollTrigger.
 * Also drives the clip-path reveal animation on the benefit titles.
 */
export function initCinematicScroll() {
    const lenis = new Lenis({ smoothWheel: true, syncTouch: true });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // Clip-path reveal for stacked benefit titles
    const benefitTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: '.title-group',
            start:   'top 85%',
            end:     'bottom 45%',
            scrub:   1.5,
        }
    });
    benefitTimeline.to('.clip-title', {
        clipPath: 'inset(-40% -20% -40% -20%)',
        stagger:  0.25,
        ease:     'power3.inOut',
    });
}

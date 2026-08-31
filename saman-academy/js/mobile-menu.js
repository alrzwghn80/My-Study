/**
 * mobile-menu.js
 * Handles the mobile hamburger button and bottom-sheet slide-up menu.
 */

export function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const bottomSheet   = document.getElementById('mobileBottomSheet');
    const sheetOverlay  = document.getElementById('mobileSheetOverlay');

    if (!mobileMenuBtn || !bottomSheet || !sheetOverlay) return;

    const toggleSheet = () => {
        bottomSheet.classList.toggle('active');
        sheetOverlay.classList.toggle('active');
    };

    mobileMenuBtn.addEventListener('click', toggleSheet);
    sheetOverlay.addEventListener('click', toggleSheet);

    // Close sheet when any navigation link inside is tapped
    bottomSheet.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', toggleSheet);
    });
}

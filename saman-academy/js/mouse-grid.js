/**
 * mouse-grid.js
 * Creates and animates the interactive German-pattern background grid.
 * Items (flags and text symbols) react to mouse proximity with a
 * scale, opacity, and color highlight effect.
 */

export function initMouseGrid() {
    const gridBg = document.getElementById('mouseGridBg');
    if (!gridBg) return;

    const CELL_SIZE      = 95;
    const PROXIMITY_RADIUS = 140;
    const GERMAN_SYMBOLS = ['Ä', 'Ö', 'Ü', 'ä', 'ö', 'ü', 'ß'];
    const GERMAN_ARTICLES = ['der', 'die', 'das'];

    let gridItems = [];
    let rAF       = null;
    let mouseX    = -1000;
    let mouseY    = -1000;

    /** Build (or rebuild) the full grid of flag + text items. */
    const buildGrid = () => {
        gridBg.innerHTML = '';
        gridItems = [];

        const viewportWidth  = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const cols = Math.ceil(viewportWidth  / CELL_SIZE) + 2;
        const rows = Math.ceil(viewportHeight / CELL_SIZE) + 2;

        const fragment = document.createDocumentFragment();

        for (let col = -1; col <= cols; col++) {
            for (let row = -1; row <= rows; row++) {

                const rowOffset = (row % 2 === 0) ? 0 : (CELL_SIZE / 2);
                const jitterX   = (Math.random() - 0.5) * 45;
                const jitterY   = (Math.random() - 0.5) * 45;

                const posX = (col * CELL_SIZE) + rowOffset + jitterX;
                const posY = (row * CELL_SIZE) + jitterY;

                const wrapper = document.createElement('div');
                wrapper.className = 'pattern-wrapper';
                wrapper.style.left = `${posX}px`;
                wrapper.style.top  = `${posY}px`;

                const rotation = (Math.random() * 60) - 30;
                const isFlag   = Math.random() > 0.55;

                let child;
                let baseOpacity;

                if (isFlag) {
                    child = document.createElement('div');
                    child.className = 'de-flag';
                    const flagWidth  = 16 + Math.random() * 12;
                    const flagHeight = flagWidth * 0.6;
                    child.style.width  = `${flagWidth}px`;
                    child.style.height = `${flagHeight}px`;
                    wrapper.dataset.type = 'flag';
                    baseOpacity = 0.03;
                } else {
                    child = document.createElement('div');
                    child.className = 'de-text';
                    const useWord = Math.random() > 0.75;
                    if (useWord) {
                        child.textContent = GERMAN_ARTICLES[Math.floor(Math.random() * GERMAN_ARTICLES.length)];
                        child.style.fontSize = `${12 + Math.random() * 3}px`;
                    } else {
                        child.textContent = GERMAN_SYMBOLS[Math.floor(Math.random() * GERMAN_SYMBOLS.length)];
                        child.style.fontSize = `${15 + Math.random() * 6}px`;
                    }
                    wrapper.dataset.type = 'text';
                    baseOpacity = 0.06;
                }

                wrapper.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(1)`;
                child.style.opacity     = baseOpacity;

                wrapper.appendChild(child);
                fragment.appendChild(wrapper);

                gridItems.push({
                    el:      wrapper,
                    child,
                    posX,
                    posY,
                    rot:     rotation,
                    type:    isFlag ? 'flag' : 'text',
                    baseOp:  baseOpacity,
                });
            }
        }

        gridBg.appendChild(fragment);
    };

    /** rAF loop: update each item based on its distance to the mouse. */
    const animateItems = () => {
        rAF = requestAnimationFrame(animateItems);

        gridItems.forEach(item => {
            const dx = mouseX - item.posX;
            const dy = mouseY - item.posY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < PROXIMITY_RADIUS) {
                const progress = 1 - (distance / PROXIMITY_RADIUS);
                const isHover  = distance < PROXIMITY_RADIUS * 0.4;
                const maxScale = item.type === 'flag' ? (1.15 + Math.random() * 0.1) : 1.1;
                const scale    = 1 + ((maxScale - 1) * progress);
                const targetOpacity = item.baseOp + ((1 - item.baseOp) * progress * (item.type === 'flag' ? 0.4 : 0.8));

                item.el.style.transform    = `translate(-50%, -50%) rotate(${item.rot}deg) scale(${scale})`;
                item.child.style.opacity   = targetOpacity;
                item.child.classList.toggle('hovered', isHover);
            } else {
                item.el.style.transform  = `translate(-50%, -50%) rotate(${item.rot}deg) scale(1)`;
                item.child.style.opacity = item.baseOp;
                item.child.classList.remove('hovered');
            }
        });
    };

    const handleMouseMove = (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        if (!rAF) animateItems();
    };

    const handleMouseLeave = () => {
        mouseX = -1000;
        mouseY = -1000;
        if (rAF) { cancelAnimationFrame(rAF); rAF = null; }
        gridItems.forEach(item => {
            item.el.style.transform  = `translate(-50%, -50%) rotate(${item.rot}deg) scale(1)`;
            item.child.style.opacity = item.baseOp;
            item.child.classList.remove('hovered');
        });
    };

    buildGrid();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
}

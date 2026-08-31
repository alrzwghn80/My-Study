/**
 * footer.js
 * Handles the interactive footer tab buttons.
 * On hover or click, the content panel fades out, swaps text, then fades back in.
 */

const FOOTER_CONTENT = {
    about:   'لورم ایپسوم متن ساختگی با تولید سادگی نامفهوم از صنعت چاپ، و با استفاده از طراحان گرافیک است، چاپگرها و متون بلکه روزنامه و مجله در ستون و سطرآنچنان که لازم است، و برای شرایط فعلی تکنولوژی مورد نیاز، و کاربردهای متنوع با هدف',
    team:    'در این بخش اطلاعات مربوط به اعضای تیم آکادمی سامان قرار خواهد گرفت. ما تیمی از متخصصان آموزش زبان آلمانی هستیم که برای موفقیت و رسیدن به اهداف شما در کنارتان تلاش می‌کنیم.',
    contact: 'راه‌های ارتباطی با آکادمی: تلفن، ایمیل، تلگرام و پشتیبانی سایت. در اینجا می‌توانید در آینده آدرس دقیق دفتر مرکزی و شماره‌های تماس را به راحتی جایگذاری کنید.',
};

export function initFooterTabs() {
    const tabButtons      = document.querySelectorAll('.footer-btn');
    const dynamicText     = document.getElementById('footerDynamicText');
    const infoBox         = document.getElementById('footerInfoBox');

    if (!tabButtons.length || !dynamicText || !infoBox) return;

    const switchTab = (btn) => {
        if (btn.classList.contains('active')) return;

        const targetKey = btn.getAttribute('data-target');

        // Animate out
        infoBox.classList.add('is-animating');

        setTimeout(() => {
            dynamicText.innerText = FOOTER_CONTENT[targetKey] ?? '';
            infoBox.classList.remove('is-animating');
        }, 300);

        tabButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('mouseenter', () => switchTab(btn));
        btn.addEventListener('click',      () => switchTab(btn));
    });
}

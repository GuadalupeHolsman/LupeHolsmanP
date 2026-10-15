/* Lupe Holsman — shared site behaviour.
   Every page loads js/i18n.js first, then this file. */
(function () {
    'use strict';

    const root = document.documentElement;
    root.classList.add('js');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Storage can throw (private mode, blocked cookies); never let that break the page.
    const store = {
        get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
        set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
    };

    /* ── Language ─────────────────────────────────────────────────────── */
    const dict = window.I18N || {};
    const lookup = (lang, key) =>
        key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), dict[lang]);

    function applyLang(lang) {
        if (!dict[lang]) return;
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const v = lookup(lang, el.dataset.i18n);
            if (v === null) return;
            if (/[<&]/.test(v)) el.innerHTML = v; else el.textContent = v;
        });
        [['data-i18n-placeholder', 'placeholder'], ['data-i18n-aria', 'aria-label'], ['data-i18n-alt', 'alt'], ['data-i18n-content', 'content']]
            .forEach(([attr, prop]) => {
                document.querySelectorAll('[' + attr + ']').forEach(el => {
                    const v = lookup(lang, el.getAttribute(attr));
                    if (v !== null) el.setAttribute(prop, v);
                });
            });
        root.lang = lang;
        document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
            const other = lang === 'es' ? 'en' : 'es';
            btn.textContent = other.toUpperCase();
            btn.setAttribute('aria-label', lookup(lang, 'common.switchLang') || 'Switch language');
            btn.dataset.next = other;
        });
    }

    const saved = store.get('lupe-lang');
    const browserLang = (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
    let lang = saved || browserLang;
    applyLang(lang);

    document.querySelectorAll('[data-lang-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            lang = btn.dataset.next || (lang === 'es' ? 'en' : 'es');
            store.set('lupe-lang', lang);
            applyLang(lang);
        });
    });

    const t = key => lookup(lang, key) || lookup('en', key) || '';

    /* ── Header ───────────────────────────────────────────────────────── */
    const header = document.querySelector('.site-header');
    const onScroll = () => header && header.classList.toggle('is-scrolled', window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* ── Mobile drawer ────────────────────────────────────────────────── */
    const toggle = document.querySelector('.menu-toggle');
    const drawer = document.getElementById('drawer');
    if (toggle && drawer) {
        const setOpen = open => {
            toggle.setAttribute('aria-expanded', String(open));
            toggle.setAttribute('aria-label', t(open ? 'common.closeMenu' : 'common.openMenu'));
            drawer.classList.toggle('is-open', open);
            drawer.inert = !open;
            document.body.classList.toggle('drawer-open', open);
            if (open) {
                const first = drawer.querySelector('a, button');
                if (first) first.focus();
            }
        };
        drawer.inert = true;
        toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
        drawer.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && drawer.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
        });
        window.matchMedia('(min-width: 1080px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
    }

    /* ── Reveal on scroll ─────────────────────────────────────────────── */
    const reveals = document.querySelectorAll('.reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
        reveals.forEach(el => el.classList.add('is-in'));
    } else {
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px' });
        reveals.forEach(el => io.observe(el));
        // Safety net: never leave content hidden.
        setTimeout(() => reveals.forEach(el => el.classList.add('is-in')), 2500);
    }

    /* ── Count-up stats ───────────────────────────────────────────────── */
    const counters = document.querySelectorAll('[data-count]');
    const runCount = el => {
        const target = parseInt(el.dataset.count, 10);
        if (reduceMotion) { el.textContent = target; return; }
        const start = performance.now();
        const step = now => {
            const p = Math.min((now - start) / 1400, 1);
            el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    };
    if ('IntersectionObserver' in window) {
        const cio = new IntersectionObserver(entries => entries.forEach(e => {
            if (e.isIntersecting) { runCount(e.target); cio.unobserve(e.target); }
        }), { threshold: 0.5 });
        counters.forEach(el => cio.observe(el));
    }

    /* ── Inline videos: play only while visible ───────────────────────── */
    const inlineVideos = document.querySelectorAll('video[data-autoplay]');
    if (inlineVideos.length && 'IntersectionObserver' in window && !reduceMotion) {
        const vio = new IntersectionObserver(entries => entries.forEach(e => {
            const v = e.target;
            if (e.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
            else v.pause();
        }), { threshold: 0.25 });
        inlineVideos.forEach(v => vio.observe(v));
    }

    /* ── Dialogs ──────────────────────────────────────────────────────── */
    const openDialog = (dlg, opener) => {
        if (!dlg) return;
        dlg._opener = opener;
        if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
        document.body.classList.add('drawer-open');
    };
    document.querySelectorAll('dialog').forEach(dlg => {
        dlg.addEventListener('close', () => {
            document.body.classList.remove('drawer-open');
            dlg.querySelectorAll('video').forEach(v => v.pause());
            if (dlg._opener) dlg._opener.focus();
        });
        // Click on the backdrop closes the dialog.
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
        dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => dlg.close()));
    });
    document.querySelectorAll('[data-dialog]').forEach(btn => {
        btn.addEventListener('click', () => openDialog(document.getElementById(btn.dataset.dialog), btn));
    });

    // Video player dialog: one shared player for every reel / animation tile.
    const player = document.getElementById('player');
    if (player) {
        const pv = player.querySelector('video');
        const title = player.querySelector('[data-player-title]');
        document.querySelectorAll('[data-video]').forEach(btn => {
            btn.addEventListener('click', () => {
                pv.src = btn.dataset.video;
                player.classList.toggle('dialog--video-wide', btn.dataset.ratio === 'wide');
                title.textContent = btn.querySelector('.media__client')?.textContent || '';
                openDialog(player, btn);
                const p = pv.play(); if (p && p.catch) p.catch(() => {});
            });
        });
        player.addEventListener('close', () => { pv.removeAttribute('src'); pv.load(); });
    }

    /* ── Contact form (EmailJS) ───────────────────────────────────────── */
    const form = document.getElementById('contactForm');
    if (form) {
        const status = form.querySelector('.form__status');
        const btn = form.querySelector('button[type="submit"]');
        form.addEventListener('submit', e => {
            e.preventDefault();
            if (!form.reportValidity()) return;
            status.className = 'form__status';
            status.textContent = t('contact.sending');
            btn.disabled = true;
            const done = (ok) => {
                btn.disabled = false;
                status.classList.add(ok ? 'is-ok' : 'is-error');
                status.textContent = t(ok ? 'contact.success' : 'contact.error');
                if (ok) form.reset();
            };
            if (!window.emailjs) { done(false); return; }
            window.emailjs.sendForm('service_e1hgfwj', 'template_xpotur4', form).then(() => done(true), () => done(false));
        });
    }

    /* ── Footer year ──────────────────────────────────────────────────── */
    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();

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
            document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    });
        document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
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

    const player = document.getElementById('player');
    if (player) player.addEventListener('close', () => { const v = player.querySelector('video'); v.removeAttribute('src'); v.load(); });

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

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

    /* ── Scroll progress + back to top ────────────────────────────────── */
    const bar = document.querySelector('.scroll-progress');
    const toTop = document.querySelector('.to-top');
    let ticking = false;
    const onScrollUI = () => {
        ticking = false;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const p = max > 0 ? window.scrollY / max : 0;
        if (bar) bar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        if (toTop) toTop.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.9);
    };
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScrollUI); } }, { passive: true });
    onScrollUI();

    /* ── Hero word rotator ────────────────────────────────────────────── */
    document.querySelectorAll('[data-rotate]').forEach(el => {
        let i = 0, timer;
        const words = () => { const w = lookup(lang, el.dataset.rotate); return Array.isArray(w) ? w : [el.textContent]; };
        const show = () => {
            const list = words();
            el.classList.add('is-out');
            setTimeout(() => { el.textContent = list[i % list.length]; el.classList.remove('is-out'); }, reduceMotion ? 0 : 250);
        };
        el.textContent = words()[0];
        if (!reduceMotion) timer = setInterval(() => { i++; show(); }, 2600);
        document.addEventListener('langchange', () => { el.textContent = words()[i % words().length]; });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearInterval(timer);
            else if (!reduceMotion) { clearInterval(timer); timer = setInterval(() => { i++; show(); }, 2600); }
        });
    });

    /* ── Pointer spotlight on cards + gentle tilt on hero art ─────────── */
    if (finePointer && !reduceMotion) {
        document.querySelectorAll('.card, .step, .brand-tile__logo, .project__thumb').forEach(el => {
            el.classList.add('has-spot');
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
                el.style.setProperty('--my', (e.clientY - r.top) + 'px');
            });
        });
        document.querySelectorAll('[data-tilt]').forEach(el => {
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform = `perspective(900px) rotateY(${(x * 6).toFixed(2)}deg) rotateX(${(-y * 6).toFixed(2)}deg)`;
            });
            el.addEventListener('pointerleave', () => { el.style.transform = ''; });
        });
    }

    /* ── AI process: steps light up in sequence while visible ─────────── */
    document.querySelectorAll('[data-steps]').forEach(list => {
        const steps = [...list.children];
        if (reduceMotion || !('IntersectionObserver' in window)) { steps.forEach(s => s.classList.add('is-active')); return; }
        let i = 0, timer = null, paused = false;
        const set = n => steps.forEach((s, k) => s.classList.toggle('is-active', k === n));
        const start = () => { if (!timer) timer = setInterval(() => { if (!paused) { i = (i + 1) % steps.length; set(i); } }, 2200); };
        const stop = () => { clearInterval(timer); timer = null; };
        steps.forEach((s, k) => {
            s.addEventListener('pointerenter', () => { paused = true; i = k; set(k); });
            s.addEventListener('pointerleave', () => { paused = false; });
            s.addEventListener('click', () => { i = k; set(k); });
        });
        new IntersectionObserver(([e]) => { if (e.isIntersecting) { set(i); start(); } else stop(); }, { threshold: 0.35 }).observe(list);
    });

    /* ── Filters (experience timeline, reels) ─────────────────────────── */
    document.querySelectorAll('[data-filter-target]').forEach(group => {
        const target = document.getElementById(group.dataset.filterTarget);
        if (!target) return;
        const items = [...target.children];
        const counter = document.querySelector(`[data-count-of="${target.id}"]`);
        const renderCount = () => {
            if (!counter) return;
            const n = items.filter(it => !it.hidden).length;
            counter.textContent = (lookup(lang, 'motion.filter.showing') || '{n}').replace('{n}', n);
        };
        group.querySelectorAll('[data-filter]').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = btn.dataset.filter;
                group.querySelectorAll('[data-filter]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
                items.forEach(it => {
                    const key = it.dataset.group || it.dataset.client;
                    it.hidden = !(f === 'all' || key === f);
                    if (!it.hidden) it.classList.add('is-in');
                });
                renderCount();
            });
        });
        renderCount();
        document.addEventListener('langchange', renderCount);
    });

    /* ── Horizontal rail buttons (branding) ───────────────────────────── */
    document.querySelectorAll('.rail').forEach(rail => {
        const nav = rail.previousElementSibling && rail.previousElementSibling.classList.contains('rail-nav') ? rail.previousElementSibling : null;
        if (!nav) return;
        const prev = nav.querySelector('[data-rail="prev"]'), next = nav.querySelector('[data-rail="next"]');
        const step = () => (rail.firstElementChild ? rail.firstElementChild.getBoundingClientRect().width + 16 : 280);
        const update = () => {
            const max = rail.scrollWidth - rail.clientWidth - 2;
            nav.hidden = max <= 0;
            prev.disabled = rail.scrollLeft <= 2;
            next.disabled = rail.scrollLeft >= max;
        };
        prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
        next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }));
        rail.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        update();
    });

    /* ── Video player: previous / next through the visible tiles ──────── */
    if (player) {
        const pv = player.querySelector('video');
        const title = player.querySelector('[data-player-title]');
        const count = player.querySelector('[data-player-count]');
        let list = [], idx = 0;
        const load = () => {
            const btn = list[idx];
            pv.src = btn.dataset.video;
            player.classList.toggle('dialog--video-wide', btn.dataset.ratio === 'wide');
            title.textContent = btn.querySelector('.media__client')?.textContent || '';
            count.textContent = (idx + 1) + ' / ' + list.length;
            const p = pv.play(); if (p && p.catch) p.catch(() => {});
        };
        document.querySelectorAll('[data-video]').forEach(btn => {
            btn.addEventListener('click', () => {
                list = [...btn.parentElement.querySelectorAll('[data-video]')].filter(b => !b.hidden);
                idx = Math.max(0, list.indexOf(btn));
                openDialog(player, btn);
                load();
            });
        });
        const go = d => { if (!list.length) return; idx = (idx + d + list.length) % list.length; load(); };
        player.querySelector('[data-player="prev"]').addEventListener('click', () => go(-1));
        player.querySelector('[data-player="next"]').addEventListener('click', () => go(1));
        player.addEventListener('keydown', e => {
            if (e.target === pv && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.altKey) return; // let the video seek
            if (e.key === 'ArrowLeft') go(-1);
            if (e.key === 'ArrowRight') go(1);
        });
        let sx = null;
        player.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
        player.addEventListener('touchend', e => {
            if (sx === null) return;
            const dx = e.changedTouches[0].clientX - sx; sx = null;
            if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        }, { passive: true });
    }

    /* ── Gallery dialogs: jump links to each section ──────────────────── */
    document.querySelectorAll('dialog .jump-bar').forEach(bar => {
        const dlg = bar.closest('dialog');
        const body = dlg.querySelector('.dialog__body');
        const heads = [...dlg.querySelectorAll('[data-jump]')];
        heads.forEach((h, k) => {
            h.id = h.id || dlg.id + '-s' + k;
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'chip chip--toggle';
            b.dataset.i18n = h.dataset.i18n; b.textContent = h.textContent;
            b.addEventListener('click', () => {
                body.scrollTo({ top: h.offsetTop - body.offsetTop - 8, behavior: reduceMotion ? 'auto' : 'smooth' });
            });
            bar.appendChild(b);
        });
        body.addEventListener('scroll', () => {
            let cur = 0;
            heads.forEach((h, k) => { if (h.offsetTop - body.offsetTop - 40 <= body.scrollTop) cur = k; });
            bar.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', String(k === cur)));
        }, { passive: true });
        bar.querySelector('button')?.setAttribute('aria-pressed', 'true');
    });

    /* ── Contact form: topics, live validation, counter, copy email ───── */
    if (form) {
        const topicsInput = form.querySelector('input[name="topics"]');
        const syncTopics = () => {
            const chosen = [...form.querySelectorAll('[data-topic][aria-pressed="true"]')].map(b => b.textContent.trim());
            if (topicsInput) topicsInput.value = chosen.join(', ');
        };
        form.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => {
            b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
            syncTopics();
        }));

        const fields = [...form.querySelectorAll('input[required], textarea[required]')];
        const check = (el, show) => {
            const err = form.querySelector('#' + el.id + '-err');
            const ok = el.checkValidity();
            el.toggleAttribute('aria-invalid', !ok && show);
            if (err) err.textContent = (!ok && show) ? t(err.dataset.err) : '';
            return ok;
        };
        fields.forEach(el => {
            el.addEventListener('blur', () => { if (el.value) check(el, true); });
            el.addEventListener('input', () => { if (el.hasAttribute('aria-invalid')) check(el, true); });
        });

        const msg = form.querySelector('#message');
        const counter = form.querySelector('[data-count-for="message"]');
        if (msg && counter) {
            const upd = () => { counter.textContent = msg.value.length + ' / ' + msg.maxLength; counter.classList.toggle('is-near', msg.value.length > msg.maxLength * 0.9); };
            msg.addEventListener('input', upd); upd();
        }

        // Validate everything on submit (capture phase runs before the sender above).
        form.addEventListener('submit', e => {
            syncTopics();
            const bad = fields.filter(el => !check(el, true));
            if (bad.length) {
                e.preventDefault(); e.stopImmediatePropagation();
                const status = form.querySelector('.form__status');
                status.className = 'form__status is-error';
                status.textContent = t('contact.fixErrors');
                bad[0].focus();
            }
        }, true);
        document.addEventListener('langchange', () => fields.forEach(el => { if (el.hasAttribute('aria-invalid')) check(el, true); }));
    }

    document.querySelectorAll('[data-copy]').forEach(btn => {
        btn.addEventListener('click', () => {
            const done = () => {
                btn.textContent = t('contact.copied'); btn.classList.add('is-done');
                setTimeout(() => { btn.textContent = t('contact.copy'); btn.classList.remove('is-done'); }, 1800);
            };
            if (navigator.clipboard) navigator.clipboard.writeText(btn.dataset.copy).then(done, () => {});
        });
    });

    /* ── Footer year ──────────────────────────────────────────────────── */
    document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();

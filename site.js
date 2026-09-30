function resolveNestedValue(obj, key) {
    return key.split('.').reduce((current, part) => current && current[part] !== undefined ? current[part] : undefined, obj);
  }

  async function loadHomepageConfig() {
    try {
      const response = await fetch('/api/homepage');
      const result = await response.json();
      if (!response.ok || !result.success) return;

      const settings = result.data || {};
      document.querySelectorAll('[data-homepage-key]').forEach((el) => {
        const key = el.dataset.homepageKey;
        const value = resolveNestedValue(settings, key);
        if (value !== undefined && value !== null) {
          el.textContent = value;
        }
      });
    } catch (error) {
      console.warn('Homepage config not loaded:', error);
    }
  }

  // ---------- Nav toggle (mobile) ----------
  const nav = document.getElementById('siteNav');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  }));

  // ---------- Nav shadow on scroll ----------
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 12);
  };
  document.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Active page state ----------
  const currentPath = window.location.pathname.replace(/\/$/, '/index.html');
  navLinks.querySelectorAll('a').forEach((item) => {
    const targetPath = new URL(item.href, window.location.href).pathname;
    item.classList.toggle('active', targetPath === currentPath);
  });

  // ---------- Reveal on scroll ----------
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // ---------- Gallery filter ----------
  const filterBtns = document.querySelectorAll('.filter-btn');
  const photoCards = document.querySelectorAll('.photo-card');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const filter = btn.dataset.filter;
      photoCards.forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.classList.toggle('hidden-item', !match);
      });
    });
  });

  // ---------- Aperture parallax (subtle, pointer devices only) ----------
  const aperture = document.getElementById('apertureEl');
  const heroVisual = document.querySelector('.hero-visual');
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  if (aperture && heroVisual && !prefersReduced && isFinePointer) {
    heroVisual.addEventListener('mousemove', (e) => {
      const rect = heroVisual.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      aperture.style.transform = `rotateY(${x * 14}deg) rotateX(${-y * 14}deg)`;
    });
    heroVisual.addEventListener('mouseleave', () => {
      aperture.style.transform = 'rotateY(0deg) rotateX(0deg)';
    });
  }

  loadHomepageConfig();

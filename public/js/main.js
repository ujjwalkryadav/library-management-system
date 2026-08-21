/**
 * Master Client-Side JavaScript
 * - Real-Time Live Search Suggestions
 * - Smooth Horizontal Book Carousel Slider (Left / Right Arrow navigation)
 * - Animated Number Counter on Homepage
 * - Micro-interactions & Tooltip initialization
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Bootstrap Tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));

  // 2. Real-Time Live Search Suggestions
  setupLiveSearch('heroSearchInput', 'heroSearchSuggestions');
  setupLiveSearch('navbarSearchInput', 'navbarSearchSuggestions');
  setupLiveSearch('topbarSearchInput', 'topbarSearchSuggestions');

  function setupLiveSearch(inputId, boxId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(boxId);
    if (!input || !box) return;

    let debounceTimer;

    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      const query = input.value.trim();

      if (query.length < 2) {
        box.classList.remove('active');
        box.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/books/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();

          if (data.success && data.books && data.books.length > 0) {
            let html = '';
            data.books.forEach(b => {
              html += `
                <a href="/books/${b.id}" class="suggestion-item">
                  <img src="${b.cover_image}" alt="${b.title}" class="suggestion-thumb">
                  <div class="flex-grow-1 overflow-hidden">
                    <div class="suggestion-title text-truncate">${escapeHtml(b.title)}</div>
                    <div class="suggestion-meta">
                      <span>${escapeHtml(b.author)}</span> &bull; 
                      <span class="badge bg-light text-secondary border py-0">${escapeHtml(b.category)}</span>
                    </div>
                  </div>
                  <div class="ms-2 flex-shrink-0">
                    ${b.is_available 
                      ? '<span class="badge bg-success-subtle text-success small"><i class="bi bi-check-circle me-1"></i>Available</span>' 
                      : '<span class="badge bg-danger-subtle text-danger small"><i class="bi bi-x-circle me-1"></i>Issued Out</span>'}
                  </div>
                </a>
              `;
            });
            box.innerHTML = html;
            box.classList.add('active');
          } else {
            box.innerHTML = `
              <div class="p-3 text-center text-muted small">
                <i class="bi bi-search me-1"></i> No matching books found for "<strong>${escapeHtml(query)}</strong>"
              </div>
            `;
            box.classList.add('active');
          }
        } catch (err) {
          console.error('Failed to fetch search suggestions:', err);
        }
      }, 250);
    });

    // Close on click outside
    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !box.contains(e.target)) {
        box.classList.remove('active');
      }
    });

    // Close on Escape
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        box.classList.remove('active');
      }
    });
  }

  // 3. Ultra-Smooth Horizontal Book Carousel Slider & Auto-Showcase
  const carouselTrack = document.getElementById('collectionTrack');
  const prevBtn = document.getElementById('carouselPrevBtn');
  const nextBtn = document.getElementById('carouselNextBtn');

  // Custom high-performance smooth scroll interpolation (easeInOutCubic)
  function smoothScrollElement(element, targetScroll, duration = 800) {
    return new Promise((resolve) => {
      const startScroll = element.scrollLeft;
      const distance = targetScroll - startScroll;
      let startTime = null;

      function step(currentTime) {
        if (!startTime) startTime = currentTime;
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // easeInOutCubic formula: smooth acceleration & deceleration
        const ease = progress < 0.5 
          ? 4 * progress * progress * progress 
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        element.scrollLeft = startScroll + (distance * ease);

        if (progress < 1) {
          requestAnimationFrame(step);
        } else {
          element.scrollLeft = targetScroll;
          resolve();
        }
      }

      requestAnimationFrame(step);
    });
  }

  if (carouselTrack && prevBtn && nextBtn) {
    const scrollAmount = () => carouselTrack.clientWidth * 0.75;

    nextBtn.addEventListener('click', () => {
      const maxScroll = carouselTrack.scrollWidth - carouselTrack.clientWidth;
      const target = Math.min(carouselTrack.scrollLeft + scrollAmount(), maxScroll);
      smoothScrollElement(carouselTrack, target, 380);
    });

    prevBtn.addEventListener('click', () => {
      const target = Math.max(carouselTrack.scrollLeft - scrollAmount(), 0);
      smoothScrollElement(carouselTrack, target, 380);
    });

    const updateArrows = () => {
      const maxScroll = carouselTrack.scrollWidth - carouselTrack.clientWidth;
      prevBtn.disabled = carouselTrack.scrollLeft <= 5;
      nextBtn.disabled = carouselTrack.scrollLeft >= maxScroll - 5;
    };

    carouselTrack.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    setTimeout(updateArrows, 100);

    // One-Time Auto-Scroll Showcase (Fast, snappy & smooth gliding preview)
    let hasAutoScrolled = false;
    const carouselObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasAutoScrolled) {
          hasAutoScrolled = true;
          carouselObserver.unobserve(carouselTrack);

          setTimeout(async () => {
            const maxScroll = carouselTrack.scrollWidth - carouselTrack.clientWidth;
            const peekDistance = Math.min(380, maxScroll);

            if (peekDistance > 30) {
              // Fast, smooth glide to the right (600ms)
              await smoothScrollElement(carouselTrack, peekDistance, 600);
              
              // Brief snappy pause (200ms)
              await new Promise(r => setTimeout(r, 200));

              // Fast, smooth return back to origin (600ms)
              await smoothScrollElement(carouselTrack, 0, 600);
            }
          }, 150);
        }
      });
    }, { threshold: 0.25 });

    carouselObserver.observe(carouselTrack);
  }

  // 4. Animated Number Count-Up for Statistics
  const statNumbers = document.querySelectorAll('.stat-count-up');
  if (statNumbers.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'), 10) || 0;
          const suffix = el.getAttribute('data-suffix') || '';
          let current = 0;
          const increment = Math.max(1, Math.ceil(target / 40));
          const duration = 1200;
          const stepTime = Math.abs(Math.floor(duration / (target / increment || 1)));

          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              el.textContent = target.toLocaleString() + suffix;
              clearInterval(timer);
            } else {
              el.textContent = current.toLocaleString() + suffix;
            }
          }, stepTime);

          observer.unobserve(el);
        }
      });
    }, { threshold: 0.2 });

    statNumbers.forEach(el => observer.observe(el));
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});

(() => {
  const main = document.querySelector('main');
  const sidebar = document.querySelector('.sidebar');
  const slides = [...main.children].filter(el => el.matches('section, header, .intro'));
  slides.forEach(slide => slide.classList.add('deck-slide'));
  const links = [...sidebar.querySelectorAll('a')];
  const search = document.createElement('input');
  search.type = 'search';
  search.className = 'deck-search';
  search.placeholder = 'Search lessons…';
  search.setAttribute('aria-label', 'Search Docker lessons');
  sidebar.prepend(search);
  const empty = document.createElement('p');
  empty.className = 'deck-empty';
  empty.textContent = 'No matching lessons.';
  empty.hidden = true;
  sidebar.append(empty);
  const footer = document.createElement('footer');
  footer.className = 'deck-footer';
  footer.innerHTML = '<span class="deck-caption" aria-live="polite"></span><span class="deck-hint">← → Navigate · Home Overview</span><div class="deck-controls"><button type="button" data-action="overview">Overview</button><button type="button" data-action="prev">← Prev</button><button type="button" data-action="next">Next →</button></div>';
  document.body.append(footer);
  const progress = document.createElement('div');
  progress.className = 'deck-progress';
  document.body.append(progress);
  const prev = footer.querySelector('[data-action="prev"]');
  const next = footer.querySelector('[data-action="next"]');
  let index = 0;
  function show(n, update = true, focus = true) {
    index = Math.max(0, Math.min(slides.length - 1, n));
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-current', i === index);
      slide.setAttribute('aria-hidden', String(i !== index));
    });
    const current = slides[index];
    const heading = current.querySelector('h1,h2');
    footer.querySelector('.deck-caption').textContent = (index + 1) + ' / ' + slides.length + ' · ' + heading.textContent;
    links.forEach(link => {
      if (link.getAttribute('href') === '#' + current.id) link.setAttribute('aria-current', 'step');
      else link.removeAttribute('aria-current');
    });
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    progress.style.width = ((index + 1) / slides.length * 100) + '%';
    main.scrollTop = 0;
    if (update) history.pushState(null, '', '#' + current.id);
    if (focus) { heading.tabIndex = -1; heading.focus({preventScroll:true}); }
    sidebar.querySelector('[aria-current="step"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  function fromHash() {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    const found = slides.findIndex(slide => slide === target || slide.contains(target));
    show(found < 0 ? 0 : found, false, false);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.hash === '#main') return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    const found = slides.findIndex(slide => slide === target || slide.contains(target));
    if (found >= 0) { event.preventDefault(); show(found); }
  });
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  footer.querySelector('[data-action="overview"]').addEventListener('click', () => show(0));
  window.addEventListener('hashchange', fromHash);
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,button,a,pre,[contenteditable]')) return;
    const destination = {ArrowRight:index+1, ArrowLeft:index-1, Home:0, End:slides.length-1}[event.key];
    if (destination !== undefined) { event.preventDefault(); show(destination); }
  });
  search.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    links.forEach(link => {
      const target = link.getAttribute('href').startsWith('#') ? document.getElementById(link.hash.slice(1)) : null;
      link.hidden = !(link.textContent + ' ' + (target?.textContent || '')).toLowerCase().includes(query);
    });
    sidebar.querySelectorAll('.sidebar-label').forEach(label => label.hidden = !!query);
    empty.hidden = links.some(link => !link.hidden);
  });
  document.querySelectorAll('.codebox').forEach(box => {
    const label = box.querySelector('.code-label');
    if (!label) return;
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'deck-copy'; button.textContent = 'Copy';
    label.append(button);
    button.addEventListener('click', async () => {
      const pre = box.querySelector('pre');
      try { await navigator.clipboard.writeText(pre.textContent); button.textContent = 'Copied'; }
      catch {
        const range = document.createRange(); range.selectNodeContents(pre);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        button.textContent = 'Selected · Ctrl+C';
      }
      setTimeout(() => button.textContent = 'Copy', 2500);
    });
  });
  document.body.classList.add('docker-deck');
  fromHash();
})();

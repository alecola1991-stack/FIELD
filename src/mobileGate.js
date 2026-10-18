// Phones and tablets get a notice instead of the game while the mobile app is being built.
// Detection: mobile user agents, iPadOS (reports itself as a Mac with touch) and devices whose
// only pointer is a finger. The desktop app (Electron) is never blocked.
export function isMobileDevice(nav = globalThis.navigator, matchMedia = globalThis.matchMedia?.bind(globalThis)) {
  if (!nav) return false;
  const ua = String(nav.userAgent || '');
  if (/electron/i.test(ua)) return false;
  if (nav.userAgentData?.mobile) return true;
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|BB10|Opera Mini|IEMobile|webOS/i.test(ua)) return true;
  if (/Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1) return true;
  if (matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches) return true;
  return false;
}

export function showMobileNotice(doc = document) {
  doc.documentElement.classList.add('mobile-blocked');
  doc.querySelector('.app-shell')?.remove();
  const notice = doc.createElement('section');
  notice.className = 'mobile-notice'; notice.setAttribute('role', 'main');
  notice.innerHTML = `
    <div class="mobile-notice-glow" aria-hidden="true"></div>
    <header class="mobile-notice-brand"><span class="brand-mark" aria-hidden="true"></span><b>Fútbol <em>arcade</em></b></header>
    <div class="mobile-notice-phone" aria-hidden="true">
      <div class="mobile-notice-screen">
        <span class="mn-line"></span><span class="mn-circle"></span>
        <i class="mn-player a"></i><i class="mn-player b"></i><i class="mn-ball"></i>
      </div>
      <span class="mobile-notice-badge">EN DESARROLLO</span>
    </div>
    <p class="mobile-notice-kicker">APP PARA MÓVILES Y TABLETS</p>
    <h1>Estamos creando<br><em>la app para móviles.</em></h1>
    <p class="mobile-notice-text">Queremos que jugar en el teléfono sea tan bueno como en el ordenador, con controles táctiles pensados para la pantalla. Por eso la web no está disponible en móviles mientras terminamos la app.</p>
    <div class="mobile-notice-card"><span>💻</span><p><b>Mientras tanto, juega en tu ordenador</b>Entra en <strong>futarcade.es</strong> desde un PC o un portátil. Tu progreso se guarda en tu cuenta.</p></div>
    <button type="button" class="mobile-notice-share">Compartir el enlace</button>
    <small class="mobile-notice-foot">¡Gracias por tu paciencia! Nos vemos muy pronto en el campo.</small>`;
  doc.body.append(notice);
  const button = notice.querySelector('.mobile-notice-share');
  button.addEventListener('click', async () => {
    const url = 'https://futarcade.es/';
    try {
      if (navigator.share) await navigator.share({ title: 'Fútbol arcade', text: 'Juega a Fútbol arcade en el ordenador', url });
      else { await navigator.clipboard.writeText(url); button.textContent = '¡Enlace copiado!'; }
    } catch { /* Sharing cancelled. */ }
  });
  globalThis.__bootHide?.();
}

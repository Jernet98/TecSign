// ══════════════════════════════════════
//  Chat LSM — Avatar 3D (Babylon.js) + imágenes ./Abc/
// ══════════════════════════════════════

let animTimeout = null;

// Convierte texto en array de letras válidas para LSM
function getSignsForText(text) {
  return text
    .toUpperCase().replaceAll('Ñ', '\uE000')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replaceAll('\uE000', 'Ñ') // conserva Ñ
    .split('')
    .map(c => ({ letra: c, valida: /^[A-ZÑ ]$/.test(c) }));
}

// Anima el avatar. Si la palabra tiene animación 3D, la reproduce.
// Si no, cae al deletreo con imágenes letra por letra (como antes).
function animateSigns(signs, textoOriginal) {
  const area = document.getElementById('sign-area');

  if (animTimeout) clearTimeout(animTimeout);
  area.innerHTML = '';

  const textoNormalizado = textoOriginal.trim().toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const archivoGlb = typeof AVATAR_WORD_MAP !== 'undefined' ? AVATAR_WORD_MAP[textoNormalizado] : null;

  // ── Coincide con una de las 6 animaciones 3D disponibles ──
  if (archivoGlb && typeof TecSignAvatar !== 'undefined' && TecSignAvatar.isAvailable()) {
    area.innerHTML = `<div class="sign-status">🤟 Reproduciendo: ${textoOriginal}</div>`;

    TecSignAvatar.playWord(archivoGlb, () => {
      area.innerHTML = `<div class="sign-status">✓ Completado</div>`;
    });
    return;
  }

  // ── Sin animación 3D: deletreo con imágenes ./Abc/ (aseguramos que el avatar esté en Idle) ──
  if (typeof TecSignAvatar !== 'undefined') TecSignAvatar.forceIdle();

  const validas = signs.filter(s => s.valida && s.letra !== ' ');
  let i = 0;

  function showNext() {
    if (i < validas.length) {
      area.innerHTML = `
        <img src="./abc/${validas[i].letra.toLowerCase()}.png"
             alt="Seña ${validas[i].letra}"
             class="sign-img-avatar">
        <div class="sign-letter">${validas[i].letra}</div>
      `;
      i++;
      animTimeout = setTimeout(showNext, 750);
    } else {
      area.innerHTML = `<div class="sign-status">✓ Completado</div>`;
    }
  }

  if (validas.length) {
    showNext();
  } else {
    area.innerHTML = `<div class="sign-status">✓ Completado</div>`;
  }
}

// Agrega mensaje al chat
function addMessage(text, isUser, signs) {
  const container = document.getElementById('messages');

  // Quita estado vacío si existe
  container.querySelectorAll('.empty-state').forEach(e => e.remove());

  const div = document.createElement('div');
  div.className = 'msg ' + (isUser ? 'user' : 'bot');

  if (isUser) {
    div.textContent = text;
  } else {
    // Chips con imágenes reales por letra
    const chipsHTML = signs
      .filter(s => s.valida)
      .map(s => {
        if (s.letra === ' ') {
          return `<div class="sign-chip espacio"><div class="e">·</div><div class="l">(esp)</div></div>`;
        }
        return `
          <div class="sign-chip" title="Letra ${s.letra}">
            <img src="./abc/${s.letra.toLowerCase()}.png" alt="Seña ${s.letra}" class="sign-chip-img">
            <div class="l">${s.letra}</div>
          </div>
        `;
      }).join('');

    div.innerHTML = `
      <div>Señas para <strong class="original-message"></strong>:</div>
      <div class="signs-row">${chipsHTML}</div>
    `;
  }

  if (!isUser) div.querySelector('.original-message').textContent = text;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// Envía palabra desde chips rápidos
function sendWord(word) {
  document.getElementById('chat-input').value = word;
  sendFromInput();
}

// Envía desde el input
function sendFromInput() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, true);
  const signs = getSignsForText(text);

  setTimeout(() => {
    addMessage(text, false, signs);
    animateSigns(signs, text); // ← pasa el texto aquí
  }, 350);

  input.value = '';
  input.focus();
}

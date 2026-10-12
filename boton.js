// Seleccionamos el botón hamburguesa y el menú
const menuToggle = document.getElementById('menu-toggle');
const nav = document.getElementById('nav');

// Agregamos el evento de clic al botón hamburguesa
menuToggle?.addEventListener('click', () => {
  // Alterna la clase 'active' en el botón y 'open' en el menú
  menuToggle.classList.toggle('active');
  nav?.classList.toggle('open');
});

// ── Hero Slider ──
const heroSlides = [
  {
    img: "./image/ilustrativa.webp",
    titulo: "Comunicación sin barreras, innovación sin límites.",
    desc: "TecSign traduce la Lengua de Señas Mexicana en tiempo real, acercando a personas sordas y oyentes."
  },
  {
    img: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80",
    titulo: "Aprender señas nunca fue tan fácil.",
    desc: "Recursos educativos interactivos para que cualquier persona pueda conectar con la comunidad sorda."
  },
  {
    img: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800&q=80",
    titulo: "Tecnología al servicio de la inclusión.",
    desc: "Diseñado junto a la comunidad sorda para garantizar una herramienta accesible y empática."
  }
];

let heroActual = 0;
let heroTimer;

const heroImg  = document.getElementById('hero-img');
const heroTit  = document.getElementById('hero-titulo');
const heroDesc = document.getElementById('hero-desc');
const dotsWrap = document.getElementById('hero-dots');

function renderDots() {
  dotsWrap.innerHTML = '';
  heroSlides.forEach((_, i) => {
    const btn = document.createElement('button');
    btn.className = 'hero-dot' + (i === heroActual ? ' active' : '');
    btn.setAttribute('aria-label', `Slide ${i + 1}`);
    btn.addEventListener('click', () => goToSlide(i));
    dotsWrap.appendChild(btn);
  });
}

function goToSlide(index) {
  heroImg.classList.add('fade');
  heroTit.style.opacity  = '0';
  heroDesc.style.opacity = '0';

  setTimeout(() => {
    heroActual = (index + heroSlides.length) % heroSlides.length;
    const s = heroSlides[heroActual];
    heroImg.src = s.img;
    heroTit.textContent  = s.titulo;
    heroDesc.textContent = s.desc;
    heroImg.classList.remove('fade');
    heroTit.style.opacity  = '1';
    heroDesc.style.opacity = '1';
    renderDots();
  }, 400);

  clearInterval(heroTimer);
  heroTimer = setInterval(() => goToSlide(heroActual + 1), 5000);
}



// Init
if (heroImg && heroTit && heroDesc && dotsWrap) {
  heroImg.src = heroSlides[0].img;
  renderDots();
  heroTimer = setInterval(() => goToSlide(heroActual + 1), 5000);
}

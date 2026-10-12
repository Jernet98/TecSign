const curiosidades = [
  {
    titulo: "¿Sabías que 🎭 ¡También se puede gritar en señas!?",
    texto: "Así es. Aunque no uses la voz, puedes transmitir emociones tan fuertes como un grito o tan suaves como un susurro. Todo depende del tamaño de tus gestos, la intensidad del movimiento y, sobre todo, de tu expresión facial. En el lenguaje de señas, tu rostro es el volumen y tus manos son la melodía. ¡Hablar sin hablar nunca fue tan expresivo!"
  },
  {
    titulo: "🌍 ¿Un solo lenguaje? ¡Para nada!",
    texto: "Aunque muchos piensan que las personas sordas se entienden entre sí sin importar su país, lo cierto es que cada región tiene su propia versión de señas, como si fueran diferentes idiomas hablados. Por ejemplo, el Lenguaje de Señas Mexicano (LSM) es distinto al Americano (ASL), y ambos tienen estructuras únicas. ¡Incluso dentro de un mismo país puede haber variantes! Es como si el lenguaje de señas también tuviera acentos y dialectos visuales."
  },
  {
    titulo: " ¿Sabías que 🎶 ¡La música también se ve!?",
    texto: "Aunque no escuchen los sonidos como tú, sienten las vibraciones, siguen el ritmo y traducen las canciones en lenguaje de señas. Hay intérpretes que “cantan” con tanta emoción y movimiento que convierten una canción en una experiencia visual inolvidable. ¡Es arte puro! Si alguna vez ves a alguien interpretando una canción en señas, te darás cuenta de que la música también se puede ver... y sentir."
  },
  {
    titulo: "👐 El idioma sin barreras",
    texto: "No necesita micrófonos ni cables. Solo necesita manos, ojos… ¡y corazón! 💖"
  },
  {
    titulo: "🤟 ¡Bailar con las manos es real!",
    texto: "No es magia, ¡es lenguaje de señas! Muchos interpretan canciones con tanto ritmo y emoción que parecen coreografías completas. ¡Concierto visual incluido!"
  },
];

window.addEventListener("DOMContentLoaded", () => {
  const curiosidad = curiosidades[Math.floor(Math.random() * curiosidades.length)];
  document.getElementById("curiosidad-titulo").textContent = curiosidad.titulo;
  document.getElementById("curiosidad-texto").textContent = curiosidad.texto;
});

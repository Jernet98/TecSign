# TecSign — Web · copia de revisión de código

**Proyecto en desarrollo | Prototipo experimental | Lengua de Señas Mexicana (LSM)**

TecSign explora el uso de visión artificial y modelos temporales de inteligencia artificial para reconocer un vocabulario limitado de señas aisladas, además de ofrecer herramientas educativas. **No es un intérprete fiable ni un traductor general de LSM.**

- **Demostración pública del proyecto:** https://gestostecsign.netlify.app/
- **Leer este documento en inglés:** [README.en.md](README.en.md)
- **Arquitectura y alcance de la copia:** [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)

## ¿Qué es esta copia?

Es una **selección del sitio generado `site/`** preparada para que otras personas estudien su estructura y conversen sobre posibles colaboraciones. No es el repositorio fuente completo ni incluye herramientas originales de entrenamiento o construcción.

Incluye el código HTML, CSS y JavaScript propio, una configuración de ejemplo, páginas educativas y recursos del sitio. Se corrigieron tres rutas con diferencias de mayúsculas/minúsculas.

**No incluye** pesos de redes neuronales, modelos ONNX, archivos GLB del avatar ni las dependencias grandes (`web/vendor`). La página de detección **está desactivada deliberadamente** en esta copia; el código de implementación está disponible en `js/` únicamente para revisión. Tampoco funcionan los formularios ni el chatbot, para impedir que las pruebas envíen información a los servicios del sitio de producción.

## Explorar el proyecto

Para revisar el código, **no hace falta instalar nada**. Empieza en `index.html`, `deteccion.html`, `js/deteccion.js`, `js/ai/` y `docs/ARQUITECTURA.md`.

Para ver las páginas estáticas y el ejemplo de interpretación de glosas sin usar cámara:

```bash
cd TecSign-Web
python -m http.server 8000
```

Abre http://localhost:8000/ y, para el ejemplo independiente de glosas, http://localhost:8000/demo-glosas.html . Este ejemplo muestra reglas lingüísticas a partir de glosas predefinidas, **no realiza reconocimiento de vídeo**. Otra página que se puede explorar sin los modelos es `traductor.html`, donde la demostración de deletreo depende de imágenes locales.

**Para probar reconocimiento real**, utiliza la demostración pública (si está disponible) o solicita al equipo información sobre una entrega técnica autorizada. Esta copia *no* permite habilitar la IA eliminando simplemente un aviso de pantalla: faltan modelos y dependencias.

## Archivos principales

```text
TecSign-Web/
├── abc/                        # imágenes didácticas
├── config/                     # configuración web no sensible
├── css/                        # estilos por página
├── image/                      # recursos visuales del sitio
├── js/
│   ├── ai/                     # lógica de reconocimiento (solo revisión)
│   ├── deteccion.js            # orquestación de la cámara/modelos (solo revisión)
│   ├── babylon-avatar.js       # lógica del avatar (GLB no incluidos)
│   └── ...
├── web/THIRD_PARTY_NOTICES.md  # avisos de procedencia/dependencias
├── docs/                       # documentación para revisores
├── index.html
├── demo-glosas.html            # ejemplo que puede ejecutarse localmente
└── README.md
```

## Colaboración y derechos

TecSign está explorando vínculos con desarrolladores y comunidades de diferentes países. Contactar con el equipo para intercambiar conocimientos **no implica incorporarse al proyecto ni ceder el código de un proyecto propio**.

Esta copia **no incluye una licencia de código abierto**: su consulta no concede por sí misma permiso para redistribuirla o reutilizar el código o sus imágenes. Antes de publicar públicamente o aceptar contribuciones, el equipo debe decidir la licencia aplicable y confirmar derechos sobre los recursos visuales. Consulta [docs/CONDICIONES_DE_REVISION.md](docs/CONDICIONES_DE_REVISION.md) y los [avisos de terceros](web/THIRD_PARTY_NOTICES.md).

Para colaborar en tareas técnicas, tendremos que acordar por separado el acceso a los modelos y el uso de los aportes. Actualmente **no se ofrece remuneración garantizada** ni se prometen porcentajes de ingresos futuros.

> Nota: esta copia de revisión **no reemplaza** los archivos originales con los que se construye la versión publicada de TecSign.

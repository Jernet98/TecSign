# Arquitectura de la web TecSign (copia de revisión)

Esta es una descripción de las partes presentes en la carpeta generada `site/`. No incluye los scripts originales de entrenamiento, ni permite inferir precisión o fiabilidad clínica de los modelos.

## Flujo previsto en la versión completa

1. `deteccion.html` muestra la interfaz para cámara o vídeo.
2. `js/deteccion.js` orquesta cámara, selección de modo y estado.
3. `js/ai/camera-engine.js`, `fast-landmark-engine.js`, `landmark-engine.js` y `normalizer.js` coordinan extracción y normalización de landmarks.
4. `js/ai/frame-buffer.js`, `activity-tracker.js` y `sign-activity-tracker.js` procesan el componente temporal.
5. `js/ai/model-runtime.js` y `baseline-runtime.js` contienen los adaptadores de inferencia en navegador; en producción dependen de pesos ONNX/TensorFlow.js no incluidos aquí.
6. `js/ai/sequence-decoder.js`, `open-set-guard.js` y `gloss-language-engine.js` participan en selección de resultados, rechazo de predicciones y representación del texto.
7. `js/babylon-avatar.js` integra visualización del avatar; requiere archivos `.glb` que no se distribuyen en esta copia.

El código de revisión también conserva referencias a un adaptador experimental `need-specialist.js`, pero **no incluye el modelo v2 que no tenía autorización de publicación**. Ese adaptador no se ejecuta en la copia de revisión. No debe considerarse una función completa ni validada.

## ¿Qué puede probarse en esta entrega?

- **Sí:** navegación e interfaz estática, recursos didácticos y `demo-glosas.html` (glosas predeterminadas hacia texto; no analiza señales captadas en vídeo).
- **No:** reconocimiento de señas por cámara o vídeo, cargas de pesos TensorFlow/ONNX, renderizado completo del avatar 3D, formularios ni Chatbase.

## Detalles a tener en cuenta

- Las rutas de archivos pueden ser sensibles a mayúsculas/minúsculas en Linux; se corrigieron tres referencias detectadas en la copia.
- La web pública podría distribuir modelos al navegador; que falten aquí no equivale a mantenerlos secretos allí.
- Las configuraciones de umbral son experimentales y no respaldan por sí solas una medida de precisión.
- `web/THIRD_PARTY_NOTICES.md` contiene créditos y licencias de dependencias, pero los binarios de terceros se excluyeron para hacer liviana esta revisión.

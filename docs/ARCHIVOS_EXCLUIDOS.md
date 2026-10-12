# Lo que se dejó fuera del repositorio

Se omitieron intencionalmente estas rutas de la versión `site.zip` original:

| Ruta original | Motivo |
|---|---|
| `dataset/` | Modelo TensorFlow.js entrenado del alfabeto; no es un dataset bruto. |
| `Secuencial/` | Pesos y metadatos del modelo temporal anterior. |
| `web/models/` | Modelos ONNX de reconocimiento. El candidato v2 está marcado sin autorización de publicación. |
| `models/` | Recursos de animación 3D GLB, sujetos a revisión de derechos. |
| `web/vendor/` | Bibliotecas binarias/JS de terceros muy pesadas; instalar/distribuir correctamente solo al preparar una versión ejecutable autorizada. |
| `build-manifest.json` | Manifiesto del artefacto generado (sus hashes dejan de corresponder a esta copia filtrada). |

**Estos archivos no se borraron del ZIP original ni del proyecto del usuario.** Solo se excluyeron de la copia para GitHub.

La página de detección tiene la inicialización desactivada para evitar fallos y no solicitar acceso a la cámara de quien solo esté revisando el código. El JavaScript permanece disponible para inspección.

# TecSign AI: atribución

El modelo temporal v1 se entrena con landmarks derivados de **Mexican Sign Language Glosses (Dynamic Signs)**, Jesús Antonio Navarrete López, Michelle Sainos-Vizuett e Irvin Hussein Lopez-Nava, CICESE, 2026. Fuente: https://zenodo.org/records/18330565. Licencia de los datos: **Creative Commons Attribution 4.0 International**, https://creativecommons.org/licenses/by/4.0/. Cambios: selección de vocabulario, extracción Holistic, normalización corporal, resampling, anotaciones auxiliares de reposo y entrenamiento de una red temporal nueva. TecSign no afirma que los autores avalen sus predicciones.

Dependencias locales descargadas mediante npm, con versiones fijadas en package-lock.json:

- MediaPipe Holistic / Hands / Pose: Google, Apache-2.0. https://github.com/google-ai-edge/mediapipe
- TensorFlow.js: Google, Apache-2.0. https://github.com/tensorflow/tfjs
- ONNX Runtime Web: Microsoft, MIT. https://github.com/microsoft/onnxruntime
- Babylon.js y loaders: Babylon.js contributors, Apache-2.0. https://github.com/BabylonJS/Babylon.js

Los assets, GLB, imágenes y modelos originales de TecSign son los suministrados por el usuario. Este trabajo no establece una nueva licencia de redistribución para esos archivos. Los videos fuente y landmarks completos se conservan en la zona local de investigación, fuera del deployment.

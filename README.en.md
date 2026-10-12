# TecSign — Web · Code Review Snapshot

**Experimental prototype | Mexican Sign Language (LSM)**

TecSign explores computer vision and temporal AI models for recognizing a **limited vocabulary of isolated signs**, with accompanying educational tools. It is **not a reliable general-purpose sign-language interpreter or translator**.

- Live public demonstration: https://gestostecsign.netlify.app/
- Spanish documentation: [README.md](README.md)
- Architecture: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md) (Spanish)

This repository contains a **selected snapshot of a generated website**. It is **not the original development/training repository**. It includes HTML, CSS, first-party JavaScript, public site configurations and educational assets. Some capitalization errors in paths were corrected.

**Excluded:** trained model weights (TensorFlow.js and ONNX), 3D avatar GLB assets, large vendored runtime libraries, and internal training assets. Consequently, **camera-based recognition and the 3D avatar are intentionally disabled** in this review copy, though their source logic may be examined in `js/`.

The production contact forms and chatbot have also been disabled to avoid sending test data to real accounts.

To view static pages and try the **text-only, pre-defined gloss examples** locally:

```bash
python -m http.server 8000
```

Then visit http://localhost:8000/demo-glosas.html . This does not process camera input or predict signs. See the public website for the hosted demonstration.

**Permissions:** no open-source license has been granted by this repository. Please do not assume that the code, images, or animations may be reused or redistributed. Any proposed collaboration, contribution rights and potential compensation require separate discussion. There is no guaranteed pay at the current experimental stage. Review third-party credits in [web/THIRD_PARTY_NOTICES.md](web/THIRD_PARTY_NOTICES.md).

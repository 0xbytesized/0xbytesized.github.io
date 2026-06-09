---
title: "OpenCV 5: así mete LLMs dentro de tu visión artificial"
date: "2026-06-09T17:35"
tags: ["opencv", "computer-vision", "deep-learning", "onnx", "python"]
excerpt: "OpenCV 5 trae un motor DNN nuevo, soporte para LLMs, inpainting con LaMa y feature matching neuronal. El cambio más grande en años."
---

OpenCV 5 ya está aquí. No es un incremento menor con unos cuantos parches de rendimiento. Es una reescritura del motor DNN, soporte nativo para modelos de lenguaje, _feature matching_ con redes neuronales y una limpieza del core que llevaba años pidiendo a gritos.

Si alguna vez has escrito `cv2.imread`, esto te afecta.

## El contexto: por qué OpenCV necesitaba un cambio

OpenCV lleva más de dos décadas siendo la columna vertebral de la visión artificial. Más de 86.000 estrellas en GitHub, más de un millón de instalaciones diarias y probablemente el catálogo más grande de algoritmos de visión del mundo.

Pero las cosas han cambiado desde OpenCV 4. Las aplicaciones modernas mezclan visión clásica, transformers, modelos de lenguaje, despliegue en edge y hardware heterogéneo. El viejo motor DNN se quedaba corto: cargabas un modelo ONNX moderno y rezabas para que no petara con un error de operador desconocido.

OpenCV 5 se diseñó para ese mundo.

## El plato fuerte: un motor DNN desde cero

El cambio que más gente va a notar es el nuevo motor DNN. OpenCV ha reconstruido su _backend_ de inferencia alrededor de un **grafo de operaciones tipado** con inferencia de formas, _constant folding_ y fusión de operadores.

¿El resultado? La cobertura de operadores ONNX pasó de cubrir menos de la mitad del estándar a prácticamente completo. Modelos con flujos de control (`If`, `Loop`), formas dinámicas y grafos cuantizados (QDQ) ahora cargan sin problemas.

Pero lo más interesante está en cómo acelera transformers. El nuevo motor reconoce el patrón `MatMul → Softmax → MatMul` que está en el corazón de cada transformer y lo colapsa en una sola operación de atención fusionada, con una implementación estilo FlashAttention. Sin tocar una línea de tu código.

Y lo han hecho sin romper nada. OpenCV 5 expone **tres motores** detrás de la misma API:

```python
import cv2 as cv

# Por defecto (ENGINE_AUTO): motor nuevo, fallback al clásico
net = cv.dnn.readNetFromONNX("modelo.onnx")

# Forzar el motor nuevo
net = cv.dnn.readNetFromONNX("modelo.onnx", engine=cv.dnn.ENGINE_NEW)

# Usar ONNX Runtime directamente (si se compiló con soporte)
net = cv.dnn.readNetFromONNX("modelo.onnx", engine=cv.dnn.ENGINE_ONNX_RUNTIME)

net.setInput(blob)
salida = net.forward()
```

El valor por defecto es `ENGINE_AUTO`: prueba el motor nuevo primero, y si el modelo no carga, cae al clásico. Tus pipelines existentes no se rompen el día que actualizas.

En benchmarks contra ONNX Runtime en CPU (Core i9-14900KS, Ubuntu 24.04), el motor nativo de OpenCV 5 es competitivo y en muchos casos **más rápido** — desde detectores ligeros como YOLO hasta modelos _open-vocabulary_ como OWLv2. Todo dentro de una sola dependencia.

## "¿OpenCV corriendo LLMs?" Sí, y no es un chiste

Esta es la parte que todavía me hace arquear una ceja. OpenCV 5 puede ejecutar **modelos de lenguaje y modelos de visión-lenguaje** directamente dentro del módulo DNN, sin un runtime separado.

Para conseguirlo han metido dos cosas que una librería de visión clásica nunca había necesitado: un **tokenizador** integrado y un **gestor de caché KV** para decodificación autorregresiva. Esto funciona con Qwen 2.5, Gemma 3, PaliGemma y la familia GPT-2.

```python
import cv2 as cv

# Un VLM (visión-lenguaje) corriendo dentro de OpenCV
net = cv.dnn.readNetFromONNX("paligemma.onnx")

# Preparar imagen + prompt de texto
blob = cv.dnn.blobFromImages([img], scalefactor=1/255.0)
net.setInput(blob)
respuesta = net.forward()  # texto generado
```

No, OpenCV no va a reemplazar un stack de _serving_ para chatbots en producción. Pero sí te da la capacidad de hacer OCR con comprensión semántica, _captioning_ o consultas _open-vocabulary_ dentro del mismo pipeline que ya usas para detectar objetos. Sin ensamblar cuatro frameworks distintos.

## LaMa: borrar objetos como si nunca hubieran estado

Uno de los demos más satisfactorios de la release es el _inpainting_ con LaMa. Le das una imagen y una máscara con lo que quieres eliminar, y el modelo rellena el hueco con bordes mezclados de forma natural:

```python
import cv2 as cv

net = cv.dnn.readNetFromONNX("lama.onnx")

# imagen y máscara binaria juntas en un blob
blob = cv.dnn.blobFromImages([img, mask], scalefactor=1/255.0)
net.setInput(blob)
inpainted = net.forward()  # imagen con el objeto eliminado
```

Un solo `forward()`. Sin dependencias externas. El ejemplo completo está en `samples/dnn/inpainting.py` de la rama 5.x y hay una versión con _diffusion_ en `samples/dnn/ldm_inpainting.py` si quieres ir más allá.

## Feature matching con esteroides neuronales

La detección y emparejamiento de características es uno de los trabajos más antiguos de OpenCV. Durante años fue SIFT u ORB y punto. OpenCV 5 incorpora un pipeline neuronal completo como ciudadano de primera clase:

- **SuperPoint** — detector y descriptor basado en CNN que encaja en los mismos puntos de llamada donde usabas SIFT.
- **DISK** — características aprendidas con _reinforcement learning_, fuerte en escenas con poca textura.
- **LightGlue** — un _matcher_ basado en atención que produce emparejamientos con puntuación de confianza.

Los detectores clásicos (SIFT, ORB, FAST) siguen ahí y los más oscuros se movieron a `opencv_contrib`. La migración es progresiva: usas lo neuronal donde ayuda y te quedas con lo de siempre donde basta.

## Un core más rápido, más limpio y con tipos de verdad

No todo es deep learning. El core ha recibido un repaso que beneficia hasta al código de procesamiento de imagen más básico:

- **FP16 y BF16 nativos** (`cv::hfloat`, `CV_16F`, `cv::bfloat`, `CV_16BF`). Adiós a convertir formatos a mano entre tu modelo y OpenCV.
- **Tensores N-dimensionales de verdad.** `cv::Mat` ahora soporta 0D (escalares) y 1D, que llevaban años tropezando a la gente porque el viejo Mat exigía al menos dos dimensiones.
- **_Broadcasting_** en el core. Las mismas operaciones matemáticas corren en CPU y aceleradores sin cambios.
- **Hasta 2× de mejora en cargas de trabajo matemáticas.**
- **API legacy en C deprecada.** C++17 como mínimo recomendado, con módulos C++20 planeados para más adelante.

## Mi veredicto

OpenCV 5 es justo lo que la librería necesitaba. El viejo motor DNN era un lastre: la cobertura de ONNX era un _subset_ impredecible y cada modelo nuevo era una moneda al aire. El nuevo motor basado en grafos resuelve eso de raíz, y el _fallback_ automático con `ENGINE_AUTO` es el detalle que convence a quien tiene pipelines en producción.

Lo de meter LLMs y VLMs dentro de OpenCV me parece un movimiento con más ruido que utilidad práctica inmediata — el _serving_ de modelos de lenguaje tiene sus propios runtimes por buenas razones —, pero como capacidad auxiliar para pipelines de visión es genuinamente útil. Poder preguntarle a un modelo "¿qué dice este cartel?" sin salir de OpenCV elimina fricción real.

El _feature matching_ neuronal y LaMa son adiciones que resuelven necesidades concretas sin meter ruido. Y la limpieza del core — tipos nativos modernos, _broadcasting_, C deprecada — era deuda técnica que por fin se ha pagado.

Si trabajas con visión artificial, la migración merece la pena solo por el motor DNN y los tipos nativos. El resto son regalos.

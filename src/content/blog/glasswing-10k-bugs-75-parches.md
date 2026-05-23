---
title: "Project Glasswing: ¿y si encontrar bugs ya no es el problema?"
date: "2026-05-23T14:35"
tags:
  - ciberseguridad
  - open-source
  - IA
  - Anthropic
  - vulnerabilidades
excerpt: "Anthropic ha encontrado más de 10.000 vulnerabilidades con Mythos Preview en un mes. Solo 75 se han parcheado. La industria ha cambiado de problema."
---

Hace un mes Anthropic lanzó [Project Glasswing](https://www.anthropic.com/research/glasswing-initial-update), un programa para usar su modelo **Claude Mythos Preview** —su modelo más avanzado, no disponible al público— para encontrar vulnerabilidades en el software más crítico del mundo. Los resultados del primer mes acaban de publicarse y las cifras son brutales: **más de 10.000 vulnerabilidades de severidad alta o crítica** encontradas en software de infraestructura esencial.

Pero aquí está el dato que de verdad importa: de las 530 vulnerabilidades altas/críticas que ya se han revelado a los mantenedores, **solo 75 se han parcheado**. El cuello de botella ya no es encontrar bugs. Es arreglarlos.

Y eso lo cambia todo.

## Los números que asustan (para bien y para mal)

El programa cuenta con unos 50 socios: empresas y proyectos que mantienen software fundamental para internet. Cloudflare, Mozilla, Oracle, Microsoft, Palo Alto Networks, bancos... Todos han estado usando Mythos Preview para escanear su código.

Algunos resultados:

- **Cloudflare** encontró 2.000 bugs (400 de severidad alta/crítica) con una tasa de falsos positivos que su equipo considera _mejor que la de testers humanos_.
- **Mozilla** encontró y arregló 271 vulnerabilidades en Firefox 150, más de diez veces las que encontraron en Firefox 148 usando otro modelo de Anthropic.
- En software open-source, Mythos escaneó **más de 1.000 proyectos** y encontró 6.202 vulnerabilidades estimadas como altas/críticas. De las 1.752 que han sido verificadas por firmas de seguridad independientes, **el 90,6% eran verdaderos positivos**.

Esa tasa de acierto es extraordinaria. Las herramientas de análisis estático tradicionales suelen generar tal cantidad de ruido que los equipos acaban ignorándolas. Un 90,6% de precisión significa que cuando Mythos te dice que tienes un problema, casi siempre tiene razón.

El caso más llamativo fue **wolfSSL**, una biblioteca criptográfica open-source usada por miles de millones de dispositivos. Mythos construyó un exploit que permitiría a un atacante **falsificar certificados** para hacerse pasar por cualquier banco o proveedor de email. La vulnerabilidad ya está parcheada y tiene asignado el CVE-2026-5194.

## La otra cara: la experiencia de curl

Pero no todo el mundo está igual de impresionado. **Daniel Stenberg**, creador y mantenedor principal de curl, [publicó su experiencia](https://daniel.haxx.se/blog/2026/05/11/mythos-finds-a-curl-vulnerability/) con Mythos y el contraste con el discurso de Anthropic es notable.

curl es probablemente una de las bases de código C más auditadas del planeta: 176.000 líneas, 188 CVEs publicados históricamente, fuzzing continuo con OSS-Fuzz, Coverity, CodeQL, y ya había pasado por varias herramientas de seguridad con IA como AISLE, Zeropath y Codex Security de OpenAI. Es, en palabras del propio informe de Mythos, "una de las bases de código C más fuzzeadas y auditadas que existen".

¿El resultado? Mythos reportó **5 vulnerabilidades "confirmadas"**. Tras revisión humana del equipo de seguridad de curl: **una era real**. Severidad baja. Las otras cuatro eran tres falsos positivos (comportamientos documentados en la API) y un bug sin implicaciones de seguridad.

La conclusión de Stenberg es directa:

> "No veo evidencia de que este sistema encuentre problemas a un nivel particularmente más alto o avanzado que el que otras herramientas ya han encontrado antes que Mythos."

No es que Mythos sea malo. Es que **curl ya estaba extremadamente bien auditado**. El modelo no encontró _cero_ vulnerabilidades de corrupción de memoria. Cero. En 176.000 líneas de C. Eso dice más de curl que de Mythos.

## El verdadero problema: la asimetría encontrar-arreglar

Aquí hay dos realidades que conviven:

**Realidad A (Anthropic):** Hay miles de proyectos open-source que _no_ son curl. Proyectos con menos recursos, menos auditorías, menos fuzzing. Ahí Mythos está encontrando bugs reales a un ritmo sin precedentes. La tasa de acierto del 90,6% en 1.752 vulnerabilidades verificadas por firmas independientes no es marketing: es un dato validado externamente.

**Realidad B (Stenberg):** En proyectos bien mantenidos, el valor marginal de un modelo más potente es decreciente. Las primeras pasadas con cualquier herramienta de IA decente ya encontraron la fruta madura. Lo que queda requiere revisión humana cuidadosa.

Pero el verdadero titular no es cuántos bugs encuentra Mythos. Es qué pasa después de encontrarlos.

Anthropic ha informado de 530 vulnerabilidades altas/críticas a mantenedores. Solo 75 se han parcheado. **Varios mantenedores les han pedido explícitamente que reduzcan el ritmo de disclosure** porque no tienen capacidad para diseñar parches. Un bug alto/crítico tarda de media **dos semanas** en parchearse.

Piénsalo: el ritmo al que la IA encuentra bugs ha superado el ritmo al que los humanos podemos arreglarlos. Es un problema estructural nuevo.

## Cómo se ve esto en la práctica

Imaginemos el pipeline de seguridad de un proyecto open-source típico antes y después de Mythos. Antes, el flujo era más o menos así:

```python
# Pipeline de seguridad tradicional (conceptual)
# Los bugs llegaban con cuentagotas

def traditional_security_pipeline():
    bugs = wait_for_reports()  # Llegan ~5-10 bugs/semana
    for bug in bugs:
        if triage(bug):        # ~30% son válidos
            assign_to_developer(bug)
            # El dev tiene tiempo de sobra para analizar y parchear
```

Ahora, con herramientas como Mythos, el pipeline se ha invertido:

```python
# Pipeline post-Mythos (conceptual)
# El cuello de botella ya no es encontrar, es procesar

def modern_security_pipeline():
    bugs = ai_scan_codebase()  # Llegan cientos de bugs de golpe
    # El triage se convierte en el cuello de botella
    confirmed = []
    for bug in bugs:
        if human_triage(bug):  # Requiere horas de experto por bug
            confirmed.append(bug)

    # Ahora tienes 100 bugs reales y 2 developers
    # Priorizas, pero el backlog no para de crecer
```

El cambio fundamental es que el paso `ai_scan_codebase()` es ahora órdenes de magnitud más rápido y más barato que `human_triage()`. Y como los modelos siguen mejorando, esta asimetría solo va a crecer.

El propio Anthropic reconoce el problema y sugiere soluciones prácticas: ciclos de parcheo más cortos, actualizaciones más fáciles de instalar para los usuarios y controles básicos de seguridad (MFA, hardening de redes, logs) que protejan incluso mientras los parches están en camino.

También han lanzado **Claude Security** (en beta para clientes enterprise), una herramienta que no solo encuentra bugs sino que genera parches propuestos. En tres semanas ya ha servido para parchear más de 2.100 vulnerabilidades. La diferencia clave: en enterprise, el que arregla el bug es el mismo equipo que lo encuentra. En open-source, dependes de mantenedores voluntarios.

## Mi opinión

Creo que tanto Anthropic como Stenberg tienen parte de razón, pero la discusión sobre si Mythos es "revolucionario" o "más de lo mismo" se está perdiendo el bosque por el árbol.

El bosque es esto: **por primera vez en la historia de la ciberseguridad, encontrar vulnerabilidades ha dejado de ser el cuello de botella**. No importa si el modelo que lo hace es un 20% mejor o un 200% mejor que el anterior. El salto cualitativo ya se ha producido: podemos encontrar bugs más rápido de lo que podemos arreglarlos.

Esto tiene implicaciones profundas:

1. **Los proyectos open-source necesitan financiación para _arreglar_, no solo para _encontrar_.** Dedicar recursos a escanear código sin dedicar recursos equivalentes a parchearlo es como diagnosticar enfermedades sin tener médicos que las traten.

2. **El modelo de disclosure de 90 días se queda corto.** Si un atacante con un modelo similar puede encontrar la misma vulnerabilidad en horas, esperar 90 días para revelarla es una eternidad. Anthropic lo sabe y por eso están empujando ciclos más cortos.

3. **El valor de escribir código seguro desde el principio se multiplica.** curl es la prueba viviente: años de prácticas defensivas (buffers dinámicos acotados, verificaciones de overflow en cada parseo numérico, límites de respuesta por protocolo) hacen que incluso el mejor escáner de IA se quede sin balas. La higiene de código paga dividendos exponenciales.

4. **Los modelos de IA no encuentran clases de bugs nuevas.** Como señala Stenberg, encuentran nuevas instancias de clases conocidas. Eso significa que las defensas existentes (análisis estático, fuzzing, revisión de código) siguen siendo relevantes. La IA es una capa más, no un reemplazo.

Lo más inquietante del informe de Anthropic es la frase final: "modelos tan capaces como Mythos Preview pronto serán desarrollados por muchas empresas de IA diferentes". Cuando cualquiera pueda ejecutar un escáner de este calibre, la ventana entre "bug encontrado" y "bug explotado" se medirá en horas, no en meses.

La pregunta ya no es cuántos bugs puedes encontrar. Es cuántos puedes arreglar antes de que alguien los encuentre con intenciones menos nobles.

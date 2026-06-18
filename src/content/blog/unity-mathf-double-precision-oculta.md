---
title: "Unity te engaña: Mathf hace todo en double y no te lo dice"
date: "2026-06-18T15:00"
tags: ["unity", "csharp", "rendimiento", "floating-point", "mono"]
excerpt: "UnityEngine.Mathf convierte tus floats a double, opera y vuelve a float. System.MathF es hasta un 50% más rápido. Aras Pranckevičius lo ha desmontado."
---

Hace unos días [Aras Pranckevičius](https://aras-p.info/) —sí, el que fue graphics lead en Unity y ahora está en Godot— publicó un análisis que debería ser lectura obligatoria para cualquiera que escriba C# en Unity. El título es modesto: "Unity vs floating point". El contenido es una autopsia de todo lo que Unity hace mal con los números decimales.

El detonante fue un tweet de [@VehiclePhysics](https://x.com/VehiclePhysics) con un consejo aparentemente simple: usa `System.MathF` en vez de `UnityEngine.Mathf` para funciones como `Sqrt`, `Sin`, `Cos` o `Pow`. La razón: `Mathf` convierte tu `float` a `double`, llama a la versión double de la función, y luego vuelve a convertir a `float`. `MathF` opera directamente en `float`. Menos trabajo, mismo resultado.

El consejo es correcto. Pero lo que Aras descubrió al rascar la superficie es bastante más salvaje.

## El problema no es solo Mathf: es Mono

Unity usa tres backends de scripting: **Mono** (el runtime por defecto en el editor y builds standalone), **IL2CPP** (convierte IL a C++ y compila nativo) y **Burst** (compilador HPC# para jobs DOTS).

El problema gordo está en Mono. Hace décadas, el equipo de Mono tomó una decisión que Miguel de Icaza describió así:

> "In Mono, decades ago, we made the mistake of performing all 32-bit float computations as 64-bit floats while still storing the data in 32-bit locations."

Traducción: **todo** el cálculo con floats en Mono se hace realmente en double. Cada operación aritmética con floats implica conversiones `float→double→float` constantes. Unity nunca activó el fix que Mono oficial incorporó después, por miedo a romper compatibilidad hacia atrás.

## Veamos qué pasa con una raíz cuadrada

Aras escribió un loop mínimo para medirlo:

```csharp
const int N = 10_000_000;

// Versión clásica de Unity
public static float ConMathf(float v)
{
    for (int i = 0; i < N; ++i)
        v += UnityEngine.Mathf.Sqrt(v);
    return v;
}

// Versión con System.MathF
public static float ConMathF(float v)
{
    for (int i = 0; i < N; ++i)
        v += System.MathF.Sqrt(v);
    return v;
}
```

Los resultados en el editor de Unity (Ryzen 5950X, Unity 6000.0.76):

| Modo | `Mathf.Sqrt` | `MathF.Sqrt` |
|------|-------------|--------------|
| Editor Debug | 282 ms | 186 ms |
| Editor Release | 242 ms | 149 ms |

`MathF` es un **38-40% más rápido** en el editor. Pero la historia se complica cuando metemos IL2CPP y Burst en la ecuación:

| Backend | `Mathf` | `MathF` | `Mathematics` |
|---------|--------|---------|---------------|
| Editor Debug | 282 | 186 | 260 |
| Editor Release | 242 | 149 | 211 |
| Player Mono | 212 | 142 | 209 |
| Player IL2CPP | 35 | 35 | 59 |
| Burst | 66 | ❌ no soportado | 34 |

La referencia "máxima velocidad posible" en esa máquina son 35 ms (C++ con `sqrtf` o .NET 10 con `MathF`).

## El código máquina no miente

Aras usó el Asm Explorer de Sebastian Schöner para ver qué instrucciones genera realmente Mono con `Mathf.Sqrt`. El resultado es una pesadilla. El cuerpo del bucle —una sola línea de C#— se convierte en esto:

```asm
loop:
  movss   xmm0, [rsp+0x10]    ; xmm0 = v (float)
  cvtss2sd xmm0, xmm0         ; xmm0 = (double)v
  movss   xmm1, [rsp+0x10]    ; xmm1 = v otra vez
  cvtss2sd xmm1, xmm1         ; xmm1 = (double)v
  cvtsd2ss xmm5, xmm1         ; xmm5 = (float)(double)v ← ¿por qué?
  movss   [rsp+0x8], xmm5     ; guardar temporal
  movss   xmm1, [rsp+0x8]     ; cargar temporal
  cvtss2sd xmm1, xmm1         ; xmm1 = (double)temporal
  movsd   [rsp-0x8], xmm1     ; guardar para x87
  fld     qword [rsp-0x8]     ; push a pila x87
  fsqrt                       ; sqrt en x87 (doble precisión)
  fstp    qword [rsp-0x8]     ; pop resultado double
  movsd   xmm1, [rsp-0x8]     ; xmm1 = sqrt (double)
  cvtsd2ss xmm1, xmm1         ; xmm1 = (float)sqrt
  cvtss2sd xmm1, xmm1         ; xmm1 = (double)(float)sqrt
  cvtsd2ss xmm5, xmm1         ; xmm5 = sqrt redondeado a float
  movss   [rsp+0x8], xmm5     ; guardar temporal
  movss   xmm1, [rsp+0x8]     ; cargar temporal
  cvtss2sd xmm1, xmm1         ; xmm1 = (double)temporal
  cvtsd2ss xmm5, xmm1         ; redondear otra vez
  movss   [rsp+0x8], xmm5     ; guardar otra vez
  movss   xmm1, [rsp+0x8]     ; cargar otra vez
  cvtss2sd xmm1, xmm1         ; a double otra vez
  addsd   xmm0, xmm1          ; suma en double
  cvtsd2ss xmm5, xmm0         ; resultado a float
  movss   [rsp+0x10], xmm5    ; v = resultado
  inc     esi                 ; ++i
  cmp     esi, 0x989680       ; i < N?
  jl      loop
```

Son **26 instrucciones** para `v += Mathf.Sqrt(v)`. Hay **ocho** conversiones float↔double, cuatro stores/loads a memoria temporales, y encima usa la vieja FPU x87 (`fsqrt`) en vez de las instrucciones SSE escalares (`sqrtss`).

Con `System.MathF.Sqrt`, el mismo loop genera esto:

```asm
loop:
  movss   xmm0, [rbp-0x10]    ; xmm0 = v
  cvtss2sd xmm0, xmm0         ; lhs = (double)v
  movsd   [rbp-0x18], xmm0    ; guardar lhs
  movss   xmm0, [rbp-0x10]    ; xmm0 = v
  cvtss2sd xmm0, xmm0         ; a double
  cvtsd2ss xmm0, xmm0         ; a float (argumento)
  call    MathF.Sqrt(float)   ; sqrtss + check negativo
  cvtss2sd xmm1, xmm0         ; rhs = (double)sqrt
  movsd   xmm0, [rbp-0x18]    ; recuperar lhs
  addsd   xmm0, xmm1          ; suma double
  cvtsd2ss xmm5, xmm0         ; resultado a float
  movss   [rbp-0x10], xmm5    ; v = resultado
  inc     esi
  cmp     esi, 0x989680
  jl      loop
```

Siguen habiendo conversiones float↔double (porque Mono insiste en hacer la suma en double), pero son muchas menos y la raíz cuadrada usa `sqrtss` —instrucción SSE escalar de precisión simple— en vez de la FPU x87.

## IL2CPP y Burst: cada uno a su bola

Aquí es donde el análisis de Aras se vuelve fascinante. Los tres backends **no se ponen de acuerdo** sobre qué funciones reciben "tratamiento especial".

**IL2CPP** con `Mathf.Sqrt` genera `sqrtf()` de C directamente —ignora que a nivel C# la implementación pasa por double. Es un caso de "shipeas tu organigrama": el equipo de IL2CPP añadió un reconocimiento especial para `Mathf.Sqrt` que el equipo de Burst no hizo.

**Burst** hace justo lo contrario: trata `Mathematics.math.sqrt` como `vsqrtss` (precisión simple nativa) pero deja `Mathf.Sqrt` como `vcvtss2sd + vsqrtsd + vcvtsd2ss` (doble precisión).

**IL2CPP** con `Mathematics.math.sqrt` es el peor caso: hace la raíz en double **y además** mete dos branches de inicialización lazy por cada llamada. Sí, dentro del hot loop.

El resultado es que no hay una respuesta única a "¿qué función debo usar?". Depende de si compilas con IL2CPP, Burst, ambos o ninguno.

## El dato curioso que lo confirma todo

Aras comprobó el resultado numérico del loop tras 10 millones de iteraciones. Todas las variantes de Unity devuelven `24212990000000.0`. Ese número **no existe** como float de 32 bits —los floats más cercanos son `24212989280256.0` y `24212991377408.0`. Las implementaciones no-Unity (.NET, C++) devuelven `24212987183104.0`.

Es la prueba definitiva de que, en algún punto de la cadena, Unity está operando con doubles y redondeando de formas que un float puro nunca produciría.

## Unity.Mathematics tampoco se salva

Podrías pensar que `Unity.Mathematics` —el paquete introducido en 2019 para DOTS, diseñado para parecerse a HLSL— sí opera en float nativo. Pues no. Funciones como `math.sqrt(float x)` internamente hacen:

```csharp
public static float sqrt(float x)
{
    return (float)System.Math.Sqrt((float)x);
}
```

Es decir, convierten a float (por si acaso), llaman a `Math.Sqrt` que opera en double, y convierten el resultado a float. Otra vez double por debajo.

La excepción es Burst, que sí reconoce `Mathematics.math.sqrt` y lo compila a `vsqrtss` nativo. Pero solo Burst.

## ¿Tiene arreglo esto?

Unity está migrando a **CoreCLR** (el runtime de .NET moderno) para reemplazar a Mono. Lo anunciaron en la GDC 2026 con la charla ["Path to CoreCLR"](https://www.youtube.com/watch?v=YzpHGWspl28). CoreCLR no tiene el problema de "todo es double" y su codegen es radicalmente mejor.

Mientras tanto, Sebastian Schöner está trabajando en [cpp2better](https://github.com/sschoner/cpp2better), una herramienta que mejora el codegen de IL2CPP. Y si necesitas rendimiento ya, la recomendación de Aras es clara: **Burst + Unity.Mathematics** para código caliente.

## Mi opinión

Este artículo me parece una joya por varias razones. Primero, porque ejemplifica algo que pasa en todo el software: las decisiones técnicas de hace décadas se convierten en deuda que nadie se atreve a pagar por miedo al "backwards compatibility". Mono decidió hacer todo en double en los 2000, Unity heredó ese comportamiento, y aquí estamos en 2026 con `Mathf.Sqrt` generando 26 instrucciones para una operación que deberían ser 2.

Segundo, porque demuestra el valor de mirar el código máquina. Sin el Asm Explorer de Schöner, nadie vería las 8 conversiones float↔double que Mono escupe para una simple raíz cuadrada. El perfilador te dice "esto va lento", el desensamblador te dice **por qué**.

Y tercero, porque es un recordatorio de que las abstracciones tienen fugas. `Mathf.Sqrt(float)` parece inofensivo. Su implementación es `(float)Math.Sqrt((double)f)`. También parece inofensiva. Pero el runtime que hay debajo convierte esa inocencia en un desastre de instrucciones.

Si escribes C# en Unity, hazte un favor: lee el artículo completo de Aras y luego revisa cuántos `Mathf.Sqrt`, `Mathf.Sin` y `Mathf.Pow` tienes en tus hot paths. La migración a `MathF` son 5 minutos de find-and-replace que te pueden dar un 40% gratis.

---

**Fuente:** [Unity vs floating point — Aras Pranckevičius](https://aras-p.info/blog/2026/06/11/Unity-vs-floating-point/) (11 junio 2026), 43 puntos en Hacker News.

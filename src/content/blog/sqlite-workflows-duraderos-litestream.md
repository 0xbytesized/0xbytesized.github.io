---
title: "SQLite es suficiente para tus workflows en producción"
date: "2026-05-30T00:12"
tags: ["sqlite", "workflows", "backend", "arquitectura", "litestream"]
excerpt: "No necesitas Postgres ni Temporal para ejecución duradera. Una SQLite, Litestream y workers desechables bastan para la mayoría de sistemas con agentes."
---

Hace unos días DBOS publicó un artículo defendiendo que [Postgres es todo lo que necesitas para ejecución duradera](https://www.dbos.dev/blog/postgres-is-all-you-need-for-durable-execution). El argumento: si ya confías en tu base de datos, no necesitas una capa de orquestación separada. Tomas Obele —el autor de Obelisk, un motor de workflows open source— cogió esa idea y la llevó más lejos: para una gran cantidad de sistemas, **SQLite es todo lo que necesitas**.

La premisa es contraintuitiva. SQLite es una base de datos embebida, sin servidor, que vive en un archivo. ¿Cómo va a sostener workflows que necesitan garantías de durabilidad? La respuesta está en repensar qué significa "duradero".

## Lo duradero es el estado, no la infraestructura

Cuando hablamos de ejecución duradera solemos imaginar infraestructura compleja: colas de mensajes, bases de datos replicadas, orquestadores con failover automático. Pero Obele plantea algo más simple: **la parte duradera es el estado del workflow, no el cómputo**. El cómputo puede ser barato y desechable.

En Obelisk, el progreso de un workflow vive en un log de ejecución. Los workflows se reproducen desde el historial persistido y las actividades se pueden reintentar. Lo único que necesitas proteger es ese log. Y para eso SQLite es perfecto.

```sql
-- Un log de ejecución mínimo en SQLite
CREATE TABLE workflow_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_workflow_log_wf ON workflow_log(workflow_id, created_at);

-- Reconstruir el estado de un workflow desde su log
SELECT event_type, payload, created_at
FROM workflow_log
WHERE workflow_id = 'wf_abc123'
ORDER BY created_at;
```

Cada paso del workflow se registra como un evento inmutable. Si un worker se cae a mitad de una tarea, el siguiente worker lee el log, ve dónde se quedó y retoma desde ahí. No necesitas un clúster de Kafka para esto.

## SQLite como motor de durabilidad transaccional

La gran ventaja de SQLite es que te da estado transaccional duradero sin añadir un servicio de base de datos separado. No hay salto de red, no hay plano de control adicional y no hay nueva superficie operativa solo para mantener a salvo el progreso de tus workflows.

Esto es especialmente relevante cuando despliegas en micro-VMs, contenedores o entornos efímeros. Un archivo de base de datos local es exactamente el nivel adecuado de maquinaria para muchos sistemas:

```python
import sqlite3
import json

def execute_workflow_step(db_path: str, workflow_id: str, step_name: str, fn):
    """Ejecuta un paso del workflow con garantía transaccional."""
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL")  # Write-Ahead Log
    try:
        # Registrar que empezamos el paso
        conn.execute(
            "INSERT INTO workflow_log (workflow_id, event_type, payload) VALUES (?, ?, ?)",
            (workflow_id, f"step_start:{step_name}", json.dumps({"status": "running"}))
        )
        conn.commit()

        # Ejecutar la lógica real
        result = fn()

        # Registrar éxito
        conn.execute(
            "INSERT INTO workflow_log (workflow_id, event_type, payload) VALUES (?, ?, ?)",
            (workflow_id, f"step_end:{step_name}", json.dumps({"status": "ok", "result": result}))
        )
        conn.commit()
        return result

    except Exception as e:
        conn.execute(
            "INSERT INTO workflow_log (workflow_id, event_type, payload) VALUES (?, ?, ?)",
            (workflow_id, f"step_error:{step_name}", json.dumps({"error": str(e)}))
        )
        conn.commit()
        raise
    finally:
        conn.close()
```

El patrón es sencillo: registrar intención, ejecutar, registrar resultado. Si el proceso muere después del primer `INSERT` pero antes del segundo, al reiniciar sabes exactamente qué paso necesita reintento. No hay mensajes perdidos en colas ni estados zombie en un orchestrator externo.

## Litestream: el backup que lo cambia todo

La objeción obvia es qué haces con esos archivos SQLite cuando empiezan a acumularse docenas o cientos de instancias. Ahí entra [Litestream](https://litestream.io/), una herramienta que replica cambios de SQLite de forma asíncrona a almacenamiento compatible con S3.

```bash
# Configuración mínima de Litestream
cat > /etc/litestream.yml <<EOF
dbs:
  - path: /data/workflows.db
    replicas:
      - type: s3
        bucket: mis-workflows-backup
        path: prod/
        endpoint: https://s3.eu-west-1.amazonaws.com
EOF

# Iniciar replicación continua en background
litestream replicate
```

Con esto, cada worker tiene su SQLite local para latencia cero y Litestream copia los cambios a S3 en segundo plano. Si un worker desaparece, restauras desde el último snapshot de S3 y pierdes como mucho unos segundos de escrituras. Para la mayoría de workflows con agentes de IA —que son bursty, experimentales y toleran cierta pérdida— este modelo es más que suficiente.

La advertencia importante: la replicación de Litestream es asíncrona. Si el volumen que contiene la SQLite desaparece antes de que los últimos writes se hayan copiado a S3, esos writes se pierden. Para un sistema financiero esto sería inaceptable; para un agente que genera documentos o analiza datos, probablemente no.

## Cuándo funciona este modelo

Este patrón brilla en varios escenarios concretos:

**Workflows con agentes de IA.** Son rafagueados por naturaleza. Un agente puede estar inactivo durante horas y de repente lanzar 50 tareas. Tener una flota de micro-VMs cada una con su SQLite en lugar de un monolito compartido es más barato y da mejor aislamiento de fallos.

**Procesamiento de datos por tenant.** Si procesas datos de múltiples clientes, darle a cada uno su propia SQLite elimina de raíz los problemas de noisy neighbor y simplifica la facturación por uso.

**CI/CD y tareas programadas.** Un runner de CI que persiste su estado en SQLite local no necesita conectarse a ninguna infraestructura externa para saber qué pasos ya ejecutó.

El propio Obele lo resume bien: un modelo operativo donde tienes workers con SQLite, Litestream haciendo backup a S3 y un observer que inspecciona bases de datos interesantes cuando hace falta. El mismo archivo sirve para replay local, debugging y entender qué hizo un agente.

## Cuándo NO usar SQLite

Obele es honesto sobre las limitaciones. SQLite no es la respuesta para cada forma de despliegue. Su herramienta Obelisk también soporta Postgres y es la opción correcta cuando necesitas:

- Alta disponibilidad con failover automático
- Escalabilidad compartida entre muchas instancias
- Replicación síncrona con garantías de no pérdida de datos
- Concurrencia de escritura alta desde múltiples procesos simultáneos

Muchos sistemas no necesitan nada de eso el día uno y no deberían empezar con más infraestructura de la que su estado realmente exige. Empezar con SQLite y migrar a Postgres cuando las métricas lo justifiquen es una estrategia perfectamente válida.

## Mi opinión

Hay una corriente en nuestra industria que trata SQLite como un juguete para prototipos y apps móviles. Es un error. SQLite es una de las piezas de software mejor testeadas del planeta —su test suite tiene el equivalente a miles de millones de años de pruebas— y maneja perfectamente cargas de trabajo que la mayoría de startups nunca alcanzarán.

El patrón SQLite + Litestream + workers desechables me parece el default sensato para sistemas con agentes en 2026. No es para todos los casos —si estás construyendo un procesador de pagos, por favor usa Postgres con replicación síncrona— pero cubre el 80% de los escenarios reales con un 20% de la complejidad operativa.

La parte que más me convence es la filosofía: **la durabilidad está en el estado, no en el cómputo**. Trata tus workers como ganado, no como mascotas. Si un worker muere, que otro lea el log y siga. Es el mismo principio que llevó a la industria de los servidores físicos a los contenedores, aplicado a la capa de workflows.

Y si dentro de seis meses tu sistema crece hasta necesitar Postgres, la migración es directa: el log de eventos es el mismo, solo cambia el `CREATE TABLE` de destino.

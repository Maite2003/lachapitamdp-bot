# 📄 Documentación Técnica y Registro de Decisiones (ADR)

**Proyecto:** Chatbot Comercial con IA para WhatsApp
**Versión:** 1.1.0
**Estado:** En desarrollo (MVP)
**Fecha de última actualización:** 10 de Diciembre de 2025

---

## 1. Visión del Producto
El objetivo es desarrollar una solución de **Automatización de Ventas B2B** para distribuidoras (insumos cerveceros). El sistema permite automatizar la atención sin perder el control del WhatsApp personal.

### Diferencial Tecnológico (RAG Estricto)
* **Inteligencia:** LLMs para interpretar lenguaje natural.
* **Veracidad:** Respuestas generadas **únicamente** con datos de la base de datos local (Supabase). Prohibición estricta de "alucinar" precios.

---

## 2. Estrategia de Datos (Supabase / PostgreSQL)

Se utiliza un enfoque híbrido (SQL + JSONB).

### A. Tabla: `configuracion_negocio` (Singleton)
Una única fila controla la identidad del bot (horarios, links, mensajes).

### B. Tabla: `productos` (Esquema Dinámico)
* **Interfaz de Código:** Se estandariza el uso de claves en inglés para el Backend (`name`, `category`, `price`, `last_synced_at`).
* **Manejo de Precios:** Columna `price` (JSONB Array) para manejar múltiples presentaciones y escalas.
    * *Ejemplo:* `[{ "presentation": "Bolsa 25kg", "min": 1, "max": 3, "price": 25000 }]`.
* **Auditoría:** Campo `last_synced_at` para controlar la frescura de los datos respecto al Excel maestro.

### C. Tabla: `pedidos` (Snapshot)
Copia del precio unitario al momento de la venta para garantizar integridad histórica.

---

## 3. Pipeline de Sincronización de Datos (ETL)

**Fuente de Verdad:** Google Sheets (Mantenido por el dueño del negocio).
**Destino:** Supabase (Consumido por el Bot).

### Decisión de Diseño: Mapeo Dinámico de Columnas
Para evitar modificar el código cada vez que el negocio agrega una nueva presentación de venta (ej: "Pack Navidad"), se implementó un **Parser de Encabezados con Regex**.

1.  **Regla de Detección:** El sistema escanea los encabezados del Excel. Cualquier columna que comience con el prefijo **"P."** (ej: `P. 4-10 Bolsas`) se interpreta automáticamente como una regla de precio.
2.  **Inferencia de Reglas:**
    * Se extraen rangos numéricos (min/max) y unidades del texto del encabezado mediante Expresiones Regulares.
    * *Ejemplo:* "P. 4-10 Bolsas" -> `{ min: 4, max: 10, presentation: "Bolsas" }`.

### Decisión de Optimización: Pre-Cálculo de Metadatos
Para garantizar el rendimiento con catálogos grandes, se optimizó el algoritmo de lectura:
* **Problema:** Ejecutar Regex en cada celda es ineficiente ($O(N \times M)$).
* **Solución:** Se analizan los encabezados **una sola vez** al inicio de la ejecución, generando un "Mapa de Índices".
* **Resultado:** Durante el recorrido de las filas de productos, el acceso a los precios es directo ($O(1)$) usando los índices pre-calculados, reduciendo drásticamente la carga de CPU.

---

## 4. Arquitectura del Sistema (Microservicios)

### Componente A: El Cerebro (API REST - Next.js)
* Expone endpoints para el Bot y ejecuta el **Sync Job** (ETL).
* Normaliza los datos del Excel a la estructura JSONB de Supabase.

### Componente B: El Cuerpo (WhatsApp Worker - Node.js)
* Alojado en Render (Docker).
* Consume la API REST.
* **Filtro de Usuarios:** Solo responde a no agendados o contactos con etiqueta "cliente".

---

## 5. Flujo de Información (RAG)

1.  **Input:** "Precio de 10 bolsas de malta".
2.  **Retrieval:** API busca producto y filtra el array JSON `price` donde `min <= 10` y `max >= 10`.
3.  **Generación:** IA redacta la respuesta usando ese precio exacto.
4.  **Output:** WhatsApp envía el mensaje.
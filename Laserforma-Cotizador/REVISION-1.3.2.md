# Revisión Laserforma 1.3.2 — 28 de octubre de 2026

Correcciones: navegación por apartados independientes, selector de pieza y actualización de material/espesor/velocidad/cantidad, formatos configurables antes de importar, prevención de duplicados al agregar y revisión comercial independiente. Las nuevas cotizaciones conservan piezas y parámetros para reabrirlas; los registros antiguos que solo guardaban totales no contienen geometría recuperable. El PDF comercial excluye reserva de producción y desglose interno de material.

Verificación antes del empaquetado:
- 26 pruebas automatizadas de cálculo y geometría: aprobadas.
- 17 comprobaciones de interfaz sobre React en Electron: aprobadas, sin errores detectados en ese recorrido.
- Compilación Vite y empaquetado Electron Windows x64: completados.

Las pruebas cubren importación de ejemplo, navegación, material, cantidad, distribución, generación de la revisión comercial e historial. No garantizan ausencia de fallos en todos los DXF ni sustituyen la validación CAM en CypCut.

Para repetir: node --test tests/*.test.js. Para interfaz, iniciar Vite en 127.0.0.1:5174 y ejecutar Electron con tests/ui-smoke.cjs. El resultado queda en .tmp/ui-test-results.json.

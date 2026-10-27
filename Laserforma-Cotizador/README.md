# Laserforma Cotizador 1.3.1

Cotizador de corte láser para Windows, basado en React y Electron.

## Interfaz
Replica la maqueta aprobada: navegación superior, panel de diseños a la izquierda, pieza y material en el centro, resumen económico y costos a la derecha. Incluye temas claro, oscuro y sistema.

## Alcance actual
- Importación de DXF ASCII 2D, hasta 10 MB por archivo.
- Varias piezas por trabajo, agrupadas por material y espesor.
- Distribución orientativa por filas con giros opcionales de 90°, zoom y desplazamiento.
- Planchas, tiras y retazos rectangulares, con separación, márgenes, reserva y precio proporcional al bloque ocupado.
- Cotización solo corte, historial local con eliminación confirmada, PDF comercial y CSV.

DWG y PDF todavía no se importan como geometría CAD. La distribución final se decide en CypCut. Los costos, formatos e historial se guardan localmente en cada computador y no se sincronizan.

## Windows
Descomprime el ZIP completo y abre `Laserforma Cotizador.exe`. El ejecutable necesita los demás archivos de su carpeta. No tiene firma digital.

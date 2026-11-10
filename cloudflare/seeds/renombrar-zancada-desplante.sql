-- 10/11/2026: Leilani pidió llamar «desplante/desplantes» a lo que la biblioteca llamaba «zancada».
-- Solo renombra (mismo id, mismos vínculos, rutinas e historial intactos). Se puede correr varias veces.
-- Los registros de entrenamientos ya hechos guardan el nombre de ese día y no se tocan.
UPDATE exercises SET name_es = v.column2, name_es_key = v.column3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('zancada hacia atras', 'Desplante hacia atrás', 'desplante hacia atras'),
  ('zancada caminando', 'Desplantes caminando', 'desplantes caminando'),
  ('zancada lateral', 'Desplante lateral', 'desplante lateral'),
  ('zancada cruzada', 'Desplante cruzado', 'desplante cruzado'),
  ('zancadas con salto', 'Desplantes con salto', 'desplantes con salto'),
  ('zancada hacia delante en smith', 'Desplante hacia delante en Smith', 'desplante hacia delante en smith')
) v
WHERE exercises.name_es_key = v.column1;

UPDATE exercises SET description = 'Desplante alternando el paso hacia adelante con la barra guiada.', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE name_es_key = 'desplante hacia delante en smith' AND description = 'Zancada alternando el paso hacia adelante con la barra guiada.';

UPDATE movement_patterns SET name_es = 'Desplante', name_es_key = 'desplante', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE name_es_key = 'zancada';

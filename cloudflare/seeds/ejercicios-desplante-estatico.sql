-- Generado por scripts/ejercicios-desplante-estatico.mjs (no editar a mano). 3 ejercicios.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Desplante estático con mancuernas', 'Dumbbell split squat', 'desplante estatico con mancuernas', 'dumbbell split squat', 'Desplante sin mover los pies: con una pierna adelante y otra atrás, se baja y se sube en el mismo lugar, con una mancuerna en cada mano.', '1. De pie con una mancuerna en cada mano, da un paso largo hacia adelante y apoya la punta del pie de atrás.
2. Con el tronco erguido, baja en vertical hasta que la rodilla de atrás casi toque el piso.
3. Empuja con el pie de adelante para subir sin mover los pies.
4. Completa las repeticiones y cambia de pierna.', 'Pasos muy cortos que llevan la rodilla delantera muy adelante.
Dejar que la rodilla delantera se vaya hacia adentro.
Inclinar el tronco hacia adelante sin indicación.', 'Separa los pies al ancho de la cadera, como sobre dos rieles, para no perder el equilibrio.
Inclinar un poco el tronco carga más el glúteo; erguido, más el cuádriceps.', 1, 1, 'desplante'),
  ('Desplante estático en Smith', 'Smith machine split squat', 'desplante estatico en smith', 'smith machine split squat', 'Desplante estático con la barra guiada de la Smith sobre la espalda alta; la máquina da estabilidad para cargar más.', '1. Coloca la barra sobre la espalda alta y desbloquéala.
2. Da un paso largo hacia adelante y apoya la punta del pie de atrás.
3. Baja en vertical hasta que la rodilla de atrás casi toque el piso.
4. Empuja con el pie de adelante para subir, completa las repeticiones y cambia de pierna.', 'Colocar el pie delantero justo debajo de la barra, lo que manda la rodilla muy adelante.
Rebotar abajo.', 'Ajusta la posición de los pies sin peso antes de empezar.
Deja los seguros a una altura que te permita salir.', 1, 1, 'desplante'),
  ('Desplante estático con barra', 'Barbell split squat', 'desplante estatico con barra', 'barbell split squat', 'Desplante estático con barra libre sobre la espalda alta; pide más equilibrio que con mancuernas o en Smith.', '1. Saca la barra del rack sobre la espalda alta.
2. Da un paso largo hacia adelante y apoya la punta del pie de atrás, pies al ancho de la cadera.
3. Baja en vertical hasta que la rodilla de atrás casi toque el piso.
4. Empuja con el pie de adelante para subir, completa las repeticiones y cambia de pierna.', 'Perder el equilibrio por tener los pies en línea.
Dejar caer el pecho hacia adelante.', 'Empieza con poca carga hasta dominar el equilibrio.
Trabaja dentro del rack con los seguros puestos.', 1, 2, 'desplante')
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
  ('desplante estatico con mancuernas', 'mancuernas'),
  ('desplante estatico en smith', 'maquina smith'),
  ('desplante estatico con barra', 'barra')
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('sentadilla bulgara', 'desplante estatico con mancuernas'),
  ('desplante estatico con mancuernas', 'desplante estatico en smith'),
  ('desplante estatico con mancuernas', 'desplante estatico con barra')
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id) AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id);

INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
  ('desplante estatico con mancuernas', 'cuadriceps', 1),
  ('desplante estatico con mancuernas', 'gluteos', 2),
  ('desplante estatico con mancuernas', 'aductores', 2),
  ('desplante estatico en smith', 'cuadriceps', 1),
  ('desplante estatico en smith', 'gluteos', 2),
  ('desplante estatico en smith', 'aductores', 2),
  ('desplante estatico con barra', 'cuadriceps', 1),
  ('desplante estatico con barra', 'gluteos', 2),
  ('desplante estatico con barra', 'aductores', 2)
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('desplante hacia delante en smith', 'desplante estatico en smith', 'Sin dar el paso: los pies quedan fijos')
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE (y.exercise_id = b.id AND y.variant_exercise_id = e.id) OR (y.exercise_id = e.id AND y.variant_exercise_id = b.id));

-- Generado por scripts/ejercicios-ampliacion.mjs (no editar a mano). Parte 3: 3 ejercicios de los casos revisados.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Prensa horizontal', 'Seated leg press', 'prensa horizontal', 'seated leg press', 'Prensa sentado empujando la plataforma en horizontal; se puede hacer con una o dos piernas.', '1. Ajusta el asiento para que las rodillas queden a unos 90° al inicio.
2. Apoya los pies en la plataforma al ancho de la cadera.
3. Empuja hasta extender las piernas sin bloquear las rodillas.
4. Regresa controlado sin despegar la espalda baja del respaldo.', 'Bloquear las rodillas al final.
Despegar la cadera del asiento al regresar.', 'Si se hace a una pierna, anótalo en la rutina y reduce la carga.', 1, 1, 'sentadilla', 1),
  ('Aducción de cadera en máquina de pie', 'Standing machine hip adduction', 'aduccion de cadera en maquina de pie', 'standing machine hip adduction', 'Aducción de pie en máquina multicadera, una pierna a la vez.', '1. Ajusta el rodillo por dentro del muslo, cerca de la rodilla, y sujétate de las agarraderas.
2. Con el tronco erguido, lleva la pierna hacia la línea media.
3. Pausa breve.
4. Regresa controlado y cambia de lado.', 'Inclinar el tronco para mover más la pierna.
Usar impulso.', 'Mantén una leve flexión en la rodilla de apoyo.', 1, 1, 'aduccion de cadera', 1),
  ('Caminata o trote en caminadora', 'Treadmill walk or run', 'caminata o trote en caminadora', 'treadmill walk or run', 'Caminata o trote en caminadora sin inclinación especial; velocidad, inclinación e intervalos se indican en la rutina.', '1. Sube a la caminadora con la banda detenida y colócate el clip de seguridad si lo tiene.
2. Empieza a velocidad baja y súbela poco a poco.
3. Mantén el tronco erguido sin sujetarte de los barandales.
4. Baja la velocidad unos minutos antes de terminar.', 'Sujetarse de los barandales todo el tiempo.
Bajarse con la banda en movimiento.', 'Anota en la rutina si es a ritmo constante o por intervalos.', 3, 1, 'locomocion', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
  ('prensa horizontal', 'maquina'),
  ('aduccion de cadera en maquina de pie', 'maquina'),
  ('caminata o trote en caminadora', 'caminadora')
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('prensa de piernas', 'prensa horizontal', NULL),
  ('aduccion de cadera en maquina', 'aduccion de cadera en maquina de pie', NULL),
  ('caminata inclinada en caminadora', 'caminata o trote en caminadora', NULL)
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id) AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id);

INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
  ('prensa horizontal', 'cuadriceps', 1),
  ('prensa horizontal', 'gluteos', 2),
  ('prensa horizontal', 'aductores', 2),
  ('aduccion de cadera en maquina de pie', 'aductores', 1),
  ('caminata o trote en caminadora', 'cuadriceps', 1),
  ('caminata o trote en caminadora', 'gluteos', 2),
  ('caminata o trote en caminadora', 'pantorrillas', 2)
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

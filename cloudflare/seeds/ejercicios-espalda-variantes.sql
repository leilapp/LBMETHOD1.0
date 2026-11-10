-- Generado por scripts/ejercicios-espalda-variantes.mjs (no editar a mano). 13 variantes de espalda.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), 1, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Pullover en polea con barra corta, agarre abierto', 'Wide-grip cable straight-arm pulldown (short bar)', 'pullover en polea con barra corta, agarre abierto', 'wide-grip cable straight-arm pulldown (short bar)', 'Pullover de pie en polea alta con una barra corta, tomándola por los extremos para abrir el agarre lo más posible.', '1. Pon la polea en lo más alto y toma la barra corta por los extremos, palmas hacia abajo.
2. Da 1 o 2 pasos atrás e inclina el torso unos 30°, rodillas suaves y codos un poco flexionados y fijos.
3. Baja la barra en arco hasta los muslos, llevando los hombros hacia abajo y atrás.
4. Aprieta la espalda 1 segundo y sube despacio hasta sentir el estiramiento.', 'Doblar los codos y convertirlo en un jalón.
Subir los hombros hacia las orejas.
Balancear el torso para mover el peso.', 'Con la barra corta el agarre queda menos abierto que con la barra larga; úsala si la barra larga incomoda los hombros.
Imagina que empujas la barra con los meñiques.', 1, 1, 'traccion vertical'),
  ('Pullover en polea con cuerda', 'Rope cable straight-arm pulldown', 'pullover en polea con cuerda', 'rope cable straight-arm pulldown', 'Pullover de pie en polea alta con cuerda; permite separar las manos al final y alargar el recorrido.', '1. Pon la polea en lo más alto y toma la cuerda con las palmas enfrentadas.
2. Da 1 o 2 pasos atrás e inclina el torso unos 30°, codos un poco flexionados y fijos.
3. Baja la cuerda en arco hasta los muslos y separa un poco las manos al final.
4. Aprieta la espalda 1 segundo y sube despacio.', 'Doblar los codos y convertirlo en un jalón.
Arquear la zona lumbar al bajar.', 'Abre la cuerda al final para sentir más el dorsal.
Usa un peso moderado y controla la subida.', 1, 1, 'traccion vertical'),
  ('Pullover con banda elástica', 'Band straight-arm pulldown', 'pullover con banda elastica', 'band straight-arm pulldown', 'Pullover de pie con una banda anclada en alto; útil en casa o como calentamiento de espalda.', '1. Ancla la banda en alto y tómala con las manos al ancho de los hombros.
2. Da un paso atrás hasta que la banda tenga tensión e inclina un poco el torso.
3. Baja los brazos casi extendidos en arco hasta los muslos.
4. Regresa despacio sin perder la tensión.', 'Doblar los codos.
Soltar la banda de golpe al regresar.', 'Aléjate más del anclaje para aumentar la resistencia.', 1, 1, 'traccion vertical'),
  ('Pullover con barra', 'Barbell pullover', 'pullover con barra', 'barbell pullover', 'Pullover acostado en banco con barra, llevándola detrás de la cabeza con los brazos casi extendidos.', '1. Acuéstate en el banco y sujeta la barra sobre el pecho con las manos al ancho de los hombros.
2. Con los codos ligeramente flexionados, llévala en arco detrás de la cabeza.
3. Baja hasta donde mantengas las costillas abajo.
4. Regresa sobre el pecho con la misma trayectoria.', 'Arquear la espalda baja al bajar.
Doblar los codos y convertirlo en un press de tríceps.', 'Empieza con poco peso: la barra es menos estable que la mancuerna.
Puede hacerse con barra EZ si se indica en la rutina.', 1, 2, 'traccion vertical'),
  ('Jalón al pecho con agarre neutro abierto', 'Wide neutral-grip lat pulldown', 'jalon al pecho con agarre neutro abierto', 'wide neutral-grip lat pulldown', 'Jalón al pecho con una barra de agarres paralelos abiertos (palmas enfrentadas, manos más separadas que los hombros).', '1. Ajusta el soporte de los muslos y toma los agarres paralelos abiertos.
2. Inclina un poco el torso atrás y saca el pecho.
3. Jala llevando los codos hacia abajo y a los costados hasta la parte alta del pecho.
4. Sube controlado hasta estirar los brazos.', 'Jalar con los brazos en lugar de llevar los codos abajo.
Echarse muy atrás para mover más peso.', 'El agarre neutro suele ser más cómodo para hombros y codos.', 1, 1, 'traccion vertical'),
  ('Jalón en máquina', 'Machine lat pulldown', 'jalon en maquina', 'machine lat pulldown', 'Jalón en máquina de palancas o de discos, con trayectoria guiada; puede hacerse con ambos brazos o uno a la vez.', '1. Ajusta el asiento y el soporte de los muslos.
2. Toma los agarres con el pecho alto.
3. Jala llevando los codos hacia abajo y atrás.
4. Regresa controlado hasta estirar los brazos.', 'Usar impulso con el torso.
Acortar el recorrido al subir.', 'Si se hace a un brazo, anótalo en la rutina.', 1, 1, 'traccion vertical'),
  ('Jalón con banda elástica', 'Band lat pulldown', 'jalon con banda elastica', 'band lat pulldown', 'Jalón con una banda anclada en alto, de rodillas o sentado; útil en casa o para aprender el movimiento.', '1. Ancla la banda en alto y colócate de rodillas o sentado debajo.
2. Toma la banda con los brazos estirados.
3. Jala llevando los codos hacia abajo hasta los costados.
4. Regresa despacio sin perder la tensión.', 'Encoger los hombros.
Soltar la banda de golpe.', 'Usa una banda más gruesa o acércate al anclaje para cambiar la resistencia.', 1, 1, 'traccion vertical'),
  ('Remo Pendlay', 'Pendlay row', 'remo pendlay', 'pendlay row', 'Remo con barra desde el piso con el torso casi paralelo al suelo; cada repetición inicia con la barra apoyada.', '1. Coloca la barra en el piso, pies al ancho de la cadera y tómala un poco más abierto que los hombros.
2. Bisagra de cadera hasta dejar el torso casi paralelo al piso, espalda neutra.
3. Jala la barra explosivamente hasta la parte baja del pecho.
4. Regrésala al piso controlada y reacomoda antes de la siguiente.', 'Levantar el torso para subir la barra.
Redondear la espalda baja.', 'Pide más técnica que el remo con barra: empieza con carga ligera.', 1, 2, 'traccion horizontal'),
  ('Remo en Smith', 'Smith machine row', 'remo en smith', 'smith machine row', 'Remo inclinado con la barra guiada de la máquina Smith.', '1. Ajusta los seguros a la altura de las rodillas y toma la barra un poco más abierto que los hombros.
2. Bisagra de cadera con la espalda neutra.
3. Jala la barra hacia el abdomen llevando los codos atrás.
4. Baja controlado.', 'Redondear la espalda.
Usar impulso con la cadera.', 'La trayectoria fija ayuda a aprender la posición antes del remo con barra libre.', 1, 1, 'traccion horizontal'),
  ('Remo inclinado con mancuernas', 'Bent-over dumbbell row', 'remo inclinado con mancuernas', 'bent-over dumbbell row', 'Remo inclinado con una mancuerna en cada mano, sin apoyo, ambos brazos a la vez.', '1. De pie con una mancuerna en cada mano, haz bisagra de cadera hasta inclinar el torso unos 45°.
2. Deja los brazos colgando con las palmas enfrentadas.
3. Jala las mancuernas hacia la cadera llevando los codos atrás.
4. Baja controlado.', 'Redondear la espalda.
Subir el torso en cada repetición.', 'Si la espalda baja se cansa antes que la espalda alta, usa el remo con pecho apoyado.', 1, 1, 'traccion horizontal'),
  ('Remo Seal con barra', 'Barbell seal row', 'remo seal con barra', 'barbell seal row', 'Remo acostado boca abajo sobre un banco alto, jalando una barra desde abajo; elimina el impulso del torso.', '1. Acuéstate boca abajo sobre un banco alto (o un banco sobre cajones) con la barra debajo.
2. Toma la barra un poco más abierto que los hombros con los brazos estirados.
3. Jala hasta que la barra toque el banco.
4. Baja controlado hasta estirar los brazos.', 'Despegar el pecho del banco.
Usar un banco tan bajo que la barra toque el piso.', 'Se puede hacer con mancuernas si no hay banco alto con barra.', 1, 2, 'traccion horizontal'),
  ('Remo con banda elástica', 'Band seated row', 'remo con banda elastica', 'band seated row', 'Remo sentado o de pie con banda elástica; útil en casa o como calentamiento.', '1. Siéntate con las piernas estiradas y pasa la banda por las plantas, o ánclala a la altura del pecho.
2. Toma los extremos con los brazos estirados y el pecho alto.
3. Jala llevando los codos atrás y juntando los omóplatos.
4. Regresa despacio sin perder la tensión.', 'Encorvar la espalda al regresar.
Jalar solo con los brazos.', 'Acorta la banda para aumentar la resistencia.', 1, 1, 'traccion horizontal'),
  ('Remo renegado', 'Renegade row', 'remo renegado', 'renegade row', 'Remo alternado desde posición de plancha con las manos sobre mancuernas; trabaja espalda y control del tronco.', '1. En plancha alta con las manos sobre dos mancuernas y los pies más abiertos que la cadera.
2. Aprieta abdomen y glúteos.
3. Jala una mancuerna hacia la cadera sin girar el tronco.
4. Bájala controlada y alterna el lado.', 'Girar la cadera al subir la mancuerna.
Dejar caer la cadera.', 'Usa mancuernas hexagonales para que no rueden.
Abre más los pies para ganar estabilidad.', 1, 2, 'traccion horizontal')
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
  ('pullover en polea con barra corta, agarre abierto', 'polea'),
  ('pullover en polea con cuerda', 'polea'),
  ('pullover con banda elastica', 'banda elastica'),
  ('pullover con barra', 'barra'),
  ('pullover con barra', 'banco'),
  ('jalon al pecho con agarre neutro abierto', 'polea'),
  ('jalon en maquina', 'maquina'),
  ('jalon con banda elastica', 'banda elastica'),
  ('remo pendlay', 'barra'),
  ('remo en smith', 'maquina smith'),
  ('remo inclinado con mancuernas', 'mancuernas'),
  ('remo seal con barra', 'barra'),
  ('remo seal con barra', 'banco'),
  ('remo con banda elastica', 'banda elastica'),
  ('remo renegado', 'mancuernas')
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('jalon con brazos rectos', 'pullover en polea con barra corta, agarre abierto'),
  ('jalon con brazos rectos', 'pullover en polea con cuerda'),
  ('jalon con brazos rectos', 'pullover con banda elastica'),
  ('pullover con mancuerna', 'pullover con barra'),
  ('jalon al pecho', 'jalon al pecho con agarre neutro abierto'),
  ('jalon al pecho', 'jalon en maquina'),
  ('jalon al pecho', 'jalon con banda elastica'),
  ('remo con barra', 'remo pendlay'),
  ('remo con barra', 'remo en smith'),
  ('remo con mancuerna a una mano', 'remo inclinado con mancuernas'),
  ('remo con pecho apoyado', 'remo seal con barra'),
  ('remo sentado en polea', 'remo con banda elastica'),
  ('remo con mancuerna a una mano', 'remo renegado')
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id) AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id);

INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
  ('pullover en polea con barra corta, agarre abierto', 'espalda', 1),
  ('pullover en polea con cuerda', 'espalda', 1),
  ('pullover con banda elastica', 'espalda', 1),
  ('pullover con barra', 'espalda', 1),
  ('pullover con barra', 'pecho', 2),
  ('pullover con barra', 'triceps', 2),
  ('jalon al pecho con agarre neutro abierto', 'espalda', 1),
  ('jalon al pecho con agarre neutro abierto', 'biceps', 2),
  ('jalon en maquina', 'espalda', 1),
  ('jalon en maquina', 'biceps', 2),
  ('jalon con banda elastica', 'espalda', 1),
  ('jalon con banda elastica', 'biceps', 2),
  ('remo pendlay', 'espalda', 1),
  ('remo pendlay', 'biceps', 2),
  ('remo en smith', 'espalda', 1),
  ('remo en smith', 'biceps', 2),
  ('remo inclinado con mancuernas', 'espalda', 1),
  ('remo inclinado con mancuernas', 'biceps', 2),
  ('remo seal con barra', 'espalda', 1),
  ('remo seal con barra', 'biceps', 2),
  ('remo con banda elastica', 'espalda', 1),
  ('remo con banda elastica', 'biceps', 2),
  ('remo renegado', 'espalda', 1),
  ('remo renegado', 'abdomen', 2),
  ('remo renegado', 'hombros', 2)
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('jalon con brazos rectos', 'pullover en polea con barra, agarre abierto', NULL),
  ('pullover en polea con barra, agarre abierto', 'pullover en polea con barra corta, agarre abierto', 'Misma técnica con barra corta')
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE (y.exercise_id = b.id AND y.variant_exercise_id = e.id) OR (y.exercise_id = e.id AND y.variant_exercise_id = b.id));

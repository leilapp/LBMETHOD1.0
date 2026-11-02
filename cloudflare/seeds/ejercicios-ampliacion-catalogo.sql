-- Generado por scripts/ejercicios-ampliacion.mjs (no editar a mano). Parte 2: catálogo nuevo + 30 ejercicios. Correr DESPUÉS de la parte 1.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

INSERT OR IGNORE INTO equipment (name_es, name_en, name_es_key, name_en_key, created_at, updated_at)
SELECT column1, column2, column3, column4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('Barra EZ', 'EZ bar', 'barra ez', 'ez bar'),
  ('Barra hexagonal', 'Trap bar', 'barra hexagonal', 'trap bar'),
  ('Barra T (landmine)', 'Landmine', 'barra t (landmine)', 'landmine'),
  ('Trineo', 'Sled', 'trineo', 'sled'),
  ('Cuerdas de batalla', 'Battle ropes', 'cuerdas de batalla', 'battle ropes'),
  ('Ski erg', 'Ski ergometer', 'ski erg', 'ski ergometer'),
  ('Escaladora', 'Stair climber', 'escaladora', 'stair climber'),
  ('Bicicleta de aire', 'Air bike', 'bicicleta de aire', 'air bike'),
  ('Foam roller', 'Foam roller', 'foam roller', 'foam roller'),
  ('Discos deslizantes', 'Sliders', 'discos deslizantes', 'sliders'),
  ('Cinturón o chaleco de lastre', 'Dip belt or weight vest', 'cinturon o chaleco de lastre', 'dip belt or weight vest')
);

INSERT OR IGNORE INTO muscle_groups (name_es, name_en, name_es_key, name_en_key, sort_order, created_at, updated_at)
SELECT 'Antebrazos', 'Forearms', 'antebrazos', 'forearms', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM muscle_groups), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT OR IGNORE INTO muscle_groups (name_es, name_en, name_es_key, name_en_key, sort_order, created_at, updated_at)
SELECT 'Tibial anterior', 'Tibialis anterior', 'tibial anterior', 'tibialis anterior', (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM muscle_groups), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Peso muerto rumano con barra hexagonal', 'Trap bar Romanian deadlift', 'peso muerto rumano con barra hexagonal', 'trap bar romanian deadlift', 'Peso muerto rumano con barra hexagonal, con la carga a los lados del cuerpo.', '1. Colócate dentro de la barra y sujeta las agarraderas.
2. Con rodillas ligeramente flexionadas, lleva la cadera hacia atrás.
3. Baja con la espalda neutra hasta sentir tensión en el femoral.
4. Sube extendiendo la cadera.', 'Convertirlo en sentadilla doblando mucho las rodillas.
Redondear la espalda.', 'Mantén los brazos largos y los hombros abajo.', 1, 2, 'bisagra de cadera', 1),
  ('Curl femoral deslizante con discos', 'Slider hamstring curl', 'curl femoral deslizante con discos', 'slider hamstring curl', 'Curl femoral acostado deslizando los talones sobre discos deslizantes (o toallas en piso liso).', '1. Acuéstate boca arriba con los talones sobre los discos.
2. Eleva la cadera en puente.
3. Desliza los talones hacia adelante sin bajar la cadera y regresa jalando.
4. Baja la cadera al terminar.', 'Dejar caer la cadera durante el deslizamiento.
Hacerlo en una superficie que frena los discos.', 'Si no hay discos, usa toallas sobre piso liso: es el mismo ejercicio.', 1, 2, 'flexion de rodilla', 1),
  ('Desplazamiento lateral con trineo', 'Lateral sled drag', 'desplazamiento lateral con trineo', 'lateral sled drag', 'Arrastre del trineo caminando de lado.', '1. Sujeta las correas del trineo de lado a él.
2. Adopta una media sentadilla.
3. Da pasos laterales cortos sin juntar los pies.
4. Cambia de lado.', 'Cruzar los pies.
Tronco demasiado inclinado.', 'Pasos cortos y constantes.', 3, 2, 'locomocion', 1),
  ('Elevación de puntas de pie contra pared', 'Wall tibialis raise', 'elevacion de puntas de pie contra pared', 'wall tibialis raise', 'Elevación de puntas de los pies con la espalda apoyada en la pared.', '1. Apoya la espalda en la pared con los pies un poco adelante.
2. Eleva las puntas de los pies manteniendo los talones en el piso.
3. Baja controlado.
4. Repite.', 'Despegar los talones.', 'Cuanto más lejos estén los pies de la pared, más difícil.', 1, 1, NULL, 1),
  ('Tibialis raise en máquina', 'Machine tibialis raise', 'tibialis raise en maquina', 'machine tibialis raise', 'Elevación de puntas con carga en máquina para tibial.', '1. Coloca los pies bajo la almohadilla de la máquina.
2. Eleva las puntas.
3. Baja controlado.
4. Repite.', 'Usar impulso.', 'Movimiento lento.', 1, 1, NULL, 1),
  ('Tibialis raise con banda', 'Banded tibialis raise', 'tibialis raise con banda', 'banded tibialis raise', 'Elevación de puntas sentado con una banda anclada al frente sobre el empeine.', '1. Siéntate con la pierna extendida y la banda anclada al frente sobre el empeine.
2. Lleva la punta del pie hacia ti.
3. Regresa controlado.
4. Cambia de pierna.', 'Mover la rodilla.', 'Ajusta la distancia para regular la tensión.', 1, 1, NULL, 1),
  ('Dominadas con lastre', 'Weighted pull-up', 'dominadas con lastre', 'weighted pull-up', 'Dominadas con peso extra en cinturón o chaleco.', '1. Coloca el cinturón o chaleco con el peso.
2. Cuélgate de la barra.
3. Sube hasta pasar la barbilla.
4. Baja controlado.', 'Peso que balancea el cuerpo.', 'Solo cuando las dominadas sin peso se hacen con buena técnica.', 1, 3, 'traccion vertical', 1),
  ('Remo con barra T', 'T-bar row', 'remo con barra t', 't-bar row', 'Remo inclinado jalando el extremo de una barra anclada en landmine.', '1. Párate sobre la barra con el agarre en V bajo el extremo cargado.
2. Inclina el tronco con la espalda neutra.
3. Jala hacia el abdomen.
4. Baja controlado.', 'Redondear la espalda.
Levantar el tronco para mover la carga.', 'Mantén el ángulo del tronco constante.', 1, 2, 'traccion horizontal', 1),
  ('Remo Meadows', 'Meadows row', 'remo meadows', 'meadows row', 'Remo unilateral sujetando el extremo de una barra en landmine, de pie y perpendicular a ella.', '1. Colócate de lado al extremo de la barra en posición escalonada.
2. Sujeta la barra con agarre prono y apoya el otro antebrazo en el muslo.
3. Jala llevando el codo hacia arriba y atrás.
4. Baja controlado y cambia de lado.', 'Girar el tronco.', 'Mantén la espalda neutra.', 1, 2, 'traccion horizontal', 1),
  ('Lagartijas con lastre', 'Weighted push-up', 'lagartijas con lastre', 'weighted push-up', 'Lagartijas con chaleco de lastre o peso sobre la espalda.', '1. Coloca el chaleco o el peso de forma segura.
2. Baja el pecho con el cuerpo en línea.
3. Empuja hasta extender los brazos.
4. Mantén el abdomen firme.', 'Peso que se mueve o se resbala.', 'Solo cuando las lagartijas sin peso se hacen con buena técnica.', 1, 3, 'empuje horizontal', 1),
  ('Curl predicador con barra EZ', 'EZ bar preacher curl', 'curl predicador con barra ez', 'ez bar preacher curl', 'Curl con barra EZ apoyando los brazos en el banco Scott.', '1. Apoya la parte trasera de los brazos en el banco.
2. Sube la barra flexionando los codos.
3. Baja controlado sin bloquear de golpe.
4. Repite.', 'Despegar los brazos del apoyo.', 'Controla la bajada.', 1, 1, 'flexion de codo', 1),
  ('Curl con barra EZ', 'EZ bar curl', 'curl con barra ez', 'ez bar curl', 'Curl de pie con barra EZ, con agarre semisupino.', '1. Sujeta la barra EZ en la parte angulada.
2. Flexiona los codos sin moverlos.
3. Baja controlado.
4. Mantén el tronco quieto.', 'Balancear el cuerpo.', 'Codos pegados al cuerpo.', 1, 1, 'flexion de codo', 1),
  ('Curl inverso con barra', 'Reverse barbell curl', 'curl inverso con barra', 'reverse barbell curl', 'Curl con barra y palmas hacia abajo.', '1. Sujeta la barra con palmas hacia abajo.
2. Flexiona los codos.
3. Baja controlado.
4. Mantén las muñecas firmes.', 'Doblar las muñecas.', 'Usa menos peso que en el curl normal.', 1, 1, 'flexion de codo', 1),
  ('Curl inverso en polea', 'Reverse cable curl', 'curl inverso en polea', 'reverse cable curl', 'Curl en polea baja con palmas hacia abajo.', '1. Sujeta la barra de la polea baja con palmas hacia abajo.
2. Flexiona los codos.
3. Baja controlado.
4. Muñecas firmes.', 'Mover los codos.', 'Tensión constante.', 1, 1, 'flexion de codo', 1),
  ('Curl martillo con cuerda', 'Rope hammer curl', 'curl martillo con cuerda', 'rope hammer curl', 'Curl martillo con cuerda en polea baja.', '1. Sujeta la cuerda con palmas enfrentadas.
2. Flexiona los codos.
3. Baja controlado.
4. Codos pegados.', 'Balancear el tronco.', 'Tensión constante.', 1, 1, 'flexion de codo', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Curl martillo cruzado', 'Cross-body hammer curl', 'curl martillo cruzado', 'cross-body hammer curl', 'Curl martillo llevando la mancuerna hacia el hombro contrario.', '1. Sujeta la mancuerna con palma hacia adentro.
2. Súbela cruzando hacia el hombro contrario.
3. Baja controlado.
4. Alterna brazos.', 'Girar el tronco.', 'Movimiento controlado.', 1, 1, 'flexion de codo', 1),
  ('Curl Zottman', 'Zottman curl', 'curl zottman', 'zottman curl', 'Curl que sube con palmas hacia arriba y baja con palmas hacia abajo.', '1. Sube las mancuernas con palmas hacia arriba.
2. Arriba, gira las palmas hacia abajo.
3. Baja lento con palmas hacia abajo.
4. Gira abajo y repite.', 'Bajar rápido.', 'Usa menos peso por la fase de bajada.', 1, 2, 'flexion de codo', 1),
  ('Curl de muñeca supino', 'Wrist curl', 'curl de muneca supino', 'wrist curl', 'Flexión de muñeca con palmas hacia arriba y los antebrazos apoyados.', '1. Apoya los antebrazos en el banco o los muslos con las muñecas por fuera.
2. Con palmas hacia arriba, flexiona las muñecas.
3. Baja controlado.
4. Repite.', 'Mover los antebrazos.', 'Peso ligero y recorrido completo.', 1, 1, NULL, 1),
  ('Curl de muñeca pronado', 'Reverse wrist curl', 'curl de muneca pronado', 'reverse wrist curl', 'Extensión de muñeca con palmas hacia abajo y los antebrazos apoyados.', '1. Apoya los antebrazos con las muñecas por fuera.
2. Con palmas hacia abajo, eleva el dorso de las manos.
3. Baja controlado.
4. Repite.', 'Usar mucho peso.', 'Peso ligero.', 1, 1, NULL, 1),
  ('Bicicleta de aire', 'Air bike', 'bicicleta de aire', 'air bike', 'Bicicleta con ventilador que combina pedaleo y empuje de brazos.', '1. Ajusta el asiento.
2. Pedalea empujando y jalando los brazos.
3. Sigue la intensidad indicada.
4. Termina con unos minutos suaves.', 'Asiento mal ajustado.', 'La resistencia sube cuanto más rápido vas.', 3, 2, 'locomocion', 1),
  ('Ski erg', 'Ski erg', 'ski erg', 'ski erg', 'Ergómetro de esquí: jalones hacia abajo que imitan el esquí de fondo.', '1. Sujeta los agarres con los brazos arriba.
2. Jala hacia abajo flexionando ligeramente la cadera.
3. Regresa extendiendo el cuerpo.
4. Sigue la intensidad indicada.', 'Usar solo los brazos.', 'Coordina cadera y brazos.', 3, 2, 'locomocion', 1),
  ('Escaladora', 'Stair climber', 'escaladora', 'stair climber', 'Subida continua de escalones en máquina.', '1. Sube a la máquina y sujétate ligeramente.
2. Ajusta la velocidad.
3. Sube con el tronco erguido.
4. Termina con unos minutos suaves.', 'Apoyar todo el peso en los barandales.', 'Pasos completos.', 3, 2, 'locomocion', 1),
  ('Trineo de empuje', 'Sled push', 'trineo de empuje', 'sled push', 'Empuje del trineo con los brazos extendidos o flexionados.', '1. Sujeta los postes del trineo.
2. Inclina el cuerpo hacia adelante.
3. Empuja con pasos cortos y potentes.
4. Recorre la distancia indicada.', 'Redondear la espalda.', 'Superficie adecuada para el trineo.', 3, 2, 'locomocion', 1),
  ('Trineo de arrastre', 'Sled drag', 'trineo de arrastre', 'sled drag', 'Arrastre del trineo caminando hacia adelante con arnés o correas.', '1. Sujeta las correas o colócate el arnés.
2. Camina hacia adelante con pasos firmes.
3. Mantén el tronco erguido.
4. Recorre la distancia indicada.', 'Inclinarse en exceso.', 'Pasos constantes.', 3, 2, 'locomocion', 1),
  ('Caminata con trineo hacia atrás', 'Backward sled drag', 'caminata con trineo hacia atras', 'backward sled drag', 'Arrastre del trineo caminando hacia atrás.', '1. Sujeta las correas de frente al trineo.
2. Camina hacia atrás con pasos cortos.
3. Empuja con la parte delantera del pie.
4. Recorre la distancia indicada.', 'Pasos largos que pierden el equilibrio.', 'Revisa que el camino esté libre.', 3, 2, 'locomocion', 1),
  ('Battle ropes', 'Battle ropes', 'battle ropes', 'battle ropes', 'Ondas con cuerdas gruesas ancladas.', '1. Sujeta un extremo de cada cuerda.
2. Adopta una media sentadilla.
3. Mueve los brazos para hacer ondas.
4. Sigue el tiempo indicado.', 'Encorvar la espalda.', 'Respira de forma constante.', 3, 2, NULL, 1),
  ('Extensión torácica sobre foam roller', 'Foam roller thoracic extension', 'extension toracica sobre foam roller', 'foam roller thoracic extension', 'Extensión de la espalda alta apoyada sobre el foam roller.', '1. Acuéstate con el foam roller bajo la espalda alta.
2. Sostén la cabeza con las manos.
3. Extiende la espalda alta sobre el rodillo.
4. Regresa.', 'Arquear la espalda baja.', 'Movimiento lento.', 2, 1, NULL, 1),
  ('Foam rolling de cuádriceps', 'Quad foam rolling', 'foam rolling de cuadriceps', 'quad foam rolling', 'Rodar el cuádriceps sobre el foam roller.', '1. Acuéstate boca abajo con el rodillo bajo los muslos.
2. Rueda despacio de la cadera a la rodilla.
3. Mantén el abdomen firme.
4. Sigue el tiempo indicado.', 'Rodar sobre la rodilla.', 'Presión tolerable.', 2, 1, NULL, 1),
  ('Foam rolling de glúteos', 'Glute foam rolling', 'foam rolling de gluteos', 'glute foam rolling', 'Rodar el glúteo sobre el foam roller.', '1. Siéntate sobre el rodillo y cruza un tobillo sobre la rodilla contraria.
2. Inclínate hacia el glúteo de la pierna cruzada.
3. Rueda despacio.
4. Cambia de lado.', 'Rodar rápido.', 'Presión tolerable.', 2, 1, NULL, 1),
  ('Foam rolling de espalda torácica', 'Thoracic spine foam rolling', 'foam rolling de espalda toracica', 'thoracic spine foam rolling', 'Rodar la espalda alta sobre el foam roller.', '1. Acuéstate con el rodillo bajo la espalda alta.
2. Eleva la cadera.
3. Rueda despacio.
4. Sostén la cabeza con las manos.', 'Rodar sobre la espalda baja.', 'Presión tolerable.', 2, 1, NULL, 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
  ('peso muerto rumano con barra hexagonal', 'barra hexagonal'),
  ('curl femoral deslizante con discos', 'discos deslizantes'),
  ('curl femoral deslizante con discos', 'tapete'),
  ('desplazamiento lateral con trineo', 'trineo'),
  ('elevacion de puntas de pie contra pared', 'peso corporal'),
  ('tibialis raise en maquina', 'maquina'),
  ('tibialis raise con banda', 'banda elastica'),
  ('dominadas con lastre', 'barra de dominadas'),
  ('dominadas con lastre', 'cinturon o chaleco de lastre'),
  ('remo con barra t', 'barra t (landmine)'),
  ('remo meadows', 'barra t (landmine)'),
  ('lagartijas con lastre', 'peso corporal'),
  ('lagartijas con lastre', 'cinturon o chaleco de lastre'),
  ('curl predicador con barra ez', 'barra ez'),
  ('curl predicador con barra ez', 'banco'),
  ('curl con barra ez', 'barra ez'),
  ('curl inverso con barra', 'barra'),
  ('curl inverso en polea', 'polea'),
  ('curl martillo con cuerda', 'polea'),
  ('curl martillo cruzado', 'mancuernas'),
  ('curl zottman', 'mancuernas'),
  ('curl de muneca supino', 'barra'),
  ('curl de muneca supino', 'mancuernas'),
  ('curl de muneca supino', 'banco'),
  ('curl de muneca pronado', 'barra'),
  ('curl de muneca pronado', 'mancuernas'),
  ('curl de muneca pronado', 'banco'),
  ('bicicleta de aire', 'bicicleta de aire'),
  ('ski erg', 'ski erg'),
  ('escaladora', 'escaladora'),
  ('trineo de empuje', 'trineo'),
  ('trineo de arrastre', 'trineo'),
  ('caminata con trineo hacia atras', 'trineo'),
  ('battle ropes', 'cuerdas de batalla'),
  ('extension toracica sobre foam roller', 'foam roller'),
  ('foam rolling de cuadriceps', 'foam roller'),
  ('foam rolling de gluteos', 'foam roller'),
  ('foam rolling de espalda toracica', 'foam roller')
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('peso muerto rumano con barra', 'peso muerto rumano con barra hexagonal', NULL),
  ('curl femoral con pelota', 'curl femoral deslizante con discos', NULL),
  ('elevacion de puntas de pie contra pared', 'tibialis raise en maquina', NULL),
  ('elevacion de puntas de pie contra pared', 'tibialis raise con banda', NULL),
  ('dominadas', 'dominadas con lastre', NULL),
  ('remo con barra', 'remo con barra t', NULL),
  ('remo con mancuerna a una mano', 'remo meadows', NULL),
  ('lagartijas', 'lagartijas con lastre', NULL),
  ('curl de biceps con barra', 'curl predicador con barra ez', NULL),
  ('curl de biceps con barra', 'curl con barra ez', NULL),
  ('curl de biceps con barra', 'curl inverso con barra', NULL),
  ('curl de biceps en polea', 'curl inverso en polea', NULL),
  ('curl martillo', 'curl martillo con cuerda', NULL),
  ('curl martillo', 'curl martillo cruzado', NULL),
  ('curl de biceps con mancuernas', 'curl zottman', NULL),
  ('curl de muneca supino', 'curl de muneca pronado', NULL),
  ('bicicleta fija', 'bicicleta de aire', NULL),
  ('remo en remadora', 'ski erg', NULL),
  ('caminata inclinada en caminadora', 'escaladora', NULL),
  ('trineo de empuje', 'trineo de arrastre', NULL),
  ('trineo de arrastre', 'caminata con trineo hacia atras', NULL)
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id) AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id);

INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
  ('peso muerto rumano con barra hexagonal', 'femoral', 1),
  ('peso muerto rumano con barra hexagonal', 'gluteos', 2),
  ('peso muerto rumano con barra hexagonal', 'espalda', 2),
  ('curl femoral deslizante con discos', 'femoral', 1),
  ('curl femoral deslizante con discos', 'gluteos', 2),
  ('desplazamiento lateral con trineo', 'aductores', 1),
  ('desplazamiento lateral con trineo', 'abductores', 2),
  ('desplazamiento lateral con trineo', 'cuadriceps', 2),
  ('desplazamiento lateral con trineo', 'gluteos', 2),
  ('elevacion de puntas de pie contra pared', 'tibial anterior', 1),
  ('tibialis raise en maquina', 'tibial anterior', 1),
  ('tibialis raise con banda', 'tibial anterior', 1),
  ('dominadas con lastre', 'espalda', 1),
  ('dominadas con lastre', 'biceps', 2),
  ('remo con barra t', 'espalda', 1),
  ('remo con barra t', 'biceps', 2),
  ('remo meadows', 'espalda', 1),
  ('remo meadows', 'biceps', 2),
  ('lagartijas con lastre', 'pecho', 1),
  ('lagartijas con lastre', 'triceps', 2),
  ('lagartijas con lastre', 'hombros', 2),
  ('lagartijas con lastre', 'abdomen', 2),
  ('curl predicador con barra ez', 'biceps', 1),
  ('curl con barra ez', 'biceps', 1),
  ('curl inverso con barra', 'biceps', 1),
  ('curl inverso con barra', 'antebrazos', 2),
  ('curl inverso en polea', 'biceps', 1),
  ('curl inverso en polea', 'antebrazos', 2),
  ('curl martillo con cuerda', 'biceps', 1),
  ('curl martillo con cuerda', 'antebrazos', 2),
  ('curl martillo cruzado', 'biceps', 1),
  ('curl martillo cruzado', 'antebrazos', 2),
  ('curl zottman', 'biceps', 1),
  ('curl zottman', 'antebrazos', 2),
  ('curl de muneca supino', 'antebrazos', 1),
  ('curl de muneca pronado', 'antebrazos', 1),
  ('bicicleta de aire', 'cuadriceps', 1),
  ('bicicleta de aire', 'gluteos', 2),
  ('bicicleta de aire', 'hombros', 2),
  ('ski erg', 'espalda', 1),
  ('ski erg', 'triceps', 2),
  ('ski erg', 'abdomen', 2),
  ('escaladora', 'gluteos', 1),
  ('escaladora', 'cuadriceps', 2),
  ('escaladora', 'pantorrillas', 2),
  ('trineo de empuje', 'cuadriceps', 1),
  ('trineo de empuje', 'gluteos', 2),
  ('trineo de empuje', 'pantorrillas', 2),
  ('trineo de arrastre', 'gluteos', 1),
  ('trineo de arrastre', 'cuadriceps', 2),
  ('trineo de arrastre', 'femoral', 2),
  ('caminata con trineo hacia atras', 'cuadriceps', 1),
  ('caminata con trineo hacia atras', 'gluteos', 2),
  ('battle ropes', 'hombros', 1),
  ('battle ropes', 'abdomen', 2),
  ('battle ropes', 'espalda', 2),
  ('extension toracica sobre foam roller', 'espalda', 1),
  ('foam rolling de cuadriceps', 'cuadriceps', 1),
  ('foam rolling de gluteos', 'gluteos', 1),
  ('foam rolling de espalda toracica', 'espalda', 1)
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

-- Generado por scripts/ejercicios-ampliacion.mjs (no editar a mano). Parte 1: 131 ejercicios con catálogos existentes.
-- Se puede correr varias veces: no duplica, no borra y no cambia ejercicios existentes.

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Hip thrust con banda elástica', 'Banded hip thrust', 'hip thrust con banda elastica', 'banded hip thrust', 'Hip thrust con la resistencia de una banda sobre la cadera; la tensión aumenta al subir.', '1. Apoya la espalda alta en el banco y pasa la banda sobre la cadera, sujeta a ambos lados.
2. Pies al ancho de la cadera y rodillas a unos 90° arriba.
3. Empuja con los talones hasta alinear rodillas, cadera y hombros.
4. Baja controlando sin perder la tensión de la banda.', 'Arquear la zona lumbar al subir en lugar de extender la cadera.
Dejar que las rodillas se cierren.', 'Mantén la barbilla hacia el pecho y las costillas abajo.
Útil para aprender el patrón o en casa.', 1, 1, 'extension de cadera', 1),
  ('Hip thrust en Smith', 'Smith machine hip thrust', 'hip thrust en smith', 'smith machine hip thrust', 'Hip thrust con la barra guiada de la máquina Smith, que da más estabilidad que la barra libre.', '1. Coloca el banco perpendicular a la Smith y la barra sobre la cadera, con almohadilla.
2. Apoya la espalda alta en el banco y los pies al ancho de la cadera.
3. Desbloquea la barra y empuja con los talones hasta extender la cadera.
4. Baja controlado y bloquea la barra al terminar.', 'Colocar el banco muy lejos o muy cerca, lo que obliga a la espalda a compensar.
Hiperextender la zona lumbar arriba.', 'Prueba la posición sin peso antes de cargar.
Ten los seguros de la Smith a una altura que te permita salir.', 1, 1, 'extension de cadera', 1),
  ('Hip thrust con pies elevados', 'Feet-elevated hip thrust', 'hip thrust con pies elevados', 'feet-elevated hip thrust', 'Hip thrust con los pies sobre una superficie elevada, lo que aumenta el recorrido de la cadera.', '1. Espalda alta en un banco y pies sobre un cajón o step de altura similar.
2. Coloca la carga sobre la cadera.
3. Empuja con los talones hasta extender la cadera.
4. Baja hasta donde mantengas la pelvis neutra.', 'Usar una superficie inestable o que se desliza.
Perder la alineación de las rodillas.', 'Empieza con poca carga: el rango es mayor que en el hip thrust normal.', 1, 2, 'extension de cadera', 1),
  ('Hip thrust con barra y banda', 'Banded barbell hip thrust', 'hip thrust con barra y banda', 'banded barbell hip thrust', 'Hip thrust con barra y una banda anclada que añade resistencia en la parte alta del movimiento.', '1. Prepara el hip thrust con barra y engancha la banda a la barra y a un anclaje firme abajo.
2. Apoya la espalda alta y coloca los pies al ancho de la cadera.
3. Empuja con los talones hasta la extensión completa de cadera.
4. Baja controlando contra la tensión de la banda.', 'Anclar la banda de forma insegura.
Acortar el recorrido por la tensión extra arriba.', 'Revisa que la banda quede pareja de ambos lados antes de cada serie.', 1, 2, 'extension de cadera', 1),
  ('Hip thrust a una pierna en máquina', 'Single-leg machine hip thrust', 'hip thrust a una pierna en maquina', 'single-leg machine hip thrust', 'Hip thrust en máquina con una sola pierna; exige más control de la pelvis que la versión con dos piernas.', '1. Ajusta la máquina y apoya la espalda en el respaldo.
2. Coloca un pie en la plataforma y eleva o flexiona la otra pierna.
3. Empuja con el talón de apoyo hasta extender la cadera sin girar la pelvis.
4. Baja controlado y completa las repeticiones antes de cambiar de lado.', 'Dejar que la pelvis se incline hacia el lado libre.
Usar tanta carga que se pierda el control.', 'Empieza con la mitad o menos de la carga que usas con dos piernas.', 1, 2, 'extension de cadera', 1),
  ('Hip thrust a una pierna con mancuerna', 'Single-leg dumbbell hip thrust', 'hip thrust a una pierna con mancuerna', 'single-leg dumbbell hip thrust', 'Hip thrust a una pierna con una mancuerna sobre la cadera de la pierna de apoyo.', '1. Apoya la espalda alta en el banco y sujeta una mancuerna sobre la cadera del lado que trabaja.
2. Coloca el pie de apoyo bajo la rodilla y eleva la otra pierna.
3. Empuja con el talón hasta extender la cadera, con la pelvis nivelada.
4. Baja controlado.', 'Rotar la pelvis al subir.
Empujar con la punta del pie.', 'Domina la versión sin peso antes de añadir la mancuerna.', 1, 2, 'extension de cadera', 1),
  ('Frog pumps', 'Frog pump', 'frog pumps', 'frog pump', 'Puente de glúteo con las plantas de los pies juntas y las rodillas abiertas, de recorrido corto.', '1. Acuéstate boca arriba, junta las plantas de los pies y deja caer las rodillas hacia afuera.
2. Acerca los talones a la cadera.
3. Eleva la cadera apretando los glúteos.
4. Baja y repite a ritmo constante.', 'Empujar con la zona lumbar en lugar de la cadera.
Separar los pies durante la serie.', 'Suele usarse con repeticiones altas o como activación.', 1, 1, 'extension de cadera', 1),
  ('Frog pumps con banda', 'Banded frog pump', 'frog pumps con banda', 'banded frog pump', 'Frog pumps con una mini banda sobre las rodillas o la cadera para añadir resistencia.', '1. Coloca la mini banda y acuéstate con las plantas juntas y las rodillas abiertas.
2. Eleva la cadera apretando los glúteos.
3. Mantén las rodillas abiertas contra la banda.
4. Baja y repite.', 'Dejar que la banda cierre las rodillas.
Arquear la zona lumbar.', 'Elige una banda que permita completar el rango sin perder la posición.', 1, 1, 'extension de cadera', 1),
  ('Extensión de cadera en banco romano', 'Roman chair hip extension', 'extension de cadera en banco romano', 'roman chair hip extension', 'Extensión de cadera en banco romano horizontal (90°), con la columna neutra y el movimiento desde la cadera.', '1. Ajusta el banco para que la cadera quede libre justo delante del apoyo.
2. Baja el tronco flexionando la cadera con la espalda neutra.
3. Sube apretando glúteos hasta alinear tronco y piernas.
4. No pases de la línea recta.', 'Redondear y extender la columna en lugar de mover la cadera.
Hiperextender arriba.', 'Si buscas trabajar la zona lumbar, usa la Extensión lumbar en banco romano.', 1, 2, 'extension de cadera', 1),
  ('Patada de glúteo en polea con rodilla flexionada', 'Bent-knee cable glute kickback', 'patada de gluteo en polea con rodilla flexionada', 'bent-knee cable glute kickback', 'Patada en polea manteniendo la rodilla doblada para reducir la participación del femoral.', '1. Coloca la tobillera en la polea baja e inclina ligeramente el tronco apoyando las manos.
2. Dobla la rodilla de la pierna que trabaja a unos 90°.
3. Lleva el talón hacia atrás y arriba extendiendo la cadera.
4. Regresa controlado sin apoyar el pie.', 'Arquear la espalda para subir más.
Abrir la rodilla durante el movimiento.', 'Mantén el abdomen firme y la cadera de frente a la máquina.', 1, 1, 'extension de cadera', 1),
  ('Patada de glúteo diagonal en polea', 'Diagonal cable glute kickback', 'patada de gluteo diagonal en polea', 'diagonal cable glute kickback', 'Patada en polea hacia atrás y hacia afuera, que combina extensión y abducción de cadera.', '1. Coloca la tobillera en la polea baja y sujétate de la máquina.
2. Lleva la pierna hacia atrás en diagonal, unos 30–45° hacia afuera.
3. Pausa breve al final sin girar la pelvis.
4. Regresa controlado.', 'Girar el tronco para alcanzar más rango.
Usar impulso.', 'Piensa en llevar el talón hacia atrás y afuera, no hacia arriba.', 1, 1, 'extension de cadera', 1),
  ('Patada de glúteo en Smith', 'Smith machine glute kickback', 'patada de gluteo en smith', 'smith machine glute kickback', 'Patada desde cuadrupedia empujando la barra de la Smith con la planta del pie.', '1. Colócate en cuadrupedia bajo la Smith con la barra sobre la planta de un pie.
2. Desbloquea la barra con cuidado.
3. Empuja la barra hacia arriba extendiendo la cadera.
4. Baja controlado y bloquea la barra al terminar.', 'Arquear la zona lumbar al empujar.
Trabajar sin los seguros puestos.', 'Ajusta los seguros para que la barra no baje más de lo que controlas.', 1, 2, 'extension de cadera', 1),
  ('Extensión de cadera en máquina de pie', 'Standing machine hip extension', 'extension de cadera en maquina de pie', 'standing machine hip extension', 'Extensión de cadera de pie en máquina multicadera, empujando el rodillo hacia atrás.', '1. Ajusta el rodillo detrás del muslo o la pantorrilla y sujétate de las agarraderas.
2. Con el tronco firme, lleva la pierna hacia atrás.
3. Pausa breve con el glúteo contraído.
4. Regresa controlado.', 'Inclinar el tronco para mover más la pierna.
Hiperextender la zona lumbar.', 'Mantén una leve flexión en la rodilla de apoyo.', 1, 1, 'extension de cadera', 1),
  ('Extensión de cadera con banda de pie', 'Standing banded hip extension', 'extension de cadera con banda de pie', 'standing banded hip extension', 'Patada de glúteo de pie con banda anclada, sin apoyo en el piso.', '1. Ancla la banda abajo y colócala en el tobillo.
2. Sujétate de un apoyo y mantén el tronco firme.
3. Lleva la pierna hacia atrás extendiendo la cadera.
4. Regresa controlado.', 'Inclinarse hacia adelante para mover más la pierna.
Soltar la banda de golpe.', 'Buena opción para trabajar en casa o calentar.', 1, 1, 'extension de cadera', 1),
  ('Extensión de cadera en cuadrupedia con mancuerna', 'Dumbbell quadruped hip extension', 'extension de cadera en cuadrupedia con mancuerna', 'dumbbell quadruped hip extension', 'Patada en cuadrupedia con una mancuerna sujeta detrás de la rodilla.', '1. En cuadrupedia, coloca una mancuerna ligera en el hueco de la rodilla.
2. Aprieta la rodilla para sujetarla.
3. Eleva el muslo hasta la altura de la cadera.
4. Baja controlado.', 'Arquear la espalda al subir.
Usar una mancuerna difícil de sujetar.', 'Usa poco peso; la prioridad es sujetarla con seguridad.', 1, 2, 'extension de cadera', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Abducción de cadera de pie con banda', 'Standing banded hip abduction', 'abduccion de cadera de pie con banda', 'standing banded hip abduction', 'Abducción de pie con banda anclada al tobillo.', '1. Ancla la banda a la altura del tobillo, del lado contrario a la pierna que trabaja.
2. Sujétate de un apoyo con el tronco erguido.
3. Lleva la pierna hacia el lado sin inclinar el tronco.
4. Regresa controlado.', 'Inclinar el tronco hacia el lado contrario.
Girar la punta del pie hacia arriba.', 'Mantén la punta del pie mirando al frente.', 1, 1, 'abduccion de cadera', 1),
  ('Abducción de cadera en máquina con torso inclinado', 'Forward-lean machine hip abduction', 'abduccion de cadera en maquina con torso inclinado', 'forward-lean machine hip abduction', 'Abducción en máquina con el tronco inclinado hacia adelante, lo que cambia el ángulo de la cadera.', '1. Siéntate en la máquina con las almohadillas por fuera de las rodillas.
2. Inclina el tronco hacia adelante con la espalda recta.
3. Abre las piernas de forma controlada.
4. Regresa sin dejar caer el peso.', 'Redondear la espalda al inclinarse.
Rebotar al final del recorrido.', 'Puedes apoyar las manos en las agarraderas o en el asiento.', 1, 1, 'abduccion de cadera', 1),
  ('Abducción de cadera en plancha lateral', 'Side plank hip abduction', 'abduccion de cadera en plancha lateral', 'side plank hip abduction', 'Plancha lateral elevando la pierna de arriba; combina estabilidad del tronco y abducción.', '1. Colócate en plancha lateral sobre el antebrazo con el cuerpo en línea.
2. Eleva la pierna de arriba sin girar la cadera.
3. Bájala controlado sin perder la plancha.
4. Completa las repeticiones o el tiempo y cambia de lado.', 'Dejar caer la cadera.
Llevar la pierna hacia adelante.', 'Para facilitarlo, apoya la rodilla de abajo.', 5, 2, 'abduccion de cadera', 1),
  ('Abducción de cadera en cuadrupedia', 'Quadruped hip abduction', 'abduccion de cadera en cuadrupedia', 'quadruped hip abduction', 'Abducción desde cuadrupedia, separando la rodilla doblada hacia el lado.', '1. Colócate en cuadrupedia con manos bajo hombros y rodillas bajo cadera.
2. Con la rodilla doblada, eleva la pierna hacia el lado.
3. Mantén el tronco quieto.
4. Baja controlado.', 'Inclinar el tronco hacia el lado contrario.
Arquear la espalda.', 'Puedes añadir una mini banda sobre las rodillas.', 1, 1, 'abduccion de cadera', 1),
  ('Caminata monstruo con banda', 'Banded monster walk', 'caminata monstruo con banda', 'banded monster walk', 'Caminata en diagonal hacia adelante o atrás con la banda en tensión constante.', '1. Coloca la mini banda y adopta una media sentadilla.
2. Da pasos en diagonal hacia adelante, separando los pies.
3. Mantén la banda tensa en todo momento.
4. Repite hacia atrás si se indica.', 'Juntar los pies entre pasos.
Dejar que las rodillas se vayan hacia adentro.', 'Pasos cortos y controlados.', 1, 1, 'abduccion de cadera', 1),
  ('Caminata lateral con banda en tobillos', 'Ankle-banded lateral walk', 'caminata lateral con banda en tobillos', 'ankle-banded lateral walk', 'Caminata lateral con la mini banda en los tobillos; la palanca es mayor que con la banda en las rodillas.', '1. Coloca la mini banda en los tobillos y adopta una media sentadilla.
2. Da pasos laterales cortos sin juntar los pies.
3. Mantén el tronco erguido.
4. Repite hacia el otro lado.', 'Arrastrar los pies.
Balancear el tronco de lado a lado.', 'Las puntas de los pies miran al frente.', 1, 1, 'abduccion de cadera', 1),
  ('Peso muerto rumano en Smith', 'Smith machine Romanian deadlift', 'peso muerto rumano en smith', 'smith machine romanian deadlift', 'Peso muerto rumano con la barra guiada de la Smith.', '1. Párate con los pies al ancho de la cadera y la barra junto a los muslos.
2. Desbloquea y baja la barra llevando la cadera hacia atrás, con rodillas ligeramente flexionadas.
3. Baja hasta sentir tensión en el femoral sin redondear la espalda.
4. Sube extendiendo la cadera.', 'Pararse demasiado lejos de la barra.
Redondear la espalda al bajar.', 'Ajusta los seguros a la altura mínima que alcanzas con buena técnica.', 1, 1, 'bisagra de cadera', 1),
  ('Peso muerto rumano con déficit', 'Deficit Romanian deadlift', 'peso muerto rumano con deficit', 'deficit romanian deadlift', 'Peso muerto rumano parado sobre una plataforma baja para aumentar el recorrido.', '1. Párate sobre una plataforma estable de pocos centímetros.
2. Baja la barra llevando la cadera atrás con la espalda neutra.
3. Usa el rango extra solo si mantienes la espalda recta.
4. Sube extendiendo la cadera.', 'Perder la posición neutra de la espalda para bajar más.
Usar una plataforma inestable.', 'Reduce la carga respecto a tu rumano habitual.', 1, 3, 'bisagra de cadera', 1),
  ('Peso muerto kickstand', 'Kickstand Romanian deadlift', 'peso muerto kickstand', 'kickstand romanian deadlift', 'Rumano con la mayor parte del peso en una pierna y la otra apoyada atrás solo con la punta.', '1. Coloca un pie adelante y la punta del otro a la altura del talón delantero.
2. Carga la pierna delantera y lleva la cadera hacia atrás.
3. Baja el peso con la espalda neutra.
4. Sube extendiendo la cadera y cambia de lado.', 'Repartir el peso igual entre ambas piernas.
Girar la pelvis.', 'Es un paso intermedio entre el rumano bilateral y el de una pierna.', 1, 2, 'bisagra de cadera', 1),
  ('Peso muerto con piernas rígidas', 'Stiff-leg deadlift', 'peso muerto con piernas rigidas', 'stiff-leg deadlift', 'Peso muerto con las rodillas casi extendidas, iniciando cada repetición desde abajo.', '1. Párate con la barra frente a las espinillas y rodillas apenas flexionadas.
2. Sujeta la barra llevando la cadera hacia atrás con la espalda neutra.
3. Sube extendiendo la cadera.
4. Baja hasta donde mantengas la espalda recta.', 'Redondear la espalda baja para llegar al piso.
Bloquear por completo las rodillas.', 'No es obligatorio tocar el piso; baja hasta donde controles.', 1, 2, 'bisagra de cadera', 1),
  ('Buenos días en Smith', 'Smith machine good morning', 'buenos dias en smith', 'smith machine good morning', 'Buenos días con la barra guiada sobre la espalda alta.', '1. Coloca la barra sobre la espalda alta y desbloquéala.
2. Con rodillas ligeramente flexionadas, lleva la cadera hacia atrás.
3. Baja el tronco con la espalda neutra.
4. Sube extendiendo la cadera.', 'Redondear la espalda.
Bajar más de lo que permite la movilidad.', 'Empieza con poca carga y ajusta los seguros.', 1, 2, 'bisagra de cadera', 1),
  ('Buenos días con banda', 'Banded good morning', 'buenos dias con banda', 'banded good morning', 'Buenos días con la banda bajo los pies y sobre la nuca o los hombros.', '1. Pisa la banda con ambos pies y pásala por detrás del cuello, sobre los hombros.
2. Lleva la cadera hacia atrás con la espalda neutra.
3. Sube extendiendo la cadera contra la tensión.
4. Controla el regreso.', 'Dejar que la banda jale el tronco hacia abajo y redondee la espalda.', 'Útil para aprender la bisagra de cadera.', 1, 1, 'bisagra de cadera', 1),
  ('Buenos días sin carga', 'Bodyweight good morning', 'buenos dias sin carga', 'bodyweight good morning', 'Bisagra de cadera sin peso, con las manos en la nuca o cruzadas al pecho.', '1. Párate con pies al ancho de la cadera y manos en la nuca o al pecho.
2. Lleva la cadera atrás con la espalda neutra.
3. Baja hasta sentir tensión en el femoral.
4. Sube apretando glúteos.', 'Flexionar la columna en lugar de la cadera.', 'Sirve como calentamiento o para enseñar la bisagra.', 1, 1, 'bisagra de cadera', 1),
  ('Curl femoral de pie en máquina', 'Standing machine leg curl', 'curl femoral de pie en maquina', 'standing machine leg curl', 'Curl femoral de pie, una pierna a la vez, en máquina.', '1. Ajusta la almohadilla detrás del tobillo y apoya el muslo en el soporte.
2. Lleva el talón hacia el glúteo.
3. Pausa breve arriba.
4. Baja controlado.', 'Mover la cadera para ayudar.
Dejar caer el peso.', 'Mantén la cadera pegada al soporte.', 1, 1, 'flexion de rodilla', 1),
  ('Curl femoral en polea baja', 'Standing cable leg curl', 'curl femoral en polea baja', 'standing cable leg curl', 'Curl femoral de pie con tobillera en la polea baja.', '1. Coloca la tobillera y párate de frente a la polea, sujeto de la máquina.
2. Con el muslo quieto, lleva el talón hacia el glúteo.
3. Pausa breve.
4. Regresa controlado.', 'Adelantar la rodilla o mover la cadera.', 'Da un paso atrás para tener tensión desde el inicio.', 1, 1, 'flexion de rodilla', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Curl nórdico asistido con banda', 'Band-assisted Nordic hamstring curl', 'curl nordico asistido con banda', 'band-assisted nordic hamstring curl', 'Curl nórdico con una banda anclada al pecho que ayuda en la parte más difícil.', '1. Arrodíllate con los tobillos sujetos y la banda anclada arriba y detrás, pasando por el pecho.
2. Con cadera extendida, inclínate hacia adelante lo más lento posible.
3. Usa las manos para frenar al final.
4. Regresa con ayuda de las manos si es necesario.', 'Doblar la cadera al bajar.
Caer sin control.', 'Usa una almohadilla bajo las rodillas.', 1, 2, 'flexion de rodilla', 1),
  ('Curl femoral con fitball a una pierna', 'Single-leg stability ball hamstring curl', 'curl femoral con fitball a una pierna', 'single-leg stability ball hamstring curl', 'Curl femoral sobre pelota con una sola pierna, con más demanda de estabilidad.', '1. Acuéstate boca arriba con un talón sobre la pelota y la otra pierna elevada.
2. Eleva la cadera en puente.
3. Acerca la pelota con el talón sin bajar la cadera.
4. Extiende la pierna controlado.', 'Perder la altura de la cadera.
Dejar que la pelota se vaya hacia un lado.', 'Abre los brazos en el piso para estabilizarte.', 1, 3, 'flexion de rodilla', 1),
  ('Sentadilla en Smith con talones elevados', 'Heel-elevated Smith machine squat', 'sentadilla en smith con talones elevados', 'heel-elevated smith machine squat', 'Sentadilla en Smith con los talones sobre un calce, que permite más avance de rodillas.', '1. Coloca un calce o discos bajo los talones y la barra sobre la espalda alta.
2. Desbloquea y baja manteniendo el tronco erguido.
3. Deja que las rodillas avancen sobre los pies.
4. Sube empujando todo el pie.', 'Calce inestable.
Despegar el calce al bajar.', 'Ajusta los seguros antes de empezar.', 1, 2, 'sentadilla', 1),
  ('Sentadilla frontal en Smith', 'Smith machine front squat', 'sentadilla frontal en smith', 'smith machine front squat', 'Sentadilla con la barra guiada apoyada al frente sobre los hombros.', '1. Apoya la barra sobre la parte frontal de los hombros con codos altos.
2. Desbloquea y baja con el tronco erguido.
3. Mantén los codos arriba.
4. Sube empujando todo el pie.', 'Bajar los codos y dejar caer la barra hacia adelante.', 'Puedes cruzar los brazos si la posición de agarre molesta.', 1, 2, 'sentadilla', 1),
  ('Sentadilla sissy asistida', 'Assisted sissy squat', 'sentadilla sissy asistida', 'assisted sissy squat', 'Sentadilla con el cuerpo inclinado hacia atrás y las rodillas avanzando, sujetándose de un apoyo.', '1. Sujétate de un apoyo firme y sube a las puntas de los pies.
2. Lleva las rodillas hacia adelante inclinando el cuerpo hacia atrás en línea.
3. Baja hasta donde controles.
4. Sube extendiendo las rodillas.', 'Doblar la cadera y convertirlo en sentadilla normal.
Bajar más de lo que permiten las rodillas sin molestias.', 'Empieza con un recorrido corto.', 1, 2, 'sentadilla', 1),
  ('Sentadilla sissy en máquina', 'Machine sissy squat', 'sentadilla sissy en maquina', 'machine sissy squat', 'Sentadilla sissy en banco o máquina que fija los tobillos y apoya las piernas.', '1. Asegura los tobillos y apoya las pantorrillas en las almohadillas.
2. Baja llevando las rodillas hacia adelante con el tronco en línea.
3. Sube extendiendo las rodillas.
4. Controla todo el recorrido.', 'Flexionar la cadera.', 'Puedes sujetar un disco al pecho para añadir carga.', 1, 1, 'sentadilla', 1),
  ('Sentadilla pendular', 'Pendulum squat', 'sentadilla pendular', 'pendulum squat', 'Sentadilla en máquina pendular, con trayectoria en arco.', '1. Colócate con la espalda en el respaldo y los hombros bajo las almohadillas.
2. Desbloquea y baja controlado.
3. Baja tan profundo como controles.
4. Sube empujando la plataforma.', 'Despegar la espalda del respaldo.
Bloquear las rodillas de golpe.', 'La posición de los pies cambia el énfasis; anótala en la rutina.', 1, 2, 'sentadilla', 1),
  ('Prensa vertical', 'Vertical leg press', 'prensa vertical', 'vertical leg press', 'Prensa acostado empujando la plataforma hacia arriba en vertical.', '1. Acuéstate con la cadera bajo la plataforma y los pies al ancho de los hombros.
2. Desbloquea y baja la plataforma controlado.
3. Detente antes de que la cadera se despegue.
4. Empuja sin bloquear las rodillas.', 'Despegar la cadera abajo.
Bloquear las rodillas.', 'Empieza con poca carga hasta dominar el recorrido.', 1, 2, 'sentadilla', 1),
  ('Extensión terminal de rodilla con banda', 'Banded terminal knee extension', 'extension terminal de rodilla con banda', 'banded terminal knee extension', 'Extensión de los últimos grados de rodilla de pie, con banda detrás de la rodilla.', '1. Ancla la banda al frente y colócala detrás de la rodilla.
2. Da un paso atrás hasta que la banda tense la rodilla flexionada.
3. Extiende la rodilla por completo apretando el cuádriceps.
4. Regresa controlado.', 'Mover la cadera en lugar de la rodilla.', 'Movimiento corto y controlado.', 1, 1, 'extension de rodilla', 1),
  ('Sentadilla búlgara en Smith', 'Smith machine Bulgarian split squat', 'sentadilla bulgara en smith', 'smith machine bulgarian split squat', 'Sentadilla búlgara con la barra guiada sobre la espalda.', '1. Coloca el banco detrás y la barra sobre la espalda alta.
2. Apoya el empeine trasero en el banco.
3. Baja la rodilla trasera en vertical.
4. Sube empujando con el pie delantero.', 'Pie delantero muy cerca del banco.
Empujar con la pierna trasera.', 'Encuentra la posición sin peso antes de cargar.', 1, 2, 'desplante', 1),
  ('Sentadilla búlgara con pie delantero elevado', 'Front-foot-elevated Bulgarian split squat', 'sentadilla bulgara con pie delantero elevado', 'front-foot-elevated bulgarian split squat', 'Búlgara con el pie delantero sobre un step bajo para aumentar el recorrido.', '1. Coloca el pie delantero sobre un step bajo y el empeine trasero en el banco.
2. Baja con el tronco estable.
3. Usa el rango extra solo si lo controlas.
4. Sube empujando con el pie delantero.', 'Perder el equilibrio por un step inestable.', 'Reduce la carga respecto a la búlgara normal.', 1, 3, 'desplante', 1),
  ('Desplante hacia delante en Smith', 'Smith machine forward lunge', 'desplante hacia delante en smith', 'smith machine forward lunge', 'Desplante alternando el paso hacia adelante con la barra guiada.', '1. Coloca la barra sobre la espalda alta y desbloquéala.
2. Da un paso al frente y baja ambas rodillas.
3. Empuja con la pierna delantera para regresar.
4. Alterna o completa un lado según la rutina.', 'Pasos muy cortos que cargan la rodilla.
Perder la alineación de la rodilla.', 'Como la barra va en vertical, ajusta tu posición antes de empezar.', 1, 2, 'desplante', 1),
  ('Step-up lateral', 'Lateral step-up', 'step-up lateral', 'lateral step-up', 'Subida al cajón de lado.', '1. Párate de lado junto al cajón y apoya el pie cercano encima.
2. Sube empujando con la pierna de arriba.
3. Baja controlado.
4. Completa las repeticiones y cambia de lado.', 'Impulsarse con la pierna de abajo.
Dejar que la rodilla se vaya hacia adentro.', 'Empieza con un cajón bajo.', 1, 1, 'desplante', 1),
  ('Step-down de cajón', 'Box step-down', 'step-down de cajon', 'box step-down', 'Bajada controlada desde un cajón con una pierna, tocando el piso con el talón contrario.', '1. Párate sobre el cajón con una pierna y la otra en el aire.
2. Flexiona la rodilla de apoyo hasta tocar el piso con el talón libre.
3. Sube extendiendo la pierna de apoyo.
4. Cambia de lado.', 'Caer de golpe al piso.
Rodilla hacia adentro.', 'Usa un cajón bajo y aumenta la altura poco a poco.', 1, 2, 'desplante', 1),
  ('Spanish squat con banda', 'Spanish squat', 'spanish squat con banda', 'spanish squat', 'Sentadilla con una banda gruesa detrás de las rodillas que permite mantener las espinillas verticales.', '1. Ancla una banda gruesa a un soporte firme y colócala detrás de las rodillas.
2. Inclínate hacia atrás hasta tensar la banda.
3. Baja manteniendo las espinillas verticales.
4. Sube extendiendo las rodillas.', 'Anclaje inseguro.
Banda demasiado débil.', 'Comprueba el anclaje antes de cada serie.', 1, 2, 'sentadilla', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Sentadilla ciclista', 'Cyclist squat', 'sentadilla ciclista', 'cyclist squat', 'Sentadilla con postura estrecha y talones elevados, sujetando una mancuerna al pecho.', '1. Coloca los talones sobre un calce con los pies juntos o cerca.
2. Sujeta la mancuerna al pecho.
3. Baja con el tronco erguido dejando avanzar las rodillas.
4. Sube empujando todo el pie.', 'Calce inestable.', 'Movimiento lento y controlado.', 1, 2, 'sentadilla', 1),
  ('Aducción de cadera acostada', 'Side-lying hip adduction', 'aduccion de cadera acostada', 'side-lying hip adduction', 'Aducción acostado de lado, elevando la pierna de abajo.', '1. Acuéstate de lado y cruza la pierna de arriba por delante apoyando el pie.
2. Eleva la pierna de abajo con la rodilla extendida.
3. Pausa breve.
4. Baja controlado.', 'Girar el tronco.', 'Movimiento corto; la prioridad es el control.', 1, 1, 'aduccion de cadera', 1),
  ('Aducción de cadera de pie con banda', 'Standing banded hip adduction', 'aduccion de cadera de pie con banda', 'standing banded hip adduction', 'Aducción de pie con banda anclada al tobillo.', '1. Ancla la banda del mismo lado de la pierna que trabaja, a la altura del tobillo.
2. Sujétate de un apoyo.
3. Lleva la pierna hacia la línea media cruzando ligeramente.
4. Regresa controlado.', 'Inclinar el tronco.', 'Mantén la punta del pie al frente.', 1, 1, 'aduccion de cadera', 1),
  ('Plancha Copenhague con rodilla apoyada', 'Short-lever Copenhagen plank', 'plancha copenhague con rodilla apoyada', 'short-lever copenhagen plank', 'Plancha Copenhague con la rodilla sobre el banco, versión más accesible.', '1. Apóyate de lado sobre el antebrazo con la rodilla de arriba sobre el banco.
2. Eleva la cadera hasta alinear el cuerpo.
3. Mantén la posición el tiempo indicado.
4. Cambia de lado.', 'Dejar caer la cadera.', 'Paso previo a la Plancha Copenhague con pierna extendida.', 5, 2, 'aduccion de cadera', 1),
  ('Sentadilla Cossack', 'Cossack squat', 'sentadilla cossack', 'cossack squat', 'Sentadilla lateral profunda alternando lados, con la pierna estirada y la punta hacia arriba.', '1. Párate con los pies muy separados.
2. Baja hacia un lado flexionando esa rodilla y estirando la otra.
3. Mantén el talón de la pierna flexionada en el piso.
4. Sube y cambia de lado.', 'Despegar el talón.
Redondear la espalda para bajar más.', 'Baja solo hasta donde controles; el rango mejora con práctica.', 1, 2, 'desplante', 1),
  ('Elevación de talones en prensa', 'Leg press calf raise', 'elevacion de talones en prensa', 'leg press calf raise', 'Elevación de talones empujando la plataforma de la prensa con las puntas.', '1. Siéntate en la prensa con las puntas de los pies en el borde inferior de la plataforma.
2. Con rodillas extendidas sin bloquear, empuja con las puntas.
3. Baja los talones hasta un estiramiento cómodo.
4. Repite sin rebotar.', 'Bloquear las rodillas.
Pies que se resbalan del borde.', 'No quites los seguros si no son necesarios.', 1, 1, 'flexion plantar', 1),
  ('Elevación de talones en Smith', 'Smith machine calf raise', 'elevacion de talones en smith', 'smith machine calf raise', 'Elevación de talones de pie con la barra guiada sobre la espalda.', '1. Coloca un step bajo la barra y apoya las puntas en el borde.
2. Desbloquea la barra.
3. Sube a las puntas y baja los talones controlado.
4. Bloquea la barra al terminar.', 'Step que se mueve.
Rebotar abajo.', 'Pausa breve arriba.', 1, 1, 'flexion plantar', 1),
  ('Elevación de talones unilateral de pie', 'Single-leg standing calf raise', 'elevacion de talones unilateral de pie', 'single-leg standing calf raise', 'Elevación de talones de pie sobre una pierna.', '1. Párate sobre una pierna sujetándote de un apoyo.
2. Sube a la punta del pie.
3. Baja el talón controlado.
4. Cambia de pierna.', 'Inclinar el cuerpo para ayudarse.', 'Puedes sujetar una mancuerna del lado que trabaja.', 1, 1, 'flexion plantar', 1),
  ('Elevación de talones en escalón', 'Step calf raise', 'elevacion de talones en escalon', 'step calf raise', 'Elevación de talones con las puntas en un escalón para bajar el talón por debajo de la punta.', '1. Apoya las puntas en el borde de un escalón y sujétate.
2. Baja los talones por debajo del escalón.
3. Sube a las puntas.
4. Repite sin rebotar.', 'Rebotar en la parte baja.', 'Controla la bajada.', 1, 1, 'flexion plantar', 1),
  ('Caminata de puntas', 'Tiptoe walk', 'caminata de puntas', 'tiptoe walk', 'Caminata sobre las puntas de los pies manteniendo los talones elevados.', '1. Sube a las puntas.
2. Camina con pasos cortos sin bajar los talones.
3. Mantén el tronco erguido.
4. Recorre la distancia o el tiempo indicado.', 'Dejar caer los talones.', 'Puedes sujetar mancuernas para añadir carga.', 1, 1, 'locomocion', 1),
  ('Jalón al pecho unilateral', 'Single-arm lat pulldown', 'jalon al pecho unilateral', 'single-arm lat pulldown', 'Jalón con un solo brazo y agarre individual.', '1. Siéntate en el jalón y sujeta el agarre con una mano.
2. Lleva el codo hacia abajo y hacia la cadera.
3. Regresa estirando el brazo arriba.
4. Cambia de lado.', 'Girar el tronco para jalar.', 'Mantén el tronco estable.', 1, 1, 'traccion vertical', 1),
  ('Jalón supino al pecho', 'Underhand lat pulldown', 'jalon supino al pecho', 'underhand lat pulldown', 'Jalón al pecho con las palmas hacia ti.', '1. Sujeta la barra con palmas hacia ti, al ancho de los hombros.
2. Jala la barra hacia la parte alta del pecho.
3. Regresa estirando los brazos.
4. Mantén el pecho alto.', 'Inclinarse mucho hacia atrás.', 'Lleva los codos hacia abajo y atrás.', 1, 1, 'traccion vertical', 1),
  ('Jalón tras nuca', 'Behind-the-neck lat pulldown', 'jalon tras nuca', 'behind-the-neck lat pulldown', 'Variante no recomendada por defecto: jalón llevando la barra detrás de la cabeza. Queda desactivada; la entrenadora decide si la activa.', '1. Sujeta la barra con agarre amplio.
2. Baja la barra detrás de la cabeza solo hasta donde lo permita la movilidad del hombro.
3. Regresa controlado.
4. No fuerces la cabeza hacia adelante.', 'Forzar el cuello hacia adelante.
Bajar más de lo que permite la movilidad del hombro.', 'En general se prefiere el Jalón al pecho.', 1, 3, 'traccion vertical', 0),
  ('Pullover con mancuerna', 'Dumbbell pullover', 'pullover con mancuerna', 'dumbbell pullover', 'Pullover acostado llevando la mancuerna detrás de la cabeza con los brazos casi extendidos.', '1. Acuéstate en el banco y sujeta la mancuerna sobre el pecho con ambas manos.
2. Con codos ligeramente flexionados, llévala detrás de la cabeza.
3. Regresa sobre el pecho.
4. Mantén las costillas abajo.', 'Arquear la espalda baja.
Doblar mucho los codos.', 'Baja solo hasta donde controles.', 1, 1, 'traccion vertical', 1),
  ('Pullover en máquina', 'Machine pullover', 'pullover en maquina', 'machine pullover', 'Pullover en máquina, con trayectoria guiada.', '1. Ajusta el asiento y apoya los brazos en las almohadillas.
2. Lleva los brazos hacia abajo.
3. Regresa controlado.
4. Mantén el pecho alto.', 'Usar impulso.', 'Ajusta el asiento según las indicaciones de la máquina.', 1, 1, 'traccion vertical', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Dominadas supinas', 'Chin-up', 'dominadas supinas', 'chin-up', 'Dominadas con las palmas hacia ti.', '1. Cuélgate con palmas hacia ti, al ancho de los hombros.
2. Sube hasta pasar la barbilla sobre la barra.
3. Baja controlado.
4. Evita balancearte.', 'Medias repeticiones sin control.', 'Puedes usar asistencia si se indica.', 1, 2, 'traccion vertical', 1),
  ('Dominadas neutras', 'Neutral-grip pull-up', 'dominadas neutras', 'neutral-grip pull-up', 'Dominadas con las palmas enfrentadas.', '1. Cuélgate de los agarres paralelos.
2. Sube llevando los codos hacia abajo.
3. Baja controlado.
4. Evita balancearte.', 'Balancear el cuerpo.', 'Suele ser más cómoda para los hombros.', 1, 2, 'traccion vertical', 1),
  ('Dominadas excéntricas', 'Eccentric pull-up', 'dominadas excentricas', 'eccentric pull-up', 'Solo la bajada de la dominada: se sube con ayuda y se baja lento.', '1. Sube a la posición alta con ayuda de un cajón.
2. Baja lo más lento posible.
3. Vuelve a subir con ayuda.
4. Repite.', 'Soltarse al final.', 'Útil como progresión hacia la dominada completa.', 1, 2, 'traccion vertical', 1),
  ('Remo con pecho apoyado', 'Chest-supported dumbbell row', 'remo con pecho apoyado', 'chest-supported dumbbell row', 'Remo con mancuernas acostado boca abajo en un banco inclinado.', '1. Apoya el pecho en un banco inclinado con una mancuerna en cada mano.
2. Lleva los codos hacia atrás.
3. Baja controlado.
4. Mantén el pecho en el banco.', 'Despegar el pecho para usar impulso.', 'Reduce el trabajo de la espalda baja.', 1, 1, 'traccion horizontal', 1),
  ('Remo con barra T con pecho apoyado', 'Chest-supported T-bar row', 'remo con barra t con pecho apoyado', 'chest-supported t-bar row', 'Remo en máquina de barra T con apoyo para el pecho.', '1. Apoya el pecho en la almohadilla y sujeta los agarres.
2. Jala llevando los codos hacia atrás.
3. Baja controlado.
4. Mantén el pecho en el apoyo.', 'Despegar el pecho.', 'Prueba distintos agarres si la máquina lo permite.', 1, 1, 'traccion horizontal', 1),
  ('Remo unilateral en polea', 'Single-arm cable row', 'remo unilateral en polea', 'single-arm cable row', 'Remo en polea con un brazo.', '1. Sujeta el agarre con una mano, sentado o de pie.
2. Jala llevando el codo hacia atrás.
3. Regresa estirando el brazo.
4. Cambia de lado.', 'Girar el tronco en exceso.', 'Mantén los hombros nivelados.', 1, 1, 'traccion horizontal', 1),
  ('Remo alto en polea', 'High cable row', 'remo alto en polea', 'high cable row', 'Remo desde polea alta hacia la parte alta del pecho, con los codos abiertos.', '1. Coloca la polea a la altura de la cabeza o más arriba.
2. Jala hacia la parte alta del pecho con codos abiertos.
3. Junta los omóplatos.
4. Regresa controlado.', 'Encoger los hombros.', 'Diferente del face pull: el agarre va al pecho, no a la cara.', 1, 1, 'traccion horizontal', 1),
  ('Remo con agarre amplio', 'Wide-grip cable row', 'remo con agarre amplio', 'wide-grip cable row', 'Remo sentado en polea con barra de agarre amplio, con los codos más abiertos.', '1. Siéntate con la barra larga a un agarre mayor que los hombros.
2. Jala hacia el pecho bajo con codos abiertos.
3. Junta los omóplatos.
4. Regresa controlado.', 'Inclinarse hacia atrás para jalar.', 'Mantén el tronco quieto.', 1, 1, 'traccion horizontal', 1),
  ('Remo con agarre supino', 'Underhand barbell row', 'remo con agarre supino', 'underhand barbell row', 'Remo con barra con las palmas hacia arriba.', '1. Sujeta la barra con palmas hacia arriba al ancho de los hombros.
2. Inclina el tronco con la espalda neutra.
3. Jala hacia el abdomen.
4. Baja controlado.', 'Usar impulso con la cadera.', 'Los codos van pegados al cuerpo.', 1, 2, 'traccion horizontal', 1),
  ('Remo en TRX con pies elevados', 'Feet-elevated suspension row', 'remo en trx con pies elevados', 'feet-elevated suspension row', 'Remo invertido en suspensión con los pies sobre un cajón para aumentar la carga.', '1. Sujeta las asas con los pies sobre un cajón y el cuerpo en línea.
2. Jala el pecho hacia las asas.
3. Baja controlado.
4. Mantén el cuerpo recto.', 'Dejar caer la cadera.', 'Domina primero la versión con pies en el piso.', 1, 2, 'traccion horizontal', 1),
  ('Encogimiento de hombros con barra', 'Barbell shrug', 'encogimiento de hombros con barra', 'barbell shrug', 'Elevación de los hombros sujetando una barra frente a los muslos.', '1. Sujeta la barra con los brazos extendidos.
2. Eleva los hombros hacia las orejas.
3. Pausa breve.
4. Baja controlado.', 'Girar los hombros en círculo.', 'Solo sube y baja.', 1, 1, NULL, 1),
  ('Encogimiento de hombros en Smith', 'Smith machine shrug', 'encogimiento de hombros en smith', 'smith machine shrug', 'Encogimiento con la barra guiada de la Smith.', '1. Párate frente a la barra y desbloquéala.
2. Eleva los hombros hacia las orejas.
3. Baja controlado.
4. Bloquea la barra al terminar.', 'Usar las piernas para subir.', 'Movimiento corto.', 1, 1, NULL, 1),
  ('Encogimiento de hombros en polea', 'Cable shrug', 'encogimiento de hombros en polea', 'cable shrug', 'Encogimiento con barra o agarres en la polea baja.', '1. Sujeta la barra de la polea baja con brazos extendidos.
2. Eleva los hombros.
3. Baja controlado.
4. Mantén los brazos extendidos.', 'Doblar los codos.', 'Tensión constante en todo el recorrido.', 1, 1, NULL, 1),
  ('Extensión lumbar en banco romano', 'Roman chair back extension', 'extension lumbar en banco romano', 'roman chair back extension', 'Extensión en banco romano con énfasis en la zona lumbar, moviendo la columna de forma controlada.', '1. Ajusta el banco con el borde a la altura de la cadera.
2. Baja el tronco redondeando la espalda de forma controlada.
3. Sube extendiendo la espalda vértebra por vértebra hasta la línea recta.
4. No pases de la línea recta.', 'Hiperextender arriba.
Hacerlo rápido.', 'Movimiento lento; empieza sin peso.', 1, 1, 'extension de cadera', 1),
  ('Aperturas invertidas en máquina', 'Machine reverse fly', 'aperturas invertidas en maquina', 'machine reverse fly', 'Aperturas invertidas en máquina (pec deck invertido), también llamadas pájaros o elevación posterior en máquina.', '1. Siéntate de frente al respaldo con los agarres a la altura de los hombros.
2. Abre los brazos hacia atrás con codos ligeramente flexionados.
3. Pausa breve.
4. Regresa controlado.', 'Encoger los hombros.', 'Piensa en llevar las manos lejos, no en juntar los omóplatos al máximo.', 1, 1, 'aislamiento de hombro', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Press de banca en Smith', 'Smith machine bench press', 'press de banca en smith', 'smith machine bench press', 'Press de banca con la barra guiada.', '1. Acuéstate con la barra sobre la parte media del pecho.
2. Desbloquea y baja controlado hasta el pecho.
3. Empuja hasta extender los brazos.
4. Bloquea la barra al terminar.', 'Banco mal colocado respecto a la barra.', 'Ajusta los seguros a la altura del pecho.', 1, 1, 'empuje horizontal', 1),
  ('Press declinado con barra', 'Decline barbell bench press', 'press declinado con barra', 'decline barbell bench press', 'Press de banca en banco declinado con barra.', '1. Asegura las piernas en el banco declinado.
2. Baja la barra a la parte baja del pecho.
3. Empuja hasta extender los brazos.
4. Usa ayudante o seguros.', 'Rebotar la barra en el pecho.', 'Pide ayuda para sacar y regresar la barra.', 1, 2, 'empuje horizontal', 1),
  ('Press declinado con mancuernas', 'Decline dumbbell bench press', 'press declinado con mancuernas', 'decline dumbbell bench press', 'Press con mancuernas en banco declinado.', '1. Asegura las piernas y sostén las mancuernas sobre el pecho.
2. Baja hasta la altura del pecho.
3. Empuja hasta extender los brazos.
4. Controla el regreso.', 'Abrir demasiado los codos.', 'Pide ayuda para colocar las mancuernas si son pesadas.', 1, 2, 'empuje horizontal', 1),
  ('Press inclinado con barra', 'Incline barbell bench press', 'press inclinado con barra', 'incline barbell bench press', 'Press de banca en banco inclinado con barra.', '1. Ajusta el banco a 30–45°.
2. Baja la barra a la parte alta del pecho.
3. Empuja hasta extender los brazos.
4. Usa ayudante o seguros.', 'Despegar la cadera del banco.', 'Escápulas juntas y abajo.', 1, 2, 'empuje horizontal', 1),
  ('Press inclinado en máquina', 'Incline machine chest press', 'press inclinado en maquina', 'incline machine chest press', 'Press de pecho en máquina con trayectoria inclinada.', '1. Ajusta el asiento para que los agarres queden a la altura del pecho alto.
2. Empuja hasta extender los brazos.
3. Regresa controlado.
4. Mantén la espalda apoyada.', 'Despegar la espalda.', 'Ajusta el asiento antes de cargar.', 1, 1, 'empuje horizontal', 1),
  ('Press convergente en máquina', 'Converging machine chest press', 'press convergente en maquina', 'converging machine chest press', 'Press en máquina cuyos brazos se acercan entre sí al empujar.', '1. Ajusta el asiento con los agarres a la altura del pecho.
2. Empuja hacia adelante y hacia el centro.
3. Regresa controlado.
4. Mantén la espalda apoyada.', 'Bloquear los codos de golpe.', 'Los brazos pueden trabajar de forma independiente.', 1, 1, 'empuje horizontal', 1),
  ('Press unilateral en polea', 'Single-arm cable chest press', 'press unilateral en polea', 'single-arm cable chest press', 'Press de pecho de pie con un brazo en polea.', '1. Coloca la polea a la altura del pecho y párate de espaldas a ella.
2. Empuja el agarre al frente.
3. Regresa controlado.
4. Cambia de lado.', 'Girar el tronco.', 'Postura escalonada para estabilizarte.', 1, 1, 'empuje horizontal', 1),
  ('Aperturas en máquina', 'Machine chest fly', 'aperturas en maquina', 'machine chest fly', 'Aperturas en máquina (pec deck).', '1. Ajusta el asiento con los agarres a la altura del pecho.
2. Junta los brazos al frente con codos ligeramente flexionados.
3. Regresa controlado.
4. No pases más atrás de lo cómodo.', 'Abrir los brazos demasiado atrás.', 'Tensión constante.', 1, 1, 'empuje horizontal', 1),
  ('Cruce de poleas de abajo hacia arriba', 'Low-to-high cable fly', 'cruce de poleas de abajo hacia arriba', 'low-to-high cable fly', 'Cruce de poleas desde las poleas bajas hacia la altura del pecho alto.', '1. Coloca las poleas abajo y sujeta un agarre en cada mano.
2. Lleva las manos hacia arriba y al centro.
3. Regresa controlado.
4. Codos ligeramente flexionados.', 'Convertirlo en un press doblando mucho los codos.', 'Movimiento en arco.', 1, 1, 'empuje horizontal', 1),
  ('Lagartijas inclinadas', 'Incline push-up', 'lagartijas inclinadas', 'incline push-up', 'Lagartijas con las manos elevadas en un banco o superficie firme.', '1. Apoya las manos en el banco y el cuerpo en línea.
2. Baja el pecho hacia el banco.
3. Empuja hasta extender los brazos.
4. Mantén el abdomen firme.', 'Dejar caer la cadera.', 'Cuanto más alta la superficie, más fácil.', 1, 1, 'empuje horizontal', 1),
  ('Lagartijas declinadas', 'Decline push-up', 'lagartijas declinadas', 'decline push-up', 'Lagartijas con los pies elevados en un banco o cajón.', '1. Apoya los pies en el banco y las manos en el piso.
2. Baja el pecho.
3. Empuja hasta extender los brazos.
4. Mantén el cuerpo en línea.', 'Arquear la espalda baja.', 'Domina primero las lagartijas normales.', 1, 2, 'empuje horizontal', 1),
  ('Press Arnold', 'Arnold press', 'press arnold', 'arnold press', 'Press de hombro con mancuernas que inicia con palmas hacia ti y gira al subir.', '1. Sentado, sostén las mancuernas frente a los hombros con palmas hacia ti.
2. Empuja hacia arriba girando las palmas al frente.
3. Baja invirtiendo el giro.
4. Mantén la espalda apoyada.', 'Arquear la espalda baja.', 'Movimiento fluido.', 1, 2, 'empuje vertical', 1),
  ('Press de hombro en Smith', 'Smith machine shoulder press', 'press de hombro en smith', 'smith machine shoulder press', 'Press de hombro sentado con la barra guiada.', '1. Coloca el banco con respaldo bajo la barra.
2. Baja la barra frente a la cara hasta la barbilla o el pecho alto.
3. Empuja hasta extender los brazos.
4. Bloquea la barra al terminar.', 'Bajar la barra detrás de la nuca.', 'Ajusta los seguros.', 1, 1, 'empuje vertical', 1),
  ('Press de hombro unilateral en polea', 'Single-arm cable shoulder press', 'press de hombro unilateral en polea', 'single-arm cable shoulder press', 'Press de hombro con un brazo en polea baja.', '1. Coloca la polea baja y párate de espaldas a ella o de lado.
2. Empuja el agarre hacia arriba.
3. Baja controlado.
4. Cambia de lado.', 'Inclinar el tronco.', 'Abdomen firme.', 1, 1, 'empuje vertical', 1),
  ('Elevación lateral en máquina', 'Machine lateral raise', 'elevacion lateral en maquina', 'machine lateral raise', 'Elevación lateral en máquina.', '1. Ajusta el asiento con las almohadillas por fuera de los brazos.
2. Eleva los brazos hacia los lados hasta la altura de los hombros.
3. Baja controlado.
4. No encojas los hombros.', 'Encoger los hombros.', 'Movimiento controlado.', 1, 1, 'aislamiento de hombro', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Elevación lateral inclinada', 'Lean-away lateral raise', 'elevacion lateral inclinada', 'lean-away lateral raise', 'Elevación lateral con una mancuerna inclinando el cuerpo hacia el lado contrario, sujeto de un apoyo.', '1. Sujétate de un apoyo e inclina el cuerpo hacia afuera.
2. Eleva la mancuerna hacia el lado.
3. Baja controlado.
4. Cambia de lado.', 'Usar impulso.', 'La inclinación cambia en qué parte del recorrido es más difícil.', 1, 1, 'aislamiento de hombro', 1),
  ('Aperturas invertidas en polea', 'Cable reverse fly', 'aperturas invertidas en polea', 'cable reverse fly', 'Aperturas invertidas cruzando los cables de las poleas, también llamadas elevación posterior en polea.', '1. Coloca las poleas a la altura de los hombros y cruza los cables.
2. Abre los brazos hacia atrás.
3. Regresa controlado.
4. Codos ligeramente flexionados.', 'Encoger los hombros.', 'Usa poco peso.', 1, 1, 'aislamiento de hombro', 1),
  ('Remo al mentón con cuerda', 'Cable rope upright row', 'remo al menton con cuerda', 'cable rope upright row', 'Remo vertical con cuerda en polea baja, llevando los codos hacia los lados.', '1. Sujeta la cuerda de la polea baja.
2. Eleva los codos hacia los lados hasta la altura de los hombros.
3. Baja controlado.
4. Mantén la cuerda cerca del cuerpo.', 'Subir los codos por encima de los hombros.', 'Detente si aparece molestia en el hombro.', 1, 2, 'aislamiento de hombro', 1),
  ('Y-raise en banco inclinado', 'Incline bench Y-raise', 'y-raise en banco inclinado', 'incline bench y-raise', 'Elevación de los brazos en forma de Y acostado boca abajo en banco inclinado.', '1. Acuéstate boca abajo en banco inclinado con mancuernas ligeras.
2. Eleva los brazos en diagonal formando una Y.
3. Baja controlado.
4. No encojas los hombros.', 'Usar mucho peso.', 'Pulgares hacia arriba.', 1, 1, 'aislamiento de hombro', 1),
  ('Y-raise en polea', 'Cable Y-raise', 'y-raise en polea', 'cable y-raise', 'Elevación en Y con cables desde las poleas bajas.', '1. Cruza los cables desde las poleas bajas.
2. Eleva los brazos en diagonal formando una Y.
3. Baja controlado.
4. Mantén el tronco quieto.', 'Inclinarse hacia atrás.', 'Peso ligero.', 1, 1, 'aislamiento de hombro', 1),
  ('Curl predicador con mancuernas', 'Dumbbell preacher curl', 'curl predicador con mancuernas', 'dumbbell preacher curl', 'Curl con mancuerna en banco Scott.', '1. Apoya el brazo en el banco.
2. Sube la mancuerna flexionando el codo.
3. Baja controlado.
4. Cambia de brazo.', 'Rebotar abajo.', 'Controla la bajada.', 1, 1, 'flexion de codo', 1),
  ('Curl predicador en máquina', 'Machine preacher curl', 'curl predicador en maquina', 'machine preacher curl', 'Curl en máquina con apoyo para los brazos.', '1. Ajusta el asiento y apoya los brazos.
2. Flexiona los codos.
3. Regresa controlado.
4. Mantén los brazos apoyados.', 'Usar impulso.', 'Ajusta el asiento para que el codo quede alineado con el eje de la máquina.', 1, 1, 'flexion de codo', 1),
  ('Curl Bayesian en polea', 'Bayesian cable curl', 'curl bayesian en polea', 'bayesian cable curl', 'Curl de espaldas a la polea baja con el brazo por detrás del cuerpo.', '1. Párate de espaldas a la polea con el agarre en una mano.
2. Deja el brazo ligeramente detrás del cuerpo.
3. Flexiona el codo sin adelantarlo.
4. Regresa controlado y cambia de brazo.', 'Adelantar el codo.', 'Postura escalonada.', 1, 1, 'flexion de codo', 1),
  ('Curl inclinado con mancuernas', 'Incline dumbbell curl', 'curl inclinado con mancuernas', 'incline dumbbell curl', 'Curl sentado en banco inclinado, con los brazos colgando detrás del tronco.', '1. Siéntate en banco inclinado a 45–60° con los brazos colgando.
2. Flexiona los codos sin adelantarlos.
3. Baja controlado.
4. Mantén la espalda apoyada.', 'Adelantar los hombros.', 'Usa menos peso que en el curl de pie.', 1, 1, 'flexion de codo', 1),
  ('Curl spider', 'Spider curl', 'curl spider', 'spider curl', 'Curl boca abajo en banco inclinado con los brazos colgando al frente.', '1. Acuéstate boca abajo en banco inclinado con los brazos colgando.
2. Flexiona los codos.
3. Baja controlado.
4. Mantén los brazos verticales.', 'Mover los hombros.', 'También puede hacerse con barra EZ.', 1, 1, 'flexion de codo', 1),
  ('Extensión de tríceps cruzada en polea', 'Cross-body cable triceps extension', 'extension de triceps cruzada en polea', 'cross-body cable triceps extension', 'Extensión de tríceps con un brazo cruzando el cable frente al cuerpo.', '1. Sujeta el cable de la polea contraria con una mano.
2. Extiende el codo hacia afuera.
3. Regresa controlado.
4. Cambia de lado.', 'Mover el hombro.', 'El codo se mantiene fijo.', 1, 1, 'extension de codo', 1),
  ('Extensión de tríceps acostada con mancuernas', 'Dumbbell lying triceps extension', 'extension de triceps acostada con mancuernas', 'dumbbell lying triceps extension', 'Press francés con mancuernas y palmas enfrentadas.', '1. Acuéstate con las mancuernas sobre el pecho y brazos extendidos.
2. Flexiona los codos bajando las mancuernas junto a la cabeza.
3. Extiende los codos.
4. Codos apuntando al techo.', 'Abrir los codos.', 'Peso moderado.', 1, 1, 'extension de codo', 1),
  ('Press cerrado con barra', 'Close-grip bench press', 'press cerrado con barra', 'close-grip bench press', 'Press de banca con agarre al ancho de los hombros, con énfasis en tríceps.', '1. Sujeta la barra al ancho de los hombros.
2. Baja a la parte baja del pecho con codos cerca del cuerpo.
3. Empuja hasta extender los brazos.
4. Usa ayudante o seguros.', 'Agarre demasiado cerrado.', 'Codos cerca del cuerpo.', 1, 2, 'empuje horizontal', 1),
  ('Press cerrado en Smith', 'Smith machine close-grip bench press', 'press cerrado en smith', 'smith machine close-grip bench press', 'Press cerrado con la barra guiada.', '1. Sujeta la barra al ancho de los hombros.
2. Baja controlado.
3. Empuja hasta extender.
4. Bloquea la barra al terminar.', 'Abrir los codos.', 'Ajusta los seguros.', 1, 1, 'empuje horizontal', 1),
  ('Fondos asistidos en máquina', 'Machine-assisted dip', 'fondos asistidos en maquina', 'machine-assisted dip', 'Fondos en máquina con contrapeso que ayuda a subir.', '1. Ajusta el contrapeso y apoya las rodillas en la plataforma.
2. Baja flexionando los codos.
3. Empuja hasta extender los brazos.
4. Controla la bajada.', 'Bajar más de lo cómodo para el hombro.', 'Más contrapeso = más ayuda.', 1, 1, 'empuje vertical', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Extensión de tríceps en máquina', 'Machine triceps extension', 'extension de triceps en maquina', 'machine triceps extension', 'Extensión de tríceps en máquina.', '1. Ajusta el asiento y apoya los brazos.
2. Extiende los codos.
3. Regresa controlado.
4. Mantén los brazos apoyados.', 'Usar impulso.', 'Ajusta el asiento según la máquina.', 1, 1, 'extension de codo', 1),
  ('Extensión de tríceps con banda', 'Banded triceps pushdown', 'extension de triceps con banda', 'banded triceps pushdown', 'Extensión de tríceps hacia abajo con banda anclada arriba.', '1. Ancla la banda arriba.
2. Extiende los codos hacia abajo.
3. Regresa controlado.
4. Codos pegados al cuerpo.', 'Mover los hombros.', 'Útil en casa.', 1, 1, 'extension de codo', 1),
  ('Crunch inverso', 'Reverse crunch', 'crunch inverso', 'reverse crunch', 'Crunch elevando la pelvis hacia el pecho.', '1. Acuéstate con rodillas flexionadas y piernas elevadas.
2. Lleva las rodillas hacia el pecho despegando la pelvis.
3. Baja controlado.
4. Brazos al lado del cuerpo.', 'Usar impulso con las piernas.', 'Movimiento corto y controlado.', 1, 1, 'flexion de tronco', 1),
  ('Crunch en banco declinado', 'Decline bench crunch', 'crunch en banco declinado', 'decline bench crunch', 'Crunch en banco declinado.', '1. Asegura los pies en el banco declinado.
2. Eleva el tronco flexionando la columna.
3. Baja controlado.
4. No jales la cabeza.', 'Jalar el cuello.', 'Movimiento controlado.', 1, 2, 'flexion de tronco', 1),
  ('Crunch en máquina', 'Machine crunch', 'crunch en maquina', 'machine crunch', 'Crunch en máquina con carga.', '1. Ajusta el asiento y sujeta los agarres.
2. Flexiona el tronco hacia adelante.
3. Regresa controlado.
4. Exhala al flexionar.', 'Usar los brazos para mover la carga.', 'Ajusta la máquina antes de cargar.', 1, 1, 'flexion de tronco', 1),
  ('Crunch con pelota de estabilidad', 'Stability ball crunch', 'crunch con pelota de estabilidad', 'stability ball crunch', 'Crunch con la espalda apoyada sobre la pelota.', '1. Siéntate en la pelota y desliza hasta apoyar la espalda media.
2. Flexiona el tronco.
3. Regresa controlado.
4. Pies firmes en el piso.', 'Perder el equilibrio.', 'Pies separados para estabilizarte.', 1, 1, 'flexion de tronco', 1),
  ('Hollow body hold', 'Hollow body hold', 'hollow body hold', 'hollow body hold', 'Isométrico boca arriba con hombros y piernas elevados, y la espalda baja pegada al piso.', '1. Acuéstate boca arriba y pega la espalda baja al piso.
2. Eleva hombros y piernas.
3. Mantén la posición el tiempo indicado.
4. Respira de forma controlada.', 'Despegar la espalda baja.', 'Flexiona las rodillas para facilitar.', 5, 2, 'estabilidad del tronco', 1),
  ('Hollow rocks', 'Hollow rock', 'hollow rocks', 'hollow rock', 'Balanceo en posición hollow manteniendo la forma del cuerpo.', '1. Adopta la posición de hollow body.
2. Balancéate adelante y atrás sin perder la forma.
3. Mantén la espalda baja redondeada.
4. Repite.', 'Perder la posición.', 'Domina primero el hollow body hold.', 1, 3, 'estabilidad del tronco', 1),
  ('Plancha con alcance', 'Plank reach', 'plancha con alcance', 'plank reach', 'Plancha alternando el alcance de un brazo al frente.', '1. Colócate en plancha alta.
2. Lleva un brazo al frente sin girar la cadera.
3. Regresa y alterna.
4. Pies separados para estabilizarte.', 'Girar la cadera.', 'Movimiento lento.', 5, 2, 'estabilidad del tronco', 1),
  ('Plancha con desplazamiento', 'Plank walk', 'plancha con desplazamiento', 'plank walk', 'Plancha alta desplazándose de lado con manos y pies.', '1. Colócate en plancha alta.
2. Desplázate de lado moviendo mano y pie del mismo lado.
3. Mantén la cadera estable.
4. Regresa hacia el otro lado.', 'Elevar la cadera.', 'Pasos cortos.', 5, 2, 'estabilidad del tronco', 1),
  ('Body saw', 'Body saw', 'body saw', 'body saw', 'Plancha sobre antebrazos desplazando el cuerpo adelante y atrás con los pies en suspensión.', '1. Colócate en plancha sobre antebrazos con los pies en las asas.
2. Desplaza el cuerpo hacia atrás.
3. Regresa sin perder la línea.
4. Mantén el abdomen firme.', 'Arquear la espalda baja.', 'Empieza con recorridos cortos. También se hace con discos deslizantes.', 5, 3, 'estabilidad del tronco', 1),
  ('Press Pallof de rodillas', 'Half-kneeling Pallof press', 'press pallof de rodillas', 'half-kneeling pallof press', 'Press Pallof arrodillado.', '1. Arrodíllate de lado a la polea.
2. Sujeta el agarre al pecho.
3. Extiende los brazos sin girar el tronco.
4. Regresa y cambia de lado.', 'Girar el tronco.', 'Glúteos firmes.', 5, 1, 'rotacion', 1),
  ('Press Pallof con pasos laterales', 'Pallof press lateral step', 'press pallof con pasos laterales', 'pallof press lateral step', 'Press Pallof con brazos extendidos mientras se dan pasos laterales.', '1. Extiende los brazos al frente con el cable tenso.
2. Da pasos laterales alejándote del anclaje.
3. Regresa sin girar el tronco.
4. Cambia de lado.', 'Girar el tronco.', 'Pasos cortos.', 5, 2, 'rotacion', 1),
  ('Bird dog con banda', 'Banded bird dog', 'bird dog con banda', 'banded bird dog', 'Bird dog con una banda entre la mano y el pie contrarios.', '1. En cuadrupedia, pasa la banda por la mano y el pie contrarios.
2. Extiende brazo y pierna contrarios.
3. Regresa controlado.
4. Cambia de lado.', 'Arquear la espalda.', 'Movimiento lento.', 1, 2, 'estabilidad del tronco', 1),
  ('Paseo del granjero unilateral', 'Suitcase carry', 'paseo del granjero unilateral', 'suitcase carry', 'Caminata con peso en una sola mano (también llamada marcha de maleta).', '1. Sujeta el peso con una mano.
2. Camina con el tronco erguido sin inclinarte.
3. Recorre la distancia indicada.
4. Cambia de mano.', 'Inclinarse hacia el peso.', 'Hombros nivelados.', 1, 1, 'acarreo', 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT INTO exercises (name_es, name_en, name_es_key, name_en_key, description, instructions, common_mistakes, technical_tips, type, difficulty, movement_pattern_id, is_active, deactivated_at, created_at, updated_at)
SELECT v.column1, v.column2, v.column3, v.column4, v.column5, v.column6, v.column7, v.column8, v.column9, v.column10,
       (SELECT id FROM movement_patterns WHERE name_es_key = v.column11), v.column12, CASE WHEN v.column12 = 0 THEN strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (VALUES
  ('Bear crawl', 'Bear crawl', 'bear crawl', 'bear crawl', 'Desplazamiento en cuadrupedia con las rodillas elevadas.', '1. En cuadrupedia, eleva las rodillas unos centímetros.
2. Avanza moviendo mano y pie contrarios.
3. Mantén la espalda plana.
4. Recorre la distancia indicada.', 'Elevar mucho la cadera.', 'Pasos cortos.', 3, 2, 'locomocion', 1),
  ('Bear plank con elevación de rodillas', 'Bear plank', 'bear plank con elevacion de rodillas', 'bear plank', 'Isométrico en cuadrupedia con las rodillas elevadas unos centímetros.', '1. Colócate en cuadrupedia.
2. Eleva las rodillas unos centímetros.
3. Mantén la posición el tiempo indicado.
4. Espalda plana.', 'Elevar la cadera.', 'Respira de forma controlada.', 5, 1, 'estabilidad del tronco', 1),
  ('Bicicleta reclinada', 'Recumbent bike', 'bicicleta reclinada', 'recumbent bike', 'Bicicleta fija con asiento y respaldo reclinados.', '1. Ajusta el asiento para una ligera flexión de rodilla al extender.
2. Pedalea a la intensidad indicada.
3. Mantén la espalda apoyada.
4. Termina con unos minutos suaves.', 'Asiento mal ajustado.', 'Opción con apoyo para la espalda.', 3, 1, 'locomocion', 1),
  ('Estiramiento de flexor de cadera en sofá', 'Couch stretch', 'estiramiento de flexor de cadera en sofa', 'couch stretch', 'Estiramiento de flexor de cadera con la rodilla trasera flexionada y el empeine apoyado en una superficie.', '1. Apoya la rodilla trasera en el piso y el empeine en el sofá o banco.
2. Coloca el otro pie adelante.
3. Aprieta el glúteo trasero y lleva la cadera adelante.
4. Mantén el tiempo indicado y cambia de lado.', 'Arquear la espalda baja.', 'Usa una almohadilla bajo la rodilla.', 6, 2, NULL, 1),
  ('Estiramiento de aductores en roca', 'Adductor rock back', 'estiramiento de aductores en roca', 'adductor rock back', 'En cuadrupedia con una pierna extendida al lado, se lleva la cadera hacia atrás.', '1. En cuadrupedia, extiende una pierna hacia el lado.
2. Lleva la cadera hacia atrás.
3. Regresa.
4. Cambia de lado.', 'Redondear la espalda.', 'Movimiento lento.', 2, 1, NULL, 1),
  ('Estiramiento de aductores en mariposa', 'Butterfly stretch', 'estiramiento de aductores en mariposa', 'butterfly stretch', 'Sentado con las plantas de los pies juntas y las rodillas hacia afuera.', '1. Siéntate y junta las plantas de los pies.
2. Deja caer las rodillas hacia afuera.
3. Inclina el tronco con la espalda recta.
4. Mantén el tiempo indicado.', 'Empujar las rodillas con fuerza.', 'No fuerces.', 6, 1, NULL, 1),
  ('Movilidad de tobillo con banda', 'Banded ankle mobilization', 'movilidad de tobillo con banda', 'banded ankle mobilization', 'Movilidad de tobillo con banda que jala el tobillo hacia atrás.', '1. Ancla la banda atrás y colócala en el frente del tobillo.
2. Lleva la rodilla hacia adelante.
3. Regresa.
4. Cambia de lado.', 'Despegar el talón.', 'Movimiento controlado.', 2, 1, NULL, 1),
  ('Dorsiflexión de tobillo en sentadilla', 'Deep squat ankle mobilization', 'dorsiflexion de tobillo en sentadilla', 'deep squat ankle mobilization', 'Movilidad de tobillo en sentadilla profunda.', '1. Baja a sentadilla profunda.
2. Lleva el peso hacia una rodilla.
3. Regresa.
4. Alterna lados.', 'Despegar los talones.', 'Sujétate de un apoyo si lo necesitas.', 2, 1, 'sentadilla', 1),
  ('Rotación torácica en posición de libro abierto', 'Side-lying open book', 'rotacion toracica en posicion de libro abierto', 'side-lying open book', 'Rotación torácica acostado de lado abriendo el brazo hacia el otro lado.', '1. Acuéstate de lado con rodillas flexionadas y brazos al frente.
2. Abre el brazo de arriba hacia el lado contrario.
3. Regresa.
4. Cambia de lado.', 'Despegar las rodillas.', 'Sigue la mano con la mirada.', 2, 1, 'rotacion', 1),
  ('Estiramiento de dorsal en banco', 'Bench lat stretch', 'estiramiento de dorsal en banco', 'bench lat stretch', 'Estiramiento de dorsal arrodillado con los codos sobre un banco.', '1. Arrodíllate frente al banco con los codos apoyados.
2. Lleva la cadera hacia atrás.
3. Baja el pecho.
4. Mantén el tiempo indicado.', 'Arquear la espalda baja.', 'Respira profundo.', 6, 1, NULL, 1),
  ('Deslizamientos de brazos en pared', 'Wall slide', 'deslizamientos de brazos en pared', 'wall slide', 'Deslizamiento de los brazos hacia arriba y abajo con la espalda contra la pared.', '1. Apoya la espalda en la pared con los brazos en forma de W.
2. Desliza los brazos hacia arriba.
3. Regresa.
4. Mantén el contacto con la pared.', 'Arquear la espalda baja.', 'Movimiento lento.', 2, 1, NULL, 1)
) v
WHERE NOT EXISTS (SELECT 1 FROM exercises e WHERE e.name_es_key IN (v.column3, v.column4) OR e.name_en_key IN (v.column3, v.column4));

INSERT OR IGNORE INTO exercise_equipment (exercise_id, equipment_id)
SELECT e.id, q.id FROM (VALUES
  ('hip thrust con banda elastica', 'banda elastica'),
  ('hip thrust con banda elastica', 'banco'),
  ('hip thrust en smith', 'maquina smith'),
  ('hip thrust en smith', 'banco'),
  ('hip thrust con pies elevados', 'barra'),
  ('hip thrust con pies elevados', 'banco'),
  ('hip thrust con pies elevados', 'cajon'),
  ('hip thrust con barra y banda', 'barra'),
  ('hip thrust con barra y banda', 'banda elastica'),
  ('hip thrust con barra y banda', 'banco'),
  ('hip thrust a una pierna en maquina', 'maquina'),
  ('hip thrust a una pierna con mancuerna', 'mancuernas'),
  ('hip thrust a una pierna con mancuerna', 'banco'),
  ('frog pumps', 'peso corporal'),
  ('frog pumps', 'tapete'),
  ('frog pumps con banda', 'mini banda'),
  ('frog pumps con banda', 'tapete'),
  ('extension de cadera en banco romano', 'banco'),
  ('patada de gluteo en polea con rodilla flexionada', 'polea'),
  ('patada de gluteo diagonal en polea', 'polea'),
  ('patada de gluteo en smith', 'maquina smith'),
  ('patada de gluteo en smith', 'tapete'),
  ('extension de cadera en maquina de pie', 'maquina'),
  ('extension de cadera con banda de pie', 'banda elastica'),
  ('extension de cadera en cuadrupedia con mancuerna', 'mancuernas'),
  ('extension de cadera en cuadrupedia con mancuerna', 'tapete'),
  ('abduccion de cadera de pie con banda', 'banda elastica'),
  ('abduccion de cadera en maquina con torso inclinado', 'maquina'),
  ('abduccion de cadera en plancha lateral', 'tapete'),
  ('abduccion de cadera en cuadrupedia', 'peso corporal'),
  ('abduccion de cadera en cuadrupedia', 'tapete'),
  ('caminata monstruo con banda', 'mini banda'),
  ('caminata lateral con banda en tobillos', 'mini banda'),
  ('peso muerto rumano en smith', 'maquina smith'),
  ('peso muerto rumano con deficit', 'barra'),
  ('peso muerto rumano con deficit', 'cajon'),
  ('peso muerto kickstand', 'mancuernas'),
  ('peso muerto kickstand', 'kettlebell'),
  ('peso muerto con piernas rigidas', 'barra'),
  ('buenos dias en smith', 'maquina smith'),
  ('buenos dias con banda', 'banda elastica'),
  ('buenos dias sin carga', 'peso corporal'),
  ('curl femoral de pie en maquina', 'maquina'),
  ('curl femoral en polea baja', 'polea'),
  ('curl nordico asistido con banda', 'banda elastica'),
  ('curl nordico asistido con banda', 'tapete'),
  ('curl femoral con fitball a una pierna', 'pelota de estabilidad'),
  ('curl femoral con fitball a una pierna', 'tapete'),
  ('sentadilla en smith con talones elevados', 'maquina smith'),
  ('sentadilla frontal en smith', 'maquina smith'),
  ('sentadilla sissy asistida', 'peso corporal'),
  ('sentadilla sissy en maquina', 'maquina'),
  ('sentadilla pendular', 'maquina'),
  ('prensa vertical', 'maquina'),
  ('extension terminal de rodilla con banda', 'banda elastica'),
  ('sentadilla bulgara en smith', 'maquina smith'),
  ('sentadilla bulgara en smith', 'banco'),
  ('sentadilla bulgara con pie delantero elevado', 'mancuernas'),
  ('sentadilla bulgara con pie delantero elevado', 'banco'),
  ('sentadilla bulgara con pie delantero elevado', 'cajon'),
  ('desplante hacia delante en smith', 'maquina smith'),
  ('step-up lateral', 'cajon'),
  ('step-up lateral', 'mancuernas'),
  ('step-down de cajon', 'cajon'),
  ('spanish squat con banda', 'banda elastica'),
  ('sentadilla ciclista', 'mancuernas'),
  ('sentadilla ciclista', 'kettlebell'),
  ('aduccion de cadera acostada', 'peso corporal'),
  ('aduccion de cadera acostada', 'tapete'),
  ('aduccion de cadera de pie con banda', 'banda elastica'),
  ('plancha copenhague con rodilla apoyada', 'banco'),
  ('sentadilla cossack', 'peso corporal'),
  ('sentadilla cossack', 'kettlebell'),
  ('elevacion de talones en prensa', 'maquina'),
  ('elevacion de talones en smith', 'maquina smith'),
  ('elevacion de talones en smith', 'cajon'),
  ('elevacion de talones unilateral de pie', 'peso corporal'),
  ('elevacion de talones unilateral de pie', 'mancuernas'),
  ('elevacion de talones en escalon', 'cajon'),
  ('elevacion de talones en escalon', 'peso corporal'),
  ('caminata de puntas', 'peso corporal'),
  ('caminata de puntas', 'mancuernas'),
  ('jalon al pecho unilateral', 'polea'),
  ('jalon supino al pecho', 'polea'),
  ('jalon tras nuca', 'polea'),
  ('pullover con mancuerna', 'mancuernas'),
  ('pullover con mancuerna', 'banco'),
  ('pullover en maquina', 'maquina'),
  ('dominadas supinas', 'barra de dominadas'),
  ('dominadas neutras', 'barra de dominadas'),
  ('dominadas excentricas', 'barra de dominadas'),
  ('dominadas excentricas', 'cajon'),
  ('remo con pecho apoyado', 'mancuernas'),
  ('remo con pecho apoyado', 'banco'),
  ('remo con barra t con pecho apoyado', 'maquina'),
  ('remo unilateral en polea', 'polea'),
  ('remo alto en polea', 'polea'),
  ('remo con agarre amplio', 'polea'),
  ('remo con agarre supino', 'barra'),
  ('remo en trx con pies elevados', 'suspension (trx)'),
  ('remo en trx con pies elevados', 'cajon'),
  ('encogimiento de hombros con barra', 'barra'),
  ('encogimiento de hombros en smith', 'maquina smith'),
  ('encogimiento de hombros en polea', 'polea'),
  ('extension lumbar en banco romano', 'banco'),
  ('aperturas invertidas en maquina', 'maquina'),
  ('press de banca en smith', 'maquina smith'),
  ('press de banca en smith', 'banco'),
  ('press declinado con barra', 'barra'),
  ('press declinado con barra', 'banco'),
  ('press declinado con mancuernas', 'mancuernas'),
  ('press declinado con mancuernas', 'banco'),
  ('press inclinado con barra', 'barra'),
  ('press inclinado con barra', 'banco'),
  ('press inclinado en maquina', 'maquina'),
  ('press convergente en maquina', 'maquina'),
  ('press unilateral en polea', 'polea'),
  ('aperturas en maquina', 'maquina'),
  ('cruce de poleas de abajo hacia arriba', 'polea'),
  ('lagartijas inclinadas', 'peso corporal'),
  ('lagartijas inclinadas', 'banco'),
  ('lagartijas declinadas', 'peso corporal'),
  ('lagartijas declinadas', 'banco'),
  ('press arnold', 'mancuernas'),
  ('press arnold', 'banco'),
  ('press de hombro en smith', 'maquina smith'),
  ('press de hombro en smith', 'banco'),
  ('press de hombro unilateral en polea', 'polea'),
  ('elevacion lateral en maquina', 'maquina'),
  ('elevacion lateral inclinada', 'mancuernas'),
  ('aperturas invertidas en polea', 'polea'),
  ('remo al menton con cuerda', 'polea'),
  ('y-raise en banco inclinado', 'mancuernas'),
  ('y-raise en banco inclinado', 'banco'),
  ('y-raise en polea', 'polea'),
  ('curl predicador con mancuernas', 'mancuernas'),
  ('curl predicador con mancuernas', 'banco'),
  ('curl predicador en maquina', 'maquina'),
  ('curl bayesian en polea', 'polea'),
  ('curl inclinado con mancuernas', 'mancuernas'),
  ('curl inclinado con mancuernas', 'banco'),
  ('curl spider', 'mancuernas'),
  ('curl spider', 'banco'),
  ('extension de triceps cruzada en polea', 'polea'),
  ('extension de triceps acostada con mancuernas', 'mancuernas'),
  ('extension de triceps acostada con mancuernas', 'banco'),
  ('press cerrado con barra', 'barra'),
  ('press cerrado con barra', 'banco'),
  ('press cerrado en smith', 'maquina smith'),
  ('press cerrado en smith', 'banco'),
  ('fondos asistidos en maquina', 'maquina'),
  ('extension de triceps en maquina', 'maquina'),
  ('extension de triceps con banda', 'banda elastica'),
  ('crunch inverso', 'tapete'),
  ('crunch en banco declinado', 'banco'),
  ('crunch en maquina', 'maquina'),
  ('crunch con pelota de estabilidad', 'pelota de estabilidad'),
  ('hollow body hold', 'tapete'),
  ('hollow rocks', 'tapete'),
  ('plancha con alcance', 'tapete'),
  ('plancha con desplazamiento', 'tapete'),
  ('body saw', 'suspension (trx)'),
  ('press pallof de rodillas', 'polea'),
  ('press pallof de rodillas', 'banda elastica'),
  ('press pallof con pasos laterales', 'polea'),
  ('press pallof con pasos laterales', 'banda elastica'),
  ('bird dog con banda', 'banda elastica'),
  ('bird dog con banda', 'tapete'),
  ('paseo del granjero unilateral', 'mancuernas'),
  ('paseo del granjero unilateral', 'kettlebell'),
  ('bear crawl', 'peso corporal'),
  ('bear plank con elevacion de rodillas', 'peso corporal'),
  ('bicicleta reclinada', 'bicicleta fija'),
  ('estiramiento de flexor de cadera en sofa', 'tapete'),
  ('estiramiento de flexor de cadera en sofa', 'banco'),
  ('estiramiento de aductores en roca', 'tapete'),
  ('estiramiento de aductores en mariposa', 'tapete'),
  ('movilidad de tobillo con banda', 'banda elastica'),
  ('dorsiflexion de tobillo en sentadilla', 'peso corporal'),
  ('rotacion toracica en posicion de libro abierto', 'tapete'),
  ('estiramiento de dorsal en banco', 'banco'),
  ('deslizamientos de brazos en pared', 'peso corporal')
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN equipment q ON q.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

INSERT OR IGNORE INTO exercise_variants (exercise_id, variant_exercise_id, note, created_at)
SELECT b.id, e.id, v.column3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now') FROM (VALUES
  ('hip thrust con barra', 'hip thrust con banda elastica', NULL),
  ('hip thrust con barra', 'hip thrust en smith', NULL),
  ('hip thrust con barra', 'hip thrust con pies elevados', NULL),
  ('hip thrust con barra', 'hip thrust con barra y banda', NULL),
  ('hip thrust en maquina', 'hip thrust a una pierna en maquina', NULL),
  ('hip thrust a una pierna', 'hip thrust a una pierna con mancuerna', NULL),
  ('puente de gluteo', 'frog pumps', NULL),
  ('puente de gluteo', 'frog pumps con banda', NULL),
  ('hiperextension a 45°', 'extension de cadera en banco romano', NULL),
  ('patada de gluteo en polea', 'patada de gluteo en polea con rodilla flexionada', NULL),
  ('patada de gluteo en polea', 'patada de gluteo diagonal en polea', NULL),
  ('patada de gluteo en cuadrupedia', 'patada de gluteo en smith', NULL),
  ('patada de gluteo en maquina', 'extension de cadera en maquina de pie', NULL),
  ('patada de gluteo con banda', 'extension de cadera con banda de pie', NULL),
  ('patada de gluteo en cuadrupedia', 'extension de cadera en cuadrupedia con mancuerna', NULL),
  ('abduccion de cadera en polea', 'abduccion de cadera de pie con banda', NULL),
  ('abduccion de cadera en maquina', 'abduccion de cadera en maquina con torso inclinado', NULL),
  ('plancha lateral', 'abduccion de cadera en plancha lateral', NULL),
  ('caminata lateral con mini banda', 'caminata monstruo con banda', NULL),
  ('caminata lateral con mini banda', 'caminata lateral con banda en tobillos', NULL),
  ('peso muerto rumano con barra', 'peso muerto rumano en smith', NULL),
  ('peso muerto rumano con barra', 'peso muerto rumano con deficit', NULL),
  ('peso muerto rumano a una pierna', 'peso muerto kickstand', NULL),
  ('peso muerto rumano con barra', 'peso muerto con piernas rigidas', NULL),
  ('buenos dias con barra', 'buenos dias en smith', NULL),
  ('buenos dias con barra', 'buenos dias con banda', NULL),
  ('buenos dias con barra', 'buenos dias sin carga', NULL),
  ('curl femoral acostado', 'curl femoral de pie en maquina', NULL),
  ('curl femoral acostado', 'curl femoral en polea baja', NULL),
  ('curl nordico', 'curl nordico asistido con banda', NULL),
  ('curl femoral con pelota', 'curl femoral con fitball a una pierna', NULL),
  ('sentadilla en smith', 'sentadilla en smith con talones elevados', NULL),
  ('sentadilla frontal', 'sentadilla frontal en smith', NULL),
  ('sentadilla sissy asistida', 'sentadilla sissy en maquina', NULL),
  ('sentadilla hack', 'sentadilla pendular', NULL),
  ('prensa de piernas', 'prensa vertical', NULL),
  ('extension de cuadriceps', 'extension terminal de rodilla con banda', NULL),
  ('sentadilla bulgara', 'sentadilla bulgara en smith', NULL),
  ('sentadilla bulgara', 'sentadilla bulgara con pie delantero elevado', NULL),
  ('desplante hacia atras', 'desplante hacia delante en smith', NULL),
  ('subida al cajon', 'step-up lateral', NULL),
  ('subida al cajon', 'step-down de cajon', NULL),
  ('sentadilla goblet', 'sentadilla ciclista', NULL),
  ('aduccion de cadera en polea', 'aduccion de cadera de pie con banda', NULL),
  ('plancha copenhague', 'plancha copenhague con rodilla apoyada', NULL),
  ('desplante lateral', 'sentadilla cossack', NULL),
  ('elevacion de talones de pie', 'elevacion de talones en prensa', NULL),
  ('elevacion de talones de pie', 'elevacion de talones en smith', NULL),
  ('elevacion de talones de pie', 'elevacion de talones unilateral de pie', NULL),
  ('elevacion de talones de pie', 'elevacion de talones en escalon', NULL),
  ('jalon al pecho', 'jalon al pecho unilateral', NULL),
  ('jalon al pecho', 'jalon supino al pecho', NULL),
  ('jalon al pecho', 'jalon tras nuca', 'No recomendada por defecto'),
  ('jalon con brazos rectos', 'pullover con mancuerna', NULL),
  ('jalon con brazos rectos', 'pullover en maquina', NULL),
  ('dominadas', 'dominadas supinas', NULL),
  ('dominadas', 'dominadas neutras', NULL),
  ('dominadas', 'dominadas excentricas', NULL),
  ('remo con mancuerna a una mano', 'remo con pecho apoyado', NULL),
  ('remo en maquina', 'remo con barra t con pecho apoyado', NULL),
  ('remo sentado en polea', 'remo unilateral en polea', NULL),
  ('remo sentado en polea', 'remo alto en polea', NULL),
  ('remo sentado en polea', 'remo con agarre amplio', NULL),
  ('remo con barra', 'remo con agarre supino', NULL),
  ('remo invertido', 'remo en trx con pies elevados', NULL),
  ('encogimiento de hombros con mancuernas', 'encogimiento de hombros con barra', NULL),
  ('encogimiento de hombros con mancuernas', 'encogimiento de hombros en smith', NULL),
  ('encogimiento de hombros con mancuernas', 'encogimiento de hombros en polea', NULL),
  ('hiperextension a 45°', 'extension lumbar en banco romano', NULL),
  ('aperturas invertidas con mancuernas', 'aperturas invertidas en maquina', NULL),
  ('press de banca con barra', 'press de banca en smith', NULL),
  ('press de banca con barra', 'press declinado con barra', NULL),
  ('press de banca con mancuernas', 'press declinado con mancuernas', NULL),
  ('press de banca con barra', 'press inclinado con barra', NULL),
  ('press de pecho en maquina', 'press inclinado en maquina', NULL),
  ('press de pecho en maquina', 'press convergente en maquina', NULL),
  ('press de pecho en maquina', 'press unilateral en polea', NULL),
  ('aperturas con mancuernas', 'aperturas en maquina', NULL),
  ('cruce de poleas', 'cruce de poleas de abajo hacia arriba', NULL),
  ('lagartijas', 'lagartijas inclinadas', NULL),
  ('lagartijas', 'lagartijas declinadas', NULL),
  ('press de hombro con mancuernas', 'press arnold', NULL),
  ('press militar con barra', 'press de hombro en smith', NULL),
  ('press de hombro con mancuernas', 'press de hombro unilateral en polea', NULL),
  ('elevaciones laterales con mancuernas', 'elevacion lateral en maquina', NULL),
  ('elevaciones laterales con mancuernas', 'elevacion lateral inclinada', NULL),
  ('aperturas invertidas con mancuernas', 'aperturas invertidas en polea', NULL),
  ('y-raise en banco inclinado', 'y-raise en polea', NULL),
  ('curl de biceps con mancuernas', 'curl predicador con mancuernas', NULL),
  ('curl de biceps con barra', 'curl predicador en maquina', NULL),
  ('curl de biceps en polea', 'curl bayesian en polea', NULL),
  ('curl de biceps con mancuernas', 'curl inclinado con mancuernas', NULL),
  ('curl de biceps con mancuernas', 'curl spider', NULL),
  ('extension de triceps en polea', 'extension de triceps cruzada en polea', NULL),
  ('press frances', 'extension de triceps acostada con mancuernas', NULL),
  ('press de banca con barra', 'press cerrado con barra', NULL),
  ('press cerrado con barra', 'press cerrado en smith', NULL),
  ('fondos en paralelas', 'fondos asistidos en maquina', NULL),
  ('extension de triceps en polea', 'extension de triceps en maquina', NULL),
  ('extension de triceps en polea', 'extension de triceps con banda', NULL),
  ('crunch abdominal', 'crunch inverso', NULL),
  ('crunch abdominal', 'crunch en banco declinado', NULL),
  ('crunch abdominal', 'crunch en maquina', NULL),
  ('crunch abdominal', 'crunch con pelota de estabilidad', NULL),
  ('bicho muerto', 'hollow body hold', NULL),
  ('hollow body hold', 'hollow rocks', NULL),
  ('plancha', 'plancha con alcance', NULL),
  ('plancha', 'plancha con desplazamiento', NULL),
  ('plancha', 'body saw', NULL),
  ('press pallof', 'press pallof de rodillas', NULL),
  ('press pallof', 'press pallof con pasos laterales', NULL),
  ('bird dog', 'bird dog con banda', NULL),
  ('paseo del granjero', 'paseo del granjero unilateral', NULL),
  ('bear crawl', 'bear plank con elevacion de rodillas', NULL),
  ('bicicleta fija', 'bicicleta reclinada', NULL),
  ('estiramiento de flexor de cadera en rodilla', 'estiramiento de flexor de cadera en sofa', NULL),
  ('movilidad de tobillo en pared', 'movilidad de tobillo con banda', NULL),
  ('movilidad de tobillo en pared', 'dorsiflexion de tobillo en sentadilla', NULL),
  ('rotacion toracica en cuadrupedia', 'rotacion toracica en posicion de libro abierto', NULL)
) v
JOIN exercises b ON b.name_es_key = v.column1
JOIN exercises e ON e.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id) AND b.id <> e.id
  AND NOT EXISTS (SELECT 1 FROM exercise_variants y WHERE y.exercise_id = e.id AND y.variant_exercise_id = b.id);

INSERT OR IGNORE INTO exercise_muscles (exercise_id, muscle_group_id, role)
SELECT e.id, m.id, v.column3 FROM (VALUES
  ('hip thrust con banda elastica', 'gluteos', 1),
  ('hip thrust con banda elastica', 'femoral', 2),
  ('hip thrust en smith', 'gluteos', 1),
  ('hip thrust en smith', 'femoral', 2),
  ('hip thrust con pies elevados', 'gluteos', 1),
  ('hip thrust con pies elevados', 'femoral', 2),
  ('hip thrust con barra y banda', 'gluteos', 1),
  ('hip thrust con barra y banda', 'femoral', 2),
  ('hip thrust a una pierna en maquina', 'gluteos', 1),
  ('hip thrust a una pierna en maquina', 'femoral', 2),
  ('hip thrust a una pierna en maquina', 'abductores', 2),
  ('hip thrust a una pierna con mancuerna', 'gluteos', 1),
  ('hip thrust a una pierna con mancuerna', 'femoral', 2),
  ('hip thrust a una pierna con mancuerna', 'abductores', 2),
  ('frog pumps', 'gluteos', 1),
  ('frog pumps', 'abductores', 2),
  ('frog pumps con banda', 'gluteos', 1),
  ('frog pumps con banda', 'abductores', 2),
  ('extension de cadera en banco romano', 'gluteos', 1),
  ('extension de cadera en banco romano', 'femoral', 2),
  ('extension de cadera en banco romano', 'espalda', 2),
  ('patada de gluteo en polea con rodilla flexionada', 'gluteos', 1),
  ('patada de gluteo en polea con rodilla flexionada', 'femoral', 2),
  ('patada de gluteo diagonal en polea', 'gluteos', 1),
  ('patada de gluteo diagonal en polea', 'abductores', 2),
  ('patada de gluteo en smith', 'gluteos', 1),
  ('patada de gluteo en smith', 'femoral', 2),
  ('extension de cadera en maquina de pie', 'gluteos', 1),
  ('extension de cadera en maquina de pie', 'femoral', 2),
  ('extension de cadera con banda de pie', 'gluteos', 1),
  ('extension de cadera con banda de pie', 'femoral', 2),
  ('extension de cadera en cuadrupedia con mancuerna', 'gluteos', 1),
  ('extension de cadera en cuadrupedia con mancuerna', 'femoral', 2),
  ('abduccion de cadera de pie con banda', 'abductores', 1),
  ('abduccion de cadera de pie con banda', 'gluteos', 2),
  ('abduccion de cadera en maquina con torso inclinado', 'abductores', 1),
  ('abduccion de cadera en maquina con torso inclinado', 'gluteos', 2),
  ('abduccion de cadera en plancha lateral', 'abductores', 1),
  ('abduccion de cadera en plancha lateral', 'gluteos', 2),
  ('abduccion de cadera en plancha lateral', 'abdomen', 2),
  ('abduccion de cadera en cuadrupedia', 'abductores', 1),
  ('abduccion de cadera en cuadrupedia', 'gluteos', 2),
  ('caminata monstruo con banda', 'abductores', 1),
  ('caminata monstruo con banda', 'gluteos', 2),
  ('caminata lateral con banda en tobillos', 'abductores', 1),
  ('caminata lateral con banda en tobillos', 'gluteos', 2),
  ('peso muerto rumano en smith', 'femoral', 1),
  ('peso muerto rumano en smith', 'gluteos', 2),
  ('peso muerto rumano en smith', 'espalda', 2),
  ('peso muerto rumano con deficit', 'femoral', 1),
  ('peso muerto rumano con deficit', 'gluteos', 2),
  ('peso muerto rumano con deficit', 'espalda', 2),
  ('peso muerto kickstand', 'femoral', 1),
  ('peso muerto kickstand', 'gluteos', 2),
  ('peso muerto con piernas rigidas', 'femoral', 1),
  ('peso muerto con piernas rigidas', 'gluteos', 2),
  ('peso muerto con piernas rigidas', 'espalda', 2),
  ('buenos dias en smith', 'femoral', 1),
  ('buenos dias en smith', 'gluteos', 2),
  ('buenos dias en smith', 'espalda', 2),
  ('buenos dias con banda', 'femoral', 1),
  ('buenos dias con banda', 'gluteos', 2),
  ('buenos dias con banda', 'espalda', 2),
  ('buenos dias sin carga', 'femoral', 1),
  ('buenos dias sin carga', 'gluteos', 2),
  ('buenos dias sin carga', 'espalda', 2),
  ('curl femoral de pie en maquina', 'femoral', 1),
  ('curl femoral de pie en maquina', 'pantorrillas', 2),
  ('curl femoral en polea baja', 'femoral', 1),
  ('curl nordico asistido con banda', 'femoral', 1),
  ('curl femoral con fitball a una pierna', 'femoral', 1),
  ('curl femoral con fitball a una pierna', 'gluteos', 2),
  ('sentadilla en smith con talones elevados', 'cuadriceps', 1),
  ('sentadilla en smith con talones elevados', 'gluteos', 2),
  ('sentadilla frontal en smith', 'cuadriceps', 1),
  ('sentadilla frontal en smith', 'gluteos', 2),
  ('sentadilla frontal en smith', 'abdomen', 2),
  ('sentadilla sissy asistida', 'cuadriceps', 1),
  ('sentadilla sissy en maquina', 'cuadriceps', 1),
  ('sentadilla pendular', 'cuadriceps', 1),
  ('sentadilla pendular', 'gluteos', 2),
  ('prensa vertical', 'cuadriceps', 1),
  ('prensa vertical', 'gluteos', 2),
  ('extension terminal de rodilla con banda', 'cuadriceps', 1),
  ('sentadilla bulgara en smith', 'cuadriceps', 1),
  ('sentadilla bulgara en smith', 'gluteos', 2),
  ('sentadilla bulgara en smith', 'aductores', 2),
  ('sentadilla bulgara con pie delantero elevado', 'cuadriceps', 1),
  ('sentadilla bulgara con pie delantero elevado', 'gluteos', 2),
  ('sentadilla bulgara con pie delantero elevado', 'aductores', 2),
  ('desplante hacia delante en smith', 'cuadriceps', 1),
  ('desplante hacia delante en smith', 'gluteos', 2),
  ('step-up lateral', 'cuadriceps', 1),
  ('step-up lateral', 'gluteos', 2),
  ('step-up lateral', 'abductores', 2),
  ('step-down de cajon', 'cuadriceps', 1),
  ('step-down de cajon', 'gluteos', 2),
  ('spanish squat con banda', 'cuadriceps', 1),
  ('sentadilla ciclista', 'cuadriceps', 1),
  ('sentadilla ciclista', 'gluteos', 2),
  ('aduccion de cadera acostada', 'aductores', 1),
  ('aduccion de cadera de pie con banda', 'aductores', 1),
  ('plancha copenhague con rodilla apoyada', 'aductores', 1),
  ('plancha copenhague con rodilla apoyada', 'abdomen', 2),
  ('sentadilla cossack', 'aductores', 1),
  ('sentadilla cossack', 'cuadriceps', 2),
  ('sentadilla cossack', 'gluteos', 2),
  ('elevacion de talones en prensa', 'pantorrillas', 1),
  ('elevacion de talones en smith', 'pantorrillas', 1),
  ('elevacion de talones unilateral de pie', 'pantorrillas', 1),
  ('elevacion de talones en escalon', 'pantorrillas', 1),
  ('caminata de puntas', 'pantorrillas', 1),
  ('jalon al pecho unilateral', 'espalda', 1),
  ('jalon al pecho unilateral', 'biceps', 2),
  ('jalon supino al pecho', 'espalda', 1),
  ('jalon supino al pecho', 'biceps', 2),
  ('jalon tras nuca', 'espalda', 1),
  ('jalon tras nuca', 'biceps', 2),
  ('pullover con mancuerna', 'espalda', 1),
  ('pullover con mancuerna', 'pecho', 2),
  ('pullover con mancuerna', 'triceps', 2),
  ('pullover en maquina', 'espalda', 1),
  ('dominadas supinas', 'espalda', 1),
  ('dominadas supinas', 'biceps', 2),
  ('dominadas neutras', 'espalda', 1),
  ('dominadas neutras', 'biceps', 2),
  ('dominadas excentricas', 'espalda', 1),
  ('dominadas excentricas', 'biceps', 2),
  ('remo con pecho apoyado', 'espalda', 1),
  ('remo con pecho apoyado', 'biceps', 2),
  ('remo con pecho apoyado', 'hombros', 2),
  ('remo con barra t con pecho apoyado', 'espalda', 1),
  ('remo con barra t con pecho apoyado', 'biceps', 2),
  ('remo unilateral en polea', 'espalda', 1),
  ('remo unilateral en polea', 'biceps', 2),
  ('remo alto en polea', 'espalda', 1),
  ('remo alto en polea', 'hombros', 2),
  ('remo alto en polea', 'biceps', 2),
  ('remo con agarre amplio', 'espalda', 1),
  ('remo con agarre amplio', 'hombros', 2),
  ('remo con agarre amplio', 'biceps', 2),
  ('remo con agarre supino', 'espalda', 1),
  ('remo con agarre supino', 'biceps', 2),
  ('remo en trx con pies elevados', 'espalda', 1),
  ('remo en trx con pies elevados', 'biceps', 2),
  ('encogimiento de hombros con barra', 'espalda', 1),
  ('encogimiento de hombros en smith', 'espalda', 1),
  ('encogimiento de hombros en polea', 'espalda', 1),
  ('extension lumbar en banco romano', 'espalda', 1),
  ('extension lumbar en banco romano', 'gluteos', 2),
  ('extension lumbar en banco romano', 'femoral', 2),
  ('aperturas invertidas en maquina', 'hombros', 1),
  ('aperturas invertidas en maquina', 'espalda', 2),
  ('press de banca en smith', 'pecho', 1),
  ('press de banca en smith', 'triceps', 2),
  ('press de banca en smith', 'hombros', 2),
  ('press declinado con barra', 'pecho', 1),
  ('press declinado con barra', 'triceps', 2),
  ('press declinado con barra', 'hombros', 2),
  ('press declinado con mancuernas', 'pecho', 1),
  ('press declinado con mancuernas', 'triceps', 2),
  ('press declinado con mancuernas', 'hombros', 2),
  ('press inclinado con barra', 'pecho', 1),
  ('press inclinado con barra', 'hombros', 2),
  ('press inclinado con barra', 'triceps', 2),
  ('press inclinado en maquina', 'pecho', 1),
  ('press inclinado en maquina', 'hombros', 2),
  ('press inclinado en maquina', 'triceps', 2),
  ('press convergente en maquina', 'pecho', 1),
  ('press convergente en maquina', 'triceps', 2),
  ('press convergente en maquina', 'hombros', 2),
  ('press unilateral en polea', 'pecho', 1),
  ('press unilateral en polea', 'triceps', 2),
  ('press unilateral en polea', 'hombros', 2),
  ('press unilateral en polea', 'abdomen', 2),
  ('aperturas en maquina', 'pecho', 1),
  ('aperturas en maquina', 'hombros', 2),
  ('cruce de poleas de abajo hacia arriba', 'pecho', 1),
  ('cruce de poleas de abajo hacia arriba', 'hombros', 2),
  ('lagartijas inclinadas', 'pecho', 1),
  ('lagartijas inclinadas', 'triceps', 2),
  ('lagartijas inclinadas', 'hombros', 2),
  ('lagartijas declinadas', 'pecho', 1),
  ('lagartijas declinadas', 'hombros', 2),
  ('lagartijas declinadas', 'triceps', 2),
  ('press arnold', 'hombros', 1),
  ('press arnold', 'triceps', 2),
  ('press de hombro en smith', 'hombros', 1),
  ('press de hombro en smith', 'triceps', 2),
  ('press de hombro unilateral en polea', 'hombros', 1),
  ('press de hombro unilateral en polea', 'triceps', 2),
  ('press de hombro unilateral en polea', 'abdomen', 2),
  ('elevacion lateral en maquina', 'hombros', 1),
  ('elevacion lateral inclinada', 'hombros', 1),
  ('aperturas invertidas en polea', 'hombros', 1),
  ('aperturas invertidas en polea', 'espalda', 2),
  ('remo al menton con cuerda', 'hombros', 1),
  ('remo al menton con cuerda', 'espalda', 2),
  ('y-raise en banco inclinado', 'hombros', 1),
  ('y-raise en banco inclinado', 'espalda', 2),
  ('y-raise en polea', 'hombros', 1),
  ('y-raise en polea', 'espalda', 2),
  ('curl predicador con mancuernas', 'biceps', 1),
  ('curl predicador en maquina', 'biceps', 1),
  ('curl bayesian en polea', 'biceps', 1),
  ('curl inclinado con mancuernas', 'biceps', 1),
  ('curl spider', 'biceps', 1),
  ('extension de triceps cruzada en polea', 'triceps', 1),
  ('extension de triceps acostada con mancuernas', 'triceps', 1),
  ('press cerrado con barra', 'triceps', 1),
  ('press cerrado con barra', 'pecho', 2),
  ('press cerrado con barra', 'hombros', 2),
  ('press cerrado en smith', 'triceps', 1),
  ('press cerrado en smith', 'pecho', 2),
  ('press cerrado en smith', 'hombros', 2),
  ('fondos asistidos en maquina', 'triceps', 1),
  ('fondos asistidos en maquina', 'pecho', 2),
  ('fondos asistidos en maquina', 'hombros', 2),
  ('extension de triceps en maquina', 'triceps', 1),
  ('extension de triceps con banda', 'triceps', 1),
  ('crunch inverso', 'abdomen', 1),
  ('crunch en banco declinado', 'abdomen', 1),
  ('crunch en maquina', 'abdomen', 1),
  ('crunch con pelota de estabilidad', 'abdomen', 1),
  ('hollow body hold', 'abdomen', 1),
  ('hollow rocks', 'abdomen', 1),
  ('plancha con alcance', 'abdomen', 1),
  ('plancha con alcance', 'hombros', 2),
  ('plancha con desplazamiento', 'abdomen', 1),
  ('plancha con desplazamiento', 'hombros', 2),
  ('body saw', 'abdomen', 1),
  ('body saw', 'hombros', 2),
  ('press pallof de rodillas', 'abdomen', 1),
  ('press pallof con pasos laterales', 'abdomen', 1),
  ('press pallof con pasos laterales', 'abductores', 2),
  ('bird dog con banda', 'abdomen', 1),
  ('bird dog con banda', 'gluteos', 2),
  ('bird dog con banda', 'espalda', 2),
  ('paseo del granjero unilateral', 'abdomen', 1),
  ('paseo del granjero unilateral', 'espalda', 2),
  ('paseo del granjero unilateral', 'hombros', 2),
  ('bear crawl', 'abdomen', 1),
  ('bear crawl', 'hombros', 2),
  ('bear crawl', 'cuadriceps', 2),
  ('bear plank con elevacion de rodillas', 'abdomen', 1),
  ('bear plank con elevacion de rodillas', 'hombros', 2),
  ('bear plank con elevacion de rodillas', 'cuadriceps', 2),
  ('bicicleta reclinada', 'cuadriceps', 1),
  ('bicicleta reclinada', 'gluteos', 2),
  ('estiramiento de flexor de cadera en sofa', 'cuadriceps', 1),
  ('estiramiento de aductores en roca', 'aductores', 1),
  ('estiramiento de aductores en mariposa', 'aductores', 1),
  ('movilidad de tobillo con banda', 'pantorrillas', 1),
  ('dorsiflexion de tobillo en sentadilla', 'pantorrillas', 1),
  ('rotacion toracica en posicion de libro abierto', 'espalda', 1),
  ('rotacion toracica en posicion de libro abierto', 'pecho', 2),
  ('estiramiento de dorsal en banco', 'espalda', 1),
  ('estiramiento de dorsal en banco', 'triceps', 2),
  ('deslizamientos de brazos en pared', 'hombros', 1),
  ('deslizamientos de brazos en pared', 'espalda', 2)
) v
JOIN exercises e ON e.name_es_key = v.column1
JOIN muscle_groups m ON m.name_es_key = v.column2
WHERE NOT EXISTS (SELECT 1 FROM exercise_muscles x WHERE x.exercise_id = e.id);

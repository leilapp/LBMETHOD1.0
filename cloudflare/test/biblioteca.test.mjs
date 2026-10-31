// Pruebas de la etapa 2 (biblioteca de ejercicios, imágenes y videos en el espacio privado KV, Excel) contra el Worker real.
//   npm test
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { BASE, OTHER, Session, sql, trainer, useServer } from './helpers.mjs'

useServer()

const LIB = '/api/trainer/library'
const EX = `${LIB}/exercises`
const GLUTEOS = 1
const FEMORAL = 2
const CUADRICEPS = 3

const json = async (res, status) => {
  assert.equal(res.status, status, `respuesta ${res.status}: ${await res.clone().text()}`)
  return res.status === 204 ? null : res.json()
}
const createExercise = async (s, body) =>
  (await json(await s.post(EX, { type: 1, primaryMuscleGroupId: GLUTEOS, ...body }), 201)).id
const search = async (s, query) => json(await s.get(`${EX}?${new URLSearchParams(query)}`), 200)

// Archivos de prueba: una imagen PNG real mínima y un video MP4 (solo la cabecera «ftyp», suficiente para el tipo real).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const mp4 = (size) => {
  const b = Buffer.alloc(size)
  b.write('ftypisom', 4, 'latin1')
  return b
}
const upload = (s, id, bytes, name, title) => {
  const form = new FormData()
  form.append('file', new Blob([bytes]), name)
  if (title) form.append('title', title)
  return s.post(`${EX}/${id}/media`, form)
}

/** Excel mínimo con textos compartidos (como lo guarda Excel), para probar el lector con un archivo distinto al nuestro. */
function xlsx(rows, sheetName = 'Ejercicios') {
  const strings = []
  const index = new Map()
  const esc = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const si = (v) => {
    if (!index.has(v)) index.set(v, strings.push(v) - 1)
    return index.get(v)
  }
  const col = (i) => String.fromCharCode(65 + i)
  const data = rows
    .map((r, i) => `<row r="${i + 1}">${r.map((v, j) => (v ? `<c r="${col(j)}${i + 1}" t="s"><v>${si(v)}</v></c>`: '')).join('')}</row>`)
    .join('')
  return zipSync({
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
    ),
    '_rels/.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data}</sheetData></worksheet>`),
    'xl/sharedStrings.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${strings.map((v) => `<si><t xml:space="preserve">${esc(v)}</t></si>`).join('')}</sst>`,
    ),
  })
}
const sendFile = (s, path, bytes, name) => {
  const form = new FormData()
  form.append('file', new Blob([bytes]), name)
  return s.post(path, form)
}
const HEADER = ['NombreES', 'NombreEN', 'Descripcion', 'GrupoPrincipal', 'MusculosSecundarios', 'Equipamiento', 'Tipo', 'PatronMovimiento', 'Dificultad', 'Instrucciones', 'ErroresFrecuentes', 'Consejos']

describe('catálogos (grupos musculares, equipamiento y patrones)', () => {
  test('vienen los 12 grupos musculares; se agregan, renombran y desactivan; los duplicados se detectan sin acentos', async () => {
    const s = await trainer()
    const catalogs = await json(await s.get(`${LIB}/catalogs`), 200)
    assert.equal(catalogs.muscleGroups.length, 12)
    assert.deepEqual(catalogs.muscleGroups[0], { id: 1, nameEs: 'Glúteos', nameEn: 'Glutes', isActive: true, exerciseCount: 0 })
    assert.deepEqual(catalogs.types.map((t) => t.label), ['Fuerza', 'Movilidad', 'Cardio', 'Pliométrico', 'Isométrico', 'Estiramiento', 'Otro'])
    assert.deepEqual(catalogs.difficulties.map((t) => t.label), ['Principiante', 'Intermedio', 'Avanzado'])

    const { id } = await json(await s.post(`${LIB}/equipment`, { nameEs: 'Banda elástica', nameEn: 'Resistance band' }), 201)
    const dup = await json(await s.post(`${LIB}/equipment`, { nameEs: 'BANDA  ELASTICA', nameEn: 'Otra' }), 409)
    assert.ok(dup.errors.nameEs)
    assert.ok((await json(await s.post(`${LIB}/muscle-groups`, { nameEs: 'Lumbar', nameEn: 'glutes' }), 409)).errors.nameEn)
    assert.ok((await json(await s.post(`${LIB}/movement-patterns`, { nameEs: '', nameEn: 'x'.repeat(101) }), 400)).errors.nameEn)

    const lumbar = await json(await s.post(`${LIB}/muscle-groups`, { nameEs: 'Lumbar', nameEn: 'Lower back' }), 201)
    const groups = await json(await s.get(`${LIB}/muscle-groups`), 200)
    assert.equal(groups.at(-1).id, lumbar.id, 'los grupos nuevos van al final')

    await json(await s.put(`${LIB}/equipment/${id}`, { nameEs: 'Liga', nameEn: 'Band', isActive: false }), 204)
    const equipment = await json(await s.get(`${LIB}/equipment`), 200)
    assert.deepEqual(equipment.find((e) => e.id === id), { id, nameEs: 'Liga', nameEn: 'Band', isActive: false, exerciseCount: 0 })
    assert.equal((await s.put(`${LIB}/equipment/999999`, { nameEs: 'Nada', nameEn: 'None' })).status, 404)
  })

  test('el cliente recibe 403 y sin sesión 401', async () => {
    const t = await trainer()
    const { temporaryPassword } = await json(await t.post('/api/trainer/clients', { firstName: 'Cliente', lastName: 'Biblioteca', email: 'cliente.biblio@prueba.local' }), 201)
    const c = new Session()
    await c.login({ email: 'cliente.biblio@prueba.local', password: temporaryPassword })
    await c.post('/api/auth/change-password', { currentPassword: temporaryPassword, newPassword: 'ClienteNueva2026' })
    for (const path of [`${LIB}/catalogs`, EX, `${EX}/export`, `${EX}/import/template`, `${LIB}/media/1/content`]) {
      assert.equal((await c.get(path)).status, 403, path)
      assert.equal((await new Session().get(path)).status, 401, path)
    }
    assert.equal((await c.post(EX, { nameEs: 'Intruso', type: 1, primaryMuscleGroupId: 1 })).status, 403)
  })
})

describe('ejercicios', () => {
  test('alta con validación por campo, nombres únicos en español e inglés (también desactivados) y auditoría', async () => {
    const s = await trainer()
    const bad = await json(await s.post(EX, { nameEs: '', type: 7, difficulty: 9, primaryMuscleGroupId: 999, secondaryMuscleGroupIds: 'no', description: 'x'.repeat(2001) }), 400)
    assert.deepEqual(Object.keys(bad.errors).sort(), ['secondaryMuscleGroupIds'])
    const bad2 = await json(await s.post(EX, { nameEs: '', type: 7, difficulty: 9, primaryMuscleGroupId: 999, description: 'x'.repeat(2001) }), 400)
    assert.deepEqual(Object.keys(bad2.errors).sort(), ['description', 'difficulty', 'nameEs', 'primaryMuscleGroupId', 'type'])
    assert.deepEqual(Object.keys((await json(await s.post(EX, { nameEs: 'Algo' }), 400)).errors).sort(), ['primaryMuscleGroupId', 'type'])
    assert.ok((await json(await s.post(EX, { nameEs: 'Algo', type: 1, primaryMuscleGroupId: GLUTEOS, secondaryMuscleGroupIds: [GLUTEOS] }), 400)).errors.secondaryMuscleGroupIds)

    const id = await createExercise(s, {
      nameEs: '  Hip   thrust con barra ', nameEn: 'Barbell hip thrust', difficulty: 2, secondaryMuscleGroupIds: [FEMORAL, CUADRICEPS],
      instructions: 'Apoya la espalda alta en el banco.',
    })
    const detail = await json(await s.get(`${EX}/${id}`), 200)
    assert.equal(detail.nameEs, 'Hip thrust con barra')
    assert.equal(detail.typeLabel, 'Fuerza')
    assert.equal(detail.difficultyLabel, 'Intermedio')
    assert.deepEqual(detail.primaryMuscleGroup, { id: GLUTEOS, nameEs: 'Glúteos', nameEn: 'Glutes' })
    assert.deepEqual(detail.secondaryMuscleGroups.map((m) => m.nameEs), ['Femoral', 'Cuádriceps'])

    assert.ok((await json(await s.post(EX, { nameEs: 'HIP THRUST CON BARRA', type: 1, primaryMuscleGroupId: GLUTEOS }), 409)).errors.nameEs)
    assert.ok((await json(await s.post(EX, { nameEs: 'Otro', nameEn: 'barbell hip thrust', type: 1, primaryMuscleGroupId: GLUTEOS }), 409)).errors.nameEn)
    assert.ok((await json(await s.post(EX, { nameEs: 'Barbell Hip Thrust', type: 1, primaryMuscleGroupId: GLUTEOS }), 409)).errors.nameEs, 'también contra el nombre en inglés')
    await createExercise(s, { nameEs: 'Plancha', nameEn: 'Plancha', type: 5, primaryMuscleGroupId: 12 }) // mismo nombre en ambos idiomas es válido

    await json(await s.post(`${EX}/${id}/status`, { active: false }), 204)
    assert.ok((await json(await s.post(EX, { nameEs: 'Hip thrust con barra', type: 1, primaryMuscleGroupId: GLUTEOS }), 409)).errors.nameEs, 'también contra desactivados')
    await json(await s.post(`${EX}/${id}/status`, { active: true }), 204)

    await json(await s.put(`${EX}/${id}`, { nameEs: 'Hip thrust con barra', nameEn: 'Barbell hip thrust', type: 1, primaryMuscleGroupId: GLUTEOS, secondaryMuscleGroupIds: [FEMORAL] }), 204)
    assert.deepEqual((await json(await s.get(`${EX}/${id}`), 200)).secondaryMuscleGroups.map((m) => m.id), [FEMORAL])
    assert.equal((await s.put(`${EX}/999999`, { nameEs: 'Nada', type: 1, primaryMuscleGroupId: 1 })).status, 404)

    const actions = sql(`SELECT action FROM audit_logs WHERE entity_type = 'Exercise' AND entity_id = '${id}' ORDER BY id`).map((r) => r.action)
    assert.deepEqual(actions, ['ExerciseCreated', 'ExerciseDeactivated', 'ExerciseActivated', 'ExerciseUpdated'])
    const muscles = await json(await s.get(`${LIB}/muscle-groups`), 200)
    assert.ok(muscles.find((m) => m.id === GLUTEOS).exerciseCount >= 1)
  })

  test('búsqueda en español o inglés sin acentos, filtros, favoritos por entrenadora, estado y paginación', async () => {
    const s = await trainer()
    const banda = (await json(await s.post(`${LIB}/equipment`, { nameEs: 'Mancuerna búsqueda', nameEn: 'Search dumbbell' }), 201)).id
    const patron = (await json(await s.post(`${LIB}/movement-patterns`, { nameEs: 'Bisagra búsqueda', nameEn: 'Search hinge' }), 201)).id
    const peso = await createExercise(s, { nameEs: 'Peso muerto rumano búsqueda', nameEn: 'Romanian deadlift search', primaryMuscleGroupId: FEMORAL, equipmentIds: [banda], movementPatternId: patron })
    const sentadilla = await createExercise(s, { nameEs: 'Sentadilla búlgara búsqueda', nameEn: 'Bulgarian split squat search', primaryMuscleGroupId: CUADRICEPS, type: 1 })
    const estira = await createExercise(s, { nameEs: 'Estiramiento 100%_búsqueda', type: 6, primaryMuscleGroupId: FEMORAL })

    assert.deepEqual((await search(s, { q: 'BULGARA busqueda' })).items.map((e) => e.id), [sentadilla])
    assert.deepEqual((await search(s, { q: 'romanian' })).items.map((e) => e.id), [peso])
    const item = (await search(s, { q: 'romanian' })).items[0]
    assert.deepEqual({ ...item, id: undefined }, {
      id: undefined, nameEs: 'Peso muerto rumano búsqueda', nameEn: 'Romanian deadlift search', type: 1, typeLabel: 'Fuerza', primaryMuscleGroup: 'Femoral',
      equipment: ['Mancuerna búsqueda'], movementPattern: 'Bisagra búsqueda', isActive: true, isFavorite: false, thumbnailMediaId: null,
    })
    // % y _ se buscan como texto, no como comodines.
    assert.deepEqual((await search(s, { q: '100%_' })).items.map((e) => e.id), [estira])
    assert.equal((await search(s, { q: '%' })).items.length, 1)
    assert.equal((await search(s, { q: '_b' })).items.length, 1)

    assert.deepEqual((await search(s, { q: 'busqueda', muscleGroupId: FEMORAL })).items.map((e) => e.id).sort(), [estira, peso].sort())
    assert.deepEqual((await search(s, { q: 'busqueda', equipmentId: banda })).items.map((e) => e.id), [peso])
    assert.deepEqual((await search(s, { q: 'busqueda', movementPatternId: patron })).items.map((e) => e.id), [peso])
    assert.deepEqual((await search(s, { q: 'busqueda', type: 6 })).items.map((e) => e.id), [estira])

    await json(await s.put(`${EX}/${sentadilla}/favorite`), 204)
    await json(await s.put(`${EX}/${sentadilla}/favorite`), 204) // repetir no falla
    assert.deepEqual((await search(s, { favorites: 'true' })).items.map((e) => e.id), [sentadilla])
    const other = await trainer(OTHER)
    assert.equal((await search(other, { favorites: 'true' })).items.length, 0, 'los favoritos son de cada entrenadora')
    await json(await s.delete(`${EX}/${sentadilla}/favorite`), 204)
    assert.equal((await search(s, { favorites: 'true' })).items.length, 0)

    await json(await s.post(`${EX}/${estira}/status`, { active: false }), 204)
    assert.equal((await search(s, { q: 'busqueda' })).total, 2)
    assert.deepEqual((await search(s, { q: 'busqueda', status: 'inactive' })).items.map((e) => e.id), [estira])
    assert.equal((await search(s, { q: 'busqueda', status: 'all' })).total, 3)
    assert.ok((await json(await s.get(`${EX}/${estira}`), 200)).deactivatedAt)

    const page = await search(s, { q: 'busqueda', status: 'all', pageSize: 2, page: 2 })
    assert.deepEqual({ total: page.total, count: page.items.length, page: page.page, pageSize: page.pageSize }, { total: 3, count: 1, page: 2, pageSize: 2 })
    assert.equal((await search(s, { pageSize: 5000 })).pageSize, 100)
  })

  test('variantes en ambos sentidos, sin repetirse ni apuntar a sí mismas', async () => {
    const s = await trainer()
    const a = await createExercise(s, { nameEs: 'Sentadilla goblet variante' })
    const b = await createExercise(s, { nameEs: 'Sentadilla sumo variante' })
    assert.ok((await json(await s.post(`${EX}/${a}/variants`, { variantExerciseId: a }), 400)).errors.variantExerciseId)
    assert.ok((await json(await s.post(`${EX}/${a}/variants`, { variantExerciseId: b, note: 'x'.repeat(501) }), 400)).errors.note)
    assert.equal((await s.post(`${EX}/${a}/variants`, { variantExerciseId: 999999 })).status, 404)
    await json(await s.post(`${EX}/${a}/variants`, { variantExerciseId: b, note: 'Más abierta' }), 204)
    assert.equal((await s.post(`${EX}/${b}/variants`, { variantExerciseId: a })).status, 409, 'el vínculo inverso ya existe')
    assert.deepEqual((await json(await s.get(`${EX}/${a}`), 200)).variants.map((v) => [v.exerciseId, v.note]), [[b, 'Más abierta']])
    assert.deepEqual((await json(await s.get(`${EX}/${b}`), 200)).variants.map((v) => v.exerciseId), [a])
    await json(await s.delete(`${EX}/${b}/variants/${a}`), 204)
    assert.equal((await json(await s.get(`${EX}/${a}`), 200)).variants.length, 0)
    assert.equal((await s.delete(`${EX}/${b}/variants/${a}`)).status, 404)
  })
})

describe('imágenes y videos (espacio privado KV)', () => {
  test('sube una imagen real, la entrega con permisos y Range; rechaza tipos falsos, tamaños excesivos y enlaces http', async () => {
    const s = await trainer()
    const id = await createExercise(s, { nameEs: 'Puente de glúteo medios' })
    const fake = await json(await upload(s, id, Buffer.from('<script>alert(1)</script>'), 'foto.png'), 400)
    assert.match(fake.errors.file[0], /Formato no permitido/)
    assert.match((await json(await upload(s, id, Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]), 'grande.png'), 400)).errors.file[0], /5 MB para imágenes/)
    assert.equal((await upload(s, 999999, PNG, 'foto.png')).status, 404)

    const { id: mediaId } = await json(await upload(s, id, PNG, '../../etc/Foto <final>.exe', 'Posición inicial'), 201)
    const media = (await json(await s.get(`${EX}/${id}`), 200)).media[0]
    assert.deepEqual(media, {
      id: mediaId, mediaType: 'Image', title: 'Posición inicial', externalUrl: null, contentUrl: `${LIB}/media/${mediaId}/content`, fileName: 'Foto final.png', sizeBytes: PNG.length,
    })
    assert.equal((await search(s, { q: 'puente de gluteo medios' })).items[0].thumbnailMediaId, mediaId)
    const key = sql(`SELECT f.storage_key FROM exercise_media m JOIN stored_files f ON f.id = m.stored_file_id WHERE m.id = ${mediaId}`)[0].storage_key
    assert.match(key, /^exercises\/[0-9a-f]{32}\.png$/, 'nombre aleatorio, sin el nombre original')

    const res = await s.get(media.contentUrl)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'image/png')
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(res.headers.get('content-disposition'), 'inline')
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG)
    const part = await s.get(media.contentUrl, { headers: { Range: 'bytes=0-7' } })
    assert.equal(part.status, 206)
    assert.equal(part.headers.get('content-range'), `bytes 0-7/${PNG.length}`)
    assert.deepEqual(Buffer.from(await part.arrayBuffer()), PNG.subarray(0, 8))
    const tail = await s.get(media.contentUrl, { headers: { Range: 'bytes=-4' } })
    assert.equal(tail.status, 206)
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), PNG.subarray(PNG.length - 4))
    // Otra entrenadora del mismo estudio sí puede ver la biblioteca (es un catálogo central).
    assert.equal((await (await trainer(OTHER)).get(media.contentUrl)).status, 200)

    const { id: videoId } = await json(await upload(s, id, mp4(2048), 'video.mov'), 201)
    const video = (await json(await s.get(`${EX}/${id}`), 200)).media.find((m) => m.id === videoId)
    assert.equal(video.mediaType, 'Video')
    assert.equal(video.fileName, 'video.mp4')
    assert.equal((await s.get(video.contentUrl)).headers.get('content-type'), 'video/mp4')

    assert.ok((await json(await s.post(`${EX}/${id}/media/link`, { mediaType: 2, url: 'http://youtube.com/watch?v=1' }), 400)).errors.url)
    assert.ok((await json(await s.post(`${EX}/${id}/media/link`, { mediaType: 2, url: 'javascript:alert(1)' }), 400)).errors.url)
    assert.ok((await json(await s.post(`${EX}/${id}/media/link`, { mediaType: 3, url: 'https://youtu.be/x' }), 400)).errors.mediaType)
    const { id: linkId } = await json(await s.post(`${EX}/${id}/media/link`, { mediaType: 2, url: 'https://youtu.be/abc', title: 'Demostración' }), 201)
    const link = (await json(await s.get(`${EX}/${id}`), 200)).media.find((m) => m.id === linkId)
    assert.deepEqual([link.externalUrl, link.contentUrl], ['https://youtu.be/abc', null])

    await json(await s.delete(`${EX}/${id}/media/${mediaId}`), 204)
    assert.equal((await s.get(media.contentUrl)).status, 404)
    assert.ok(sql(`SELECT deleted_at FROM stored_files WHERE storage_key = '${key}'`)[0].deleted_at, 'el registro queda como historial')
    assert.equal((await s.delete(`${EX}/${id}/media/${mediaId}`)).status, 404)
    assert.equal((await new Session().get(video.contentUrl)).status, 401)
    const actions = sql(`SELECT action FROM audit_logs WHERE entity_type = 'Exercise' AND entity_id = '${id}' AND action LIKE 'ExerciseMedia%' ORDER BY id`).map((r) => r.action)
    assert.deepEqual(actions, ['ExerciseMediaUploaded', 'ExerciseMediaUploaded', 'ExerciseMediaLinked', 'ExerciseMediaDeleted'])
  })

  test('un video de varias partes (más de 4 MB) se entrega completo y por trozos; el máximo es 25 MB', async () => {
    const s = await trainer()
    const id = await createExercise(s, { nameEs: 'Peso muerto rumano video largo' })
    assert.match((await json(await upload(s, id, mp4(25 * 1024 * 1024 + 1), 'enorme.mp4'), 400)).errors.file[0], /25 MB para videos/)
    const bytes = mp4(9 * 1024 * 1024 + 123) // tres partes de 4 MB
    for (let i = 16; i < bytes.length; i++) bytes[i] = (i * 31 + (i >> 12)) & 0xff
    const { id: videoId } = await json(await upload(s, id, bytes, 'largo.mp4'), 201)
    const url = `${LIB}/media/${videoId}/content`
    const full = await s.get(url)
    assert.equal(full.status, 200)
    assert.equal(full.headers.get('content-length'), String(bytes.length))
    assert.ok(Buffer.from(await full.arrayBuffer()).equals(bytes), 'idéntico byte por byte')
    const M = 4 * 1024 * 1024
    const cases = [
      [`bytes=${M - 10}-${M + 9}`, M - 10, M + 9], // cruza el límite entre la parte 1 y la 2
      [`bytes=${2 * M + 5}-`, 2 * M + 5, bytes.length - 1], // desde un punto hasta el final (adelantar un video)
      ['bytes=-100', bytes.length - 100, bytes.length - 1],
      [`bytes=0-${bytes.length + 500}`, 0, bytes.length - 1], // más allá del final: se recorta
    ]
    for (const [range, from, to] of cases) {
      const res = await s.get(url, { headers: { Range: range } })
      assert.equal(res.status, 206, range)
      assert.equal(res.headers.get('content-range'), `bytes ${from}-${to}/${bytes.length}`, range)
      assert.equal(res.headers.get('content-length'), String(to - from + 1), range)
      assert.ok(Buffer.from(await res.arrayBuffer()).equals(bytes.subarray(from, to + 1)), range)
    }
    const beyond = await s.get(url, { headers: { Range: `bytes=${bytes.length + 10}-` } })
    assert.equal(beyond.status, 416)
    assert.equal(beyond.headers.get('content-range'), `bytes */${bytes.length}`)
    await json(await s.delete(`${EX}/${id}/media/${videoId}`), 204)
    assert.equal((await s.get(url)).status, 404)
  })
})

describe('Excel: plantilla, exportación e importación', () => {
  test('la plantilla trae las tres hojas, los catálogos y las listas desplegables', async () => {
    const s = await trainer()
    const res = await s.get(`${EX}/import/template`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-disposition'), /plantilla-ejercicios-lbmethod\.xlsx/)
    const files = unzipSync(new Uint8Array(await res.arrayBuffer()))
    const workbook = strFromU8(files['xl/workbook.xml'])
    assert.deepEqual([...workbook.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]), ['Ejercicios', 'Catálogos', 'Instrucciones'])
    const sheet1 = strFromU8(files['xl/worksheets/sheet1.xml'])
    for (const h of HEADER) assert.ok(sheet1.includes(`<t>${h}</t>`) || sheet1.includes(`>${h}<`), h)
    assert.match(sheet1, /<dataValidation [^>]*sqref="D2:D2001"/)
    assert.ok(strFromU8(files['xl/worksheets/sheet2.xml']).includes('Glúteos'))
  })

  test('vista previa y guardado: válidas, duplicadas (en la biblioteca y en el archivo) y con errores; nada se crea implícitamente', async () => {
    const s = await trainer()
    await createExercise(s, { nameEs: 'Ya existente importación' })
    const rows = [
      HEADER,
      ['Zancada importada', 'Imported lunge', 'Paso largo', 'cuadriceps', 'Glúteos; Femoral', '', 'fuerza', '', 'Principiante', '', '', ''],
      ['Abducción importada', '', '', 'Abductores', '', '', 'Mobility', '', '', '', '', ''],
      ['ya existente IMPORTACION', '', '', 'Glúteos', '', '', 'Fuerza', '', '', '', '', ''],
      ['Zancada importada', '', '', 'Glúteos', '', '', 'Fuerza', '', '', '', '', ''],
      ['Sin músculo válido', '', '', 'Trapecio', '', 'Kettlebell inventada', 'Fuerza', '', 'Experto', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', '', ''],
      ['=HYPERLINK("http://x")', '', '', 'Glúteos', 'Glúteos', '', 'Volar', '', '', '', '', ''],
    ]
    const file = xlsx(rows)
    const preview = await json(await sendFile(s, `${EX}/import/preview`, file, 'ejercicios.xlsx'), 200)
    assert.deepEqual({ valid: preview.valid, duplicates: preview.duplicates, errors: preview.errors }, { valid: 2, duplicates: 2, errors: 2 })
    assert.deepEqual(preview.rows.map((r) => [r.rowNumber, r.status]), [[2, 1], [3, 1], [4, 2], [5, 2], [6, 3], [8, 3]])
    assert.match(preview.rows[3].messages[0], /fila 2/)
    assert.deepEqual(preview.rows[4].messages, [
      'Grupo principal "Trapecio" no existe en el catálogo. Agrégalo primero o corrige el nombre.',
      'Equipamiento "Kettlebell inventada" no existe en el catálogo. Agrégalo primero o corrige el nombre.',
      'Dificultad "Experto" no reconocida. Usa uno de la hoja Catálogos.',
    ])
    assert.equal((await search(s, { q: 'zancada importada' })).total, 0, 'la vista previa no guarda nada')

    const commit = await json(await sendFile(s, `${EX}/import/commit`, file, 'ejercicios.xlsx'), 200)
    assert.equal(commit.created, 2)
    assert.deepEqual(commit.rejected.map((r) => r.rowNumber), [4, 5, 6, 8])
    const zancada = (await search(s, { q: 'zancada importada' })).items[0]
    const detail = await json(await s.get(`${EX}/${zancada.id}`), 200)
    assert.deepEqual([detail.nameEn, detail.description, detail.primaryMuscleGroup.nameEs, detail.secondaryMuscleGroups.map((m) => m.nameEs), detail.difficultyLabel],
      ['Imported lunge', 'Paso largo', 'Cuádriceps', ['Glúteos', 'Femoral'], 'Principiante'])
    assert.equal((await search(s, { q: 'abduccion importada' })).items[0].typeLabel, 'Movilidad')
    assert.equal(sql("SELECT COUNT(*) AS n FROM muscle_groups WHERE name_es = 'Trapecio'")[0].n, 0)
    assert.equal(sql(`SELECT details FROM audit_logs WHERE entity_type = 'Exercise' AND entity_id = '${zancada.id}'`)[0].details, 'Importado desde Excel')
    // Volver a importar el mismo archivo no duplica nada.
    assert.equal((await json(await sendFile(s, `${EX}/import/commit`, file, 'ejercicios.xlsx'), 200)).created, 0)
  })

  test('archivos no válidos se rechazan con un mensaje claro', async () => {
    const s = await trainer()
    assert.match((await json(await sendFile(s, `${EX}/import/preview`, xlsx([HEADER]), 'datos.csv'), 400)).errors.file[0], /\.xlsx/)
    assert.match((await json(await sendFile(s, `${EX}/import/preview`, Buffer.from('no soy un excel'), 'datos.xlsx'), 400)).errors.file[0], /no es un Excel válido/)
    assert.match((await json(await sendFile(s, `${EX}/import/preview`, xlsx([['NombreES', 'Tipo']]), 'datos.xlsx'), 400)).errors.file[0], /Faltan columnas obligatorias: GrupoPrincipal/)
    assert.match((await json(await sendFile(s, `${EX}/import/preview`, xlsx([HEADER]), 'datos.xlsx'), 400)).errors.file[0], /no tiene ejercicios/)
    assert.ok((await json(await s.post(`${EX}/import/preview`, new FormData()), 400)).errors.file)
  })

  test('la exportación escribe todo como texto (una fórmula no se ejecuta) e incluye la columna Activo', async () => {
    const s = await trainer()
    const id = await createExercise(s, { nameEs: '=1+1 exportación', description: '@SUM(A1)' })
    await json(await s.post(`${EX}/${id}/status`, { active: false }), 204)
    const res = await s.get(`${EX}/export?status=inactive`)
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-disposition'), /biblioteca-lbmethod-\d{4}-\d{2}-\d{2}\.xlsx/)
    const sheet = strFromU8(unzipSync(new Uint8Array(await res.arrayBuffer()))['xl/worksheets/sheet1.xml'])
    assert.doesNotMatch(sheet, /<f>/, 'sin fórmulas')
    assert.ok(sheet.includes('=1+1 exportación'))
    assert.ok(sheet.includes('>Activo<'))
    assert.ok(sheet.includes('>No<'))
    assert.ok(!sheet.includes('Hip thrust'), 'solo los desactivados')
  })
})

test('las rutas del navegador de la biblioteca devuelven la aplicación', async () => {
  for (const path of ['/entrenadora/biblioteca', '/entrenadora/biblioteca/nuevo']) {
    const res = await fetch(BASE + path)
    assert.equal(res.status, 200)
    assert.match(await res.text(), /<div id="root">/)
  }
})

// Lista todos los endpoints de la versión .NET (atributos [Route] y [HttpGet]/[HttpPost]/...) en test/endpoints-dotnet.json,
// para comprobar que la versión de Cloudflare los tiene todos con la misma regla de sesión y rol.
//   node scripts/endpoints-dotnet.mjs
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('../../backend/src/LBMethod.Api/Controllers/', import.meta.url).pathname
const files = []
const walk = (dir) => readdirSync(dir).forEach((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : f.endsWith('.cs') && files.push(join(dir, f))))
walk(root)
const endpoints = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // Cada [Route] de clase marca el inicio de un controlador; sus acciones llegan hasta el siguiente.
  const starts = [...src.matchAll(/\[Route\("([^"]+)"\)\]\s*public (?:partial )?class/g)]
  starts.forEach((start, i) => {
    const body = src.slice(start.index, starts[i + 1]?.index ?? src.length)
    for (const m of body.matchAll(/\[Http(Get|Post|Put|Delete)(?:\("([^"]*)"\))?\]/g)) {
      // «~/» en una acción ignora la ruta del controlador.
      const path = (m[2]?.startsWith('~/') ? m[2].slice(2) : [start[1], m[2]].filter(Boolean).join('/')).replace(/\{(\w+)(:[^}]*)?\}/g, '{$1}')
      endpoints.push(`${m[1].toUpperCase()} /${path}`)
    }
  })
}
endpoints.sort()
writeFileSync(new URL('../test/endpoints-dotnet.json', import.meta.url), JSON.stringify(endpoints, null, 2) + '\n')
console.log(`${endpoints.length} endpoints`)

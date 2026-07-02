/**
 * Servidor de emergencia para Next.js
 *
 * Intercepta rutas API problemáticas con Strapi v5
 */
/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Node script, not part of the Next.js bundle */

const http = require('http');
const url = require('url');
const next = require('next');

const STRAPI_BASE_URL = process.env.NEXT_PUBLIC_STRAPI_URL || process.env.STRAPI_BASE_URL || 'http://localhost:1337';
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || '';
const STRAPI_INTERNAL_URL = 'http://127.0.0.1:1337';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev, dir: __dirname, conf: { distDir: '.next-prod-deploy' } });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

// Función para hacer fetch
function nativeFetch(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const client = parsedUrl.protocol === 'https:' ? require('https') : require('http');
    
    const requestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = client.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          json: () => Promise.resolve(JSON.parse(data)),
          text: () => Promise.resolve(data),
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

// Función para construir query
function buildQuery(params) {
  return Object.entries(params)
    .map(([key, val]) => {
      if (typeof val === 'object') {
        return Object.entries(val)
          .map(([k, v]) => `${encodeURIComponent(key)}[${encodeURIComponent(k)}]=${encodeURIComponent(JSON.stringify(v))}`)
          .join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(val)}`;
    })
    .join('&');
}

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const { pathname } = parsedUrl;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // ===== Helper: JWT y validación de rol =====
    function getJwtFromRequest(req) {
      const cookies = req.headers.cookie || '';
      const jwtMatch = cookies.match(/jwt=([^;]+)/);
      return jwtMatch ? decodeURIComponent(jwtMatch[1]) : null;
    }

    const roleCache = new Map();
    async function getUserRole(jwt) {
      const now = Date.now();
      const cached = roleCache.get(jwt);
      if (cached && cached.expiresAt > now) return cached.role;
      try {
        const userRes = await nativeFetch(`${STRAPI_INTERNAL_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${jwt}` }
        });
        if (!userRes.ok) return null;
        const userData = await userRes.json();
        const email = userData?.email;
        if (!email) return null;
        const profileRes = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/user-profiles?filters[email][$eq]=${encodeURIComponent(email)}&fields[0]=role`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );
        if (!profileRes.ok) return null;
        const profileData = await profileRes.json();
        const role = profileData.data?.[0]?.role || null;
        roleCache.set(jwt, { role, expiresAt: now + 60000 });
        return role;
      } catch {
        return null;
      }
    }

    async function requireAdmin(req, res) {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No autenticado' }));
        return false;
      }
      const role = await getUserRole(jwt);
      if (!role || (role !== 'admin' && role !== 'super-admin')) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Acceso restringido: Se requieren permisos de administrador' }));
        return false;
      }
      return true;
    }

    // ===== BLOQUEO EARLY: Rutas de Flota protegidas =====
    const isFleetProtectedRoute = pathname.match(/^\/api\/fleet\/.+/) ||
      (pathname.match(/^\/api\/vehicle-[^\/]+/) && !pathname.startsWith('/api/vehicle-selector'));
    if (isFleetProtectedRoute) {
      if (!(await requireAdmin(req, res))) return;
    }

    // Interceptar GET /api/fleet/[id]/reminder
    const reminderMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/reminder$/);
    if (reminderMatch && req.method === 'GET') {
      try {
        const id = reminderMatch[1];
        console.log(`[Emergency] GET /api/fleet/${id}/reminder`);

        // Obtener vehículo usando endpoint directo Strapi v5
        const vehicleResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}?fields=id`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );

        if (!vehicleResponse.ok) {
          if (vehicleResponse.status === 404) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Vehículo no encontrado' }));
            return;
          }
          throw new Error(`Strapi error: ${vehicleResponse.status}`);
        }

        const vehicleData = await vehicleResponse.json();
        const vehicleId = vehicleData.data?.id;

        if (!vehicleId) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No se pudo obtener el ID del vehículo' }));
          return;
        }

        // Obtener recordatorios
        const query = buildQuery({
          filters: JSON.stringify({ type: { $eq: 'reminder' }, fleetVehicle: { id: { $eq: vehicleId } } }),
          populate: JSON.stringify({
            assignedUsers: { fields: ['id', 'documentId', 'displayName', 'email'] },
            author: { fields: ['id', 'documentId', 'displayName', 'email'] },
            fleetVehicle: { fields: ['id', 'documentId', 'name'] },
          }),
          sort: 'nextTrigger:asc',
        });

        const remindersResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/notifications?${query}`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );

        if (!remindersResponse.ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [] }));
          return;
        }

        const remindersData = await remindersResponse.json();
        const reminders = (remindersData.data || []).map(r => {
          if (r.fleetVehicle) r.vehicle = r.fleetVehicle;
          return r;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: reminders }));
        return;
      } catch (error) {
        console.error('[Emergency] Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar GET /api/fleet/[id]/status
    const statusMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/status$/);
    if (statusMatch && req.method === 'GET') {
      try {
        const id = statusMatch[1];
        console.log(`[Emergency] GET /api/fleet/${id}/status`);

        // Obtener vehículo usando endpoint directo Strapi v5
        const vehicleResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}?fields=id`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );

        if (!vehicleResponse.ok) {
          if (vehicleResponse.status === 404) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Vehículo no encontrado' }));
            return;
          }
          throw new Error(`Strapi error: ${vehicleResponse.status}`);
        }

        const vehicleData = await vehicleResponse.json();
        const vehicleId = vehicleData.data?.id;

        if (!vehicleId) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No se pudo obtener el ID del vehículo' }));
          return;
        }

        // Obtener estados
        const query = buildQuery({
          filters: JSON.stringify({ fleetVehicle: { id: { $eq: vehicleId } } }),
          populate: JSON.stringify({
            createdByUser: { fields: ['id', 'documentId', 'displayName', 'email'] },
            fleetVehicle: { fields: ['id', 'documentId', 'name'] },
          }),
          sort: 'createdAt:desc',
        });

        const statusesResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleet-statuses?${query}`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );

        if (!statusesResponse.ok) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ data: [] }));
          return;
        }

        const statusesData = await statusesResponse.json();
        const statuses = (statusesData.data || []).map(s => {
          if (s.fleetVehicle) s.vehicle = s.fleetVehicle;
          return s;
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: statuses }));
        return;
      } catch (error) {
        console.error('[Emergency] Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar POST /api/fleet/[id]/mileage
    const mileageMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/mileage$/);
    if (mileageMatch && req.method === 'POST') {
      try {
        const id = mileageMatch[1];
        console.log(`[Emergency] POST /api/fleet/${id}/mileage`);
        let bodyRaw = '';
        for await (const chunk of req) bodyRaw += chunk;
        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}/set-mileage-record`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: bodyRaw,
          }
        );
        const text = await strapiResponse.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          json = null;
        }
        // Traducir respuesta para frontend viejo que espera currentMileage
        if (json && json.data && json.data.currentMileage === undefined && json.data.newMileage !== undefined) {
          json.data.currentMileage = json.data.newMileage;
        }
        res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
        res.end(json ? JSON.stringify(json) : text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en mileage:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar POST /api/fleet/[id]/oil-change
    const oilChangeMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/oil-change$/);
    if (oilChangeMatch && req.method === 'POST') {
      try {
        const id = oilChangeMatch[1];
        console.log(`[Emergency] POST /api/fleet/${id}/oil-change`);
        let bodyRaw = '';
        for await (const chunk of req) bodyRaw += chunk;
        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}/record-oil-change`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: bodyRaw,
          }
        );
        res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
        const text = await strapiResponse.text();
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en oil-change:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar POST /api/fleet/[id]/reset-oil-change (legacy redirect con traducción de respuesta)
    const resetOilChangeMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/reset-oil-change$/);
    if (resetOilChangeMatch && req.method === 'POST') {
      try {
        const id = resetOilChangeMatch[1];
        console.log(`[Emergency] POST /api/fleet/${id}/reset-oil-change -> redirect to record-oil-change`);
        let bodyRaw = '';
        for await (const chunk of req) bodyRaw += chunk;
        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}/record-oil-change`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: bodyRaw,
          }
        );

        if (!strapiResponse.ok) {
          res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
          const text = await strapiResponse.text();
          res.end(text);
          return;
        }

        const json = await strapiResponse.json();
        // Traducir respuesta para frontend viejo que espera newMileage
        if (json.data && json.data.newMileage === undefined) {
          json.data.newMileage = json.data.currentMileage !== undefined ? json.data.currentMileage : 0;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
        return;
      } catch (error) {
        console.error('[Emergency] Error en reset-oil-change redirect:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

        // Interceptar PUT /api/fleet/[id]/update-fields (legacy redirect)
    const updateFieldsMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/update-fields$/);
    if (updateFieldsMatch && req.method === 'PUT') {
      try {
        const id = updateFieldsMatch[1];
        console.log(`[Emergency] PUT /api/fleet/${id}/update-fields -> redirect to mileage`);
        let bodyRaw = '';
        for await (const chunk of req) bodyRaw += chunk;
        const body = JSON.parse(bodyRaw || '{}');
        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}/set-mileage-record`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify({ newMileage: body.currentMileage, notes: body.notes }),
          }
        );
        res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
        const text = await strapiResponse.text();
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en update-fields redirect:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar POST /api/fleet/[id]/document (legacy - fix Strapi v5 relation format)
    const documentMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/documents?$/);
    if (documentMatch && req.method === 'POST') {
      try {
        const id = documentMatch[1];
        console.log(`[Emergency] POST /api/fleet/${id}/document -> proxy to Strapi v5 fleet-documents`);
        let bodyRaw = '';
        for await (const chunk of req) bodyRaw += chunk;
        const body = JSON.parse(bodyRaw || '{}');

        if (!body.data) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Los datos del documento son requeridos.' }));
          return;
        }

        // Obtener vehicleId numérico desde Strapi
        const vehicleQuery = `filters%5BdocumentId%5D%5B%24eq%5D=${encodeURIComponent(id)}&fields%5B0%5D=id`;
        const vehicleResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets?${vehicleQuery}`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );
        if (!vehicleResponse.ok) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No se pudo obtener el vehículo' }));
          return;
        }
        const vehicleData = await vehicleResponse.json();
        const vehicleId = vehicleData.data?.[0]?.id;
        if (!vehicleId) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Vehículo no encontrado.' }));
          return;
        }

        // Construir payload para Strapi v5 con relaciones en formato connect
        const payload = {
          data: {
            files: body.data.files || [],
            authorDocumentId: body.data.authorDocumentId,
            vehicle: { set: [{ id: vehicleId }] },
            documentType: { set: [{ id: body.data.documentType }] },
          }
        };
        if (body.data.otherDescription) {
          payload.data.otherDescription = body.data.otherDescription;
        }

        const createResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleet-documents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
            body: JSON.stringify(payload),
          }
        );

        const text = await createResponse.text();
        let json;
        try { json = JSON.parse(text); } catch { json = null; }

        if (!createResponse.ok) {
          res.writeHead(createResponse.status, { 'Content-Type': 'application/json' });
          res.end(text);
          return;
        }

        // Normalizar archivos en respuesta
        if (json && json.data && json.data.files) {
          const normalizeFiles = (filesData) => {
            if (!filesData) return [];
            if (Array.isArray(filesData)) {
              return filesData.map((file) => {
                let f = file.data?.attributes || file.attributes || file;
                return {
                  id: file.id || f.id,
                  url: f.url ? (f.url.startsWith('http') ? f.url : STRAPI_BASE_URL + f.url) : undefined,
                  name: f.name,
                  mime: f.mime,
                  size: f.size,
                  alternativeText: f.alternativeText,
                };
              });
            }
            if (filesData.data && Array.isArray(filesData.data)) return normalizeFiles(filesData.data);
            return [];
          };
          json.data.files = normalizeFiles(json.data.files);
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(json));
        return;
      } catch (error) {
        console.error('[Emergency] Error en document proxy:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar POST /api/fleet/[id]/check-mileage-reminders
    const checkMileageRemindersMatch = pathname.match(/^\/api\/fleet\/([^\/]+)\/check-mileage-reminders$/);
    if (checkMileageRemindersMatch && req.method === 'POST') {
      try {
        const id = checkMileageRemindersMatch[1];
        console.log(`[Emergency] POST /api/fleet/${id}/check-mileage-reminders`);

        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${id}/check-mileage-reminders`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            },
          }
        );

        res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
        const text = await strapiResponse.text();
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en check-mileage-reminders:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // ===== SOLUCIÓN TEMPORAL: Proxy directo a Strapi v5 para rutas de fleet con campos faltantes =====
    
    function formatCurrency(price) {
      return new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(price);
    }

    function normalizeVehicle(entry, useSmallImage = false) {
      if (!entry) return null;
      const attrs = entry.attributes || entry;
      const parsedPrice = Number(attrs.price ?? 0) || 0;
      
      const image = attrs.image;
      let imageUrl;
      let imageData;
      if (image) {
        const img = image.data?.attributes || image;
        // Fallback defensivo: si el thumbnail small no existe, usar original
        const formatUrl = useSmallImage && img.formats?.small?.url
          ? img.formats.small.url
          : (img.formats?.thumbnail?.url || img.url);
        imageUrl = formatUrl ? STRAPI_BASE_URL + formatUrl : undefined;
        imageData = img.url ? { url: img.url, alternativeText: img.alternativeText, formats: img.formats } : undefined;
      }
      const imageAlt = image?.data?.attributes?.alternativeText || image?.alternativeText || attrs.imageAlt || attrs.name;

      const getAvatar = (item) => {
        if (!item) return undefined;
        const avatar = item.avatar?.data?.attributes || item.avatar;
        return avatar?.url ? { url: avatar.url, alternativeText: avatar.alternativeText } : undefined;
      };

      const mapRelation = (rel) => {
        const arr = rel?.data || rel;
        if (!Array.isArray(arr)) return [];
        return arr.map(item => {
          const it = item.attributes || item;
          return { id: item.id || it.id, documentId: item.documentId || it.documentId, displayName: it.displayName, email: it.email, avatar: getAvatar(it) };
        });
      };

      const mapInterestedPersons = (rel) => {
        const arr = rel?.data || rel;
        if (!Array.isArray(arr)) return [];
        return arr.map(item => {
          const it = item.attributes || item;
          return { id: item.id || it.id, documentId: item.documentId || it.documentId, fullName: it.fullName, email: it.email, avatar: getAvatar(it) };
        });
      };

      const financingRaw = attrs.financing;
      const financingData = financingRaw?.data || financingRaw;
      const financing = financingData ? {
        id: financingData.id,
        documentId: financingData.documentId || financingData.attributes?.documentId,
        status: financingData.status || financingData.attributes?.status,
      } : undefined;

      return {
        id: String(attrs.id),
        documentId: String(attrs.documentId || attrs.id),
        name: attrs.name,
        vin: attrs.vin,
        condition: attrs.condition,
        brand: attrs.brand,
        model: attrs.model,
        year: attrs.year,
        priceNumber: parsedPrice,
        priceLabel: formatCurrency(parsedPrice),
        imageUrl,
        imageAlt,
        imageData,
        color: attrs.color,
        currentMileage: attrs.currentMileage ?? undefined,
        lastOilChangeMileage: attrs.lastOilChangeMileage ?? undefined,
        oilChangeNotificationSent: attrs.oilChangeNotificationSent ?? undefined,
        fuelType: attrs.fuelType,
        transmission: attrs.transmission,
        nextMaintenanceDate: attrs.nextMaintenanceDate,
        placa: attrs.placa,
        billingInitials: attrs.billingInitials,
        assignedDrivers: mapRelation(attrs.assignedDrivers),
        responsables: mapRelation(attrs.responsables),
        interestedDrivers: mapRelation(attrs.interestedDrivers),
        currentDrivers: mapRelation(attrs.currentDrivers),
        interestedPersons: mapInterestedPersons(attrs.interestedPersons),
        financing,
      };
    }

    const populateQuery = 'populate[image]=true&populate[responsables][populate][avatar]=true&populate[assignedDrivers][populate][avatar]=true&populate[interestedDrivers][populate][avatar]=true&populate[currentDrivers][populate][avatar]=true&populate[interestedPersons][populate][avatar]=true&populate[financing]=true';

    // Interceptar GET /api/fleet/[id]
    const fleetDetailMatch = pathname.match(/^\/api\/fleet\/([^\/]+)$/);
    if (fleetDetailMatch && req.method === 'GET') {
      try {
        const id = fleetDetailMatch[1];
        console.log(`[Emergency] GET /api/fleet/${id}`);

        let documentId = id;
        const numericId = parseInt(id, 10);
        if (!isNaN(numericId)) {
          const lookupResponse = await nativeFetch(
            `${STRAPI_INTERNAL_URL}/api/fleets?filters[id][$eq]=${numericId}&fields[0]=documentId&pagination[limit]=1`,
            { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
          );
          if (!lookupResponse.ok) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Error buscando vehículo por ID numérico' }));
            return;
          }
          const lookupData = await lookupResponse.json();
          if (!lookupData.data || lookupData.data.length === 0) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Vehículo no encontrado' }));
            return;
          }
          documentId = lookupData.data[0].documentId;
        }

        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets/${documentId}?${populateQuery}`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );

        if (!strapiResponse.ok) {
          res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Strapi error: ${strapiResponse.status}` }));
          return;
        }

        const strapiData = await strapiResponse.json();
        const normalized = normalizeVehicle(strapiData.data);

        if (!normalized) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Vehículo no encontrado' }));
          return;
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: normalized }));
        return;
      } catch (error) {
        console.error('[Emergency] Error en GET /api/fleet/[id]:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Interceptar GET /api/fleet
    if (pathname === '/api/fleet' && req.method === 'GET') {
      try {
        console.log('[Emergency] GET /api/fleet');

        const strapiResponse = await nativeFetch(
          `${STRAPI_INTERNAL_URL}/api/fleets?${populateQuery}&pagination[pageSize]=100`,
          { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
        );

        if (!strapiResponse.ok) {
          res.writeHead(strapiResponse.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Strapi error: ${strapiResponse.status}` }));
          return;
        }

        const strapiData = await strapiResponse.json();
        const items = Array.isArray(strapiData.data) ? strapiData.data : [];
        const normalized = items.map(item => normalizeVehicle(item, true)).filter(Boolean);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ data: normalized }));
        return;
      } catch (error) {
        console.error('[Emergency] Error en GET /api/fleet:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // ===== PROXY DE SERVICE-ORDERS (hotfix JWT para build antiguo) =====
    const serviceOrdersMatch = pathname.match(/^\/api\/service-orders(?:\/([^\/]+))?$/);
    if (serviceOrdersMatch) {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const id = serviceOrdersMatch[1];
      try {
        const strapiPath = id
          ? `${STRAPI_INTERNAL_URL}/api/service-orders/${id}${parsedUrl.search || ''}`
          : `${STRAPI_INTERNAL_URL}/api/service-orders${parsedUrl.search || ''}`;

        const headers = {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        };

        let bodyRaw = '';
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          for await (const chunk of req) bodyRaw += chunk;
        }

        // Limpiar fechas vacías para Strapi v5 (el proxy salta la API Route de Next.js)
        let bodyToSend = bodyRaw;
        if (bodyRaw) {
          try {
            const parsed = JSON.parse(bodyRaw);
            if (parsed?.data) {
              const dateFields = ['dateOfBirth', 'hireDate'];
              let modified = false;
              for (const field of dateFields) {
                if (parsed.data[field] === '' || parsed.data[field] === undefined) {
                  parsed.data[field] = null;
                  modified = true;
                }
              }
              if (modified) {
                bodyToSend = JSON.stringify(parsed);
              }
            }
          } catch (e) {
            // Si no es JSON válido, enviar el body tal cual
          }
        }

        const strapiRes = await nativeFetch(strapiPath, {
          method: req.method === 'PATCH' ? 'PUT' : req.method,
          headers,
          ...(bodyToSend ? { body: bodyToSend } : {}),
        });

        const text = await strapiRes.text();
        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy /api/service-orders:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    // ===== FIN PROXY DE SERVICE-ORDERS =====

    // ===== PROXY DE SERVICE-ORDERS-V2 (hotfix JWT para build antiguo) =====
    const serviceOrdersV2Match = pathname.match(/^\/api\/service-orders-v2(?:\/([^\/]+))?$/);
    if (serviceOrdersV2Match) {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const id = serviceOrdersV2Match[1];
      try {
        let strapiPath;
        if (id && req.method === 'GET') {
          // Detalle: agregar populate para serviceOrderInventoryItems con inventoryItem
          const detailPopulate = 'populate[vehicle][fields][0]=id&populate[vehicle][fields][1]=documentId&populate[vehicle][fields][2]=name&populate[vehicle][fields][3]=placa&populate[vehicle][fields][4]=brand&populate[vehicle][fields][5]=model&populate[services][fields][0]=id&populate[services][fields][1]=documentId&populate[services][fields][2]=name&populate[services][fields][3]=price&populate[driver][fields][0]=id&populate[driver][fields][1]=documentId&populate[driver][fields][2]=displayName&populate[appointment][fields][0]=id&populate[appointment][fields][1]=documentId&populate[appointment][fields][2]=status&populate[appointment][fields][3]=scheduledAt&populate[notes][fields][0]=id&populate[notes][fields][1]=content&populate[notes][fields][2]=createdAt&populate[serviceOrderInventoryItems][populate][inventoryItem][fields][0]=id&populate[serviceOrderInventoryItems][populate][inventoryItem][fields][1]=documentId&populate[serviceOrderInventoryItems][populate][inventoryItem][fields][2]=code&populate[serviceOrderInventoryItems][populate][inventoryItem][fields][3]=description&populate[serviceOrderInventoryItems][populate][inventoryItem][fields][4]=stock';
          strapiPath = `${STRAPI_INTERNAL_URL}/api/service-orders/${id}?${detailPopulate}`;
        } else {
          strapiPath = id
            ? `${STRAPI_INTERNAL_URL}/api/service-orders/${id}${parsedUrl.search || ''}`
            : `${STRAPI_INTERNAL_URL}/api/service-orders${parsedUrl.search || ''}`;
        }

        const headers = {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        };

        let bodyRaw = '';
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          for await (const chunk of req) bodyRaw += chunk;
        }

        const strapiRes = await nativeFetch(strapiPath, {
          method: req.method,
          headers,
          ...(bodyRaw ? { body: bodyRaw } : {}),
        });

        let text = await strapiRes.text();

        // Mapear serviceOrderInventoryItems -> usedItems para detalle
        if (id && req.method === 'GET' && strapiRes.status === 200) {
          try {
            const json = JSON.parse(text);
            if (json.data && json.data.serviceOrderInventoryItems) {
              const items = json.data.serviceOrderInventoryItems;
              json.data.usedItems = items.map((item) => ({
                id: item.id,
                quantity: parseFloat(item.quantity),
                unitPriceAtMoment: parseFloat(item.unitPriceAtMoment),
                totalLine: parseFloat(item.totalLine),
                inventoryItem: item.inventoryItem || null,
                inventoryItemId: item.inventoryItem?.id ?? null,
              }));
              // Recalcular totales si faltan
              if ((json.data.partsCost === undefined || json.data.partsCost === null) && json.data.usedItems.length > 0) {
                const partsCost = json.data.usedItems.reduce((sum, item) => sum + item.quantity * item.unitPriceAtMoment, 0);
                const laborCost = parseFloat(json.data.laborCost || 0);
                const servicesCost = (json.data.services || []).reduce((sum, s) => sum + parseFloat(s?.price || 0), 0);
                const subtotal = laborCost + partsCost + servicesCost;
                json.data.partsCost = Number(partsCost.toFixed(2));
                json.data.taxAmount = 0;
                json.data.totalCost = Number(subtotal.toFixed(2));
              }
              text = JSON.stringify(json);
            }
          } catch (e) {
            // Si falla el parseo, devolver el texto original
          }
        }

        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy /api/service-orders-v2:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    // ===== FIN PROXY DE SERVICE-ORDERS-V2 =====

    // ===== PROXY DE USER-PROFILES (hotfix JWT para build antiguo) =====
    const userProfilesMatch = pathname.match(/^\/api\/user-profiles(?:\/([^\/]+))?$/);
    if (userProfilesMatch) {
      const id = userProfilesMatch[1];
      // No interceptar endpoints propios de Next.js
      if (id && ['batch-delete', 'batch-import'].includes(id)) {
        // Dejar que Next.js maneje estas rutas
      } else if (id && req.method === 'GET') {
        // Dejar que el build de Next.js maneje GET /api/user-profiles/:id
        // El build v51+ enriquece la respuesta con userAccount vía llamada a /account
        console.log(`[Emergency] Delegando GET /api/user-profiles/${id} al build de Next.js (enriquecimiento userAccount)`);
      } else {
        const jwt = getJwtFromRequest(req);
        if (!jwt) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }
      try {
        // Limpiar populate de userAccount del query string (causa 400 en Strapi v5)
        let cleanSearch = parsedUrl.search || '';
        if (cleanSearch) {
          const params = new URLSearchParams(cleanSearch);
          for (const key of Array.from(params.keys())) {
            if (key.startsWith('populate[userAccount]')) {
              params.delete(key);
            }
          }
          const newSearch = params.toString();
          cleanSearch = newSearch ? '?' + newSearch : '';
        }

        const strapiPath = id
          ? `${STRAPI_INTERNAL_URL}/api/user-profiles/${id}${cleanSearch}`
          : `${STRAPI_INTERNAL_URL}/api/user-profiles${cleanSearch}`;

        const headers = {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        };

        let bodyRaw = '';
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          for await (const chunk of req) bodyRaw += chunk;
        }

        const strapiRes = await nativeFetch(strapiPath, {
          method: req.method === 'PATCH' ? 'PUT' : req.method,
          headers,
          ...(bodyRaw ? { body: bodyRaw } : {}),
        });

        const text = await strapiRes.text();
        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy /api/user-profiles:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    }
    // ===== FIN PROXY DE USER-PROFILES =====

    // ===== PROXY DE USER-PROFILES CONVERT (hotfix propagar status code) =====
    const userProfilesConvertMatch = pathname.match(/^\/api\/user-profiles\/([^\/]+)\/convert$/);
    if (userProfilesConvertMatch) {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const documentId = userProfilesConvertMatch[1];
      try {
        const strapiPath = `${STRAPI_INTERNAL_URL}/api/user-profiles/${documentId}/convert`;
        const headers = {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        };

        let bodyRaw = '';
        for await (const chunk of req) bodyRaw += chunk;

        const strapiRes = await nativeFetch(strapiPath, {
          method: req.method,
          headers,
          ...(bodyRaw ? { body: bodyRaw } : {}),
        });

        const text = await strapiRes.text();
        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy /api/user-profiles/.../convert:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    // ===== FIN PROXY DE USER-PROFILES CONVERT =====

    // ===== PROXY DE SUPPLY-ITEMS (hotfix JWT para build antiguo) =====
    if (pathname === '/api/supply-items') {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      try {
        const strapiPath = `${STRAPI_INTERNAL_URL}/api/supply-items${parsedUrl.search || ''}`;
        const headers = {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        };

        let bodyRaw = '';
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          for await (const chunk of req) bodyRaw += chunk;
        }

        const strapiRes = await nativeFetch(strapiPath, {
          method: req.method,
          headers,
          ...(bodyRaw ? { body: bodyRaw } : {}),
        });

        const text = await strapiRes.text();
        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy /api/supply-items:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    // ===== FIN PROXY DE SUPPLY-ITEMS =====

    // ===== PROXY DE SUPPLY-REQUESTS (hotfix JWT para build antiguo) =====
    const supplyRequestsMatch = pathname.match(/^\/api\/supply-requests(?:\/([^\/]+)(?:\/(approve|reject|deliver))?)?$/);
    if (supplyRequestsMatch) {
      const jwt = getJwtFromRequest(req);
      if (!jwt) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
      const id = supplyRequestsMatch[1];
      const action = supplyRequestsMatch[2];
      try {
        let strapiPath;
        if (id && action) {
          strapiPath = `${STRAPI_INTERNAL_URL}/api/supply-requests/${id}/${action}${parsedUrl.search || ''}`;
        } else if (id) {
          strapiPath = `${STRAPI_INTERNAL_URL}/api/supply-requests/${id}${parsedUrl.search || ''}`;
        } else {
          strapiPath = `${STRAPI_INTERNAL_URL}/api/supply-requests${parsedUrl.search || ''}`;
        }

        const headers = {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        };

        let bodyRaw = '';
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
          for await (const chunk of req) bodyRaw += chunk;
        }

        const strapiRes = await nativeFetch(strapiPath, {
          method: req.method,
          headers,
          ...(bodyRaw ? { body: bodyRaw } : {}),
        });

        const text = await strapiRes.text();
        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy /api/supply-requests:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    // ===== FIN PROXY DE SUPPLY-REQUESTS =====

    // ===== PROXY DE VEHICLE-DOCUMENT-CATEGORIES-V2 (hotfix slug) =====
    function generateSlug(name) {
      return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    }

    const vdcMatch = pathname.match(/^\/api\/vehicle-document-categories(?:-v2)?(?:\/([^\/]+))?$/);
    if (vdcMatch) {
      const id = vdcMatch[1];
      try {
        if (req.method === 'GET' && !id) {
          const strapiRes = await nativeFetch(
            `${STRAPI_INTERNAL_URL}/api/vehicle-document-categories?sort[0]=order:asc`,
            { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` } }
          );
          const text = await strapiRes.text();
          res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
          res.end(text);
          return;
        }

        if (req.method === 'POST' && !id) {
          let bodyRaw = '';
          for await (const chunk of req) bodyRaw += chunk;
          const body = JSON.parse(bodyRaw || '{}');
          if (!body.data?.name) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'El nombre es requerido' }));
            return;
          }
          const payload = { ...body.data };
          if (!payload.slug && payload.name) {
            payload.slug = generateSlug(payload.name);
          }
          const strapiRes = await nativeFetch(
            `${STRAPI_INTERNAL_URL}/api/vehicle-document-categories`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              },
              body: JSON.stringify({ data: payload }),
            }
          );
          const text = await strapiRes.text();
          res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
          res.end(text);
          return;
        }

        if (req.method === 'PUT' && id) {
          let bodyRaw = '';
          for await (const chunk of req) bodyRaw += chunk;
          const body = JSON.parse(bodyRaw || '{}');
          const payload = { ...body.data };
          if (!payload.slug && payload.name) {
            payload.slug = generateSlug(payload.name);
          }
          const strapiRes = await nativeFetch(
            `${STRAPI_INTERNAL_URL}/api/vehicle-document-categories/${id}`,
            {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              },
              body: JSON.stringify({ data: payload }),
            }
          );
          const text = await strapiRes.text();
          res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
          res.end(text);
          return;
        }

        if (req.method === 'DELETE' && id) {
          const strapiRes = await nativeFetch(
            `${STRAPI_INTERNAL_URL}/api/vehicle-document-categories/${id}`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
            }
          );
          const text = await strapiRes.text();
          res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
          res.end(text || JSON.stringify({ success: true }));
          return;
        }
      } catch (error) {
        console.error('[Emergency] Error en proxy vehicle-document-categories-v2:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }
    // ===== FIN PROXY VEHICLE-DOCUMENT-CATEGORIES-V2 =====

    // Interceptar GET /api/maintenance-kits
    if (pathname === '/api/maintenance-kits' && req.method === 'GET') {
      try {
        if (!(await requireAdmin(req, res))) return;
        const jwt = getJwtFromRequest(req);
        if (!jwt) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'No autenticado' }));
          return;
        }
        const strapiUrl = `${STRAPI_INTERNAL_URL}/api/maintenance-kits${parsedUrl.search || ''}`;
        console.log(`[Emergency] GET /api/maintenance-kits -> ${strapiUrl}`);
        const strapiRes = await nativeFetch(strapiUrl, {
          headers: {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          },
        });
        const text = await strapiRes.text();
        res.writeHead(strapiRes.status, { 'Content-Type': 'application/json' });
        res.end(text);
        return;
      } catch (error) {
        console.error('[Emergency] Error en proxy maintenance-kits:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
    }

    // Para assets estáticos de Next.js: forzar caché largo (sobrescribe el no-store de next.config.js)
    const isNextStatic = pathname.startsWith('/_next/static/');
    if (isNextStatic) {
      const originalWriteHead = res.writeHead.bind(res);
      res.writeHead = function(statusCode, headersOrReason, headers) {
        let headersObj;
        if (typeof headersOrReason === 'string') {
          headersObj = headers || {};
        } else if (typeof headersOrReason === 'object') {
          headersObj = headersOrReason;
        } else {
          headersObj = {};
        }
        headersObj['Cache-Control'] = 'public, max-age=31536000, immutable';
        delete headersObj['Pragma'];
        delete headersObj['Expires'];
        if (typeof headersOrReason === 'string') {
          return originalWriteHead(statusCode, headersOrReason, headersObj);
        }
        return originalWriteHead(statusCode, headersObj);
      };
    }

    // Todas las demás rutas van al handler de Next.js
    handle(req, res, parsedUrl);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`[Emergency Server] Listo en http://localhost:${port}`);
  });
});

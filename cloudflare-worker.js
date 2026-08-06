/**
 * Lark Base proxy — Cloudflare Worker (module syntax).
 *
 * Deploy: `npx wrangler deploy cloudflare-worker.js` (hoặc dán vào Workers editor).
 * Biến bí mật đặt bằng `wrangler secret put <NAME>` hoặc trong dashboard Workers:
 *   LARK_APP_ID, LARK_APP_SECRET, LARK_HOST, LARK_APP_TOKEN,
 *   TB_CHECKIN, TB_ORDERS, TB_MASTER, TB_DISPATCH, TB_DS_MASTER
 *
 * Dashboard trỏ vào:  API URL = https://<worker>.workers.dev/api/lark
 * (Worker lấy tên bảng ở segment cuối, nên /api/lark/<table> hay /<table> đều được.)
 * `GET /` hoặc `GET /health` → liệt kê các table key đang hỗ trợ, không cần Lark token.
 *
 * **Schema (2026-08-05, "no DS Master")**: `TB_CHECKIN` = table id của
 * "Master_Check in". `TB_MASTER` = table id của bảng "Master" (log NV tiếp
 * nhận khách theo bàn — nguồn xác định khách đang ở bàn nào + màu bàn + "Chờ
 * điều phối"). `TB_DISPATCH` = table id của "Master Điều phối" (khách đã gán
 * bàn, chờ NV nhận — nguồn số "khách đang chờ" mỗi bàn).
 *
 * **`TB_DS_MASTER`** (thêm lại 2026-08-05, tiếp) = table id của "DS Master" —
 * web đọc field "STT tiếp theo" + "NV Tư vấn"/"Loại" mỗi bàn từ bảng này
 * (dự phòng suy mã bàn khi `TV_MãNV` không tự resolve được, xem
 * `larkMapper.ts`'s `indexDeskCodeByStaffName`). Bug thật 2026-08-06:
 * `TABLE_ENV` từng thiếu hẳn key `dsMaster` — `/dsMaster` luôn trả rỗng y hệt
 * bảng thật sự không có dữ liệu, mất nhiều vòng debug mới lộ ra.
 *
 * **Tự resolve mã option Lark thô** (2026-08-06, đồng bộ từ bản đang deploy
 * thật — tiến bộ hơn bản cũ chỉ lọc mã "opt..." phía web): với field có
 * DANH SÁCH OPTION TĨNH khai báo ngay trên field (formula/single-select
 * bình thường), REST API trả mảng mã option thô (`["opt..."]`) thay vì chữ
 * hiển thị — gọi thêm `GET .../fields` 1 lần/bảng (cache 10 phút) lấy map
 * optionId→tên, tự thay thế trước khi trả về client. KHÔNG bao phủ được
 * field kiểu Lookup có options ĐỘNG (vd `TV_MãNV`, options lấy từ bảng khác
 * qua `optionsRule`, không có trong `fields` API) — code web (`larkMapper.ts`)
 * vẫn cần tự suy mã bàn qua NV làm dự phòng cho đúng trường hợp này.
 *
 * **Base nhúng trong Wiki**: nếu bạn lấy `LARK_APP_TOKEN` từ 1 URL dạng
 * `.../wiki/<token>?table=...` (không phải `.../base/<token>?table=...`),
 * giá trị đó là *wiki node token*, KHÔNG PHẢI app_token thật của Bitable —
 * dùng thẳng sẽ luôn lỗi `NOTEXIST`. Worker này tự dò: gọi
 * `wiki/v2/spaces/get_node` trước, nếu token là 1 node kiểu `bitable` thì tự
 * đổi sang `obj_token` thật; nếu không (bạn đã dùng đúng app_token trực
 * tiếp) thì dùng nguyên token đã cấu hình — không cần biết trước bạn đang ở
 * trường hợp nào.
 */
const TABLE_ENV = {
  checkin: 'TB_CHECKIN',
  orders: 'TB_ORDERS',
  master: 'TB_MASTER',
  dispatch: 'TB_DISPATCH',
  dsMaster: 'TB_DS_MASTER',
};

let cachedToken = null;
let tokenExpiresAt = 0;

async function getToken(env, host) {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const r = await fetch(`${host}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: env.LARK_APP_ID, app_secret: env.LARK_APP_SECRET }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error(`token error: ${j.msg} (code ${j.code})`);
  cachedToken = j.tenant_access_token;
  tokenExpiresAt = Date.now() + (j.expire - 120) * 1000;
  return cachedToken;
}

let cachedAppToken = null;

/** `LARK_APP_TOKEN` có thể là wiki node token — dò và đổi sang app_token thật của Bitable nếu đúng vậy. */
async function resolveAppToken(env, host, token) {
  if (cachedAppToken) return cachedAppToken;
  try {
    const bearer = await getToken(env, host);
    const r = await fetch(`${host}/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(token)}`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    const j = await r.json();
    if (j.code === 0 && j.data?.node?.obj_type === 'bitable' && j.data.node.obj_token) {
      cachedAppToken = j.data.node.obj_token;
      return cachedAppToken;
    }
  } catch {
    /* không phải wiki node (hoặc lỗi mạng) — dùng thẳng token gốc bên dưới */
  }
  cachedAppToken = token;
  return cachedAppToken;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// Cache map optionId→tên hiển thị theo TỪNG BẢNG (10 phút) — tránh gọi lại
// API field-metadata mỗi request.
const fieldOptionCache = new Map();
const FIELD_CACHE_MS = 10 * 60 * 1000;

/** Lấy `{ tên field → Map(optionId → tên hiển thị) }` cho các field CÓ danh sách option tĩnh trong 1 bảng. */
async function getFieldOptionMaps(env, host, appToken, token, tableId) {
  const now = Date.now();
  const hit = fieldOptionCache.get(tableId);
  if (hit && now < hit.expiresAt) return hit.maps;

  const url = `${host}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields?page_size=200`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();

  const maps = {};
  for (const f of data?.data?.items ?? []) {
    const options = f.property?.type?.ui_property?.options;
    if (Array.isArray(options)) maps[f.field_name] = new Map(options.map((o) => [o.id, o.name]));
  }
  fieldOptionCache.set(tableId, { maps, expiresAt: now + FIELD_CACHE_MS });
  return maps;
}

/** Thay mã option thô (`["opt..."]`) bằng tên hiển thị cho mọi field có option tĩnh — sửa `records` tại chỗ. */
function resolveOptionRefs(records, fieldMaps) {
  for (const rec of records) {
    for (const [fieldName, optMap] of Object.entries(fieldMaps)) {
      const v = rec.fields?.[fieldName];
      if (Array.isArray(v) && v.length && typeof v[0] === 'string' && optMap.has(v[0])) {
        rec.fields[fieldName] = v.map((id) => optMap.get(id) ?? id).join(', ');
      }
    }
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const table = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    const host = (env.LARK_HOST || 'https://open.larksuite.com').replace(/\/+$/, '');

    if (table === '' || table === 'health') {
      return json({ code: 0, msg: 'ok', tables: Object.keys(TABLE_ENV) });
    }

    const envKey = TABLE_ENV[table];
    const tableId = envKey ? env[envKey] : undefined;

    // Thiếu secret (hoặc key bảng không tồn tại trong TABLE_ENV) — báo lỗi rõ
    // ràng thay vì giả vờ thành công. Trước đây trả `code:0, items:[]` trông
    // Y HỆT 1 bảng thật sự rỗng — bug thật 2026-08-06 (thiếu hẳn key
    // "dsMaster") mất nhiều vòng debug mới lộ ra vì im lặng "thành công".
    if (!envKey) return json({ code: -1, msg: `Unknown table key "${table}"`, data: { items: [] } }, 400);
    if (!tableId) return json({ code: -1, msg: `Missing Cloudflare secret "${envKey}" for table "${table}"`, data: { items: [] } }, 500);

    try {
      const token = await getToken(env, host);
      const appToken = await resolveAppToken(env, host, env.LARK_APP_TOKEN);
      let items = [];
      let pageToken;
      do {
        const u = new URL(`${host}/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`);
        u.searchParams.set('page_size', '500');
        if (pageToken) u.searchParams.set('page_token', pageToken);
        const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
        const jj = await r.json();
        if (jj.code !== 0) return json(jj);
        items = items.concat(jj.data?.items ?? []);
        pageToken = jj.data?.has_more ? jj.data.page_token : null;
      } while (pageToken);

      const fieldMaps = await getFieldOptionMaps(env, host, appToken, token, tableId);
      resolveOptionRefs(items, fieldMaps);

      return json({ code: 0, msg: 'success', data: { items, has_more: false, total: items.length } });
    } catch (e) {
      return json({ code: -1, msg: String(e?.message || e), data: { items: [] } }, 500);
    }
  },
};

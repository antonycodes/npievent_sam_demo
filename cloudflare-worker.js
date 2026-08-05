/**
 * Lark Base proxy — Cloudflare Worker (module syntax).
 *
 * Deploy: `npx wrangler deploy cloudflare-worker.js` (hoặc dán vào Workers editor).
 * Biến bí mật đặt bằng `wrangler secret put <NAME>` hoặc trong dashboard Workers:
 *   LARK_APP_ID, LARK_APP_SECRET, LARK_HOST, LARK_APP_TOKEN,
 *   TB_DS_TRADEIN, TB_DS_CONSULT, TB_CHECKIN, TB_ORDERS, TB_MASTER
 *
 * Dashboard trỏ vào:  API URL = https://<worker>.workers.dev/api/lark
 * (Worker lấy tên bảng ở segment cuối, nên /api/lark/<table> hay /<table> đều được.)
 *
 * **Schema "Master" (2026-08-05)**: `DS Tư vấn`/`DS thu cũ`/`DS backup`/`DS Kho`
 * đã gộp thành 1 bảng Lark "DS Master" — đặt CẢ `TB_DS_TRADEIN` VÀ
 * `TB_DS_CONSULT` bằng đúng table id của "DS Master" (web tự lọc theo cột
 * "Loại", xem `src/config/larkConfig.ts`). `TB_CHECKIN` đổi sang table id của
 * "Master_Check in". `TB_MASTER` = table id của bảng "Master" (log NV tiếp
 * nhận khách theo bàn — nguồn xác định khách đang ở bàn nào).
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
  dsTradein: 'TB_DS_TRADEIN',
  dsConsult: 'TB_DS_CONSULT',
  checkin: 'TB_CHECKIN',
  orders: 'TB_ORDERS',
  master: 'TB_MASTER',
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const table = new URL(request.url).pathname.split('/').filter(Boolean).pop();
    const host = (env.LARK_HOST || 'https://open.larksuite.com').replace(/\/+$/, '');
    const tableId = env[TABLE_ENV[table]];

    if (!tableId) return json({ code: 0, msg: 'success', data: { items: [], has_more: false, total: 0 } });

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

      return json({ code: 0, msg: 'success', data: { items, has_more: false, total: items.length } });
    } catch (e) {
      return json({ code: -1, msg: String(e?.message || e), data: { items: [] } }, 500);
    }
  },
};

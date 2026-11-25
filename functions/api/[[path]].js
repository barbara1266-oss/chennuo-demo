// 晨諾餐飲叫貨系統｜中繼程式（Cloudflare Pages Functions）
// 網頁只呼叫自己網址下的 /api，這支程式把請求轉給後端（Google Apps Script）。
// 後端網址（GAS_URL）與通關密語（GATEWAY_KEY）收在 Cloudflare 的環境變數，瀏覽器看不到。

function jsonOut(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;

  if (method !== 'GET' && method !== 'POST') {
    return jsonOut({ ok: false, error: '不支援的請求方式' }, 405);
  }
  if (!env.GAS_URL || !env.GATEWAY_KEY) {
    return jsonOut({ ok: false, error: '中繼尚未設定完成' }, 500);
  }

  // 保留網頁原本帶的查詢參數（例如 t=店家代碼），丟掉外部自己塞的 k，再補上通關密語
  const incoming = new URL(request.url);
  const target = new URL(env.GAS_URL);
  incoming.searchParams.forEach((value, key) => {
    if (key !== 'k') target.searchParams.append(key, value);
  });
  target.searchParams.set('k', env.GATEWAY_KEY);

  const init = { method, redirect: 'follow' };
  if (method === 'POST') {
    const body = await request.text();
    if (body.length > 1000000) {
      return jsonOut({ ok: false, error: '資料量過大' }, 413);
    }
    init.body = body;
    init.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
  }

  let upstream;
  try {
    upstream = await fetch(target.toString(), init);
  } catch (err) {
    return jsonOut({ ok: false, error: '雲端連線失敗，請稍後再試' }, 502);
  }

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

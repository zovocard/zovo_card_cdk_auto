# ZovoCard 開放 API 文檔

通過開放 API 程序化完成開卡、查卡、卡充值、退款、凍結、消費查詢等操作。所有調用按你的賬戶餘額與專屬費率計費（與網頁端一致）。

- **生產 Base URL**：`https://zovocard.com/openapi/v1`
- **沙盒 Base URL**：`https://sandbox.zovocard.com/openapi/v1`
- **數據格式**：請求與響應均為 `application/json`，UTF-8
- **憑證獲取**：登錄後在「開發者」頁生成 `app_id` / `app_secret`

### 代理接入前測試

新代理應先登錄 `https://sandbox.zovocard.com`，在「開發者」頁建立一套僅用於沙盒的 API 密鑰，再用沙盒 Base URL 完成聯調。沙盒賬戶、密鑰和數據與生產完全隔離；開卡、充值、退款及交易均為模擬結果，不會請求真實發卡渠道或產生真實資金變動。

```bash
export ZOVOCARD_API_BASE='https://sandbox.zovocard.com/openapi/v1'
export ZOVOCARD_API_KEY='sk_沙盒密鑰'

curl "$ZOVOCARD_API_BASE/products" \
  -H "X-API-Key: $ZOVOCARD_API_KEY"
curl "$ZOVOCARD_API_BASE/balance" \
  -H "X-API-Key: $ZOVOCARD_API_KEY"
```

沙盒驗證通過後，只需改用生產 Base URL 和單獨建立的生產密鑰。不要在沙盒中使用生產密鑰，也不要把沙盒返回的卡片或交易當作真實資產。

## 0. 當前賬戶與卡片約束

- 鏈上充值單筆最低 `50U`（USDT/USDC）；共享 TRC20 意向低於 `50U` 無法創建，專屬地址收到低於 `50U` 的轉賬不會自動入賬，會進入人工處理。
- 普通賬戶全賬戶共同保留一筆 `20U` 風險保證金，不按卡片或交易重復扣取。該金額仍包含在 `balance` 中，不產生單獨扣款流水；`GET /balance` 同時返回 `balance`、`spendable_balance` 和 `account_reserve_amount`，開卡、卡充值、批量開卡、轉賬、商城和 GPT 直充等用戶主動消費只能使用 `spendable_balance`。
- 子賬戶不單獨保留 `20U`；主賬戶及其全部子賬戶共享主賬戶的保證金、拒付率、退款率、單日拒付計數和白名單資格。子賬戶風險手續費優先扣子賬戶餘額，不足部分由主賬戶代扣，並分別記錄資金流水；主賬戶風險保證金可用於核銷該類手續費。子賬戶的 `account_reserve_amount` 和 `spendable_balance` 按其自身餘額返回，不代表另行佔用一筆保證金。
- 拒付費、授權撤銷費、消費退款費、小額消費費和受限商戶處理費屬於平颱風險費用，可以核銷保證金；調用方不要用總餘額自行判斷用戶操作是否可執行。
- 拒付規則：非白名單真實拒付前 3 筆免費，第 4 筆起基礎 `$0.30`，比例檔位附加 `$0.30/$0.50/$0.80`；所有賬戶授權撤銷固定按金額 `1%` 收取，且不參與當前拒付/退款風控；消費退款金額低於 `1U` 時免收退款手續費，達到 `1U` 後繼續執行比例與最低 `$0.50` 規則；Google 商戶低於 `1U` 的消費驗證退款不計入退款筆數、退款率分母或退款率，但保留完整流水；小額真實消費（`0 < amount < 0.50U`）每筆 `$0.30`。
- 產品和卡詳情返回 `restricted_merchants` 有效禁用商戶陣列，以及兼容字段 `google_chatgpt_blocked`。未配置卡頭時，非香港發行卡默認禁用 `GOOGLE CHATGPT`，香港發行卡默認無禁用商戶；產品管理可按前 6 位卡頭配置多個商戶，顯式空陣列表示全部放行。命中任一規則的真實授權/清算時，第一次凍結卡，第二次刪卡、退回卡內餘額並收取 `$0.50`。
- 提現若觸及最後 `20U`，屬於保證金退出，必須刪除全部卡片並等待 `30` 天觀察期；30 天前管理端打款接口也會拒絕，不能只依賴前端按鈕狀態。

---

## 1. 接入流程

1. 在「開發者」頁生成密鑰，得到 `app_id`（`ak_` 開頭，公開標識）與 `app_secret`（`sk_` 開頭，請求鑒權用，務必保密）。
2. （可選）為密鑰設置 IP 白名單、配置回調地址。
3. 調 `GET /products` 獲取可開卡產品 → `POST /cards/open` 開卡（建議帶冪等鍵）。
4. 用 `GET /cards/{id}` 取卡號/有效期/CVV，`GET /cards/{id}/transactions` 查消費，或配置 Webhook 實時接收卡事件。
5. `GET /balance` 查餘額，`GET /balance-logs` 對賬。

> 餘額不足會導致開卡/充值失敗。請先在網頁端用 USDT 充值（支持 TRON / Ethereum / BNB Chain / X Layer）。

---

## 2. 鑒權

每個請求在 Header 攜帶 `app_secret`（`sk_` 開頭），二選一：

```
X-API-Key: sk_xxxxxxxxxxxxxxxx
```
或
```
Authorization: Bearer sk_xxxxxxxxxxxxxxxx
```

可選：再帶 `X-App-Id: ak_xxxx` 做雙重校驗。

- 密鑰可在開發者頁 **啓用 / 停用**、設置 **IP 白名單**（僅允許指定 IP 調用）。
- 鑒權失敗返回 `401`；IP 不在白名單返回 `403`。

---

## 3. 請求與響應格式

統一信封（注意欄位名是 **`msg`**，不是 `message`）：

```jsonc
// 成功
{ "code": 0, "msg": "ok", "data": <結果> }
// 失敗（多數錯誤帶 error_code）
{ "code": 400, "error_code": "insufficient_balance", "msg": "餘額不足" }
```

> **API 返回的 `msg` 永遠是簡體中文**，與本文語言無關。本文範例中的 `msg`
> 已隨全文轉為繁體，僅供閱讀；★請勿據此比對字串★——見下方「按 `error_code` 判斷」。

**★HTTP 狀態碼是有意義的，不要一律當 200 處理★**，body 裡的 `code` 與 HTTP 狀態通常一致。

| HTTP 狀態 | 含義 | 你該怎麼做 |
|------|------|------|
| 200 | 成功（`code:0`）| 讀 `data` |
| **202** | **已受理，結果待定**（退款、刪卡）| ★不是失敗也不是成功★，見下方「異步受理」 |
| 400 | 參數錯誤 / 業務失敗 | 看 `error_code`，多為終態，別盲目重試 |
| 401 | 密鑰缺失 / 無效 / 已停用 | 檢查 `X-API-Key` |
| 403 | IP 不在白名單 / 未開通權限 / 未充值 / 子賬戶無權 | 看 `error_code` 區分，見附錄 |
| 404 | 對象不存在（訂單、CDK 訂單）| 確認 id 歸屬本密鑰 |
| 409 | 衝突（冪等鍵仍在處理中、訂單已開始支付無法取消）| 退避後重查狀態，別重複提交 |
| 429 | 頻率超限（默認 100 次/分鐘/密鑰）| 指數退避 |
| 500 | 服務端錯誤 | 可重試；寫操作重試務必帶同一 `Idempotency-Key` |
| 503 | 渠道暫時不可用（上游故障已熔斷）| 稍後重試或換 `issuer` |

### ★一律按 `error_code` 判斷，不要匹配 `msg` 文案★

`msg` 是給人看的中文說明，**會改**，而且始終是簡體；`error_code` 是穩定的機器可讀值。
完整對照見 [附錄 A：錯誤碼](#附錄-a錯誤碼對照)。

### ★異步受理（HTTP 202）：受理 ≠ 成功★

**退款**和**刪卡**可能返回 HTTP `202`，表示上游已受理但結果未確認：

```jsonc
{ "code": 0, "msg": "退款已提交，正在確認結果", "data": { "pending": true } }
```

- `data.pending == true` → 結果待定，**不要重複提交**，改為輪詢卡列表 / 卡詳情確認。
- `data.pending == false`（HTTP 200）→ 已確認完成。
- 系統會自動對賬收口；重複提交可能造成重複操作。

**直充下單**同理：`POST /gpt-direct/orders` 返回 HTTP `202` + `"msg":"accepted"`，
只表示訂單已入隊，**不代表訂閱已開通**，必須輪詢訂單狀態到終態。

> ★充值是例外★：卡充值結果未確認時返回的是 **HTTP 400** 加「充值結果確認中」類
> 文案（不是 202），同樣不要重複提交，等系統對賬。

### 兩個不守規矩的響應（歷史兼容，接入時請特判）

| 接口 | 異常表現 |
|---|---|
| `GET /cards/{id}/openai-payments` | 卡不存在時返回 **HTTP 200**，但 body 是 `{"code":404,...}` |
| `GET /balance-logs` | 篩選參數非法時返回 400，但**不帶 `error_code`**，只有 `msg` |

**常見業務錯誤（`msg` 文案示例）**：餘額不足、卡產品不存在或已下架、最低開卡金額限制、卡不存在、卡狀態異常無法操作、退款金額超出卡內餘額、退款後卡內餘額不得少於 $1 等。

### 渠道暫時不可用（可編程區分）

當某發卡渠道上游故障時，系統會探活確認後**臨時熔斷**該渠道，開卡 / 充值接口返回 **HTTP `503`**，body 帶穩定的 `error_code`：

```jsonc
{ "code": 503, "error_code": "channel_unavailable", "msg": "渠道暫時不可用，請稍後再試或選擇其他渠道" }
```

- 請按 `error_code == "channel_unavailable"` 判定（勿匹配 `msg` 文案），據此**稍後重試**或**改用其他渠道的產品**（不同 `issuer`）。
- 渠道恢復後自動放開，無需人工介入；該狀態只影響對應渠道，其他渠道正常。
- 此為暫時性故障，非扣費失敗——熔斷攔截發生在扣費之前，不會產生扣款。


---

## 4. 冪等

開卡、充值、退款等寫操作，帶一個唯一的 `Idempotency-Key` 頭：

```
Idempotency-Key: 你的唯一訂單號
```

同一密鑰下、相同 `Idempotency-Key` 的請求只會真正執行一次；重試會**原樣返回首次結果**（響應頭帶 `Idempotent-Replayed: true`），可避免網絡重試導致**重復開卡 / 重復扣費**。

---

## 5. 數據字典

**卡狀態 `status`**

| 狀態 | 說明 |
| --- | --- |
| ACTIVE | 激活（正常使用）|
| FROZEN | 已凍結 |
| CANCELLED | 已注銷 |
| DELETED | 已刪除 |

**交易類型 `type`**

| 類型 | 說明 |
| --- | --- |
| Authorization | 消費授權 |
| Settlement | 清算 |
| Refund | 消費退款 |
| Reversal | 授權撤銷 |

**交易狀態 `status`**

| 狀態 | 說明 |
| --- | --- |
| PENDING | 清算中 |
| COMPLETE | 清算完成 |
| DECLINED | 交易失敗（失敗原因見 `description`）|

---

## 6. 接口詳解

### 6.1 獲取可開卡產品

`GET /products`

返回當前可開卡的產品列表，**含你的專屬開卡費/退款率**。

**響應字段（`data` 數組項）**

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| product_code | string | 產品碼（開卡用）。開卡時原樣回傳本接口給出的值即可 |
| network | string | 卡組織：VISA / MasterCard |
| issuing_area | string | 發行區域 |
| card_type | string | 卡類型：save=儲值卡 |
| open_fee | number | 開卡費（你的專屬價）|
| recharge_fee | number | 卡充值手續費率 |
| rtf_rate | number | 消費退款手續費率 |
| min_amount | number | 產品最低開卡/卡充值金額（鏈上賬戶充值另受 50U 平台下限約束）|
| max_amount | number | 最高金額 |
| restricted_merchants | string[] | 當前卡頭禁用商戶規則；空陣列表示不禁用商戶 |
| google_chatgpt_blocked | boolean | 兼容字段；有效規則會命中 `GOOGLE CHATGPT` 時為 true |

**請求**
```bash
curl https://zovocard.com/openapi/v1/products -H "X-API-Key: sk_你的密鑰"
```

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "product_code": "P5378OX",
      "issuer": "one",
      "network": "MasterCard",
      "issuing_area": "United States",
      "card_type": "save",
      "open_fee": 1.5,
      "recharge_fee": 0,
      "rtf_rate": 0.1,
      "min_amount": 10,
      "max_amount": 10000,
      "restricted_merchants": ["GOOGLE CHATGPT"],
      "google_chatgpt_blocked": true
    }
  ]
}
```

> `issuer` 為發卡渠道：`one` / `two`。兩渠道卡段、發行地、費率可能不同，開卡時用對應 `product_code` 即可，無需關心底層差異；所有卡接口（充值/退款/凍結/刪卡/查詢）對兩渠道通用。

---

### 6.2 開卡

`POST /cards/open`

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| product_code | string | 是 | 產品碼 |
| first_name | string | 是 | 持卡人名 |
| last_name | string | 是 | 持卡人姓 |
| init_amount | number | 是 | 初始充值金額（≥ 產品最低金額）|
| max_on_daily | number | 否 | 日交易限額 USD（僅 `issuer=four` 星鏈卡；其它渠道忽略） |
| max_on_monthly | number | 否 | 月交易限額 USD（僅 four） |
| max_on_percent | number | 否 | 單筆最大金額 USD（僅 four） |
| transaction_limit | number | 否 | 可交易總額度 USD（僅 four） |
| transaction_limit_type | string | 否 | `limited` / `unlimited`（僅 four） |

開卡將從賬戶可消費餘額扣除 **開卡費 + 初始充值金額**；賬戶必須保留 20U 風險保證金。產品或卡詳情中的 `restricted_merchants` 是該卡頭的有效禁用商戶列表。

星鏈卡（`issuer=four`）可在開卡時寫入消費限額；開卡後亦可用 `POST /cards/limits` 調整。

**請求**
```bash
curl -X POST https://zovocard.com/openapi/v1/cards/open \
  -H "X-API-Key: sk_你的密鑰" \
  -H "Idempotency-Key: order-20260604-001" \
  -H "Content-Type: application/json" \
  -d '{"product_code":"PP5450RC","first_name":"John","last_name":"Doe","init_amount":25,"max_on_daily":500,"max_on_monthly":5000,"max_on_percent":200}'
```

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "id": 123,
    "user_id": 31,
    "issuer": "one",
    "vm_card_id": "card55202606040031562947331",
    "card_number": "5378727109708264",
    "cvv": "123",
    "expire": "08/29",
    "product_code": "P5378OX",
    "network": "MasterCard",
    "issuing_area": "United States",
    "available_amount": 20,
    "status": "ACTIVE",
    "open_fee": 1.5,
    "first_name": "John",
    "last_name": "Doe",
    "created_at": "2026-06-04T00:31:56Z"
  }
}
```

> 開卡響應即時返回 `cvv` / `expire`（有效期 MM/YY），請妥善保存；後續 `GET /cards/{id}` 也可再取。卡列表接口出於安全不返回 CVV。

---

### 6.3 批量開卡

`POST /cards/batch-open`

在 6.2 參數基礎上增加 `count`（開卡數量）。先預檢總餘額，再逐張開卡；單張失敗自動退款並繼續。

**請求**
```bash
curl -X POST https://zovocard.com/openapi/v1/cards/batch-open \
  -H "X-API-Key: sk_你的密鑰" -H "Content-Type: application/json" \
  -d '{"product_code":"P5378OX","first_name":"John","last_name":"Doe","init_amount":20,"count":3}'
```

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "success": [ { "id": 124, "card_number": "5378727100000001", "status": "ACTIVE" } ],
    "failed":  [ { "index": 2, "error": "餘額不足" } ]
  }
}
```

---

### 6.4 我的卡列表

`GET /cards?page=1&page_size=20`

**請求參數**：`page`（頁碼，默認 1）、`page_size`（每頁數量，默認 20）、`q`（按卡號/備注模糊搜索，選填）、`sync`（傳 `1` 時實時同步當前頁各卡餘額/狀態後再返回，便於核對“卡里還有多少錢”；不傳則返回緩存值，更快）。

> `available_amount` 默認為緩存值（由 Webhook/消費回調更新，可能有滯後）。需要**實時餘額**時加 `&sync=1`，系統會逐卡向上游查詢當前頁餘額後返回（單卡 60 秒內最多同步一次，避免觸發上游限速）。

**請求**
```bash
# 實時餘額：加 sync=1（不加則返回更快的緩存值）
curl "https://zovocard.com/openapi/v1/cards?page=1&page_size=20&sync=1" -H "X-API-Key: sk_你的密鑰"
```

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 2,
    "list": [
      {
        "id": 123,
        "vm_card_id": "card55202606040031562947331",
        "card_number": "5378727109708264",
        "product_code": "P5378OX",
        "network": "MasterCard",
        "issuing_area": "United States",
        "available_amount": 18.8,
        "status": "ACTIVE",
        "first_name": "John",
        "last_name": "Doe",
        "created_at": "2026-06-04T00:31:56Z"
      }
    ]
  }
}
```

---

### 6.5 卡詳情（含卡號 / 有效期 / CVV）

`GET /cards/{id}`

`{id}` 為本地卡 ID。實時返回完整卡信息（含敏感字段）。

**響應字段（`data`）**

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| card_id | string | 卡 ID |
| card_number | string | 完整卡號 |
| cvv | string | CVV 安全碼 |
| expire | string | 有效期 MM/YY |
| status | string | 卡狀態 |
| user_name | string | 持卡人姓名 |
| available_amount | number | 卡內可用餘額 |
| card_type | string | 卡類型 |
| first_name / last_name | string | 持卡人名 / 姓 |
| create_time | string | 開卡時間 |
| card_address | object | 賬單地址 |
| limit | object | 額度設置（額度卡有效）|

**請求**
```bash
curl https://zovocard.com/openapi/v1/cards/123 -H "X-API-Key: sk_你的密鑰"
```

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "card_id": "card55202606040031562947331",
    "card_number": "5378727109708264",
    "cvv": "123",
    "expire": "08/29",
    "status": "ACTIVE",
    "user_name": "John Doe",
    "available_amount": 18.8,
    "card_type": "save",
    "first_name": "John",
    "last_name": "Doe",
    "create_time": "2026-06-04 00:31:56",
    "card_address": {
      "address_line_one": "",
      "address_line_two": "",
      "city": "",
      "state": "",
      "country": "",
      "post_code": ""
    }
  }
}
```

---

### 6.6 卡消費記錄

`GET /cards/{id}/transactions?page=1&page_size=50&sync=0`

**響應字段（`data` 數組項）**

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| auth_id | string | 交易 ID |
| card_id | string | 上游卡 ID（渠道卡標識）|
| auth_time | string | 交易授權時間 |
| auth_amount | number | 授權金額 |
| auth_currency | string | 授權幣種 |
| settle_amount | number | 結算金額 |
| settle_currency | string | 結算幣種 |
| status | string | 交易狀態（見數據字典）|
| type | string | 交易類型（見數據字典）|
| merchant_name | string | 交易商戶 |
| merchant_amount | number | 商戶本幣金額；本地歷史投影可能為 0 |
| merchant_currency | string | 商戶本幣幣種；沒有時為空字符串 |
| create_time | string | 上游創建時間；本地歷史投影可能為空，實時 Webhook 才保證原始值 |
| description | string | 交易詳情 / 失敗原因 |

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "auth_id": "1059958172",
      "card_id": "card55202606040031562947331",
      "auth_time": "2026-06-04 02:29:40",
      "auth_amount": 9.99,
      "auth_currency": "USD",
      "settle_amount": 9.99,
      "settle_currency": "USD",
      "status": "COMPLETE",
      "type": "Settlement",
      "merchant_name": "OPENAI",
      "merchant_amount": 9.99,
      "merchant_currency": "USD",
      "create_time": "",
      "description": ""
    },
    {
      "auth_id": "1059957962",
      "card_id": "card55202606040031562947331",
      "auth_time": "2026-06-04 02:20:34",
      "auth_amount": 5.00,
      "auth_currency": "USD",
      "settle_amount": 0,
      "settle_currency": "USD",
      "status": "DECLINED",
      "type": "Authorization",
      "merchant_name": "STEAM",
      "merchant_amount": 5.00,
      "merchant_currency": "USD",
      "create_time": "",
      "description": "Insufficient funds"
    }
  ]
}
```

> 另有 `GET /cards/all-transactions` 一次性聚合你名下所有卡的消費記錄（響應結構同上，每項額外帶 `card_number`、`local_card_id`）。

---

### 6.7 卡段 OpenAI 最新支付（三檔價位）

`GET /cards/{id}/openai-payments`

返回該卡**所屬卡段**（卡頭/BIN，渠道1/2 按產品、渠道3 按卡頭）在 **OpenAI** 商戶三個價位檔（Plus / 5x / 20x）各自「最新一筆」支付的金額與時間，作為該卡段的**最新行情參考價**（用於參考下單）。取卡段而非單卡：新卡/未刷過某檔的卡也能拿到該卡段的最新價。

**檔位（按結算金額 USD 區間）**

| tier | label | 金額區間 |
| --- | --- | --- |
| plus | Plus | $15 – $20 |
| x5 | 5x | $90 – $100 |
| x20 | 20x | $140 – $160 |

**響應字段（`data` 數組，固定 3 項，按上表順序）**

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| tier | string | 檔位標識：plus / x5 / x20 |
| label | string | 檔位名：Plus / 5x / 20x |
| min_usd | number | 檔位下限（USD）|
| max_usd | number | 檔位上限（USD）|
| amount | number | 該卡段該檔最新一筆支付金額（USD），無則 0 |
| time | string | 該卡段該檔最新一筆授權時間，無則空字符串 |
| found | boolean | 該檔是否有匹配記錄 |

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    { "tier": "plus", "label": "Plus", "min_usd": 15, "max_usd": 20, "amount": 16.24, "time": "2026-06-16 09:43:25", "found": true },
    { "tier": "x5", "label": "5x", "min_usd": 90, "max_usd": 100, "amount": 99.00, "time": "2026-06-15 20:11:03", "found": true },
    { "tier": "x20", "label": "20x", "min_usd": 140, "max_usd": 160, "amount": 150.00, "time": "2026-06-16 03:02:55", "found": true }
  ]
}
```

> 僅統計非拒付（成功 / 掛賬）的 OPENAI 商戶交易。某檔無記錄時 `found=false`、`amount=0`、`time=""`。

---

### 6.8 卡充值記錄

`GET /cards/{id}/recharges`

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "id": 88,
      "user_id": 31,
      "card_id": 123,
      "vm_card_id": "card55202606040031562947331",
      "amount": 20,
      "fee": 0,
      "status": "success",
      "created_at": "2026-06-04T01:59:55Z"
    }
  ]
}
```

---

### 6.8b 卡資金流水

`GET /cards/{id}/fund-flows`

一張卡的**資金進出**賬本：開卡初始注資、卡充值、退款回錢包、刪卡退回。
與 `6.6 卡消費記錄` 互不重疊——那邊是**消費**（商戶扣款/退款），這邊是**資金進出**。

`amount` 為「對卡的影響」：正數=錢進卡，負數=錢出卡回到你的錢包。
已刪卡仍可查詢（刪卡退回那筆正在這裡）。

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": [
    {
      "id": 901792,
      "time": "2026-08-20 03:49:34",
      "type": "open_card_funding",
      "direction": "in",
      "amount": 20.4,
      "card_number": "5378727127637909",
      "remark": "開卡 P5378OX + 初始充值 $20.00（卡號 5378727127637909）"
    },
    {
      "id": 901880,
      "time": "2026-08-20 04:12:01",
      "type": "card_refund",
      "direction": "out",
      "amount": -20,
      "card_number": "5378727127637909",
      "remark": "刪卡退回餘額 5378727127637909"
    }
  ]
}
```

| `type` | 含義 |
|---|---|
| `open_card_funding` | 開卡費 + 初始充值（合併一條） |
| `card_recharge` | 卡充值 |
| `card_refund` | 退款回錢包 / 刪卡退回 |

---

### 6.9 卡充值

`POST /cards/recharge`

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| card_id | number | 是 | 本地卡 ID |
| amount | number | 是 | 充值金額 |

從賬戶可消費餘額扣除 `金額 + 手續費`（手續費 = 金額 × 卡充值費率）；賬戶必須保留 20U 風險保證金。產品或卡詳情中的 `restricted_merchants` 是該卡頭的有效禁用商戶列表。

**請求**
```bash
curl -X POST https://zovocard.com/openapi/v1/cards/recharge \
  -H "X-API-Key: sk_xxx" -H "Content-Type: application/json" \
  -d '{"card_id":123,"amount":50}'
```

**響應**
```json
{ "code": 0, "msg": "充值成功" }
```

---

### 6.10 卡退款（卡內餘額退回平台餘額）

`POST /cards/refund`

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| card_id | number | 是 | 本地卡 ID |
| amount | number | 是 | 退款金額（≤ 卡內可用餘額；退款後卡內餘額需 ≥ $1）|

主動從卡退回平台餘額**不收手續費**，全額到賬。

**請求**
```bash
curl -X POST https://zovocard.com/openapi/v1/cards/refund \
  -H "X-API-Key: sk_xxx" -H "Content-Type: application/json" \
  -d '{"card_id":123,"amount":10}'
```

**響應**
```json
{ "code": 0, "msg": "退款成功，餘額已退回" }
```

---

### 6.11 設置消費限額（星鏈卡 / issuer=four）

`POST /cards/limits`

僅 **星鏈卡**（`issuer=four`）支持；其它渠道返回業務錯誤。開卡時亦可在 `POST /cards/open` 傳入同名字段。

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| card_id | number | 是 | 本地卡 ID |
| max_on_daily | number | 否 | 日限額 USD |
| max_on_monthly | number | 否 | 月限額 USD |
| max_on_percent | number | 否 | 單筆最大 USD |
| transaction_limit | number | 否 | 可交易總額度變動金額 |
| transaction_limit_type | string | 否 | `limited` / `unlimited` |
| transaction_limit_change_type | string | 否 | `increase` / `decrease` |

至少提供一個限額字段。

**請求**
```bash
curl -X POST https://zovocard.com/openapi/v1/cards/limits \
  -H "X-API-Key: sk_xxx" -H "Content-Type: application/json" \
  -d '{"card_id":123,"max_on_daily":500,"max_on_monthly":5000,"max_on_percent":200}'
```

**響應**
```json
{ "code": 0, "msg": "限額已更新" }
```

---

### 6.11.1 渠道標識（issuer / channel）

| 值 | 含義 | 說明 |
| --- | --- | --- |
| `one` | 渠道 1 | 默認主力渠道 |
| `two` | 渠道 2 | 已退役，存量卡只讀/有限操作 |
| `three` | 渠道 3 | 含卡池/按 BIN 等能力 |
| `four` | 星鏈卡（PhotonPay）| 支援開卡可選限額、`POST /cards/limits` 改限額 |

產品列表 `GET /products` 的 `issuer`、卡對象的 `issuer`、Webhook 的 `channel` 使用同一套取值。客戶端應按 `issuer` 選擇產品並展示，無需關心上游廠商名。


### 6.12 凍結 / 解凍

`POST /cards/freeze`

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| card_id | number | 是 | 本地卡 ID |
| freeze | boolean | 是 | true=凍結，false=解凍 |

**請求**
```bash
curl -X POST https://zovocard.com/openapi/v1/cards/freeze \
  -H "X-API-Key: sk_xxx" -H "Content-Type: application/json" \
  -d '{"card_id":123,"freeze":true}'
```

**響應**
```json
{ "code": 0, "msg": "ok" }
```

---

### 6.13 修改卡備註

`PUT /cards/{id}/remark`

設置卡片的本地備註（僅你自己的卡）。備註僅用於本地整理 / 搜索（`GET /cards` 的 `q` 可按備註模糊搜索），不影響卡片本身或上游。

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| remark | string | 否 | 備註內容；傳空字符串即清空 |

**請求**
```bash
curl -X PUT https://zovocard.com/openapi/v1/cards/123/remark \
  -H "X-API-Key: sk_xxx" -H "Content-Type: application/json" \
  -d '{"remark":"給客戶A的卡"}'
```

**響應**
```json
{ "code": 0, "msg": "已保存" }
```

---

### 6.14 刪卡

`DELETE /cards/{id}`

永久刪除卡，卡內剩餘餘額**全額退回**平台餘額。

**請求**
```bash
curl -X DELETE https://zovocard.com/openapi/v1/cards/123 -H "X-API-Key: sk_xxx"
```

**響應**
```json
{ "code": 0, "msg": "刪卡成功，餘額已退回" }
```

---

### 6.15 賬戶餘額

`GET /balance`

**請求**
```bash
curl https://zovocard.com/openapi/v1/balance -H "X-API-Key: sk_你的密鑰"
```

**響應**
```json
{ "code": 0, "msg": "ok", "data": { "balance": 128.5, "spendable_balance": 108.5, "account_reserve_amount": 20, "account_reserve_enabled": true, "minimum_deposit_amount": 50, "currency": "USD" } }
```

`balance` 是賬面餘額，`spendable_balance` 是扣除持續鎖定保證金後的用戶可主動消費餘額。風險費用可能使賬面餘額低於 0；請始終以接口返回的業務錯誤和 `spendable_balance` 為準。

子賬戶的 `account_reserve_amount` 固定返回 `0`，因為保證金只保留在主賬戶；子賬戶仍與主賬戶共享風險主體。子賬戶風險手續費不足時，服務端會自動從主賬戶代扣，不要求客戶端自行拼接或轉移這筆費用。

---

### 6.16 賬戶流水（對賬）

`GET /balance-logs?page=1&page_size=20`

**響應字段（`data.list` 項）**：`created_at` 時間、`type` 類型（`recharge` 充值 / `open_card` 開卡 / `card_recharge` 卡充值 / `refund` 退款 / `decline_fee` 消費失敗費 / `reversal_fee` 授權撤銷費 / `refund_fee` 消費退款費 / `small_tx_fee` 小額消費費 / `merchant_violation_fee` 受限商戶處理費 / `admin` 調整等）、`amount` 金額（正增負減）、`before`/`after` 變動前後餘額、`remark` 備注。

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "total": 12,
    "list": [
      {
        "created_at": "2026-06-04T01:59:55Z",
        "type": "card_recharge",
        "amount": -20,
        "before": 38.8,
        "after": 18.8,
        "remark": "卡 5378727109708264 充值 $20.00 (手續費 $0.00)"
      }
    ]
  }
}
```

---

### 6.17 會員等級

`GET /vip`

返回當前賬戶的會員等級、累計數據與各檔達標門檻。會員按**累計充值**自動達標（也可後台手動授予），達標後享更低開卡費與充值費率，高等級含低等級全部權益。

**等級（tier）**

| tier | 名稱 | 達標（累計充值）| 權益（開卡費 / 充值費率 / 退款費）|
| --- | --- | --- | --- |
| `super` | 超級SVIP | ≥ $3,000 | $1 / 1% / 7% |
| `supreme` | 至尊SVIP | ≥ $20,000 | $0.5 / 1% / 5% |
| `legend` | 傳奇SVIP | ≥ $100,000 | $0.5 / 0.8% / 3% |
| `none` | 普通 | — | 產品默認 / 全局默認 / 10%（港卡 15%）|

**響應字段（`data`）**

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| tier | string | `none` / `super` / `supreme` / `legend` |
| tier_name | string | 等級中文名 |
| is_svip | boolean | 是否超級SVIP 及以上 |
| is_supreme_svip | boolean | 是否至尊SVIP 及以上 |
| is_legend_svip | boolean | 是否傳奇SVIP |
| active_cards | number | 名下有效卡數（僅供參考，不作為達標門檻）|
| cumulative_recharge | number | 累計充值（USDT，已入賬）|
| recharge_fee_rate | number | 當前生效充值費率（如 0.01 = 1%）|
| thresholds.super / .supreme / .legend | object | 各檔門檻 `{cards, recharge}`；當前僅按 `recharge` 達標，`cards` 恆為 `0` |

**響應**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "tier": "super",
    "tier_name": "超級SVIP",
    "is_svip": true,
    "is_supreme_svip": false,
    "is_legend_svip": false,
    "active_cards": 63,
    "cumulative_recharge": 4200.50,
    "recharge_fee_rate": 0.01,
    "thresholds": {
      "super": { "cards": 0, "recharge": 3000 },
      "supreme": { "cards": 0, "recharge": 20000 },
      "legend": { "cards": 0, "recharge": 100000 }
    }
  }
}
```

---

### 6.18 GPT 直充 API

GPT 直充接口使用你名下的卡為 GPT 賬號開通或升級套餐。它與卡開通、卡充值是兩條獨立鏈路：

- **商城直付**：沒有額外的 API / CDK 服務費。
- **開放 API 訂單**：按套餐收取 API 服務費，創建訂單時凍結，成功後結算；確定未扣款的終態會釋放。
- **CDK**：購買或通過開放 API 發放 CDK 時預付服務費；CDK 兌換後的上游開卡、充值、訂閱實付資金由 CDK 所有者承擔。
- GPT 上游訂閱金額不是固定美元價。先調用預檢接口取得當前地區、幣種和賬號狀態下的實時報價。


#### 6.18.0 多產品直充：GPT / Claude / Grok

直充不止 GPT。`plans`、`preflight`、`orders` 三個介面都接受 `product` 參數：

| `product` | 產品 | 憑據 | 付款幣種 | 定價方式 |
| --- | --- | --- | --- | --- |
| `gpt`（預設） | ChatGPT | Session / Access Token / 信箱 | PHP | 隨卡 BIN 波動，**以預檢報價為準** |
| `claude` | Claude | `sk-ant-…`（sessionKey） | USD | **恆價**，見下表 |
| `grok` | Grok（x.ai） | grok.com 的 **`sso` cookie** | USD | **恆價**，見下表 |

> **`product` 不傳按 `gpt` 處理**，舊呼叫方無需改動。

**Grok 憑證從哪來（不是帳號密碼，也不是 X 綁定）**

Grok 直充要的是 **grok.com 登入後的 `sso` cookie**，通常是以 `eyJ` 開頭的 JWT。
它**不是** x.ai 帳號密碼、**不是** SuperGrok Heavy 頁上「關聯 X 帳戶領取 Premium+」那一步、
也**不是** ChatGPT Session / Claude `sk-ant-…`。

1. 瀏覽器打開 [https://grok.com](https://grok.com) 並登入。
2. 按 F12 → Application（或「儲存」）→ Cookies → `grok.com`。
3. 複製名為 **`sso`** 的值（不要 `cf_clearance`、不要 `x-userid`）。

下單 / 預檢都這樣傳：

```json
"credential": { "mode": "session", "session": "eyJ..." }
```

也可以把整段含 `sso=` 的 Cookie 貼進 `credential.session`。
Grok 的預檢只校驗登入態、查當前訂閱，**不產預檢票**；建立訂單時仍須帶上這份 `sso`。

**套餐鍵與服務費**（服務費為平台按次收取，與上游訂閱價分開；檔位名對齊 x.ai「管理你的訂閱」個人頁）：

| `product` | `plan` | 官方套餐名 | 上游訂閱價 | API / CDK 服務費 |
| --- | --- | --- | ---: | ---: |
| `claude` | `pro` | Claude Pro | $20 | **2 U** |
| `claude` | `max_5x` | Claude Max 5x | $100 | **8 U** |
| `claude` | `max_20x` | Claude Max 20x | $200 | **10 U** |
| `grok` | `lite_monthly` / `lite_yearly` | SuperGrok Lite | $10 / $100 | **1 U** |
| `grok` | `monthly` / `yearly` | SuperGrok | $30 / $300 | **1 U** |
| `grok` | `plus_monthly` / `plus_yearly` | SuperGrok Plus | $100 / $1,000 | **1 U** |
| `grok` | `heavy_monthly` / `heavy_yearly` | SuperGrok Heavy | $300 / $3,000 | **1 U** |

> **以 `GET /gpt-direct/plans?product=…` 的即時回應為準**：上表是撰寫時的設定，
> 管理員隨時可改價或停用某一檔。Claude / Grok 的價讀 `registry[].checkout_amount_minor`
> （美元分），不要只看 GPT 那套 `plans.expectedAmountMinor`，也不用等預檢報價。

**每個產品都有獨立的全局開關**，關閉時下單回傳 `DIRECT_PRODUCT_DISABLED`。
接入前請先用 `GET /gpt-direct/plans?product=…` 確認該產品有檔位回傳。
（撰寫時 GPT / Claude / Grok 三者均已開啟。）

#### ★四個必須避開的坑★

以下都是真實行為，接入前務必看完——它們不報錯，但會讓你拿到錯的結果。

**坑 1：`product` 拼錯不會報錯，會被當成 `gpt` 下單。**

創建訂單時未知的 `product` 會被**靜默歸一化成 `gpt`**。也就是說把 `claude` 寫成
`cluade`，你會開出一張 **GPT 訂單並真實扣款**，而不是收到參數錯誤。

> ★務必在你自己這邊先校驗 `product`★，只允許 `gpt` / `claude` / `grok` 三個字面量。
> 不要依賴服務端擋你。

同理，`GET /gpt-direct/plans?product=<未知值>` 會回傳**全部三個產品的所有檔位**
（且 `registry` 為空陣列），而不是報錯。看到 `plans` 裡同時出現
`plus` 和 `claude_pro`、`grok_monthly`，說明你的 `product` 沒生效。

**坑 2：`plans` 的鍵和 `registry[].key` 不一樣——只有 GPT 一致。**

| `product` | `plans` 裡的鍵 | `registry[].key` | 下單時 `plan` 該傳哪個 |
| --- | --- | --- | --- |
| `gpt` | `plus` | `plus` | `plus`（兩者相同） |
| `claude` | `claude_pro` | `pro` | **`pro`** |
| `grok` | `grok_lite_monthly` | `lite_monthly` | **`lite_monthly`** |

Claude / Grok 的 `plans` 鍵帶產品前綴，`registry` 裡不帶。
**下單的 `plan` 取 `registry[].key`**（即不帶前綴的那個）。
按 GPT 摸出的規律直接用 `plans` 的鍵去下 Claude，會得到「未知套餐」。

**坑 3：Claude / Grok 是美元恆價，不要套 GPT 的菲律賓預設。**

網站 Claude 固定走 `US/USD`。開放 API 不傳地區時，GPT 預設 `PH/PHP`。
把這套預設套到 Claude / Grok 上，服務端會拿美元恆價去對菲律賓比索，回傳
「定價檔缺失或幣種不符」——看起來像「沒有配置價格」，價其實已配好。

- 下單必須帶 `"product": "claude"`（或 `grok`），並加 `?product=…` 取檔位。
- `plan` 用 `registry[].key`（如 `max_5x`），不要用 `plans` 裡帶前綴的鍵。
- 價讀 `registry[].checkout_amount_minor`（美元分）。
- **請顯式傳** `"payment_country":"US","payment_currency":"USD"`。
  新版本不傳也會落到美區；舊版本不傳會落到菲律賓並報沒配價。
- `GET /gpt-direct/plans` 的 `payment_regions` 主要給商城前端；GPT 不傳地區仍預設 `PH/PHP`。

**坑 4：`enabled` / `purchasable` / 在不在 `registry` 是三個開關，不是同一個狀態。**

沒有 `purchased` 欄位。文件和回應裡的名字是 **`purchasable`**。
`plans[<key>].enabled === true` 只表示 ACC 認這個檔，**不等於現在能買、能發碼**。

| 欄位 | 誰管 | 含義 |
| --- | --- | --- |
| 該檔是否出現在 `registry` | 卡台上架 | 沒上架的檔不會出現在 `registry` |
| `registry[].purchasable` | 卡台註冊表 | **現在能不能買**。`false` = 仍展示，灰成「即將上線」，下單/發 CDK 會被拒 |
| `plans[<acc_plan_key>].enabled` | ACC 執行層 | 兌換/履約時上游認不認。對 `plans` 要用 `registry[].acc_plan_key`（Claude / Grok 帶前綴） |

**能賣當且僅當三條同時成立：**

```text
registry 裡有這一檔
AND registry[].purchasable === true
AND plans[registry[].acc_plan_key].enabled === true
```

`enabled=true` 且 `purchasable=false` = 上架了、ACC 也開著，卡台還沒放賣。不要發碼。

```bash
# 取 Claude 檔位
curl -H "X-API-Key: sk_你的金鑰" \
  "https://zovocard.com/openapi/v1/gpt-direct/plans?product=claude"

# 下一筆 Claude Max 5x
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/orders \
  -H "X-API-Key: sk_你的金鑰" -H "Content-Type: application/json" \
  -d '{
    "product": "claude",
    "plan": "max_5x",
    "payment_country": "US",
    "payment_currency": "USD",
    "card_id": 12345,
    "credential": {"mode": "session", "session": "sk-ant-sid01-..."},
    "client_request_id": "your-unique-id"
  }'
```

```bash
# 取 Grok 檔位（plan 用 registry[].key，例如 monthly = SuperGrok 月付）
curl -H "X-API-Key: sk_你的金鑰" \
  "https://zovocard.com/openapi/v1/gpt-direct/plans?product=grok"

# 下一筆 SuperGrok 月付。session 填 grok.com 的 sso cookie
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/orders \
  -H "X-API-Key: sk_你的金鑰" -H "Content-Type: application/json" \
  -d '{
    "product": "grok",
    "plan": "monthly",
    "payment_country": "US",
    "payment_currency": "USD",
    "card_id": 12345,
    "credential": {"mode": "session", "session": "eyJ..."},
    "client_request_id": "your-unique-id"
  }'
```

#### 6.18.0.1 自帶卡（`raw_card`）——★僅開放 API 可用★

用你自己的卡直接支付，跳過平台卡的選取、餘額判斷與注資（卡自帶餘額）。

> **商城介面不提供這個功能**，只能透過開放 API 使用。

| 參數 | 類型 | 說明 |
| --- | --- | --- |
| `raw_card` | string | `卡號\|月\|年\|CVV`，例 `4111111111111111\|12\|30\|123`。年可寫兩位或四位 |

- `card_id` 与 `raw_card` **二選一**：必須給其一，且**不能同時提供**（同時給會回傳
  `INVALID_REQUEST`——「刷哪張卡」不允許有歧義）。
- 需要平台開啟該能力，否則回傳 `403 EXTERNAL_CARD_DISABLED`。
- **按次收服務費**，從卡台餘額扣：GPT `0.3 U` / Claude `10 U`（以平台設定為準）。
  某產品費率為 0 表示**該產品不开放自帶卡**，不是免費。
- 自帶卡的訂單不注資、不佔用單卡直充次數額度；卡上餘額不足由上游直接拒付。

```bash
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/orders \
  -H "X-API-Key: sk_你的金鑰" -H "Content-Type: application/json" \
  -d '{
    "product": "gpt",
    "plan": "plus",
    "raw_card": "4111111111111111|12|30|123",
    "credential": {"mode": "session", "session": "你的_SESSION"},
    "client_request_id": "your-unique-id"
  }'
```

#### 6.18.1 權限與服務費

開放 API 還需要有效的 `app_secret`。賬戶必須是正常的主賬戶、沒有卡片操作限制；除管理員外，還必須已有一筆已入賬充值，並滿足以下任一條件：

1. 管理員手工開通 GPT 直充；
2. 管理員賬戶；
3. 超級 SVIP、至尊 SVIP 或傳奇 SVIP。

VIP 達標後自動開放，不需要管理員再寫入 `gpt_direct_enabled`。子賬戶不能使用 GPT 直充。服務或上游不可用時，權限仍可顯示，但寫操作會返回相應錯誤。

| `plan` | 套餐 | API / CDK 服務費 | 上游訂閱價格 |
| --- | --- | ---: | --- |
| `go` | Go（ChatGPT Go）| **0.15 U** | 以預檢報價為準 |
| `plus` | Plus | **0.15 U** | 以預檢報價為準 |
| `pro_5x` | Pro 5x | **0.15 U** | 以預檢報價為準 |
| `pro_20x` | Pro 20x | **0.15 U** | 以預檢報價為準 |
| `pro_20x_renew` | Pro 20x 續費（綁卡檔）| **0.15 U** | **本單不扣款**，見下方說明 |
| `credit250` | Codex 點數 250 | **0.15 U** | ₱565（按實時匯率折美元，約 $8–$13） |
| `credit500` | Codex 點數 500 | **0.15 U** | ₱1,130（約 $16–$26） |
| `credit1000` | Codex 點數 1000 | **0.15 U** | ₱2,260（約 $32–$51） |
| `credit2500` | Codex 點數 2500 | **0.15 U** | ₱5,650（約 $81–$130） |
| `credit5000` | Codex 點數 5000 | **0.15 U** | ₱11,300（約 $161–$260） |
| `credit25000` | Codex 點數 25000 | **0.15 U** | ₱56,500（約 $807–$1,300） |

> **Pro 20x 續費（`pro_20x_renew`）——綁卡檔，與其它檔語義完全不同**
> - 它賣的**不是開通**，而是「給已在 Pro 20x 的賬號換一張有錢的卡並設為預設卡」。
>   OpenAI 到點會自己從預設卡扣款，**本單不產生任何上游扣款**，
>   所以沒有預檢報價、也不做付款金額校驗；平台只收 API / CDK 服務費。
> - **目標賬號必須當前就在 Pro 20x**。不滿足會在**預檢階段**直接拒絕、不建單：
>   - `GPT_RENEW_TARGET_NOT_PRO` —— 賬號不在 Pro 20x（Pro 5x / Plus / Free 等）
>   - `GPT_RENEW_SUBSCRIPTION_EXPIRED` —— 曾是 Pro 20x 但訂閱已到期，屬於「重新訂閱」
>
>   這兩個都是**確定性失敗**：檔位不對，換張卡重試也沒用，請直接改走新開/升級檔。
> - 開出的卡會被該續費單**獨佔**，不接受其它訂單複用。
> - 訂單成功只代表「卡已綁定並設為預設」，**不代表已經續上**——真正的扣款發生在
>   OpenAI 自己的續費週期裡。請確保卡上餘額足夠屆時支付 Pro 帳單。
> - **不涉及國家定價**：續費本單不扣款，`payment_country` / `payment_currency` 對它無意義；付款地區只影響新開、升級與點數檔的報價。

> **Codex 點數（credit250 / credit500 / credit1000 / credit2500 / credit5000 / credit25000）**
> - 點數是訂閱的★加購項★：目標賬號必須已有生效中的 Plus/Pro 订阅，否则下单会被拒
>   （`GPT_CREDIT_REQUIRES_SUBSCRIPTION`）——免費號買了也用不了。
> - 買點數★不改變賬號套餐★，同一賬號可以反覆購買，不會被「套餐仍在有效期内」拦下。
> - 付款幣種是 PHP、卡上按 USD 結算。卡台按**當日真實匯率**（每日抓取，來源 frankfurter）
>   下浮一檔安全邊際（預設 12%）給卡注資，向上取整，以避免匯率波動導致拒付；
>   多注的部分隨刪卡退回。例：匯率 61.70 時按 54.29 折算，₱565 實付約 $9.16、注資 $10.41。
>   PHP 需在當日內跌超過該邊際才可能不夠付。
> - 點數訂單不佔用單卡直充次數額度。

除上游訂閱實付（以預檢 `quoted_amount` 報價為準）之外，平台**按次收取 API / CDK 服務費**。
服務費在價格配置裡以**美元最小單位**返回（`serviceFeeUsdMinor`），例如 `15` 表示 `$0.15`。

> ★不要把上表的數字寫死到程式碼裡★：管理員隨時可改價或停用某一檔。
> **一律以 `GET /gpt-direct/plans` 的實時返回為準**。服務費讀 `registry[].service_fee_usd_minor`
> （或 GPT 的 `plans[<key>].serviceFeeUsdMinor`）。能不能買見上面**坑 4**，
> 不要只看 `plans[<key>].enabled`，也沒有 `purchased` 欄位。
> 價格配置版本（`version`）變化後，創建訂單應重新預檢並帶最新 `pricing_version`。

#### 6.18.2 獲取套餐和實時配置

`GET /gpt-direct/plans`（可選 `?product=gpt|claude|grok`）

**響應**（節選。判斷能不能買見坑 4）
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "version": 214,
    "plans": {
      "plus": {
        "key": "plus",
        "label": "Plus",
        "currency": "PHP",
        "enabled": true,
        "serviceFeeUsdMinor": 15,
        "expectedAmountMinor": 98214,
        "minAmountMinor": 90000,
        "maxAmountMinor": 110000
      }
    },
    "registry": [
      {
        "key": "plus",
        "product": "gpt",
        "acc_plan_key": "plus",
        "label": "Plus",
        "funding": "bin_snapshot",
        "checkout_currency": "PHP",
        "checkout_amount_minor": 98214,
        "service_fee_usd_minor": 15,
        "purchasable": true,
        "is_credit": false,
        "requires_active_subscription": false,
        "tier": 1,
        "sort_order": 20
      }
    ]
  }
}
```

沒有 `registry[].purchased`。可購買欄位是 **`purchasable`**。
`plans` 裡可能同時有 `enabled=true` 的檔，但對應 `registry` 行 `purchasable=false`——那一檔現在不能買。

`expectedAmountMinor`、`minAmountMinor`、`maxAmountMinor` 是配置參考範圍，不是訂單最終扣款；訂單以預檢返回的 `quotes[plan]` 為準。

**支援的付款地區（`payment_regions`）**

直充訂單可在下單時指定付款地區/幣種；CDK 在發碼時保存地區，預檢與兌換沿用，不在兌換時臨時改區。不傳時 GPT 預設 `PH/PHP`。目前開放 5 個地區：

| 地區 | 幣種 | 定價口徑 |
| --- | --- | --- |
| `PH` 菲律賓（預設） | PHP | 主通道，走卡段成交價快照 |
| `US` 美國 | USD | 按國家定價 $20 / $100 / $200 |
| `JP` 日本 | JPY | 按國家定價 ¥3,000 / ¥16,800 / ¥30,000（含稅） |
| `CL` 智利 | CLP | 走 USD 預設價（$20 / $100 / $200） |
| `EG` 埃及 | EGP | 走 USD 預設價（$20 / $100 / $200） |

> ★以介面下發為準★：可用地區清單即時讀 `GET /gpt-direct/plans` 的 `payment_regions`，別在自己這邊寫死；下單/發碼傳 `payment_country` + `payment_currency`（Claude / Grok 為美元恆價，見坑 3）。

#### 6.18.3 憑據預檢

`POST /gpt-direct/preflight`

預檢會驗證 GPT 憑據、查詢當前套餐和支付方式，並取得實時報價。預檢憑證有效期 **10 分鐘且只能消費一次**。

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| `credential.mode` | string | 是 | `session` / `access_token` / `mailbox` |
| `credential.session` | string | session 模式 | GPT：`__Secure-next-auth.session-token` 或含 `sessionToken` 的 JSON；Claude：`sk-ant-…`；**Grok：grok.com 的 `sso` cookie**（`eyJ…` 或含 `sso=` 的整段 Cookie） |
| `credential.accessToken` | string | access_token 模式 | OpenAI JWT Access Token（`Authorization: Bearer` 所用）；壽命通常短於 Session |
| `credential.email` | string | mailbox 模式 | 郵箱地址 |
| `credential.password` | string | mailbox 模式 | 郵箱密碼 |
| `payment_country` | string | 否 | GPT 預設 `PH`；Claude / Grok 請傳 `US` |
| `payment_currency` | string | 否 | GPT 預設 `PHP`；Claude / Grok 請傳 `USD` |

```bash
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/preflight \
  -H "X-API-Key: sk_你的密鑰" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": {"mode":"session","session":"你的_SESSION"},
    "payment_country":"PH",
    "payment_currency":"PHP"
  }'
```

Access Token 示例：

```bash
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/preflight \
  -H "X-API-Key: sk_你的密鑰" \
  -H "Content-Type: application/json" \
  -d '{
    "credential": {"mode":"access_token","accessToken":"eyJhbGciOi..."},
    "payment_country":"PH",
    "payment_currency":"PHP"
  }'
```

**響應關鍵字段**
```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "email": "user@example.com",
    "currentPlan": "free",
    "credentialMode": "session",
    "preflight_token": "一次性預檢令牌",
    "preflight_expires_at": "2026-06-04T02:10:00Z",
    "payment_country": "PH",
    "payment_currency": "PHP",
    "quotes": {
      "plus": {
        "country": "PH",
        "currency": "PHP",
        "plan": "plus",
        "amountMinor": 98214,
        "amountMajor": 982.14,
        "minorUnitExponent": 2,
        "fetchedAt": 1780538400000
      }
    },
    "quote_error": ""
  }
}
```

`quote_error` 非空時不要創建對應套餐訂單。Session / Access Token / 郵箱密碼等敏感憑據不會在訂單響應中返回；服務端只保存短期預檢令牌（ACC 托管執行憑據）。

無 CDK 的 API 訂單會按當前套餐 **服務費** 從餘額凍結，成功結算、失敗釋放；使用 CDK 兌換時服務費已在購碼時預付。

#### 6.18.4 創建直充訂單

`POST /gpt-direct/orders`

建議先預檢，再創建訂單。開放 API 當前使用手動選擇的 `card_id`，該卡必須屬於當前 API 用戶並處於可用狀態。

**請求參數**

| 參數 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| `card_id` | number | 是 | 用於支付的名下卡 ID |
| `product` | string | 否 | `gpt`（預設）/ `claude` / `grok`。Claude / Grok 必須顯式傳 |
| `plan` | string | 是 | GPT：`go` / `plus` / …；Claude / Grok 用 `registry[].key`，見坑 2 |
| `payment_country` | string | 否 | GPT 預設 `PH`；Claude / Grok 請傳 `US`，見坑 3 |
| `payment_currency` | string | 否 | GPT 預設 `PHP`；Claude / Grok 請傳 `USD` |
| `credential` | object | 是 | 與預檢相同的憑據結構；使用預檢令牌時以服務端預檢結果為準 |
| `preflight_token` | string | 否 | 預檢返回的一次性令牌；推薦使用 |
| `client_request_id` | string | 是 | 商戶側訂單號，當前用戶下最長 80 字符；重試必須保持不變 |
| `pricing_version` | integer | 否 | 預檢時看到的價格版本；不一致會要求刷新 |
| `no_auto_card_switch` | boolean | 否 | 預設 `false`：支付被拒/失敗後平台會**自動換一張卡有限次重試**（與卡台直沖/CDK 一致）。設為 `true` 則**失敗即失敗、不自動換卡**（適合自己管控用哪張卡的自動化調用方）；此時訂單會直接進入失敗態，你可自行改單/換卡後重發 |

```bash
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/orders \
  -H "X-API-Key: sk_你的密鑰" \
  -H "Idempotency-Key: merchant-order-20260718-001" \
  -H "Content-Type: application/json" \
  -d '{
    "card_id":123,
    "plan":"plus",
    "credential":{"mode":"access_token","accessToken":"eyJhbGciOi..."},
    "preflight_token":"一次性預檢令牌",
    "client_request_id":"merchant-order-20260718-001",
    "pricing_version":2
  }'
```

`credential` 也可繼續使用 `{"mode":"session","session":"..."}`；若已帶 `preflight_token`，以預檢結果為準。

成功返回 HTTP `202`，訂單先進入安全隊列，不能把 `202` 當作已開通：

```json
{ "code": 0, "msg": "accepted", "data": {
  "id": 981,
  "plan": "plus",
  "source": "api",
  "status": "queued",
  "service_fee_minor": 100,
  "service_fee_status": "held",
  "pricing_version": 2,
  "quoted_amount_minor": 98214,
  "currency": "PHP",
  "client_request_id": "merchant-order-20260718-001"
} }
```

同一用戶的 `client_request_id` 會返回原訂單，不能用於創建第二筆訂單。建議同時攜帶唯一 `Idempotency-Key`，網絡重試時兩個編號都保持不變。

#### 6.18.5 查詢、詳情與取消

- `GET /gpt-direct/orders?page=1&page_size=20`：只返回當前 API 用戶創建的訂單；默認 20 條，最大 100 條。響應為 `data.list` 和 `data.total`。
- `GET /gpt-direct/orders/{id}`：返回 `data.order`、`data.events` 和可選的 `data.card_usage`。憑據、支付意圖和代理憑據不會返回。
- `POST /gpt-direct/orders/{id}/cancel`：只能取消尚未開始支付的 `queued`、`awaiting_card` 或 `funding_pending` 訂單。支付已提交、已扣款或進入人工對賬後返回 HTTP `409`，不要重復創建訂單。
- `POST /gpt-direct/orders/{id}/cancel-renewal`：取消該訂單對應 GPT 賬號的**自動續費**。權益保留到本期到期日，到期後不再扣款——它取消的是下一期扣款，不是本次已付的套餐，也不退款。

  取消動作由上游賬號服務執行，平台不直連 ChatGPT。**下單成功時上游就會自動嘗試取消一次**，所以多數訂單拿到手已經是 `renewal_status=success`，無需再調本接口；本接口用於那次嘗試未確認（`pending`）或需要複查（`warning`）時重試。

  | `renewal_status` | 含義 | 調本接口的結果 |
  |---|---|---|
  | `success` | 已取消 | 冪等返回當前狀態，不會重複請求上游 |
  | `pending` | 上游已受理未確認 | 重試取消 |
  | `warning` | 上游嘗試過、需複查 | 重試取消 |
  | `not_requested` | 上游未被要求取消（如未支付成功） | HTTP `409` |

  訂單未到 `completed` 時返回 HTTP `409`。只能操作本 API 用戶經 API 下的單，其它訂單一律 HTTP `404`。

#### 6.18.5a 用卡規則、剩餘次數與卡池調度

預設仍是平台寫死規則：**失敗/取消也計次數**，普通檔每卡 5 次、Pro 20x 每卡 3 次，自動選卡餘額優先，支付失敗自動換卡最多 2 次。合作方可按產品（`gpt` / `claude` / `grok`）改規則，也可自行清掉失敗占用的次數。

次數計數器按**卡**共享。規則只決定「這一單按哪個產品的口徑解釋這張卡」。

- `GET /gpt-direct/card-rules`：不傳 `product` 回三份（缺行補預設，`is_default=true`）
- `PUT /gpt-direct/card-rules`：`product`、`count_failures`、`light_max_uses`（0=不限）、`pro20_max_uses`、`select_mode`（`default` / `lowest_usage` / `newest`）、`auto_switch_on_fail`、`max_auto_switches`
- `GET /gpt-direct/cards/{id}/usage?product=gpt`：該卡剩餘次數；`remaining=-1` 表示不限
- `POST /gpt-direct/cards/reset-usage`：`{ "card_ids": [101], "scope": "failed" }`；`card_ids` 空=全部；`scope=all` 再清成功次數。不動在途占用
- `GET /gpt-direct/card-pool/schedule?product=gpt&plan=plus&card_mode=auto_existing`：不落單的自動選卡預覽
- `GET /gpt-direct/card-products`：卡頭是否啟動（`usable`）
- `PUT /gpt-direct/card-rules` 可加 `select_priority`（卡頭優先級）與 `strict_select`（不回落平台級聯）

商城對等路徑在 `/api/v1/gpt/direct/`。

#### 6.18.6 發放和查詢 CDK

以下相對路徑以 `/openapi/v1` 為 Base，由接入方伺服器使用 API Key 呼叫。發碼時收服務費，兌換時的卡片注資與訂閱實付由 CDK 所有者承擔。費率讀取 `GET /gpt-direct/plans`，不要寫死為免費。

`POST /gpt-direct/cdks`：

```json
{"plan":"plus","count":2,"funding_confirmed":true,"payment_country":"PH"}
```

| 欄位 | 要求與含義 |
| --- | --- |
| `plan` | 必填。`go`、`plus`、`pro_5x`、`pro_20x`、`pro_20x_renew`、`credit250`、`credit500`、`credit1000`、`credit2500`、`credit5000`、`credit25000`，並須仍可購買 |
| `count` | 預設1，建議1–200；單次最多 **200** 張 |
| `funding_confirmed` | 必須為 `true`，確認由所有者承擔兌換資金 |
| `payment_country` | 可選 PH / US / JP / CL / EG；依 `/gpt-direct/plans` 的 `payment_regions`，省略預設 PH |
| `payment_currency` | 可省略，由平台按國家補齊；明確提供時須相符 |
| `preferred_issuer` / `preferred_segment_type` / `preferred_segment_key` | 購碼展示快照；**不綁定卡片，也不決定日後兌換選卡** |

- 同一事務內整批成功或整批回滾。成功回傳 `data.requested`、`data.issued[]`；每項含 `id/code/code_prefix/plan/fee_amount_minor`（USD 分）。
- 發碼帶唯一 `Idempotency-Key`，重試保持原鍵和參數；結果不明先查庫存，不換鍵重買。
- 保存完整 `code`；所有者清單也回傳資料庫保留的明文，極早期僅存雜湊的碼可能沒有。不能用前綴兌換，也不要限制碼長度；新舊碼均相容。
- 發碼請求**沒有**可寫 `owner_funding_cap_minor` 參數，新購碼不設硬上限；舊碼按現有授權執行，`preview.funding_cap_minor=0` 表示未設上限。
- `pro_20x_renew` 僅為符合資格的 Pro 20x 帳號綁續費卡，本次不扣訂閱款，未來帳單仍需卡內足夠餘額。點數檔需已有有效 Plus/Pro；仍須通過預檢。

| 方法與路徑 | 用法與回應 |
| --- | --- |
| `GET /gpt-direct/cdks` | `page/page_size`（預設20、最多200）、`status/plan/q`；回傳 `data.list/total`。可見本 Key 發碼與官網購入未綁 App 的碼 |
| `POST /gpt-direct/cdks/{id}/disable` | 停用自己帳戶的未使用碼；回傳 `data.id/status`，不退發碼費 |
| `POST /gpt-direct/cdks/{id}/enable` | 恢復自己帳戶可啟用的碼為 `unused` |
| `POST /gpt-direct/cdks/batch-disable` | `{"ids":[101,102]}`，最多100；回傳 `data.disabled/failed` ID 陣列及計數 |
| `POST /gpt-direct/cdks/batch-enable` | 同上，成功陣列及計數為 `enabled/enabled_count` |

批量啟停逐項處理，200不代表全部成功，須檢查 `failed`。清單/訂單按 Key/App 可見範圍過濾，啟停按帳戶歸屬校驗，同帳戶不同 Key 不是啟停權限隔離邊界。

CDK 狀態：`unused` 可兌換，`reserved` 已關聯處理中訂單，`consumed` 已消耗，`review` 保留待核驗，`frozen` 暫時凍結，`disabled` 已停用。

#### 6.18.7 CDK 訂單對賬

- `GET /gpt-direct/cdk-orders?page=1&page_size=20` 返回當前 Key 可見 CDK 的兌換訂單（本 Key 簽發 + 官網購入未綁定 App）。
- `GET /gpt-direct/cdk-orders/{order_id}` 返回單筆訂單與公開時間線 `events`。

列表支持 `updated_after`（RFC3339）、`status`、`cdk_id`、`order_id`、`page` 和 `page_size`（最大 100）。結果包括 CDK 前綴/狀態、脫敏賬號與卡號、金額、服務費/資金狀態、訂單階段和時間；不返回憑據、代理、內部排障詳情、完整 CDK 或完整卡號。同一用戶的其他 API Key 簽發 CDK 的訂單不可見。官網購入碼的兌換 Webhook 不會推到後建的 Key，請用本接口對賬。

#### 6.18.8 CDK 兌換（公開兌換接口，獨立於 API Key）

Base 為 `https://zovocard.com/api/v1/cdk`，無需 API Key，憑完整有效碼獲取短期會話。四步須保持相同出口 IP 與 `X-Redemption-Device`；未傳時使用 `User-Agent`。

公開接口按 IP 限流：preview 每分鐘30次、redeem 20次、result 60次；預檢另有限制，遇429須退避。

**非同步受理（2026-09-24）**：訂單、CDK預留、預檢消耗與查詢會話一起提交後即回應，由背景繼續選卡、注資和付款。沿用 HTTP 200、`code=0`、`data.id`，不要求改接202。新單初始為 `status=awaiting_card`、`stage=cdk_accepted`；`card_id` 可能省略/為0，請持續查詢結果。重啟後會由持久化訂單恢復。

重試須保留原 `redemption_token/preflight_token/client_request_id` 及選卡參數；相同請求回傳原訂單，改參數回傳409 `IDEMPOTENCY_CONFLICT`。受理不等於付款成功，背景發現餘額/授權不足仍會在狀態和事件說明。

```json
{"code":0,"msg":"ok","data":{"id":456,"status":"awaiting_card","stage":"cdk_accepted","async_card_selection":true}}
```


| 步驟 | 方法與完整路徑 | 請求與結果 |
| --- | --- | --- |
| 1. 預覽 | `POST /api/v1/cdk/preview` | `{"code":"<完整CDK>"}` → `data.redemption_token/expires_at/plan/plan_flow/funding_cap_minor`，會話15分鐘有效 |
| 2. 預檢 | `POST /api/v1/cdk/preflight` | `redemption_token` + `credential` → `data.preflight_token/preflight_expires_at`、資格與報價；採用碼內付款地區 |
| 3. 兌換 | `POST /api/v1/cdk/redeem` | `redemption_token/preflight_token/client_request_id` → `data.id/status/stage` |
| 4. 查結果 | `GET /api/v1/cdk/result?token=<redemption_token>` | `data.order/events`，須符合原 IP/設備綁定 |

```json
{"redemption_token":"<preview token>","credential":{"mode":"session","session":"<customer session>"}}
```

第三步不重傳憑據。可選 `exclude_card_ids` 排除本單選卡、`strict_card_preference=true` 不追加平台後備卡段、`no_auto_card_switch=true` 禁止本單自動換卡。自動選卡依卡主**當前用卡規則**，未配置則依平台預設，不讀購碼 `preferred_*` 快照。

指定既有卡須使用 §6.18.8a；公開入口收到非零 `card_id` 回傳403 `CARD_SELECTION_REQUIRES_API_KEY`。

`queued/awaiting_card/funding_pending/dispatching/running/requires_action/pending/plus_paid` 及各種 review 均須繼續查詢，不重新付款。`completed` 表示該套餐流程完成，續費綁卡不代表下期帳單已扣。`declined/failed_precharge/cancelled` 雖為訂單終態，仍須核對 `cdk_status/funding_hold_status/service_fee_status` 與事件，**不能直接推斷已退錢或釋放碼**；僅 `unused` 可再次兌換，有扣款證據或結果不明可能保留 `review`。

公開結果包含 `data.order.card_id/card_last_four`。後四位可能為空且不唯一，不應用它判斷訂單成敗。API Key 與完整 Session 不得放在網頁原始碼或日誌。

#### 6.18.8a 兌換時指定既有銀行卡（所有者 API）

`POST /openapi/v1/gpt-direct/cdks/redeem` 以卡主 API Key 鑑權，兌換已購 CDK，不重收 CDK 服務費。購碼、發碼、持碼均不綁卡。

所有者兌換未傳 `card_id` 時同樣非同步受理；明確指定卡仍先校驗並鎖定該卡，不會改為自動選卡。

接入方須由**服務端**先呼叫公開 `/api/v1/cdk/preview`、`/preflight`，再以相同出口 IP 與 `X-Redemption-Device` 呼叫此接口，勿把 API Key 放入終端網頁。僅可兌換本賬戶、本 Key 簽發或官網購入未綁 App 的碼。

```json
{"redemption_token":"<preview>","preflight_token":"<preflight>","client_request_id":"redeem-example-001","card_id":123}
```

- `card_id` 是可選的本地卡 ID；省略/0 維持自動選卡。傳入即鎖定，失敗不自動換卡、不另開卡，重試也不能更換。
- 卡須屬於 CDK 所有者、ACTIVE、未過期，無在途充值/退款/銷卡，並符合用量、冷卻、歸檔、渠道與續費獨占限制。
- 卡餘額不足時僅按原注資規則補入指定卡，受所有者資金授權、CDK 上限與可用餘額約束；不退其它卡籌款。
- 同卡再次主動充值不等於自動續費，訂閱資格及 `pro_20x_renew` 獨占限制不變。選卡校驗失敗不消耗 CDK/預檢；結果不確定時維持對賬。
- 幂等使用必填 `client_request_id`；CDK、卡、預檢令牌或選卡參數變更回 `409 IDEMPOTENCY_CONFLICT`。此接口不使用通用 `Idempotency-Key` 回應快取。
- `exclude_card_ids`、`strict_card_preference`、`no_auto_card_switch` 可選；指定卡與排除清單衝突會拒絕，不能設 false 解除指定卡鎖定。

返回 `data.order`（`order_id`、`card_id`、`card_last_four`、狀態與資金狀態）及 `data.events`；亦可用 §6.18.7 查詢。公開 `/api/v1/cdk/result` 新增 `order.card_id` / `order.card_last_four`，不洩漏完整卡號/CVV。

明確錯誤包括 `CARD_NOT_FOUND`、`CARD_NOT_PAYABLE`、`CARD_EXPIRED`、`CARD_DETAILS_UNAVAILABLE`、`CARD_FUNDING_BUSY`、`CARD_IN_USE`、`CARD_CAPACITY_REACHED`、`CARD_CAPACITY_PRO20`、`CARD_RENEWAL_BOUND`、`CARD_COOLING_DOWN`、`CARD_PLAN_UNSUPPORTED`、`CARD_SELECTION_LOCKED`。公開 `/api/v1/cdk/redeem` 不接受指定卡，回 `403 CARD_SELECTION_REQUIRES_API_KEY`。

**參數與呼叫順序**

`redemption_token/preflight_token/client_request_id` 必填，請求編號為 1–80 位元組（建議使用 ASCII）。`card_id` 是正整數的**本地卡 ID**，不是完整卡號、後四位或上游字串 ID；可保存上次 `cdk-orders/{order_id}` 的 `order.card_id`，或查自己卡片清單。

以下由服務端依序呼叫，把前一步的令牌帶入下一步，出口 IP/設備保持一致。購買、生成 CDK 不傳 `card_id`。

```bash
# Server-side only. Set these variables privately; never ship the key to a browser.
ZOVOCARD_ORIGIN='https://sandbox.zovocard.com'
# Production: https://zovocard.com with a separate production key.
curl --fail-with-body "$ZOVOCARD_ORIGIN/api/v1/cdk/preview" \
  -H 'Content-Type: application/json' -H 'X-Redemption-Device: merchant-session-001' \
  -d '{"code":"<full CDK>"}'

curl --fail-with-body "$ZOVOCARD_ORIGIN/api/v1/cdk/preflight" \
  -H 'Content-Type: application/json' -H 'X-Redemption-Device: merchant-session-001' \
  -d '{"redemption_token":"<preview token>","credential":{"mode":"session","session":"<customer session>"}}'

curl --fail-with-body "$ZOVOCARD_ORIGIN/openapi/v1/gpt-direct/cdks/redeem" \
  -H "X-API-Key: $ZOVOCARD_API_KEY" -H 'Content-Type: application/json' \
  -H 'X-Redemption-Device: merchant-session-001' \
  -d '{"redemption_token":"<preview token>","preflight_token":"<preflight token>","client_request_id":"merchant-redeem-001","card_id":123}'

# Use data.order.order_id returned above.
curl --fail-with-body "$ZOVOCARD_ORIGIN/openapi/v1/gpt-direct/cdk-orders/456" \
  -H "X-API-Key: $ZOVOCARD_API_KEY"
```

成功回應示例（僅主要欄位；HTTP 200 是建單成功，**尚非充值完成**）：

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "order": {
      "order_id": 456,
      "client_request_id": "merchant-redeem-001",
      "cdk_id": 78,
      "cdk_status": "reserved",
      "status": "queued",
      "card_id": 123,
      "card_last_four": "1234"
    },
    "events": []
  }
}
```

保存 `data.order.order_id/card_id/card_last_four`，待終態確認實際用卡；不回傳完整 PAN/CVV。卡不能用時不得自行改為 `card_id=0` 或普通直充單。

| HTTP / error_code | 處理方式 |
| --- | --- |
| 409 `IDEMPOTENCY_CONFLICT` | 原編號已綁其它參數，先查原單，不用新編號繞過不明結果 |
| 403 `CDK_NOT_ACCESSIBLE` | 核對所有者、Key/App |
| 400 `REDEMPTION_SESSION_INVALID` | 核對有效期、出口 IP、設備；先確認舊單未建立，再重新預覽/預檢 |
| 400 `CDK_UNAVAILABLE` | 已使用或兌換中，查原單 |
| 400 `CARD_*` / `REDEMPTION_REJECTED` | 按原因處理卡狀態、額度、冷卻或資金授權，不自動換卡 |

平台繼續校驗鑑權/IP白名單/直充及子帳戶權限。接入方也須核實自己客戶的身份和可復用卡，不可信任瀏覽器任意傳入的卡 ID。舊服務404時先確認平台版本，不回退自動選卡。

#### 6.18.8b CDK 專案復用的卡台接口

以下均在卡台 `/openapi/v1`，使用卡主 API Key。模板後台路由不是卡台開放 API。

| 方法與路徑 | 用途 |
| --- | --- |
| `GET /gpt-direct/plans` | 即時費率、可售套餐、付款地區（§6.18.2） |
| `GET /balance` | 查 `spendable_balance` 可用餘額 |
| `GET /gpt-direct/cdks` | 按 `status/plan/q` 同步可見庫存碼（§6.18.6） |
| `GET /gpt-direct/cdk-orders` | 按 `updated_after/status/cdk_id/order_id` 對帳，讀完分頁（§6.18.7） |
| `GET /gpt-direct/cdk-orders/{order_id}` | 實際用卡、資金狀態與公開時間線 |
| `GET /gpt-direct/card-products` | `enabled/suspended/channel_open/auto_open_allowed/usable` 卡頭狀態 |
| `GET /gpt-direct/card-rules` | 讀取當前帳戶規則，可帶 `product=gpt` |
| `PUT /gpt-direct/card-rules` | 保存帳戶規則，影響後續相關訂單，不僅單張碼（§6.18.5a） |
| `GET /gpt-direct/cards/{id}/usage` | 復用前查看用量/佔用/冷卻；查詢不預留卡，兌換時再校驗 |

#### 6.18.9 GPT 直充錯誤處理

除通用 HTTP 錯誤外，調用方應按 `error_code` 編程處理：

- `GPT_DIRECT_ACCESS_DENIED` / `RECHARGE_REQUIRED`：賬戶尚未滿足權限、充值或風控條件。
- `GPT_SESSION_INVALID`、`SESSION_REQUIRED`：重新提交憑據預檢。
- `GPT_PLAN_ALREADY_ACTIVE`：目標賬號套餐仍有效，不要重試扣款。
- `INSUFFICIENT_BALANCE`：API 服務費餘額不足。
- `GPT_DIRECT_ORDER_REJECTED`：讀取訂單或事件後決定是否重試；不要盲目新建訂單。

---

---

### 6.19 取消自動續費（任意賬號，只需 Session）

`POST /gpt-direct/cancel-renewal`

**不帶訂單號**，只憑完整 Session 取消**任意** GPT 賬號的自動續費。

上面那個接口只能操作你經本 API 下的單，所以存量賬號（早期在網頁端下的單、從別處拿到的號）沒法通過 API 關續費。本接口把判據從「訂單歸屬」換成「持有 Session」。

```bash
curl -X POST https://zovocard.com/openapi/v1/gpt-direct/cancel-renewal \
  -H "X-API-Key: sk_你的密鑰" \
  -H "Content-Type: application/json" \
  -d '{"session":"<完整 Session JSON 或 sessionToken>"}'
```

```json
{
  "code": 0,
  "msg": "ok",
  "data": {
    "renewal_status": "success",
    "renewal_message": "自動續費已取消",
    "email": "user@example.com",
    "will_renew": false,
    "active_until": 1760000000,
    "plan_type": "chatgptplusplan"
  }
}
```

必須是含 `sessionToken` 的**完整 Session**，純 Access Token 不再受支持。

| `renewal_status` | 含義 | 你該怎麼做 |
|---|---|---|
| `success` | 已取消並二次確認 `will_renew=false` | 完成 |
| `pending` | 取消請求已發出但未能二次確認 | 稍後複查；**不要立即重試** |

本接口不依賴訂單，因此沒有訂單可回寫狀態，結果請自行記錄。

常見訂單狀態：

| 狀態 | 含義 |
| --- | --- |
| `queued` / `running` | 已接收，正在檢查憑據或處理支付 |
| `pending` / `requires_action` | 上游仍在等待或需要後續對賬 |
| `completed` | 已確認目標套餐開通 |
| `declined` | 上游拒付，未必代表服務費已釋放前的最終狀態 |
| `failed_precharge` | 扣款前失敗；若未發生扣款，服務費會釋放 |
| `cancelled` | 在支付開始前取消 |

---


### 6.20 自託管 CDK 專案的公開查詢接口

依 `zovo_card_cdk_auto` **v1.4.22** 原始碼核對。以下路由位於你自己的 CDK 網站，如 `https://cdk.example.com`，**不屬於**卡台 `/openapi/v1` 或卡台 `/api/v1/cdk/*`。

模板目前 `/api/v1/public/cdk/redeem` 仍轉發卡台公開兌換，尚未接所有者指定卡入口。僅加 `card_id` 不會生效，須由接入方伺服器按 §6.18.8a 適配。下列公開查詢不需卡台 API Key，但完整碼/Session 是敏感存取憑據。

| 方法與路徑 | 用途 |
| --- | --- |
| `GET /api/v1/public/cdk/plans` | 頂層 `source/plans/registry/version`；`cardplatform_live` 為即時，`docs_default/docs_default_fallback` 只供參考 |
| `POST /api/v1/public/cdk/preview` | `{code}`，轉發卡台並保存本站碼與令牌綁定 |
| `POST /api/v1/public/cdk/preflight` | 同卡台預檢，供本站保存Session綁定 |
| `POST /api/v1/public/cdk/redeem` | 同公開兌換，本站可能附加排除卡與選卡策略 |
| `GET /api/v1/public/cdk/result` | `?token=`，保持原 `X-Redemption-Device` |
| `GET /api/v1/public/cdk/result-by-code` | `?code=`，相容 `cdk_code`；以本站綁定恢復進度，無綁定404，仍受 IP/設備限制 |
| `GET /api/v1/lookup/cdk` | `?code=`，相容 `cdk_code`；本站狀態摘要，找不到404 |
| `POST /api/v1/lookup/cdk/batch` | `{codes:[...]}` 或 `{text:"多行卡密"}`，去重後最多100；頂層 `total/max/results` |
| `POST /api/v1/public/billing/check` | `{cdk_code}` 或 `{token_input}` / `{session}`；頂層 `summary/invoices/auth_source`，可能有 `invoice_url` |

單碼摘要：`cdk_code/status/used/can_resubmit/message`，可選 `account_email/plan/used_at/notes`。常見 `unused/used/failed/disabled/expired/processing/unknown` 是本站摘要，**不是扣款對帳證據**；不能僅憑 `used=false` 重付。批量200也要逐項看結果，資金以卡台訂單與事件為準。

`result-by-code` 保留卡台封裝，頂層另加 `cdk_code/redemption_token/has_session_binding`，有時附帳單鏈接；須檢查HTTP及原 `code`，不能看到令牌便判成功。帳單憑碼查詢需本站有效Session綁定，郵箱模式或別站兌換的碼不保證可查；無綁定404、輸入/憑據錯誤400。回應可能含完整郵箱、令牌，只交予有權持有碼或Session的使用者，不記公開日誌。

範例（`CDK_SITE` 為站主自己的域名）：

```bash
curl --get "$CDK_SITE/api/v1/public/cdk/result-by-code" \
  -H 'X-Redemption-Device: merchant-session-001' --data-urlencode 'code=<full CDK>'
curl "$CDK_SITE/api/v1/lookup/cdk/batch" -H 'Content-Type: application/json' \
  -d '{"codes":["<full CDK A>","<full CDK B>"]}'
curl "$CDK_SITE/api/v1/public/billing/check" -H 'Content-Type: application/json' \
  -d '{"cdk_code":"<full CDK>"}'
```

兌換代理沿用 `code/msg/data`；查詢及帳單通常是頂層物件，本站錯誤一般為 `{error:...}`，不要一律只讀 `data`。`/api/v1/admin/*` 需要本站管理員JWT，不接受卡台API Key作為管理員憑據，不向終端使用者開放。

## 7. 回調 Webhook（卡事件、GPT 直充與 CDK）

配置回調地址後，平台會主動 **POST** 卡事件；按 API Key 訂閱還可接收 GPT 直充全終態、階段進度、公開時間線和 CDK 生命週期事件。

> 卡交易/操作使用 `event`；GPT / CDK 事件使用 `type`。API Key 可訂閱 `gpt_direct.*`、`cdk.*` 或具體事件。上游提供開卡、充值、凍結/解凍、刪卡或卡餘額退款結果時，平台會在能安全解析卡主時轉發操作回調。
>
> 當前運行中的發卡渠道為渠道 1 和渠道 3；渠道 2 的 Webhook 已退役。兩條渠道的事件已在平台側**歸一化**為下面同一套結構，接收端無需區分渠道。

### 7.1 配置回調地址

「開發者」頁保留通用回調，並在每條 API 密鑰的 Webhook 操作中提供獨立配置。白標 CDK 應使用 Key 級配置：

```http
GET /api/v1/dev/keys/{key_id}/webhook
PUT /api/v1/dev/keys/{key_id}/webhook

{
  "webhook_url": "https://merchant.example/webhooks/cardplatform",
  "webhook_events": ["gpt_direct.*", "cdk.*"]
}
```

- 地址必須是有效的 **https** URL（不接受 `http`、`localhost`、內網 / 私有 IP；長度 ≤ 256）。
- **首次**保存非空回調地址時，系統自動生成該 Key 獨立的簽名密鑰 `webhook_secret`（形如 `whsec_xxxx…`），在開發者頁可見，用於校驗請求來源（見 7.7）。
- 清空回調地址即停止推送。

### 7.2 請求

| 項 | 值 |
| --- | --- |
| 方法 | `POST` |
| Content-Type | `application/json` |
| 請求頭 | `X-Signature`：請求體的 HMAC-SHA256 簽名（見 7.7）|
| 期望響應 | HTTP `2xx`；其它狀態碼或超時（約 10s）視為失敗並重試 |

**請求體（JSON）**
```json
{
  "event": "card_transaction",
  "auth_id": "1059958172",
  "vm_card_id": "card55202606040031562947331",
  "card_id": 123,
  "card_number": "5378721234568264",
  "auth_time": "2026-07-20 10:20:30",
  "auth_amount": 9.99,
  "auth_currency": "USD",
  "settle_amount": 9.99,
  "settle_currency": "USD",
  "merchant_name": "GOOGLE *CHATGPT 766999 GB",
  "merchant": "GOOGLE *CHATGPT 766999 GB",
  "merchant_location": "United Kingdom",
  "merchant_region": "England",
  "merchant_country": "GB",
  "description": "GOOGLE *CHATGPT 766999 GB",
  "failed_reason": "",
  "bill_status": "Settled",
  "merchant_amount": 9.99,
  "merchant_currency": "USD",
  "create_time": "2026-07-20 10:20:31",
  "status": "COMPLETE",
  "type": "Settlement",
  "source": "webhook",
  "channel": "three"
}
```

### 7.3 事件字段

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| `event` | string | 事件類型，目前固定為 `card_transaction`（卡交易）|
| `auth_id` | string | 上游交易 / 授權唯一號，**冪等鍵**（見 7.7）|
| `vm_card_id` | string | 卡在系統內的上游卡標識 |
| `card_id` | number | 卡在平台的數字 ID（對應 `GET /cards/{id}`）|
| `card_number` | string | **完整卡號**（請按需妥善保管，勿明文落日誌）|
| `auth_time` | string | 平台歸一化的授權時間；渠道 1 保持上游格式，渠道 3 將上游 UTC `billTime` 轉為北京時間（`YYYY-MM-DD HH:mm:ss`） |
| `auth_amount` | number | 授權金額 |
| `auth_currency` | string | 授權/交易幣種 |
| `settle_amount` | number | 結算金額（USD，正數）。清算 / 退款為實際金額；授權與拒付可能為 `0` |
| `settle_currency` | string | 結算幣種 |
| `merchant_name` | string | 商戶名稱或商戶描述原文；描述中的驗證碼不會被單獨提取 |
| `merchant` | string | `merchant_name` 的兼容別名 |
| `merchant_location` | string | 商戶地區/位置；上游沒有提供時為空字符串 |
| `merchant_region` / `merchant_country` | string | 上游提供的地區/國家別名；沒有時為空字符串 |
| `description` | string | 交易描述原文；不要依賴平台另行生成驗證碼字段 |
| `failed_reason` | string | 上游失敗原因；沒有時為空字符串 |
| `bill_status` | string | 上游賬單狀態原值；實時回調通常是文本，渠道 3 REST 補賬也可能是數字代碼字符串（如 `"99"`） |
| `merchant_amount` / `merchant_currency` | number / string | 上游或渠道歸一化的商戶本幣金額和幣種；沒有時為 `0` / 空字符串 |
| `create_time` | string | 上游創建時間；渠道 3 保留上游 UTC 原文，渠道 1 按上游回調提供；沒有時為空字符串 |
| `status` | string | 交易狀態：`PENDING` / `COMPLETE` / `DECLINED`（見 [§5 數據字典](#5-數據字典)）|
| `type` | string | 交易類型：`Authorization` / `Settlement` / `Refund` / `Reversal`（見 [§5 數據字典](#5-數據字典)）|
| `source` | string | `webhook` 為實時上游回調，`reconciled` 為單卡對賬補錄 |
| `channel` | string | 渠道內部標記：渠道 1 為 `one`，渠道 3 為 `three`；渠道 2 Webhook 已退役。**附加字段**，可忽略 |

> 舊字段全部保留。交易接收端應按 `event + auth_id + type + status` 冪等；同一授權從 `PENDING` 變為 `COMPLETE` 時不能只按 `auth_id` 丟棄後續狀態。
>
> 渠道 3 的驗證碼如果位於上游 `merchantDescription` / `merchantName` 中，會原樣進入歸一化事件的 `description` / `merchant_name`；平台不會生成獨立的 `verification_code` 或 `otp` 字段。

### 7.4 卡操作事件

開卡、充值、凍結、解凍、刪卡和卡餘額退款等操作如果有上游狀態回調，平台發送獨立的 `card_operation` 事件。無法安全歸類的上游通用卡狀態事件使用 `operation = status_change`。商戶退款仍使用 `card_transaction`，`type = Refund`。

```json
{
  "event": "card_operation",
  "operation": "recharge",
  "operation_id": "R202607200001",
  "event_type": "CardRechargeStatusChanged",
  "bill_number": "R202607200001",
  "vm_card_id": "three-card-202607200001",
  "card_id": 123,
  "card_number": "5378721234568264",
  "status": "COMPLETE",
  "success": true,
  "operate_status": "Success",
  "operate_status_value": 1,
  "bill_status": "Completed",
  "failed_reason": "",
  "amount": 10,
  "currency": "USD",
  "balance": 20,
  "balance_after": 30,
  "card_status": "Activated",
  "card_status_value": 1,
  "occurred_at": "2026-07-20 10:20:30",
  "source": "webhook",
  "channel": "three"
}
```

| 字段 | 類型 | 說明 |
| --- | --- | --- |
| `event` | string | 固定為 `card_operation` |
| `operation` | string | `open_card` / `recharge` / `freeze` / `unfreeze` / `delete` / `refund` / `status_change` |
| `operation_id` | string | 上游操作單號；刪卡無單號時使用卡號 |
| `event_type` | string | 上游操作事件名 |
| `bill_number` | string | 上游賬單/操作單號，沒有時為空 |
| `vm_card_id` / `card_id` / `card_number` | string / number / string | 能解析到本地卡時返回；`vm_card_id` 是本地上游卡標識，不是完整卡號；開卡回調可能暫時沒有 `card_id` |
| `card_number_masked` | string | 上游脫敏卡號（如有） |
| `status` | string | `PENDING` / `COMPLETE` / `FAILED` |
| `success` | boolean | 上游是否明確成功 |
| `operate_status` / `operate_status_value` | string / number | 上游操作狀態原值 |
| `bill_status` | string | 上游賬單狀態原值 |
| `failed_reason` | string | 上游失敗原因 |
| `amount` / `currency` | number / string | 本次操作金額和幣種 |
| `event_amount` / `settled_amount` / `refund_amount` / `revoked_amount` | number | 上游各階段原始金額 |
| `balance` / `balance_after` | number | 上游回調中的操作前後餘額 |
| `card_status` / `card_status_value` | string / number | 上游卡狀態原值 |
| `occurred_at` | string | 上游事件時間 |
| `source` / `channel` | string | 回調來源和渠道；當前實時來源為 `webhook` |

> 開卡回調可能早於本地卡記錄創建。無法通過操作單號或卡號安全找到卡主時只保留內部記錄，不會把事件發送給錯誤用戶；待卡主可解析後才發送。

### 7.5 GPT 直充與 CDK 生命週期事件

| 訂閱值 | 觸發 |
| --- | --- |
| `gpt_direct.completed` | 首次進入 `completed` |
| `gpt_direct.failed` | 首次進入 `declined` 或 `failed_precharge` |
| `gpt_direct.cancelled` | 首次進入 `cancelled` |
| `gpt_direct.progress` | `status` 或 `stage` 發生變化；單訂單最多 30 條 |
| `gpt_direct.event` | 公開訂單時間線新增事件 |
| `gpt_direct.*` | 上述全部 GPT 事件 |
| `cdk.reserved` / `cdk.consumed` / `cdk.released` | CDK 預留、成功消耗或失敗釋放 |
| `cdk.frozen` / `cdk.unfrozen` / `cdk.disabled` | CDK 管理狀態變化 |
| `cdk.*` | 上述全部 CDK 事件 |

終態事件示例：

```json
{
  "type": "gpt_direct.completed",
  "event_id": "gpt_direct.completed:981",
  "order_id": 981,
  "client_request_id": "merchant-order-20260718-001",
  "source": "cdk",
  "app_id": "app_xxx",
  "plan": "plus",
  "status": "completed",
  "stage": "completed",
  "message": "開通成功",
  "cdk_id": 123,
  "code_prefix": "ZC-XXXX-XXXX",
  "cdk_status": "consumed",
  "account_email": "us***@example.com",
  "card_id": 456,
  "card_number": "537872****1234",
  "card_last_four": "1234",
  "final_amount_minor": 98214,
  "quoted_amount_minor": 98000,
  "currency": "PHP",
  "service_fee_minor": 100,
  "service_fee_status": "settled",
  "funding_state": "card_ready",
  "funding_hold_status": "settled",
  "funding_card_amount_minor": 10000,
  "created_at": "2026-07-28T10:00:00Z",
  "updated_at": "2026-07-28T10:05:00Z",
  "completed_at": 1784397600,
  "occurred_at": "2026-07-28T10:05:00.123Z"
}
```

失敗事件保留真實 `status`，並通過 `cdk_status`、`service_fee_status`、`funding_hold_status` 表示釋放結果。進度事件額外提供 `from_status` / `from_stage`；時間線事件額外提供公開的 `timeline_event_id`、`category`、`step`、`public_code`、`public_message`、`to_status` 和 `payment_fact`。

CDK 生命週期事件提供 `event_id`、`app_id`、`cdk_id`、`code_prefix`、`cdk_status`、`plan`、`order_id`、`from_status`、`to_status`、費用和時間。完整 CDK、完整卡號、憑據和 API Key 永不返回。事件嚴格發送給簽發該 CDK 的 Key / `app_id`。

### 7.6 事件場景對照（type × status）

| type | status | 含義 | 對卡餘額 |
| --- | --- | --- | --- |
| `Authorization` | `PENDING` | 消費授權成功，預扣（凍結）額度，尚未清算 | 佔用可用額度 |
| `Settlement` | `COMPLETE` | 清算完成，真實扣款落地 | 扣減 |
| 任意 | `DECLINED` | 交易被拒（餘額不足 / 風控等）| 不變 |
| `Refund` | `COMPLETE` / `PENDING` | 消費退款，金額退回卡內 | 增加 |
| `Reversal` | `COMPLETE` | 授權撤銷（預授權取消，非真實退款）| 釋放佔用 |

> 一筆消費通常先收到 `Authorization` / `PENDING`，清算後再收到 `Settlement` / `COMPLETE`，兩條 `auth_id` 相同——按 7.7 冪等去重。

### 7.7 簽名校驗（務必校驗）

`X-Signature` = `HMAC-SHA256(webhook_secret, 原始請求體字節)` 的**十六進制小寫**串。必須用**原始 body** 計算（不要先反序列化再重新序列化，否則字節不一致導致校驗失敗），並用常量時間比較：

```js
const crypto = require('crypto')
// 用 raw body（Buffer），不要用已解析的對象
app.post('/webhook', express.raw({ type: '*/*' }), (req, res) => {
  const expect = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.body).digest('hex')
  const got = req.headers['x-signature'] || ''
  const ok = expect.length === got.length &&
    crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(got))
  if (!ok) return res.status(401).end()

  const evt = JSON.parse(req.body.toString('utf8'))
  // TODO: 卡事件按業務字段、GPT/CDK 事件按 evt.event_id 冪等處理
  res.status(200).end()
})
```

### 7.8 投遞、重試與冪等

- **異步投遞**，不阻塞上游事件處理；每次投遞超時約 10 秒。
- 卡事件、手續費和資金變動回調：未收到 `2xx` 會**退避重試**，最多共 3 次（間隔約 `2s`、`4s` 遞增）；仍失敗則丟棄該次投遞（不會無限重投）。
- GPT 直充 / CDK 回調（`gpt_direct.*`、`cdk.*`）為持久化投遞：未收到 `2xx` 按約 `10s`、`30s`、`2min`、`10min`、`30min` 退避重試，最多共 6 次；同一接收地址連續失敗時暫停投遞、最長每 5 分鐘探測一次（暫停期間不計入重試次數），恢復後按原順序補發；超過 24 小時仍未送達的放棄。各接收地址相互隔離，同一地址按事件先後逐條投遞，某個地址不可用不會延遲其他地址的回調。
- 回調是通知而不是唯一事實來源：長時間未收到回調時，請用訂單查詢接口核對最終狀態，不要據此判定訂單失敗或重復下單。
- 接收端應**盡快返回 2xx**（重活丟隊列異步做），否則易觸發重試與重復投遞。
- **冪等**：交易事件請以 `event + auth_id + type + status` 去重；操作事件請以 `event + operation + operation_id + status` 去重；GPT / CDK 事件請以穩定的 `event_id` 去重，切勿重復入賬或發貨。
- `source = reconciled` 表示單卡對賬補錄，不代表新的上游扣款；接收端應按同一業務號合併或更新記錄。
- 平台側拒付、撤銷、退款、小額消費和受限商戶費用也按業務號冪等；同一事件回放不會再次收費或重復執行凍結/刪卡處置。
- **不保證嚴格順序**：極端情況下 `COMPLETE` 可能早於 `PENDING` 到達，請以最終態為準。

### 7.9 安全建議

- 只接受 `https`；先校驗 `X-Signature` 再處理，拒絕簽名不符的請求。
- `card_number` 是完整卡號，按合規要求存儲 / 傳輸，切勿寫入明文日誌或轉發到不可信下游。
- GPT / CDK payload 中的卡號與賬號均已脫敏，且不包含完整 CDK、憑據、API Key 或代理信息。
- 平台僅從公網地址回源，回調地址不可指向內網 / 本機。
- 平台不會把商戶描述中的驗證碼單獨提取成站內通知或獨立回調字段；需要時請讀取 `merchant_name` / `description`。

### 7.10 資金變動事件（`balance_change`）與手續費事件（`card_fee`）

**所有會動錢的操作都有回調。** `balance_change` 直接掛在帳本（餘額流水）上，
因此覆蓋是完整的：開卡扣費、卡充值、各類退款、各種手續費、內部轉帳、人工調整、
鏈上充值到帳、直充下單與釋放等等，**新增任何資金操作都會自動出現在這條流裡**，
不需要我們再單獨接線、也不會漏。

#### `balance_change`

```json
{
  "event": "balance_change",
  "balance_log_id": 8812345,
  "type": "decline_fee",
  "amount": -0.30,
  "direction": "debit",
  "currency": "USD",
  "balance_before": 120.00,
  "balance_after": 119.70,
  "remark": "消費失敗手續費 $0.30 卡 4147000000000000（insufficient funds）",
  "ref_id": 44219,
  "card_id": 365712,
  "card_number": "4147000000000000",
  "occurred_at": "2026-08-27 10:15:02"
}
```

| 欄位 | 類型 | 說明 |
|---|---|---|
| `balance_log_id` | number | 帳本行號。**唯一且不變，請按它去重**（投遞是「至少一次」） |
| `type` | string | 流水類型，與「財務明細」頁顯示的口徑一致；見下表 |
| `amount` | number | **保留帳本正負號**：正=入帳，負=扣款。與你在財務明細看到的一致 |
| `direction` | string | `credit`（入帳）/ `debit`（扣款）。與 `amount` 的符號冗餘，便於不想判符號的接入方 |
| `balance_before` / `balance_after` | number | 該筆前後的帳戶餘額，可用於逐筆對帳 |
| `ref_id` | number | 關聯單號（訂單/扣費記錄 id）。內部轉帳時是對方的用戶 id |
| `card_id` / `card_number` | number / string | 僅卡類流水帶；由建卡側結構化寫入，非卡類流水**不出現這兩個欄位** |

常見 `type`（不是封閉枚舉，**收到未知類型請按 `amount` 正負記帳、不要丟棄**）：

| type | 含義 |
|---|---|
| `recharge` | 鏈上充值到帳 |
| `open_card` | 開卡扣費 |
| `card_recharge` | 卡充值扣費 |
| `refund` | 退款入帳（開卡/充值失敗、刪卡退回等） |
| `decline_fee` / `reversal_fee` / `refund_fee` | 消費失敗 / 授權撤銷 / 消費退款手續費 |
| `small_tx_fee` / `low_auth_fee` / `merchant_violation_fee` | 小額消費 / 低額授權 / 受限商戶處理費 |
| `*_fee_refund` | 上述手續費的退還 |
| `card_overdraft` | 卡透支補收 |
| `transfer_in` / `transfer_out` / `transfer_fee` | 內部轉帳 |
| `admin` / `admin_penalty` | 人工調整 / 平台核收扣款 |
| `unfreeze` | 凍結釋放 |
| `gpt_direct_*` | 直充下單、服務費預扣與釋放、CDK 購買 |

#### `card_fee`

手續費扣費的**明細事件**，帶上游授權號，便於把這筆費對到具體那筆消費上：

```json
{
  "event": "card_fee",
  "fee_type": "decline_fee",
  "auth_id": "AUTH-20260827-0001",
  "amount": 0.30,
  "currency": "USD",
  "direction": "debit",
  "remark": "消費失敗手續費 $0.30 卡 4147000000000000",
  "occurred_at": "2026-08-27 10:15:02"
}
```

> `card_fee` 的 `amount` 是**正數**，方向由 `direction` 表達；
> `balance_change` 的 `amount` 則保留帳本符號。兩者刻意不同：前者是「收了多少費」，
> 後者是「帳本這一行是多少」。

#### ★不要重複計帳★

同一筆手續費會**同時**出現在 `balance_change` 和 `card_fee` 裡（消費本身還會有
`card_transaction`）。它們是同一件事的不同視角，不是三筆錢。

- 做**帳務/對帳**：只認 `balance_change`。它掛在帳本上，完整且不重不漏。
- 做**業務提醒/歸因**：用 `card_fee`（帶 `auth_id`，能對到具體消費）
  和 `card_transaction`（消費明細）。

把兩條流都累加進餘額，會得到雙倍甚至三倍的扣款。

#### 投遞語義

- **至少一次**：進程在「已投遞、未落標記」之間重啟會重投。請按 `balance_log_id`
  （或 `card_fee` 的 `auth_id` + `fee_type`）去重。
- 只推送**新產生**的資金變動。功能上線時歷史帳本不會重推 —— 否則會是一場
  幾萬條的回調風暴，而你早就對過那些帳了。
- 未配置回調地址時不推送，也不會積壓：平台照樣會把這些流水標記為已處理。
- 簽名、重試與超時要求同 7.7 / 7.8。

---

## 附錄 A：錯誤碼對照

**一律按 `error_code` 判斷，不要匹配 `msg` 文案**——`msg` 是給人看的說明，會隨版本調整，且始終為簡體。

### A.1 通用（任意接口都可能回傳）

| HTTP | `error_code` | 含義 | 可否重試 |
|---|---|---|---|
| 401 | *（無）* | `缺少 API Key` / `API Key 無效或已禁用` / `賬戶不存在或已禁用` | 否，先修憑據 |
| 403 | *（無）* | `客服賬號不能使用開放 API` | 否 |
| 403 | *（無）* | 該密鑰尚未配置 IP 白名單（新簽發密鑰必須先填伺服器出口 IP）| 否，去後台配 |
| 403 | *（無）* | `當前 IP 不在白名單內` | 否，去後台補 IP |
| 403 | `RECHARGE_REQUIRED` | 賬戶尚無已入賬充值，寫操作被擋（`data.recharge_required=true`）| 否，先充值 |
| 403 | `FORBIDDEN` | 子賬戶被凍結，或缺少該操作的權限 | 否 |
| 429 | *（無）* | `調用過於頻繁，請稍後再試`（默認 100 次/分鐘/密鑰）| 是，指數退避 |
| 400 | `invalid_argument` | 參數錯誤（路徑 id 非法、JSON 綁定失敗等）| 否 |
| 400 | `not_found` | 對象不存在（卡、產品）| 否 |
| 400 | `insufficient_balance` | 餘額不足 / 風險保證金不足 | 否，先充值 |
| 400 | `request_failed` | 業務失敗，具體看 `msg` | 視情況 |
| 400 | `forbidden` | 被風控限制 / 無權操作 | 否 |
| 500 | `internal_error` | 服務端錯誤 | 是，寫操作請帶同一 `Idempotency-Key` |
| 503 | `channel_unavailable` | 渠道熔斷中 | 是，或換 `issuer` |

**冪等相關**

| HTTP | 含義 |
|---|---|
| 400 | `Idempotency-Key 格式錯誤`（允許 `A-Za-z0-9._:-`，1–80 字元）|
| 409 | `相同 Idempotency-Key 的請求仍在處理中，請稍後重試`（服務端最多等 30 秒）|

> 只有 **2xx** 響應會被冪等緩存；失敗不緩存，同一 key 可以再試。

### A.2 開卡 / 卡產品

| HTTP | `error_code` | 含義 |
|---|---|---|
| 403 | `product_exclusive_access_required` | 該卡產品僅向指定用戶開放 |
| 403 | `product_approval_required` | 該卡產品需申請並通過審核 |
| 409 | `product_policy_outdated` | 卡產品規則已更新，需重新確認後申請 |
| 503 | `product_unavailable` | 該卡產品暫停開通 |
| 400 | `request_failed` | 卡產品不存在或已下架 / 卡頭暫停開新卡 / 渠道維護中 / 會員等級不足 / 開卡費配置無效 |
| 400 | `insufficient_balance` | 可用餘額不足（批量開卡會給出「共需 $X，當前可用 $Y」）|
| 400 | `request_failed` | `API 密鑰消費額度不足：剩餘 $X，本次需要 $Y` / 密鑰不存在 / 密鑰已停用 |

> **API 密鑰有獨立的累計消費上限**（與賬戶餘額是兩道閘）。上限用盡時即使賬戶有錢也會被拒。

### A.3 卡操作（充值 / 退款 / 凍結 / 限額 / 刪卡）

| HTTP | 含義 |
|---|---|
| 400 | 卡不存在 / 卡狀態異常 / 卡已註銷 / 刪卡確認中 |
| 400 | 該卡有一筆充值正在確認結果（勿重複充值，系統自動對賬）|
| 400 | 最低充值金額 $X（星鏈卡 / issuer=four）|
| 400 | 退款金額需為有效正數 / 超過卡內可用餘額 / 退款後餘額不得少於 $X |
| 400 | 該卡單筆最低退款 $1.00（渠道 3）|
| 400 | 該卡暫不支援通過接口調整消費限額（**僅 issuer=four 支援**）|
| 400 | 請至少提供一個限額欄位 / 限額數值無效（範圍 0–1e9）|
| 403 | `DELETE_DISABLED`：該賬號的 API 刪卡功能已關閉 |
| 503 | `channel_unavailable`：渠道熔斷 |
| **202** | 退款/刪卡已受理，`data.pending=true`，**輪詢確認，勿重複提交** |

### A.4 直充（GPT / Claude / Grok）

| HTTP | `error_code` | 含義 |
|---|---|---|
| 401 | `ACCOUNT_UNAVAILABLE` | 賬戶不可用（非活躍主賬戶 / 被風控）|
| 403 | `GPT_DIRECT_ACCESS_DENIED` | 未開通直充 API 權限（需管理員開通或達到 SVIP）|
| 403 | `RECHARGE_REQUIRED` | 尚無已入賬充值 |
| 503 | `GPT_DIRECT_UNAVAILABLE` / `GPT_DIRECT_PAUSED` | 直充服務暫不可用 / 已暫停 |
| 400 | `DIRECT_PRODUCT_DISABLED` | 該產品線全局關閉（每個產品獨立開關）|
| 400 | `INVALID_REQUEST` | 參數錯誤；**或未知 `product`**；或 `card_id` 與 `raw_card` 同時提供 |
| 403 | `EXTERNAL_CARD_DISABLED` | 自帶卡（`raw_card`）未開放 |
| 400 | `INSUFFICIENT_BALANCE` | 餘額不足 |
| 400 | `PRECHECK_REJECTED` | 賬號預檢不通過 |
| 400 | `GPT_PLAN_ALREADY_ACTIVE` | 目標賬號該套餐仍在有效期內 |
| 400 | `GPT_PRICE_UNCONFIRMED` | 報價未確認，需重新預檢 |
| 400 | `GPT_SESSION_INVALID` / `CLAUDE_SESSION_INVALID` | 憑據無效 |
| 400 | `GPT_CREDIT_REQUIRES_SUBSCRIPTION` | 買點數要求目標賬號已有生效訂閱 |
| 400 | `GPT_CREDIT_DISABLED` | 點數購買已關閉 |
| 400 | `GPT_RENEW_TARGET_NOT_PRO` | 續費檔要求目標賬號當前就在 Pro 20x。**確定性失敗，重試無用** |
| 400 | `GPT_RENEW_SUBSCRIPTION_EXPIRED` | 續費檔：Pro 20x 訂閱已到期，屬於重新訂閱。**確定性失敗，重試無用** |
| 429 | `GPT_PREFLIGHT_RATE_LIMITED` | 預檢過於頻繁（60 次/分鐘/用戶，120 次/分鐘/IP）|
| 404 | *（無）* | 訂單不存在（或不屬於本密鑰經 API 下的單）|
| 409 | *（無）* | 訂單已開始支付或已開通，無法取消 / 取消續費狀態不允許 |
| **202** | — | 下單已受理（`"msg":"accepted"`），**輪詢到終態才算成功** |

### A.5 CDK

| HTTP | `error_code` | 含義 |
|---|---|---|
| 400 | *（無）* | 必須確認承擔資金（`funding_confirmed` 必填為 `true`）|
| 400 | *（無）* | 單次最多發放 50 張 |
| 400 | *（無）* | 未知套餐（**CDK 目前僅支援 GPT 檔位**）|
| 409 | `CDK_DISABLE_REJECTED` | 只能禁用未使用的 CDK / CDK 不存在 |
| 403 | `API_SCOPE_UNAVAILABLE` | 密鑰作用域不可用 |
| 404 | `ORDER_NOT_FOUND` | CDK 訂單不存在 |

---

## 附錄 B：接入自檢清單

上線前逐項對一遍，這些都是真實踩過的坑：

- [ ] 用 `error_code` 判分支，**沒有**在程式碼裡匹配 `msg` 文案
- [ ] 寫操作都帶了 `Idempotency-Key`，重試用**同一個** key
- [ ] HTTP **202** 當「待定」處理，不重複提交；退款/刪卡/下單都會遇到
- [ ] `POST /gpt-direct/orders` 之後**輪詢訂單狀態到終態**，沒把 202 當成功
- [ ] 直充 `product` 只傳 `gpt` / `claude` / `grok`，**自己先校驗字面量**
- [ ] Claude / Grok 下單的 `plan` 取自 `registry[].key`（不帶產品前綴），不是 `plans` 的鍵
- [ ] Claude / Grok 下單顯式傳 `payment_country=US`、`payment_currency=USD`，價讀 `registry[].checkout_amount_minor`
- [ ] 服務費、檔位、可購買狀態**實時讀 `/gpt-direct/plans`**，沒寫死在程式碼裡
- [ ] 「能不能買」用 `registry` 有該檔 **且** `purchasable===true` **且** `plans[acc_plan_key].enabled===true`，沒有去讀不存在的 `purchased`，也沒有只看 `enabled`
- [ ] 已在後台配好**伺服器出口 IP 白名單**（不是瀏覽器 IP，也不是內網地址）
- [ ] 知道 API 密鑰有**獨立的累計消費上限**，與賬戶餘額是兩道閘
- [ ] Webhook 用**原始 body 位元組**校驗 `X-Signature`，並按 `event_id` / `balance_log_id` 去重
- [ ] 對賬只認 `balance_change`，沒有把 `card_fee` / `card_transaction` 重複累加
- [ ] 卡詳情回傳**完整卡號與 CVV**，日誌裡已脫敏

---

如需協助，請在「開發者」頁聯繫客服或加入開發者群。

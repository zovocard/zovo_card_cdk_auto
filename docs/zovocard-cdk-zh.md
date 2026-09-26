# ZovoCard · CDK 卡密系統接入文檔

更新：2026-09-24。與客戶《開放 API 文檔》CDK 章節同步。通用鑑權、套餐、用卡規則及 Webhook 請見該文檔 §2、§6.18.2、§6.18.5a、§7。

- 所有者 API：`https://zovocard.com/openapi/v1`，服務端使用 `X-API-Key`。
- 公開兌換：`https://zovocard.com/api/v1/cdk`，憑碼/令牌且綁定出口 IP/設備。
- 自託管站：你自己的域名，路徑見 §6.20。三組地址不可混用。
- 沙盒僅用 `https://sandbox.zovocard.com`、沙盒密鑰與測試資料。

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

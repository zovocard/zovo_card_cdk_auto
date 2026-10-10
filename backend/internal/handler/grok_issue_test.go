package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/tuzi/cdk-recharge-system/internal/db"
)

// Grok 发码：拉 Grok 档位表、对卡台显式发 grok_ 前缀档位、地区固定 US。
func TestGrokIssueUsesGrokCatalogueAndPrefixedPlan(t *testing.T) {
	c, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	c.SetMaxOpenConns(1)
	old := db.DB
	db.DB = c
	t.Cleanup(func() { db.DB = old; c.Close() })
	for _, q := range []string{`CREATE TABLE site_settings(key TEXT PRIMARY KEY,value TEXT,updated_at DATETIME)`, `CREATE TABLE cardplatform_cdk_codes(upstream_id INTEGER,code TEXT UNIQUE NOT NULL,code_prefix TEXT,plan TEXT,fee_amount_minor INTEGER,status TEXT,payment_country TEXT,created_at DATETIME)`} {
		if _, err = c.Exec(q); err != nil {
			t.Fatal(err)
		}
	}
	issued := 0
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/openapi/v1/gpt-direct/plans":
			if r.URL.Query().Get("product") != "grok" {
				t.Error("Grok issue fetched another catalogue")
			}
			w.Write([]byte(`{"code":0,"data":{"version":1,"plans":{"grok_monthly":{"enabled":true,"currency":"USD"}},"registry":[{"key":"monthly","label":"SuperGrok"}]}}`))
		case "/openapi/v1/gpt-direct/cdks":
			var b map[string]any
			if err := json.NewDecoder(r.Body).Decode(&b); err != nil {
				t.Error(err)
			}
			if b["plan"] != "grok_monthly" || b["payment_country"] != "US" {
				t.Errorf("wrong Grok issue parameters %v", b)
			}
			issued++
			w.Write([]byte(`{"code":0,"data":{"requested":1,"issued":[{"id":1,"code":"ZC-FAKE-TEST-GROK-CODE","plan":"monthly","payment_country":"US"}]}}`))
		default:
			t.Errorf("unexpected endpoint %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	defer s.Close()
	if e := db.SetSetting("card_api_base", s.URL); e != nil {
		t.Fatal(e)
	}
	if e := db.SetSetting("card_api_key", "fixture-key"); e != nil {
		t.Fatal(e)
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.POST("/issue", CardPlatformIssueCDKs)
	for _, body := range []string{
		`{"plan":"monthly","product":"grok","count":1,"funding_confirmed":true,"payment_country":"PH"}`,
		`{"plan":"grok_monthly","count":1,"funding_confirmed":true}`, // 老前端不传 product：按档位推断
	} {
		req := httptest.NewRequest("POST", "/issue", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != 200 {
			t.Fatalf("Grok issue failed %d %s", w.Code, w.Body.String())
		}
	}
	if issued != 2 {
		t.Fatalf("issued %d", issued)
	}
}

func TestIssueProductKeepsGPTDefault(t *testing.T) {
	cases := map[[2]string]string{
		{"", "plus"}: "gpt", {"", "pro_20x_renew"}: "gpt", {"", "basic_monthly"}: "x",
		{"", "heavy_yearly"}: "grok", {"gpt", "plus"}: "gpt", {"bogus", "plus"}: "gpt",
	}
	for in, want := range cases {
		if got := issueProduct(in[0], in[1]); got != want {
			t.Fatalf("issueProduct(%q,%q)=%s want %s", in[0], in[1], got, want)
		}
	}
}

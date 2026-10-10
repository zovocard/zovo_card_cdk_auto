package cardplatform

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGrokCatalogueIsProductScopedAndUSOnly(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/openapi/v1/gpt-direct/plans" || r.URL.Query().Get("product") != "grok" {
			t.Errorf("wrong product request %s", r.URL.String())
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"code":0,"data":{"version":1,"payment_regions":[{"country":"PH","currency":"PHP"},{"country":"US","currency":"USD"}],"plans":{"grok_monthly":{"enabled":true,"currency":"USD","serviceFeeUsdMinor":20},"grok_heavy_yearly":{"enabled":false,"currency":"USD"}},"registry":[{"key":"monthly","label":"SuperGrok"},{"key":"heavy_yearly","label":"Heavy"},{"key":"plus_monthly","label":"Plus"}]}}`))
	}))
	defer s.Close()
	plans, err := New(Config{SiteBase: s.URL, APIKey: "fixture-key"}).GetPlans(context.Background(), "grok")
	if err != nil {
		t.Fatal(err)
	}
	rows := plans.SellablePlans()
	// heavy_yearly 定价停用、plus_monthly 定价表里没有：都不能卖。
	if len(rows) != 1 || rows[0].Key != "monthly" || rows[0].ServiceFeeUsdMinor != 20 {
		t.Fatalf("bad Grok catalogue %+v", rows)
	}
	if len(plans.PaymentRegions) != 1 || plans.PaymentRegions[0].Country != "US" {
		t.Fatalf("Grok must be US/USD only, got %+v", plans.PaymentRegions)
	}
}

func TestGrokPlansAndCredentials(t *testing.T) {
	for _, p := range []string{"monthly", "yearly", "lite_monthly", "plus_yearly", "heavy_monthly", "grok_heavy_yearly"} {
		if !IsGrokPlan(p) {
			t.Fatal(p)
		}
	}
	for _, p := range []string{"plus", "pro_20x", "premium_monthly", "premium_plus_monthly", "pro_monthly", "pro_plus_monthly"} {
		if IsGrokPlan(p) {
			t.Fatal("cross product plan", p)
		}
	}
	if GrokIssuePlan("monthly") != "grok_monthly" || GrokIssuePlan("grok_monthly") != "grok_monthly" {
		t.Fatal("issue plan prefix")
	}
	if !IsGrokCredential("sso=abc.def") || !IsGrokCredential("sso-rw=x; sso=y") || IsGrokCredential(`{"sessionToken":"x"}`) || IsGrokCredential("abc") {
		t.Fatal("grok credential detection")
	}
}

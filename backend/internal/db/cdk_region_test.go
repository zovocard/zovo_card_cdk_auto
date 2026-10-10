package db

import (
	"database/sql"
	"encoding/json"
	"testing"
)

func TestCDKRegionMigrationAndCache(t *testing.T) {
	conn, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	conn.SetMaxOpenConns(1)
	old := DB
	DB = conn
	t.Cleanup(func() { DB = old; conn.Close() })
	check := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	// Existing installations have no region column. Preserve their data and
	// leave unknown rows NULL until the authoritative current page is read.
	_, err = conn.Exec(`CREATE TABLE cardplatform_cdk_codes(upstream_id INTEGER,code TEXT UNIQUE NOT NULL,code_prefix TEXT,plan TEXT,fee_amount_minor INTEGER,status TEXT,created_at DATETIME)`)
	check(err)
	_, err = conn.Exec(`INSERT INTO cardplatform_cdk_codes VALUES(1,'ZC-SYNTHETIC-OLD-CODE','ZC-SYNTHETIC','plus',15,'unused',CURRENT_TIMESTAMP)`)
	check(err)
	check(migrateCardplatformCDKRegionCol())
	check(migrateCardplatformCDKRegionCol())
	list, _, err := ListCardplatformStoredCDKCodesPage("", "", "", 1, 20)
	check(err)
	if len(list) != 1 || list[0].PaymentCountry != nil || list[0].FeeAmountMinor != 15 {
		t.Fatalf("legacy row changed: %+v", list)
	}
	raw, err := json.Marshal(list[0])
	check(err)
	var wire map[string]any
	check(json.Unmarshal(raw, &wire))
	if wire["payment_country"] != nil {
		t.Fatal("unknown region became default")
	}
	check(UpdateCardplatformCDKRegion(1, " cl "))
	check(SaveCardplatformCDKCode(2, "ZC-SYNTHETIC-JP-CODE", "", "plus", 15, "JP"))
	check(SaveCardplatformCDKCode(3, "ZC-SYNTHETIC-DEFAULT", "", "plus", 15, ""))
	// An older browser's code-cache write must not erase synced metadata.
	check(SaveCardplatformCDKCode(2, "ZC-SYNTHETIC-JP-CODE", "", "plus", 15))
	check(UpdateCardplatformCDKStatus(1, "disabled"))
	list, n, err := ListCardplatformStoredCDKCodesPage("", "", "", 1, 20)
	check(err)
	if n != 3 {
		t.Fatal(n)
	}
	for _, r := range list {
		want := map[int64]string{1: "CL", 2: "JP", 3: ""}[r.UpstreamID]
		if r.PaymentCountry == nil || *r.PaymentCountry != want {
			t.Fatalf("wrong cached region id=%d", r.UpstreamID)
		}
		if r.FeeAmountMinor != 15 {
			t.Fatal("fee changed")
		}
		if r.UpstreamID == 1 && r.Status != "disabled" {
			t.Fatal("status lost")
		}
	}
}

func TestLookupStoredCDKRegionDistinguishesUnknown(t *testing.T) {
	conn, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	conn.SetMaxOpenConns(1)
	old := DB
	DB = conn
	t.Cleanup(func() { DB = old; conn.Close() })
	if _, err := conn.Exec(`CREATE TABLE cardplatform_cdk_codes(upstream_id INTEGER,code TEXT UNIQUE NOT NULL,code_prefix TEXT,plan TEXT,fee_amount_minor INTEGER,status TEXT,payment_country TEXT,created_at DATETIME)`); err != nil {
		t.Fatal(err)
	}
	_, _ = conn.Exec(`INSERT INTO cardplatform_cdk_codes VALUES(1,'ZC-OLD','ZC','plus',15,'unused',NULL,CURRENT_TIMESTAMP)`)
	_, _ = conn.Exec(`INSERT INTO cardplatform_cdk_codes VALUES(2,'ZC-CL','ZC','pro_5x',15,'unused','cl',CURRENT_TIMESTAMP)`)
	_, _ = conn.Exec(`INSERT INTO cardplatform_cdk_codes VALUES(3,'ZC-PH','ZC','plus',15,'unused','',CURRENT_TIMESTAMP)`)
	if c, ok := LookupStoredCDKRegion(1); ok || c != "" {
		t.Fatal("NULL 地区必须是未知，不能当默认区")
	}
	if c, ok := LookupStoredCDKRegion(2); !ok || c != "CL" {
		t.Fatalf("CL 地区读错: %q %v", c, ok)
	}
	if c, ok := LookupStoredCDKRegion(3); !ok || c != "" {
		t.Fatal("空串是明确的默认区")
	}
	if _, ok := LookupStoredCDKRegion(99); ok {
		t.Fatal("没有这行应为未知")
	}
}

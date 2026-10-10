package db

import (
	"database/sql"
	"strings"
)

// Old rows remain NULL until their current page is refreshed from CardPlatform.
// Treating NULL as PH would mislabel old codes issued for another region.
func migrateCardplatformCDKRegionCol() error {
	var n int
	if err := DB.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('cardplatform_cdk_codes') WHERE name='payment_country'`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return nil
	}
	_, err := DB.Exec(`ALTER TABLE cardplatform_cdk_codes ADD COLUMN payment_country TEXT`)
	return err
}

func UpdateCardplatformCDKRegion(upstreamID int64, country string) error {
	return UpdateCardplatformCDKMetadata(upstreamID, "", country)
}

// The existing page refresh updates status and region in one SQLite write.
func UpdateCardplatformCDKMetadata(upstreamID int64, status, country string) error {
	if DB == nil || upstreamID <= 0 {
		return nil
	}
	status = strings.ToLower(strings.TrimSpace(status))
	_, err := DB.Exec(`UPDATE cardplatform_cdk_codes SET payment_country = ?, status = CASE WHEN ? != '' THEN ? ELSE status END WHERE upstream_id = ?`, strings.ToUpper(strings.TrimSpace(country)), status, status, upstreamID)
	return err
}

// LookupStoredCDKRegion 读本站缓存的付款地区。known=false 表示老数据没记过地区（NULL），
// 调用方必须去卡台取权威值，不能把未知当成默认菲律宾。空串+known=true 才是明确的默认区。
func LookupStoredCDKRegion(upstreamID int64) (country string, known bool) {
	if DB == nil || upstreamID <= 0 {
		return "", false
	}
	var v sql.NullString
	if err := DB.QueryRow(`SELECT payment_country FROM cardplatform_cdk_codes WHERE upstream_id = ? ORDER BY created_at DESC LIMIT 1`, upstreamID).Scan(&v); err != nil || !v.Valid {
		return "", false
	}
	return strings.ToUpper(strings.TrimSpace(v.String)), true
}

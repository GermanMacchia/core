package slugutil

import "strings"

// transliterations and Slugify are a faithful port of
// booking-backend/internal/store/sysadmin.go:619-639 (storeSlugify), so the
// slug generated here matches exactly what booking-backend already derives
// client-side from a tenant name today. Keep these in sync if either side
// changes.
var transliterations = strings.NewReplacer(
	"á", "a", "à", "a", "ä", "a", "â", "a", "ã", "a",
	"é", "e", "è", "e", "ë", "e", "ê", "e",
	"í", "i", "ì", "i", "ï", "i", "î", "i",
	"ó", "o", "ò", "o", "ö", "o", "ô", "o", "õ", "o",
	"ú", "u", "ù", "u", "ü", "u", "û", "u",
	"ñ", "n", "ç", "c",
)

func Slugify(s string) string {
	s = strings.ToLower(s)
	s = transliterations.Replace(s)
	s = strings.ReplaceAll(s, " ", "-")
	var sb strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' {
			sb.WriteRune(r)
		}
	}
	return sb.String()
}

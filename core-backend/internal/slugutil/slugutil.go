package slugutil

import (
	"fmt"
	"regexp"
	"strings"
)

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

// Unique returns base, or base suffixed with -2, -3, ... when taken reports it
// as already used. Callers check within their uniqueness scope (per service for
// businesses); a concurrent insert can still race past this check, in
// which case the database UNIQUE constraint rejects it.
func Unique(base string, taken func(slug string) (bool, error)) (string, error) {
	candidate := base
	for n := 2; ; n++ {
		used, err := taken(candidate)
		if err != nil {
			return "", err
		}
		if !used {
			return candidate, nil
		}
		candidate = fmt.Sprintf("%s-%d", base, n)
	}
}

// MaxLen mirrors businesses.slug VARCHAR(100).
const MaxLen = 100

var validSlug = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// Valid reports whether s is an acceptable hand-edited slug: lowercase ASCII
// letters and digits in hyphen-separated groups (no leading, trailing or
// doubled hyphens), at most MaxLen characters.
func Valid(s string) bool {
	return len(s) <= MaxLen && validSlug.MatchString(s)
}

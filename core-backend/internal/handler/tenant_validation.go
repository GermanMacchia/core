package handler

import (
	"errors"
	"net/mail"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/tu-org/core-backend/internal/domain"
)

const maxTenantAddressLen = 500

var (
	phonePattern = regexp.MustCompile(`^\+?[0-9 ()\-]{6,30}$`)

	// cuitPrefixes are the valid type prefixes for Argentine CUIT/CUIL numbers.
	cuitPrefixes = map[string]bool{"20": true, "23": true, "24": true, "27": true, "30": true, "33": true, "34": true}
	cuitWeights  = [10]int{5, 4, 3, 2, 7, 6, 5, 4, 3, 2}
	cuitStripper = strings.NewReplacer("-", "", " ", "", ".", "")
)

// tenantContact groups the optional contact fields shared by create and update
// inputs so both can be normalized and validated the same way.
type tenantContact struct {
	email   *string
	phone   *string
	address *string
	taxID   *string
}

// normalizeTenantContact trims and validates the optional contact fields in
// place, leaving empty values as "". Create maps "" to nil (NULL); update
// keeps "" so the repository clears the stored value.
func normalizeTenantContact(c tenantContact) error {
	fields := []struct {
		ptr      *string
		validate func(string) (string, error)
	}{
		{c.email, validateContactEmail},
		{c.phone, validateContactPhone},
		{c.address, validateAddress},
		{c.taxID, normalizeCUIT},
	}
	for _, f := range fields {
		if f.ptr == nil {
			continue
		}
		v := strings.TrimSpace(*f.ptr)
		if v != "" {
			normalized, err := f.validate(v)
			if err != nil {
				return err
			}
			v = normalized
		}
		*f.ptr = v
	}
	return nil
}

// emptyToNil maps a pointer to an empty string to nil (SQL NULL).
func emptyToNil(s *string) *string {
	if s == nil || *s == "" {
		return nil
	}
	return s
}

func normalizeCreateTenantInput(input *domain.CreateTenantInput) error {
	if err := normalizeTenantContact(tenantContact{
		email:   input.ContactEmail,
		phone:   input.ContactPhone,
		address: input.Address,
		taxID:   input.TaxID,
	}); err != nil {
		return err
	}
	input.ContactEmail = emptyToNil(input.ContactEmail)
	input.ContactPhone = emptyToNil(input.ContactPhone)
	input.Address = emptyToNil(input.Address)
	input.TaxID = emptyToNil(input.TaxID)
	return nil
}

func normalizeUpdateTenantInput(input *domain.UpdateTenantInput) error {
	return normalizeTenantContact(tenantContact{
		email:   input.ContactEmail,
		phone:   input.ContactPhone,
		address: input.Address,
		taxID:   input.TaxID,
	})
}

func validateContactEmail(s string) (string, error) {
	addr, err := mail.ParseAddress(s)
	if err != nil || addr.Address != s {
		return "", errors.New("invalid contact_email")
	}
	return s, nil
}

func validateContactPhone(s string) (string, error) {
	if !phonePattern.MatchString(s) {
		return "", errors.New("invalid contact_phone: only digits, spaces, parentheses, dashes and a leading + are allowed")
	}
	digits := 0
	for _, r := range s {
		if r >= '0' && r <= '9' {
			digits++
		}
	}
	if digits < 6 {
		return "", errors.New("invalid contact_phone: at least 6 digits are required")
	}
	return s, nil
}

func validateAddress(s string) (string, error) {
	if utf8.RuneCountInString(s) > maxTenantAddressLen {
		return "", errors.New("address must be at most 500 characters")
	}
	return s, nil
}

// normalizeCUIT strips separators from an Argentine CUIT/CUIL and validates its
// prefix and mod-11 check digit. It returns the 11-digit canonical form.
func normalizeCUIT(s string) (string, error) {
	invalid := errors.New("invalid CUIT/CUIL")
	digits := cuitStripper.Replace(s)
	if len(digits) != 11 {
		return "", invalid
	}
	for _, r := range digits {
		if r < '0' || r > '9' {
			return "", invalid
		}
	}
	if !cuitPrefixes[digits[:2]] {
		return "", invalid
	}
	sum := 0
	for i, w := range cuitWeights {
		sum += int(digits[i]-'0') * w
	}
	expected := 11 - sum%11
	switch expected {
	case 11:
		expected = 0
	case 10:
		return "", invalid
	}
	if int(digits[10]-'0') != expected {
		return "", invalid
	}
	return digits, nil
}

package handler

import (
	"testing"

	"github.com/tu-org/core-backend/internal/domain"
)

func TestNormalizeCUIT(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    string
		wantErr bool
	}{
		// 2*5+0*4+1*3+2*2+3*7+4*6+5*5+6*4+7*3+8*2 = 148; 148%11 = 5; 11-5 = 6
		{name: "valid plain", in: "20123456786", want: "20123456786"},
		{name: "valid with dashes", in: "20-12345678-6", want: "20123456786"},
		{name: "valid with dots and spaces", in: "20.12345678 6", want: "20123456786"},
		// sum 142; 142%11 = 10; 11-10 = 1
		{name: "valid company prefix 30", in: "30-71234567-1", want: "30712345671"},
		// sum 38; 38%11 = 5; 11-5 = 6
		{name: "valid prefix 27", in: "27-00000000-6", want: "27000000006"},
		// sum 22; 22%11 = 0; 11-0 = 11 -> check digit 0
		{name: "valid check digit zero", in: "20-00000006-0", want: "20000000060"},
		{name: "wrong check digit", in: "20-12345678-9", wantErr: true},
		// sum 12; 12%11 = 1; 11-1 = 10 -> no valid check digit
		{name: "check digit would be 10", in: "20-00000001-0", wantErr: true},
		{name: "invalid prefix", in: "21-12345678-6", wantErr: true},
		{name: "too short", in: "2012345678", wantErr: true},
		{name: "too long", in: "201234567861", wantErr: true},
		{name: "letters", in: "20-1234567A-6", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := normalizeCUIT(tt.in)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("normalizeCUIT(%q) = %q, want error", tt.in, got)
				}
				return
			}
			if err != nil {
				t.Fatalf("normalizeCUIT(%q) unexpected error: %v", tt.in, err)
			}
			if got != tt.want {
				t.Errorf("normalizeCUIT(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestValidateContactEmail(t *testing.T) {
	tests := []struct {
		in      string
		wantErr bool
	}{
		{in: "admin@acme.com"},
		{in: "first.last+tag@sub.acme.com.ar"},
		{in: "not-an-email", wantErr: true},
		{in: "Admin <admin@acme.com>", wantErr: true},
		{in: "admin@", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			_, err := validateContactEmail(tt.in)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateContactEmail(%q) err = %v, wantErr %v", tt.in, err, tt.wantErr)
			}
		})
	}
}

func TestValidateContactPhone(t *testing.T) {
	tests := []struct {
		in      string
		wantErr bool
	}{
		{in: "+54 11 4555-1234"},
		{in: "(011) 4555-1234"},
		{in: "123456"},
		{in: "12345", wantErr: true},
		{in: "+() -- ()", wantErr: true},
		{in: "11 4555 1234 ext", wantErr: true},
		{in: "54+11", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			_, err := validateContactPhone(tt.in)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateContactPhone(%q) err = %v, wantErr %v", tt.in, err, tt.wantErr)
			}
		})
	}
}

func strPtr(s string) *string { return &s }

func TestNormalizeCreateTenantInput(t *testing.T) {
	input := domain.CreateTenantInput{
		Name:         "Acme",
		ContactEmail: strPtr("  admin@acme.com "),
		ContactPhone: strPtr("   "),
		TaxID:        strPtr("20-12345678-6"),
	}
	if err := normalizeCreateTenantInput(&input); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if input.ContactEmail == nil || *input.ContactEmail != "admin@acme.com" {
		t.Errorf("ContactEmail = %v, want trimmed email", input.ContactEmail)
	}
	if input.ContactPhone != nil {
		t.Errorf("ContactPhone = %q, want nil for blank input", *input.ContactPhone)
	}
	if input.Address != nil {
		t.Errorf("Address = %q, want nil when absent", *input.Address)
	}
	if input.TaxID == nil || *input.TaxID != "20123456786" {
		t.Errorf("TaxID = %v, want canonical digits", input.TaxID)
	}
}

func TestNormalizeUpdateTenantInputKeepsEmptyToClear(t *testing.T) {
	input := domain.UpdateTenantInput{ContactPhone: strPtr("  ")}
	if err := normalizeUpdateTenantInput(&input); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if input.ContactPhone == nil || *input.ContactPhone != "" {
		t.Errorf("ContactPhone = %v, want empty string to clear", input.ContactPhone)
	}
}

func TestValidateAddressLength(t *testing.T) {
	long := make([]rune, maxTenantAddressLen+1)
	for i := range long {
		long[i] = 'á'
	}
	if _, err := validateAddress(string(long)); err == nil {
		t.Error("expected error for address over the limit")
	}
	if _, err := validateAddress(string(long[:maxTenantAddressLen])); err != nil {
		t.Errorf("unexpected error at the limit: %v", err)
	}
}

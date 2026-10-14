package slugutil

import (
	"errors"
	"strings"
	"testing"
)

func TestUnique(t *testing.T) {
	tests := []struct {
		name  string
		base  string
		taken map[string]bool
		want  string
	}{
		{name: "free base", base: "peluqueria-juan", taken: map[string]bool{}, want: "peluqueria-juan"},
		{name: "base taken", base: "peluqueria-juan", taken: map[string]bool{"peluqueria-juan": true}, want: "peluqueria-juan-2"},
		{
			name:  "several taken",
			base:  "peluqueria-juan",
			taken: map[string]bool{"peluqueria-juan": true, "peluqueria-juan-2": true},
			want:  "peluqueria-juan-3",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Unique(tt.base, func(s string) (bool, error) { return tt.taken[s], nil })
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tt.want {
				t.Errorf("Unique() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestUniquePropagatesError(t *testing.T) {
	wantErr := errors.New("db down")
	if _, err := Unique("x", func(string) (bool, error) { return false, wantErr }); !errors.Is(err, wantErr) {
		t.Errorf("Unique() error = %v, want %v", err, wantErr)
	}
}

func TestValid(t *testing.T) {
	tests := []struct {
		slug string
		want bool
	}{
		{"peluqueria-juan", true},
		{"juan2", true},
		{"a", true},
		{"", false},
		{"Peluqueria", false},
		{"-juan", false},
		{"juan-", false},
		{"juan--co", false},
		{"juan co", false},
		{"peluquería", false},
		{strings.Repeat("a", MaxLen), true},
		{strings.Repeat("a", MaxLen+1), false},
	}
	for _, tt := range tests {
		if got := Valid(tt.slug); got != tt.want {
			t.Errorf("Valid(%q) = %v, want %v", tt.slug, got, tt.want)
		}
	}
}

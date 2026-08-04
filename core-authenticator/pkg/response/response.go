package response

import (
	"encoding/json"
	"net/http"
)

type envelope struct {
	Data  any    `json:"data,omitempty"`
	Error string `json:"error,omitempty"`
}

func JSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Data: data})
}

func Error(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(envelope{Error: msg})
}

func BadRequest(w http.ResponseWriter, msg string) { Error(w, http.StatusBadRequest, msg) }
func Unauthorized(w http.ResponseWriter)           { Error(w, http.StatusUnauthorized, "unauthorized") }
func InternalError(w http.ResponseWriter) {
	Error(w, http.StatusInternalServerError, "internal server error")
}

// Package api exposes local-only synthetic rules over a bounded HTTP contract.
package api

import (
	"encoding/json"
	"errors"
	"github.com/DhanapalKulanthaivel23/addressrail-ai/rail-engine/internal/rails"
	"io"
	"net/http"
	"runtime"
	"strings"
	"sync"
)

const limitSingle int64 = 65536
const limitBatch int64 = 524288

func response(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func errorResponse(w http.ResponseWriter, status int, msg string) {
	response(w, status, map[string]string{"error": msg})
}
func decode(w http.ResponseWriter, r *http.Request, size int64, v any) bool {
	if r.Method != "POST" {
		w.Header().Set("Allow", "POST")
		errorResponse(w, 405, "Method not allowed.")
		return false
	}
	if r.Header.Get("Origin") != "" {
		errorResponse(w, 403, "Browser-origin requests are not permitted.")
		return false
	}
	if media := strings.ToLower(r.Header.Get("Content-Type")); media != "application/json" && !strings.HasPrefix(media, "application/json;") {
		errorResponse(w, 415, "Content-Type application/json required.")
		return false
	}
	if r.ContentLength > size {
		errorResponse(w, 413, "Request body too large.")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, size)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		var big *http.MaxBytesError
		if errors.As(err, &big) {
			errorResponse(w, 413, "Request body too large.")
			return false
		}
		errorResponse(w, 400, "Invalid or unsupported JSON request.")
		return false
	}
	var extra any
	if err := d.Decode(&extra); err != io.EOF {
		errorResponse(w, 400, "One JSON object or array is required.")
		return false
	}
	return true
}
func NewHandler() http.Handler { return NewHandlerForRail("") }

// NewHandlerForRail optionally restricts one independently running local Go
// instance to one teaching profile, without duplicating the rule implementation.
func NewHandlerForRail(profile string) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			w.Header().Set("Allow", "GET")
			errorResponse(w, 405, "Method not allowed.")
			return
		}
		response(w, 200, map[string]any{"ok": true, "service": "addressrail-go-rail-engine", "version": rails.Version, "scope": "synthetic-only", "railProfile": profile})
	})
	mux.HandleFunc("/v1/validate", func(w http.ResponseWriter, r *http.Request) {
		var input rails.ValidationRequest
		if !decode(w, r, limitSingle, &input) {
			return
		}
		if profile != "" && input.Rail != profile {
			errorResponse(w, 422, "Request rail differs from this synthetic service profile.")
			return
		}
		response(w, 200, rails.Validate(input))
	})
	mux.HandleFunc("/v1/xml/inspect", func(w http.ResponseWriter, r *http.Request) {
		var input rails.XMLRequest
		if !decode(w, r, limitSingle, &input) {
			return
		}
		if profile != "" && input.Rail != profile {
			errorResponse(w, 422, "XML inspection rail differs from this synthetic profile.")
			return
		}
		response(w, 200, rails.InspectXML(input))
	})
	mux.HandleFunc("/v1/reconcile", func(w http.ResponseWriter, r *http.Request) {
		var input rails.ReconcileRequest
		if !decode(w, r, limitSingle, &input) {
			return
		}
		response(w, 200, rails.Reconcile(input))
	})
	mux.HandleFunc("/v1/validate/batch", func(w http.ResponseWriter, r *http.Request) {
		var batch []rails.ValidationRequest
		if !decode(w, r, limitBatch, &batch) {
			return
		}
		if len(batch) < 1 || len(batch) > 100 {
			errorResponse(w, 422, "Batch must contain 1 to 100 fictional payments.")
			return
		}
		if profile != "" {
			for _, item := range batch {
				if item.Rail != profile {
					errorResponse(w, 422, "Batch contains a different synthetic service rail.")
					return
				}
			}
		}
		results := make([]rails.ValidationResponse, len(batch))
		workers := runtime.GOMAXPROCS(0) * 2
		if workers > 8 {
			workers = 8
		}
		if workers > len(batch) {
			workers = len(batch)
		}
		jobs := make(chan int)
		var wg sync.WaitGroup
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for idx := range jobs {
					results[idx] = rails.Validate(batch[idx])
				}
			}()
		}
		for idx := range batch {
			jobs <- idx
		}
		close(jobs)
		wg.Wait()
		response(w, 200, map[string]any{"validator": rails.Version, "results": results, "synthetic": true, "settlementAttested": false})
	})
	return mux
}

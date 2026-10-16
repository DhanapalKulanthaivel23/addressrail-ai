package main

import (
	"github.com/DhanapalKulanthaivel23/addressrail-ai/rail-engine/internal/api"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"
)

func main() {
	port := 8094
	if value := os.Getenv("RAIL_ENGINE_PORT"); value != "" {
		p, err := strconv.Atoi(value)
		if err != nil || p < 1024 || p > 65535 {
			log.Fatal("RAIL_ENGINE_PORT must be between 1024 and 65535")
		}
		port = p
	}
	server := &http.Server{
		Addr: "127.0.0.1:" + strconv.Itoa(port), Handler: api.NewHandler(),
		ReadHeaderTimeout: 2 * time.Second, ReadTimeout: 5 * time.Second,
		WriteTimeout: 8 * time.Second, IdleTimeout: 20 * time.Second,
		MaxHeaderBytes: 8 << 10,
	}
	log.Printf("AddressRail Go synthetic rules listening on localhost:%d", port)
	log.Fatal(server.ListenAndServe())
}

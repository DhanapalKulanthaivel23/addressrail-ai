"""Fail-closed remote Kafka TLS configuration contract (no network needed)."""
import pytest
from investigation.kafka_bus import kafka_config

def test_local_defaults(monkeypatch):
    for name in ("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", "ADDRESSRAIL_KAFKA_BOOTSTRAP",
                 "ADDRESSRAIL_KAFKA_SASL_USERNAME", "ADDRESSRAIL_KAFKA_SASL_PASSWORD"):
        monkeypatch.delenv(name, raising=False)
    config = kafka_config()
    assert config["bootstrap.servers"] == "127.0.0.1:9092"
    assert "security.protocol" not in config

def test_remote_requires_opt_in_and_ca(monkeypatch, tmp_path):
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_BOOTSTRAP", "broker.example.com:9093")
    monkeypatch.delenv("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", raising=False)
    with pytest.raises(ValueError, match="opt-in"):
        kafka_config()
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", "true")
    monkeypatch.delenv("ADDRESSRAIL_KAFKA_CA_FILE", raising=False)
    with pytest.raises(ValueError, match="CA certificate"):
        kafka_config()
    ca = tmp_path / "test-ca.pem"
    ca.write_text("fixture only")
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_CA_FILE", str(ca))
    monkeypatch.delenv("ADDRESSRAIL_KAFKA_SASL_USERNAME", raising=False)
    monkeypatch.delenv("ADDRESSRAIL_KAFKA_SASL_PASSWORD", raising=False)
    cfg = kafka_config()
    assert cfg["security.protocol"] == "SSL"
    assert cfg["enable.ssl.certificate.verification"] is True
    assert cfg["ssl.ca.location"] == str(ca)

def test_remote_sasl_requires_both_secrets(monkeypatch, tmp_path):
    ca = tmp_path / "ca.pem"
    ca.write_text("fixture only")
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_CA_FILE", str(ca))
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", "true")
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_BOOTSTRAP", "broker.example.com:9093")
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_SASL_USERNAME", "test-user")
    monkeypatch.delenv("ADDRESSRAIL_KAFKA_SASL_PASSWORD", raising=False)
    with pytest.raises(ValueError, match="both"):
        kafka_config()
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_SASL_PASSWORD", "fixture-secret")
    cfg = kafka_config()
    assert cfg["security.protocol"] == "SASL_SSL"
    assert cfg["sasl.mechanism"] == "SCRAM-SHA-512"
    assert cfg["sasl.password"] == "fixture-secret"
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_SASL_MECHANISM", "PLAIN")
    with pytest.raises(ValueError, match="mechanism"):
        kafka_config()

@pytest.mark.parametrize("host", [
    "localhost:9092", "127.0.0.1:9092", "192.168.1.1:9093",
    "10.0.0.1:9093", "169.254.1.2:9093", "broker.local:9093",
    "broker.example.com:99999", "broker.example.com:0",
    "broker.example.com:9093,other.example.com:9093"
])
def test_remote_destination_guard(monkeypatch, tmp_path, host):
    ca = tmp_path / "ca.pem"
    ca.write_text("fixture only")
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_REMOTE_ENABLED", "true")
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_BOOTSTRAP", host)
    monkeypatch.setenv("ADDRESSRAIL_KAFKA_CA_FILE", str(ca))
    with pytest.raises(ValueError):
        kafka_config()

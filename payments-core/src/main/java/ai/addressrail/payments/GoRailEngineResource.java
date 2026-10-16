package ai.addressrail.payments;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

/**
 * Java Quarkus remains the payment-record owner and opt-in orchestration layer.
 * The actual cross-rail rules and event correlation execute in the Go service.
 * Local-only and disabled in prod. Not a bank gateway or a settlement status oracle.
 */
@Path("/api/v1/labs/go-engine")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class GoRailEngineResource {
    @Inject EntityManager em;
    @ConfigProperty(name = "addressrail.lab.go-engine.enabled", defaultValue = "false")
    boolean enabled;

    @ConfigProperty(name = "addressrail.go-engine.base-url", defaultValue = "http://127.0.0.1:8094")
    String baseUrl;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(1))
            .followRedirects(HttpClient.Redirect.NEVER).build();

    private void ensureEnabled() {
        if (!enabled) throw new NotFoundException("Local Go engine integration is disabled.");
    }

    private URI destination(String operation) {
        URI uri;
        try {
            URI base = URI.create(baseUrl);
            if (!"http".equals(base.getScheme()) ||
                    !"127.0.0.1".equals(base.getHost()) ||
                    base.getPort() < 1024 || base.getPort() > 65535 ||
                    (base.getPath() != null && !base.getPath().isEmpty()) ||
                    base.getQuery() != null || base.getFragment() != null ||
                    base.getUserInfo() != null) {
                throw new IllegalArgumentException("Go integration must use 127.0.0.1 only");
            }
            uri = URI.create(base.toString() + "/v1/" + operation);
        } catch (IllegalArgumentException e) {
            throw new WebApplicationException("Go engine configuration is not permitted", 503);
        }
        return uri;
    }

    private Response forward(JsonNode input, String operation) {
        ensureEnabled();
        if (input == null || !input.isObject() || !input.path("synthetic").asBoolean(false)) {
            throw new BadRequestException("Explicitly fictional synthetic:true request required.");
        }
        byte[] body;
        try {
            body = mapper.writeValueAsBytes(input);
        } catch (Exception e) {
            throw new BadRequestException("Invalid JSON body.");
        }
        if (body.length > 60_000) {
            return Response.status(413).entity(
                    java.util.Map.of("error", "Fictional request exceeds size limit.")).build();
        }
        try {
            HttpRequest request = HttpRequest.newBuilder(destination(operation))
                    .header("Content-Type", "application/json")
                    .header("Accept", "application/json")
                    .timeout(Duration.ofSeconds(3))
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> reply = http.send(request,
                    HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));
            if (reply.statusCode() != 200 || reply.body().length() > 100_000) {
                return Response.status(503).entity(java.util.Map.of(
                        "error", "Go rules service returned no validated educational result.")).build();
            }
            JsonNode checked = mapper.readTree(reply.body());
            if (!checked.isObject() ||
                    !checked.path("synthetic").asBoolean(false) ||
                    !"addressrail-go-educational-v1".equals(
                            checked.path("validator").asText())) {
                return Response.status(503).entity(java.util.Map.of(
                        "error", "Unrecognised Go validation contract.")).build();
            }
            return Response.ok(checked).header("Cache-Control", "no-store").build();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Response.status(503).entity(java.util.Map.of(
                    "error", "Go rules service interrupted.")).build();
        } catch (Exception e) {
            // No payment payload or raw upstream error bodies in application responses.
            return Response.status(503).entity(java.util.Map.of(
                    "error", "Local Go rules service is unavailable.")).build();
        }
    }

    /**
     * Java reads its own persisted evidence, then delegates ONLY the bounded,
     * deterministic event-correlation decision to the Go service.
     */
    @GET
    @Path("/payments/{id}/reconcile")
    public Response reviewStoredSyntheticPayment(@PathParam("id") String id) {
        ensureEnabled();
        if (id == null || !id.matches("[A-Za-z0-9_-]{1,80}")) {
            throw new BadRequestException("Invalid synthetic payment identifier.");
        }
        PaymentRecord payment = em.find(PaymentRecord.class, id);
        if (payment == null || !payment.synthetic) throw new NotFoundException("Fictional payment not found.");
        List<PaymentEvent> events = em.createQuery(
                "from PaymentEvent e where e.paymentId = :id order by e.occurredAt, e.id",
                PaymentEvent.class).setParameter("id", id).setMaxResults(257).getResultList();
        if (events.isEmpty() || events.size() > 256) {
            return Response.status(422).entity(java.util.Map.of(
                    "error", "Expected 1 to 256 complete synthetic payment events.")).build();
        }
        ObjectNode body = mapper.createObjectNode();
        body.put("synthetic", true);
        body.put("paymentId", id);
        body.put("recordedStatus", payment.status);
        ArrayNode entries = body.putArray("events");
        for (PaymentEvent event : events) {
            ObjectNode e = entries.addObject();
            e.put("paymentId", event.paymentId);
            e.put("occurredAt", event.occurredAt.toString());
            e.put("type", event.type);
            e.put("source", event.source);
            e.put("evidenceRef", event.evidenceRef);
            // Deliberately omit descriptions, amounts, accounts and names.
        }
        return forward(body, "reconcile");
    }

    @POST
    @Path("/validate")
    public Response validate(JsonNode input) {
        return forward(input, "validate");
    }

    @POST
    @Path("/reconcile")
    public Response reconcile(JsonNode input) {
        return forward(input, "reconcile");
    }
}

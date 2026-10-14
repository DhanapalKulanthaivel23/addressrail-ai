package ai.addressrail.payments;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Local-only, synthetic SEPA SCT learning simulator.
 * Explicitly NOT a scheme connector, compliance validator or settlement service.
 * Disabled by default and in production. The existing payments collection remains read-only.
 */
@Path("/api/v1/labs/sepa-sct")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class SepaSctLabResource {
    @Inject EntityManager em;

    @ConfigProperty(name = "addressrail.lab.sepa-sct.enabled", defaultValue = "false")
    boolean enabled;

    public record SimulationRequest(boolean synthetic, String scenario, String debtorName,
                                    String creditorName, String debtorIban, String creditorIban,
                                    String debtorBic, String creditorBic, BigDecimal amount,
                                    String reference) {}

    public record SimulationReceipt(String paymentId, String scenario, String status,
                                    boolean synthetic, String settlement, String limitation,
                                    List<String> evidenceRefs, String paymentUrl, String eventsUrl,
                                    String investigationUrl) {}

    private void ensureEnabled() {
        if (!enabled) throw new NotFoundException("The local synthetic lab is disabled");
    }

    private static boolean ibanValid(String candidate) {
        if (candidate == null) return false;
        String iban = candidate.replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        if (!iban.matches("[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}")) return false;
        String rotated = iban.substring(4) + iban.substring(0, 4);
        int mod = 0;
        for (int i = 0; i < rotated.length(); i++) {
            char ch = rotated.charAt(i);
            String digits = ch >= 'A' && ch <= 'Z' ? String.valueOf(ch - 'A' + 10) : String.valueOf(ch);
            for (int j = 0; j < digits.length(); j++) mod = (mod * 10 + digits.charAt(j) - '0') % 97;
        }
        return mod == 1;
    }

    private static boolean bicValid(String bic) {
        return bic != null && bic.matches("[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?");
    }

    private static boolean validSyntheticName(String name) {
        return name != null && name.length() <= 70
                && name.matches("SYNTHETIC [A-Za-z0-9 .'-]{1,60}");
    }

    private static void validate(SimulationRequest request) {
        if (request == null || !request.synthetic())
            throw new BadRequestException("Only explicitly synthetic test cases are accepted");
        if (!List.of("accepted", "invalid-iban", "csm-reject").contains(request.scenario() == null ? "" : request.scenario()))
            throw new BadRequestException("Unsupported synthetic scenario");
        if (!validSyntheticName(request.debtorName()) || !validSyntheticName(request.creditorName()))
            throw new BadRequestException("Use names starting with SYNTHETIC; never submit customer data");
        if (request.amount() == null || request.amount().signum() <= 0 || request.amount().scale() > 2
                || request.amount().compareTo(new BigDecimal("9999999999.99")) > 0)
            throw new BadRequestException("Invalid illustrative EUR amount");
        if (request.reference() == null || !request.reference().matches("[A-Za-z0-9-]{1,35}"))
            throw new BadRequestException("Invalid synthetic reference");
        if (!bicValid(request.debtorBic()) || !bicValid(request.creditorBic()))
            throw new BadRequestException("Invalid BIC format");
        if (!ibanValid(request.debtorIban()))
            throw new BadRequestException("Invalid debtor IBAN");
        // Only the injected failure scenario is allowed to contain an invalid creditor IBAN.
        if (!"invalid-iban".equals(request.scenario()) && !ibanValid(request.creditorIban()))
            throw new BadRequestException("Invalid creditor IBAN");
        if (request.creditorIban() == null || request.creditorIban().length() > 34
                || !request.creditorIban().matches("[A-Z0-9]+"))
            throw new BadRequestException("Invalid creditor IBAN format");
    }

    @POST
    @Path("/simulations")
    @Transactional
    public Response simulate(SimulationRequest request) {
        ensureEnabled();
        validate(request);
        String paymentId = "SCT-" + UUID.randomUUID().toString().toUpperCase(Locale.ROOT);
        boolean localReject = "invalid-iban".equals(request.scenario());
        boolean csmReject = "csm-reject".equals(request.scenario());
        String finalStatus = localReject || csmReject ? "RJCT" : "ACTC";
        PaymentRecord payment = new PaymentRecord(paymentId, "SEPA SCT synthetic", "pacs.008",
                request.amount(), "EUR", request.debtorBic(), request.creditorBic(), finalStatus);
        em.persist(payment);
        Instant base = Instant.now();
        List<String> evidence = new ArrayList<>();
        int stage = 0;
        stage = append(paymentId, base, stage, "INITIATED", "synthetic-customer",
                "Synthetic pain.001 initiated. Not an actual bank instruction.", evidence);
        if (localReject) {
            append(paymentId, base, stage, "RJCT", "synthetic-bank-validator",
                    "Illustrative local bank rejection: creditor IBAN failed checks; no pacs.008 submitted.", evidence);
        } else {
            stage = append(paymentId, base, stage, "BASIC_VALIDATED", "synthetic-bank-validator",
                    "Limited local syntax/check-digit validation only; not EPC compliance.", evidence);
            stage = append(paymentId, base, stage, "INTERBANK_SIMULATED", "synthetic-step2",
                    "Simulated pacs.008 journey; no STEP2 connection or settlement.", evidence);
            if (csmReject) {
                append(paymentId, base, stage, "RJCT", "synthetic-csm",
                        "Hypothetical pacs.002 rejection; not a real STEP2 status.", evidence);
            } else {
                append(paymentId, base, stage, "ACTC", "synthetic-csm",
                        "Illustrative technical acceptance only: settlement and credit unverified.", evidence);
            }
        }
        String path = "/api/v1/payments/" + paymentId;
        return Response.status(Response.Status.CREATED).entity(new SimulationReceipt(
                paymentId, request.scenario(), finalStatus, true,
                localReject ? "NOT_ATTEMPTED" : csmReject ? "NOT_SETTLED" : "UNVERIFIED",
                "Synthetic simulation only; no scheme, bank, sanctions or settlement verification.",
                evidence, path, path + "/events", path + "/investigation")).build();
    }

    private int append(String paymentId, Instant base, int offset, String type, String source,
                       String description, List<String> evidence) {
        int stage = offset + 1;
        String ref = paymentId + "-E" + stage;
        em.persist(new PaymentEvent(paymentId, base.plusMillis(stage * 100L).toString(), type,
                source, ref, description));
        evidence.add(ref);
        return stage;
    }
}

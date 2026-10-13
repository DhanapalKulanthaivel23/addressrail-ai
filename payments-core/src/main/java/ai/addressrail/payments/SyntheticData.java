package ai.addressrail.payments;

import io.quarkus.runtime.StartupEvent;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;

@ApplicationScoped
public class SyntheticData {
    @Inject EntityManager em;

    @Transactional
    public void seed(@Observes StartupEvent event) {
        if (em.find(PaymentRecord.class, "PAY-10001") != null) return;
        em.persist(new PaymentRecord("PAY-10001", "CBPR+ (illustrative)", "pacs.008",
                new BigDecimal("25000.00"), "EUR", "SYNTHETIC BANK A", "SYNTHETIC BANK B", "RJCT"));
        em.persist(new PaymentEvent("PAY-10001", "2026-10-13T09:00:00Z", "RECEIVED", "synthetic-origin",
                "DEMO-EVT-001", "Synthetic instruction received"));
        em.persist(new PaymentEvent("PAY-10001", "2026-10-13T09:01:00Z", "VALIDATED", "synthetic-validator",
                "DEMO-EVT-002", "Synthetic example passed local input checks; not scheme certification"));
        em.persist(new PaymentEvent("PAY-10001", "2026-10-13T09:02:00Z", "SUBMITTED", "synthetic-gateway",
                "DEMO-EVT-003", "Simulated submission, not connected to Swift"));
        em.persist(new PaymentEvent("PAY-10001", "2026-10-13T09:03:00Z", "RJCT", "synthetic-status-feed",
                "DEMO-EVT-004", "Simulated rejection; reason AC01 (incorrect account number)"));
    }
}

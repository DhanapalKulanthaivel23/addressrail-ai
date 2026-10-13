package ai.addressrail.payments;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import java.util.List;

@Path("/api/v1/payments")
@Produces(MediaType.APPLICATION_JSON)
public class PaymentsResource {
    @Inject EntityManager em;

    @GET
    @Path("/{id}")
    public PaymentRecord getPayment(@PathParam("id") String id) {
        PaymentRecord record = em.find(PaymentRecord.class, id);
        if (record == null) throw new NotFoundException("Payment not found");
        return record;
    }

    @GET
    @Path("/{id}/events")
    public List<PaymentEvent> getEvents(@PathParam("id") String id) {
        if (em.find(PaymentRecord.class, id) == null) throw new NotFoundException("Payment not found");
        return em.createQuery("from PaymentEvent e where e.paymentId = :id order by e.occurredAt, e.id", PaymentEvent.class)
                .setParameter("id", id).setMaxResults(500).getResultList();
    }

    @GET
    @Path("/{id}/investigation")
    public InvestigationView investigate(@PathParam("id") String id) {
        PaymentRecord payment = getPayment(id);
        List<PaymentEvent> events = getEvents(id);
        PaymentEvent last = events.isEmpty() ? null : events.get(events.size()-1);
        return new InvestigationView(payment.id, payment.status, payment.synthetic,
                last == null ? null : last.type, last == null ? null : last.evidenceRef,
                "Synthetic evidence only. No external payment status verification.", events);
    }

    public record InvestigationView(String paymentId, String status, boolean synthetic,
                                     String lastRecordedEvent, String lastEvidenceRef,
                                     String limitation, List<PaymentEvent> events) {}
}

package ai.addressrail.payments;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.util.List;

/** Read-only local catalogue for synthetic educational investigations. */
@Path("/api/v1/labs/cases")
@Produces(MediaType.APPLICATION_JSON)
public class SyntheticCaseCatalogue {
    @Inject EntityManager em;
    @ConfigProperty(name="addressrail.lab.catalogue.enabled", defaultValue="false")
    boolean enabled;

    public record CaseSummary(String paymentId,String scheme,String status,String messageType,
                              String currency,boolean synthetic) {}

    @GET
    public List<CaseSummary> list(@QueryParam("status") String status,
                                  @DefaultValue("40") @QueryParam("limit") int limit) {
        if(!enabled) throw new NotFoundException("Local synthetic catalogue disabled");
        if(limit<1 || limit>100) throw new BadRequestException("Limit must be between 1 and 100");
        if(status!=null && !status.matches("[A-Z_]{2,40}"))
            throw new BadRequestException("Invalid status filter");
        List<PaymentRecord> rows = em.createQuery(
                "from PaymentRecord p where p.synthetic = true and (:status is null or p.status = :status) order by p.id desc",
                PaymentRecord.class).setParameter("status", status).setMaxResults(limit).getResultList();
        return rows.stream().map(p->new CaseSummary(p.id,p.scheme,p.status,p.messageType,p.currency,p.synthetic)).toList();
    }
}

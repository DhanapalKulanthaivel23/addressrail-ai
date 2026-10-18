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
import java.util.Map;

/**
 * Synthetic-only local case fixture creation. Never connects to Swift,
 * sends a payment or obtains an actual scheme status. Dev/test only.
 */
@Path("/api/v1/labs/synthetic-intake")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class SyntheticIntakeResource {
    @Inject EntityManager em;
    @ConfigProperty(name="addressrail.lab.synthetic-intake.enabled",defaultValue="false")
    boolean enabled;
    public record NewPayment(String paymentId,String simulatedStatus,boolean synthetic) {}
    private void gate(){if(!enabled)throw new NotFoundException("Fictional intake disabled");}

    @POST @Transactional
    public Response create(NewPayment input){
        gate();
        if(input==null || !input.synthetic() ||
           input.paymentId()==null || !input.paymentId().matches("PAY-[A-Za-z0-9_-]{5,72}") ||
           input.simulatedStatus()==null || !java.util.Set.of("RJCT","PENDING","UNKNOWN")
                                                  .contains(input.simulatedStatus()))
            throw new BadRequestException("Only fictional PAY-* and RJCT/PENDING/UNKNOWN scenarios permitted");
        PaymentRecord old=em.find(PaymentRecord.class,input.paymentId());
        if(old!=null){
            if(!old.synthetic || !old.status.equals(input.simulatedStatus()))
                throw new ClientErrorException("Fictional payment identifier already in use",409);
            return Response.status(200).entity(old).build(); // idempotent reuse
        }
        PaymentRecord created=new PaymentRecord(input.paymentId(),"CBPR+ (synthetic Kafka training)",
             "pacs.008",new BigDecimal("1.00"),"EUR","SYNTHETIC BANK A",
             "SYNTHETIC BANK B",input.simulatedStatus());
        em.persist(created);
        em.persist(new PaymentEvent(input.paymentId(),Instant.now().toString(),
           input.simulatedStatus(),"synthetic-kafka-fixture",
           "AR-DEMO-"+input.paymentId()+"-STATUS",
           "Invented processing outcome for Kafka/AI investigation training only."));
        em.flush();
        return Response.status(201).entity(created).build();
    }
}

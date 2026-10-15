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

/** Synthetic high-value CHAPS / Bank of England RTGS education; no real network or settlement. */
@Path("/api/v1/labs/chaps")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class ChapsLabResource {
    @Inject EntityManager em;
    @ConfigProperty(name="addressrail.lab.chaps.enabled",defaultValue="false")
    boolean enabled;

    public record Request(boolean synthetic,String messageType,String scenario) {}
    public record Receipt(String paymentId,String messageType,String scenario,String status,
                          String settlement,String limitation,List<String> evidenceRefs,
                          String paymentUrl,String eventsUrl,String investigationUrl) {}

    @POST @Path("/simulations") @Transactional
    public Response simulate(Request req) {
        if(!enabled) throw new NotFoundException("CHAPS learning lab disabled");
        if(req==null || !req.synthetic()) throw new BadRequestException("Synthetic scenarios only");
        if(!List.of("pacs.008","pacs.009").contains(req.messageType()))
            throw new BadRequestException("Choose pacs.008 or pacs.009 CORE teaching case");
        if(!List.of("settlement-demo","liquidity-hold","local-reject","outcome-unknown").contains(req.scenario()))
            throw new BadRequestException("Unsupported scenario");
        boolean local="local-reject".equals(req.scenario());
        boolean liquidity="liquidity-hold".equals(req.scenario());
        boolean uncertain="outcome-unknown".equals(req.scenario());
        String id="CHAPS-"+UUID.randomUUID().toString().toUpperCase(Locale.ROOT);
        String status=local ? "RJCT" : liquidity ? "PENDING" : uncertain ? "UNKNOWN" : "SIMULATED";
        // No live status such as ACSC/settled is asserted from a teaching case.
        em.persist(new PaymentRecord(id,"CHAPS synthetic",req.messageType(),
                new BigDecimal("250000.00"),"GBP","AAAA GB 2L DEMO","BBBB GB 2L DEMO",status));
        List<String> refs=new ArrayList<>();
        Instant start=Instant.now();
        int stage=append(id,start,0,"RECEIVED","synthetic-bank",
                "Fictional GBP high-value payment instruction. No actual CHAPS submission.",refs);
        if(local) {
            append(id,start,stage,"RJCT","synthetic-bank-validator",
                    "Local bank-side validation rejection; no RTGS settlement attempted.",refs);
        } else {
            stage=append(id,start,stage,"BASIC_CHECKS","synthetic-validator",
                    "Illustrative data checks only; not CHAPS ISO 20022 or enhanced-data certification.",refs);
            stage=append(id,start,stage,"RTGS_ROUTED","synthetic-chaps",
                    "Fictional CHAPS direct-participant route to Bank of England RTGS; no submission.",refs);
            if(liquidity) {
                append(id,start,stage,"PENDING","synthetic-liquidity",
                        "Hypothetical insufficient available liquidity; outcome pending, settlement NOT confirmed.",refs);
            } else if(uncertain) {
                append(id,start,stage,"UNKNOWN","synthetic-status",
                        "Simulated missing authoritative settlement confirmation; reconcile before drawing conclusions.",refs);
            } else {
                append(id,start,stage,"SIMULATED","synthetic-rtgs",
                        "Completed teaching trace ONLY; no Bank of England settlement evidence or beneficiary credit.",refs);
            }
        }
        String settlement=local?"NOT_ATTEMPTED":liquidity?"UNCONFIRMED_LIQUIDITY_HOLD":
                uncertain?"UNKNOWN":"SIMULATED_ONLY";
        String path="/api/v1/payments/"+id;
        return Response.status(201).entity(new Receipt(id,req.messageType(),req.scenario(),status,
                settlement,"Synthetic education: no live CHAPS access, official validation or verified RTGS settlement.",
                refs,path,path+"/events",path+"/investigation")).build();
    }

    private int append(String paymentId,Instant start,int prior,String event,String source,
                       String description,List<String> evidence) {
        int n=prior+1;
        String ref=paymentId+"-E"+n;
        em.persist(new PaymentEvent(paymentId,start.plusMillis(100L*n).toString(),
                event,source,ref,description));
        evidence.add(ref);
        return n;
    }
}

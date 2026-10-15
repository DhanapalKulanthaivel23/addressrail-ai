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

/** Local synthetic SCT Inst RT1/TIPS learning simulations. No external connections. */
@Path("/api/v1/labs/sepa-instant")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class SepaInstantLabResource {
    @Inject EntityManager em;
    @ConfigProperty(name="addressrail.lab.sepa-instant.enabled",defaultValue="false")
    boolean enabled;

    public record Request(boolean synthetic,String rail,String scenario) {}
    public record Receipt(String paymentId,String rail,String scenario,String status,
                          String settlement,String limitation,List<String> evidenceRefs,
                          String paymentUrl,String eventsUrl,String investigationUrl) {}

    @POST @Path("/simulations") @Transactional
    public Response run(Request request) {
        if(!enabled) throw new NotFoundException("Local lab disabled");
        if(request==null || !request.synthetic()) throw new BadRequestException("Synthetic only");
        if(!List.of("RT1","TIPS").contains(request.rail())) throw new BadRequestException("Select RT1 or TIPS");
        if(!List.of("confirmed","unreachable","timeout","local-reject").contains(request.scenario()))
            throw new BadRequestException("Invalid scenario");
        String scenario=request.scenario(),rail=request.rail();
        boolean local="local-reject".equals(scenario), unavailable="unreachable".equals(scenario),
                timeout="timeout".equals(scenario);
        String id="INST-"+UUID.randomUUID().toString().toUpperCase(Locale.ROOT);
        String status=local || unavailable ? "RJCT" : timeout ? "UNKNOWN" : "ACSC";
        em.persist(new PaymentRecord(id,"SCT Inst "+rail+" synthetic",
                local?"pain.001":"pacs.008",new BigDecimal("125.00"),
                "EUR","AAAADEFFXXX","BBBBFRPPXXX",status));
        List<String> refs=new ArrayList<>();
        Instant now=Instant.now();
        int n=add(id,now,0,"INITIATED","synthetic-customer",
                "Synthetic initiation only; no real instruction.",refs);
        if(local) {
            add(id,now,n,"RJCT","synthetic-bank",
                    "Hypothetical bank validation rejection; no interbank instruction created.",refs);
        } else {
            n=add(id,now,n,"BASIC_VALIDATED","synthetic-bank",
                    "Teaching-only basic validation; not scheme or compliance certification.",refs);
            n=add(id,now,n,"ROUTED","synthetic-"+rail.toLowerCase(Locale.ROOT),
                    "Illustrative route through "+rail+" only, not both RT1 and TIPS.",refs);
            if(timeout)
                add(id,now,n,"UNKNOWN","synthetic-"+rail.toLowerCase(Locale.ROOT),
                        "Simulated missing outcome; requires reconciliation and must not be assumed rejected or settled.",refs);
            else if(unavailable)
                add(id,now,n,"RJCT","synthetic-"+rail.toLowerCase(Locale.ROOT),
                        "Hypothetical negative outcome: receiving institution unavailable.",refs);
            else
                add(id,now,n,"ACSC","synthetic-"+rail.toLowerCase(Locale.ROOT),
                        "Fictional completed outcome for teaching; not attested settlement or credit.",refs);
        }
        String settlement=local?"NOT_ATTEMPTED":unavailable?"NOT_SETTLED":timeout?"UNKNOWN":"SIMULATED_ONLY";
        String url="/api/v1/payments/"+id;
        return Response.status(201).entity(new Receipt(id,rail,scenario,status,settlement,
                "Synthetic educational example; no live RT1/TIPS calls, certified responses or real settlement.",
                refs,url,url+"/events",url+"/investigation")).build();
    }

    private int add(String id,Instant now,int previous,String type,String source,String note,List<String> refs) {
        int n=previous+1;
        String ref=id+"-E"+n;
        em.persist(new PaymentEvent(id,now.plusMillis(n*100L).toString(),type,source,ref,note));
        refs.add(ref);
        return n;
    }
}

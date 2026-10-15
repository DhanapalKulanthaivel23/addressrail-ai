package ai.addressrail.payments;

import jakarta.inject.Inject;
import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * LOCAL TRAINING ONLY. Not authenticated; never enable publicly or in production.
 * Only synthetic payments and invented TRAINING-* aliases are permitted.
 */
@Path("/api/v1/labs/investigation-cases")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class TrainingCaseResource {
    @Inject EntityManager em;
    @ConfigProperty(name="addressrail.lab.case-management.enabled",defaultValue="false")
    boolean enabled;
    public record OpenRequest(String paymentId,String actorAlias) {}
    public record ChangeRequest(String actorAlias,String state,String ownerAlias,String note,long expectedVersion) {}
    public record NoteRequest(String actorAlias,String note) {}
    public record CaseView(TrainingCase trainingCase,List<TrainingCaseActivity> history,String limitation) {}
    private void gate(){if(!enabled)throw new NotFoundException("Training cases unavailable");}
    private static boolean actor(String a){return a!=null && a.matches("TRAINING-[A-Za-z0-9_-]{2,48}");}
    private static boolean note(String n){return n!=null && !n.isBlank() && n.length()<=500 &&
            n.chars().noneMatch(c->c<32 || c==127);}
    private TrainingCase find(String id) {
        TrainingCase c=em.find(TrainingCase.class,id);
        if(c==null || !c.synthetic)throw new NotFoundException("Synthetic case not found");
        return c;
    }
    private CaseView view(TrainingCase c){
        List<TrainingCaseActivity> trail=em.createQuery(
            "from TrainingCaseActivity a where a.caseId=:id order by a.id",TrainingCaseActivity.class)
            .setParameter("id",c.id).setMaxResults(500).getResultList();
        return new CaseView(c,trail,"Local training workflow only; no authenticated identity, approval authority or tamper-proof audit.");
    }
    private void record(TrainingCase c,String action,String actor,String detail){
        em.persist(new TrainingCaseActivity(c.id,Instant.now(),action,actor,detail,
            "TRAINING-"+UUID.randomUUID()));
    }

    @GET @Path("/by-payment/{paymentId}")
    public CaseView byPayment(@PathParam("paymentId") String paymentId){
        gate();
        if(paymentId==null || !paymentId.matches("[A-Za-z0-9_-]{1,80}"))
            throw new BadRequestException("Invalid payment ID");
        List<TrainingCase> matches=em.createQuery(
            "from TrainingCase c where c.paymentId=:id and c.synthetic=true",TrainingCase.class)
            .setParameter("id",paymentId).setMaxResults(1).getResultList();
        if(matches.isEmpty())throw new NotFoundException("Training case not opened");
        return view(matches.get(0));
    }
    @GET @Path("/{id}")
    public CaseView get(@PathParam("id") String id){gate();return view(find(id));}

    @POST @Transactional
    public Response open(OpenRequest request){
        gate();
        if(request==null || request.paymentId()==null ||
           !request.paymentId().matches("[A-Za-z0-9_-]{1,80}") || !actor(request.actorAlias()))
            throw new BadRequestException("Synthetic payment ID and TRAINING-* actor required");
        PaymentRecord payment=em.find(PaymentRecord.class,request.paymentId());
        if(payment==null || !payment.synthetic)throw new NotFoundException("Synthetic payment not found");
        if(!em.createQuery("select c.id from TrainingCase c where c.paymentId=:id",String.class)
            .setParameter("id",request.paymentId()).setMaxResults(1).getResultList().isEmpty())
            throw new ClientErrorException("Case already opened for this payment",409);
        Instant now=Instant.now();
        TrainingCase c=new TrainingCase("CASE-"+UUID.randomUUID(),request.paymentId(),request.actorAlias(),now);
        em.persist(c);
        record(c,"OPENED",request.actorAlias(),"Case opened for synthetic payment; requires human review.");
        em.flush();
        return Response.status(201).entity(view(c)).build();
    }
    @POST @Path("/{id}/notes") @Transactional
    public CaseView addNote(@PathParam("id") String id,NoteRequest request){
        gate();TrainingCase c=find(id);
        if(request==null || !actor(request.actorAlias()) || !note(request.note()))
            throw new BadRequestException("TRAINING-* actor and short nonempty note required");
        record(c,"NOTE",request.actorAlias(),request.note());
        em.flush();
        return view(c);
    }
    @POST @Path("/{id}/transition") @Transactional
    public CaseView transition(@PathParam("id") String id,ChangeRequest request){
        gate();TrainingCase c=find(id);
        if(request==null || !actor(request.actorAlias()) || !actor(request.ownerAlias()) ||
           !note(request.note()) || request.expectedVersion()!=c.version)
            throw new ClientErrorException("Invalid training actor, note or stale version",409);
        if(!List.of("OPEN","IN_REVIEW","ESCALATED","CLOSED").contains(request.state()))
            throw new BadRequestException("Invalid case state");
        if(c.state.equals("CLOSED") && !request.state().equals("OPEN"))
            throw new ClientErrorException("Closed training case can only reopen",409);
        if(c.state.equals(request.state()) && c.ownerAlias.equals(request.ownerAlias()))
            throw new BadRequestException("No workflow change requested");
        String old=c.state;
        c.state=request.state();c.ownerAlias=request.ownerAlias();c.updatedAt=Instant.now();
        record(c,"TRANSITION",request.actorAlias(),
            old+" -> "+c.state+"; owner "+c.ownerAlias+"; "+request.note());
        em.flush();
        return view(c);
    }
}

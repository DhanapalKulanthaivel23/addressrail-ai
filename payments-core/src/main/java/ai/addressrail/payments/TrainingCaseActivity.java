package ai.addressrail.payments;

import jakarta.persistence.*;
import java.time.Instant;

/** Append-only in application code; H2 training data is not tamper-proof audit. */
@Entity
@Table(name="training_case_activity",indexes=@Index(name="idx_training_activity_case",columnList="caseId"))
public class TrainingCaseActivity {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Column(nullable=false,length=80) public String caseId;
    @Column(nullable=false) public Instant occurredAt;
    @Column(nullable=false,length=30) public String action;
    @Column(nullable=false,length=60) public String actorAlias;
    @Column(nullable=false,length=500) public String note;
    @Column(nullable=false,length=80) public String evidenceRef;
    protected TrainingCaseActivity() {}
    public TrainingCaseActivity(String caseId,Instant when,String action,String actor,String note,String ref) {
        this.caseId=caseId;this.occurredAt=when;this.action=action;this.actorAlias=actor;
        this.note=note;this.evidenceRef=ref;
    }
}

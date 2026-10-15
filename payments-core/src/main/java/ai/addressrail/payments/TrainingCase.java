package ai.addressrail.payments;

import jakarta.persistence.*;
import java.time.Instant;

/** Synthetic learning case, not a payment approval or real investigator identity. */
@Entity
@Table(name="training_investigation_case")
public class TrainingCase {
    @Id @Column(length=80) public String id;
    @Column(nullable=false,length=80,unique=true) public String paymentId;
    @Column(nullable=false,length=24) public String state;
    @Column(nullable=false,length=60) public String ownerAlias;
    @Column(nullable=false) public Instant openedAt;
    @Column(nullable=false) public Instant updatedAt;
    @Column(nullable=false) public boolean synthetic;
    @Version public long version;
    protected TrainingCase() {}
    public TrainingCase(String id,String paymentId,String ownerAlias,Instant at) {
        this.id=id;this.paymentId=paymentId;this.ownerAlias=ownerAlias;
        this.state="OPEN";this.openedAt=at;this.updatedAt=at;this.synthetic=true;
    }
}

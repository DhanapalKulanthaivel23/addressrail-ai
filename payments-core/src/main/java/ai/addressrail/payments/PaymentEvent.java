package ai.addressrail.payments;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "payment_event", indexes = @Index(name="idx_payment_event_payment", columnList="paymentId"))
public class PaymentEvent {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) public Long id;
    @Column(nullable=false, length=80) public String paymentId;
    @Column(nullable=false) public Instant occurredAt;
    @Column(nullable=false, length=50) public String type;
    @Column(nullable=false, length=40) public String source;
    @Column(nullable=false, length=120) public String evidenceRef;
    @Column(nullable=false, length=500) public String description;
    protected PaymentEvent() {}
    public PaymentEvent(String paymentId, String time, String type, String source, String evidenceRef, String description) {
        this.paymentId=paymentId; this.occurredAt=Instant.parse(time); this.type=type;
        this.source=source; this.evidenceRef=evidenceRef; this.description=description;
    }
}

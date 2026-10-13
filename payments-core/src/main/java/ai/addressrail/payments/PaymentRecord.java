package ai.addressrail.payments;

import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(name = "payment_record")
public class PaymentRecord {
    @Id @Column(length = 80) public String id;
    @Column(nullable = false, length = 40) public String scheme;
    @Column(nullable = false, length = 40) public String messageType;
    @Column(nullable = false, precision = 19, scale = 2) public BigDecimal amount;
    @Column(nullable = false, length = 3) public String currency;
    @Column(nullable = false, length = 120) public String debtorAgent;
    @Column(nullable = false, length = 120) public String creditorAgent;
    @Column(nullable = false, length = 40) public String status;
    @Column(nullable = false) public boolean synthetic;
    protected PaymentRecord() {}
    public PaymentRecord(String id, String scheme, String messageType, BigDecimal amount, String currency,
                         String debtorAgent, String creditorAgent, String status) {
        this.id=id; this.scheme=scheme; this.messageType=messageType; this.amount=amount; this.currency=currency;
        this.debtorAgent=debtorAgent; this.creditorAgent=creditorAgent; this.status=status; this.synthetic=true;
    }
}

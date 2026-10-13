package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class PaymentsResourceTest {
    @Test
    void paymentIsSyntheticAndRejected() {
        given().get("/api/v1/payments/PAY-10001").then().statusCode(200)
                .body("id", is("PAY-10001"), "synthetic", is(true), "status", is("RJCT"));
    }
    @Test
    void eventsAreChronologicalAndEvidenceLinked() {
        given().get("/api/v1/payments/PAY-10001/events").then().statusCode(200)
                .body("size()", is(4), "[0].type", is("RECEIVED"), "[3].type", is("RJCT"),
                        "[3].evidenceRef", is("DEMO-EVT-004"));
    }
    @Test
    void investigationNeverClaimsLiveSettlement() {
        given().get("/api/v1/payments/PAY-10001/investigation").then().statusCode(200)
                .body("synthetic", is(true), "lastRecordedEvent", is("RJCT"),
                        "limitation", containsString("No external payment status"));
    }
    @Test
    void unknownPaymentIsNotFound() {
        given().get("/api/v1/payments/UNKNOWN").then().statusCode(404);
        given().get("/api/v1/payments/UNKNOWN/events").then().statusCode(404);
    }
    @Test
    void noPaymentMutationsExposed() {
        // Collection has no matching resource method, so RESTEasy returns 404.
        given().contentType("application/json").body("{}")
                .post("/api/v1/payments").then().statusCode(404);
        // An existing item path does exist but does not support POST, hence 405.
        given().contentType("application/json").body("{}")
                .post("/api/v1/payments/PAY-10001").then().statusCode(405);
        // A rejected mutation must not alter the persisted payment.
        given().get("/api/v1/payments/PAY-10001").then().statusCode(200)
                .body("status", is("RJCT"), "synthetic", is(true));
    }
}

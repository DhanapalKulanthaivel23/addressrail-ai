package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class GoRailEngineResourceTest {
    @Test
    void integrationIsOffByDefaultAndCannotChangeStoredPayments() {
        String example = """
          {"synthetic":true,"rail":"SCT","messageType":"pacs.008",
           "currency":"EUR","amount":"10.00","reference":"AR-DEMO-001"}
          """;
        // The opt-in local service is not exposed in a normal Java dev/prod deployment.
        given().contentType("application/json").body(example)
            .post("/api/v1/labs/go-engine/validate")
            .then().statusCode(404);
        given().get("/api/v1/payments/PAY-10001")
            .then().statusCode(200).body("status", is("RJCT"));
    }
}

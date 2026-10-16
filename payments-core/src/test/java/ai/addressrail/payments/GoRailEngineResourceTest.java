package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assumptions.*;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class GoRailEngineResourceTest {
    @Test
    void integrationIsOffByDefaultAndCannotChangeStoredPayments() {
        assumeFalse("true".equalsIgnoreCase(System.getenv("GO_ENGINE_INTEGRATION")));
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
    @Test
    void syntheticPaymentReviewUsesGoRulesWithoutMovingMoney() {
        assumeTrue("true".equalsIgnoreCase(System.getenv("GO_ENGINE_INTEGRATION")));
        given().get("/api/v1/labs/go-engine/payments/PAY-10001/reconcile")
                .then().statusCode(200)
                .body("validator", is("addressrail-go-educational-v1"),
                      "verdict", is("CONSISTENT"),
                      "recordedStatus", is("RJCT"),
                      "synthetic", is(true),
                      "settlementAttested", is(false),
                      "safeToRetry", is(false),
                      "evidenceRefs.size()", is(4));
        // Quarkus still owns the persisted payment and status after Go's review.
        given().get("/api/v1/payments/PAY-10001")
                .then().statusCode(200).body("status", is("RJCT"));
    }

    @Test
    void explicitValidationDelegatesToGoAndPreservesSubsetDisclaimer() {
        assumeTrue("true".equalsIgnoreCase(System.getenv("GO_ENGINE_INTEGRATION")));
        String request = """
          {"synthetic":true,"rail":"SCT","messageType":"pacs.008",
           "currency":"EUR","amount":"25.00","reference":"AR-DEMO-101",
           "debtorIban":"DE89370400440532013000",
           "creditorIban":"FR1420041010050500013M02606"}
          """;
        given().contentType("application/json").body(request)
                .post("/api/v1/labs/go-engine/validate")
                .then().statusCode(200)
                .body("validSubset", is(true),
                      "rules.size()", is(0),
                      "settlementAttested", is(false),
                      "safeToRetry", is(false),
                      "disclaimer", containsString("Synthetic rules subset"));
    }

    @Test
    void nonSyntheticProxyRequestsAlwaysRejected() {
        assumeTrue("true".equalsIgnoreCase(System.getenv("GO_ENGINE_INTEGRATION")));
        given().contentType("application/json").body("""
           {"synthetic":false,"rail":"SCT","reference":"AR-DEMO-101"}
           """).post("/api/v1/labs/go-engine/validate").then().statusCode(400);
    }
}

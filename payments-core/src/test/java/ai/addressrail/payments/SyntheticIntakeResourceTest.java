package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class SyntheticIntakeResourceTest {
    private static final String ROOT="/api/v1/labs/synthetic-intake";
    private static final String REQ="""
        {"paymentId":"PAY-KAFKA-TEST-001","simulatedStatus":"RJCT","synthetic":true}
        """;

    @Test
    void persistFictionalPaymentAndEventIdempotently(){
        given().contentType("application/json").body(REQ)
             .post(ROOT).then().statusCode(201)
             .body("id",is("PAY-KAFKA-TEST-001"),"status",is("RJCT"),"synthetic",is(true));
        given().contentType("application/json").body(REQ)
             .post(ROOT).then().statusCode(200);
        given().get("/api/v1/payments/PAY-KAFKA-TEST-001").then().statusCode(200)
             .body("status",is("RJCT"));
        given().get("/api/v1/payments/PAY-KAFKA-TEST-001/events").then().statusCode(200)
             .body("size()",is(1),"[0].type",is("RJCT"));
        given().contentType("application/json").body("""
          {"paymentId":"PAY-KAFKA-TEST-001","simulatedStatus":"UNKNOWN","synthetic":true}
          """).post(ROOT).then().statusCode(409);
    }

    @Test
    void rejectRealAndUnsafeIntake(){
        given().contentType("application/json").body("""
          {"paymentId":"PAY-SOURCE-100","simulatedStatus":"RJCT","synthetic":false}
          """).post(ROOT).then().statusCode(400);
        given().contentType("application/json").body("""
          {"paymentId":"PAY-SOURCE-101","simulatedStatus":"ACSC","synthetic":true}
          """).post(ROOT).then().statusCode(400);
        given().contentType("application/json").body("""
          {"paymentId":"PAYER@REALBANK","simulatedStatus":"RJCT","synthetic":true}
          """).post(ROOT).then().statusCode(400);
    }
}

package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class SepaInstantLabResourceTest {
    private String run(String rail, String scenario) {
        return given().contentType("application/json")
                .body("{\"synthetic\":true,\"rail\":\""+rail+"\",\"scenario\":\""+scenario+"\"}")
                .post("/api/v1/labs/sepa-instant/simulations")
                .then().statusCode(201)
                .body("rail",is(rail),"scenario",is(scenario))
                .extract().path("paymentId");
    }

    @Test
    void routesAreDistinctAndPersistEvidence() {
        String rt1=run("RT1","confirmed");
        String tips=run("TIPS","confirmed");
        given().get("/api/v1/payments/"+rt1).then().statusCode(200)
                .body("scheme",containsString("RT1"),"status",is("ACSC"),"synthetic",is(true));
        given().get("/api/v1/payments/"+tips).then().statusCode(200)
                .body("scheme",containsString("TIPS"),"status",is("ACSC"),"synthetic",is(true));
        given().get("/api/v1/payments/"+tips+"/events").then().statusCode(200)
                .body("size()",is(4),"[2].type",is("ROUTED"),
                      "[2].description",containsString("TIPS only"),
                      "[3].description",containsString("not attested"));
    }

    @Test
    void timeoutKeepsOutcomeUnknownAndRequiresReconciliation() {
        String id=given().contentType("application/json")
                .body("{\"synthetic\":true,\"rail\":\"RT1\",\"scenario\":\"timeout\"}")
                .post("/api/v1/labs/sepa-instant/simulations")
                .then().statusCode(201).body("status",is("UNKNOWN"),"settlement",is("UNKNOWN"))
                .extract().path("paymentId");
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("[3].type",is("UNKNOWN"),"[3].description",containsString("reconciliation"));
        given().get("/api/v1/payments/"+id+"/investigation").then().statusCode(200)
                .body("status",is("UNKNOWN"),"lastRecordedEvent",is("UNKNOWN"));
    }

    @Test
    void localRejectNeverSubmitsInterbankMessage() {
        String id=run("RT1","local-reject");
        given().get("/api/v1/payments/"+id).then().statusCode(200)
                .body("messageType",is("pain.001"),"status",is("RJCT"));
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("size()",is(2),"[1].type",is("RJCT"),
                      "[1].description",containsString("no interbank"));
    }

    @Test
    void unreachableIsHypotheticalAndNotSettled() {
        String id=given().contentType("application/json")
                .body("{\"synthetic\":true,\"rail\":\"TIPS\",\"scenario\":\"unreachable\"}")
                .post("/api/v1/labs/sepa-instant/simulations")
                .then().statusCode(201).body("status",is("RJCT"),"settlement",is("NOT_SETTLED"))
                .extract().path("paymentId");
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("[3].description",containsString("Hypothetical negative outcome"));
    }

    @Test
    void guardRejectsNonSyntheticInvalidRouteOrScenario() {
        String url="/api/v1/labs/sepa-instant/simulations";
        given().contentType("application/json")
                .body("{\"synthetic\":false,\"rail\":\"RT1\",\"scenario\":\"confirmed\"}")
                .post(url).then().statusCode(400);
        given().contentType("application/json")
                .body("{\"synthetic\":true,\"rail\":\"RT1-TIPS\",\"scenario\":\"confirmed\"}")
                .post(url).then().statusCode(400);
        given().contentType("application/json")
                .body("{\"synthetic\":true,\"rail\":\"RT1\",\"scenario\":\"settle-real\"}")
                .post(url).then().statusCode(400);
    }
}

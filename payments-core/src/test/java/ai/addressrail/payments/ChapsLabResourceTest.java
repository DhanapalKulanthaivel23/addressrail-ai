package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class ChapsLabResourceTest {
    private static String payload(String type,String scenario) {
        return "{\"synthetic\":true,\"messageType\":\""+type+"\",\"scenario\":\""+scenario+"\"}";
    }
    private static String create(String type,String scenario) {
        return given().contentType("application/json").body(payload(type,scenario))
                .post("/api/v1/labs/chaps/simulations").then().statusCode(201)
                .body("messageType",is(type),"scenario",is(scenario))
                .extract().path("paymentId");
    }
    @Test void liquidityHoldDoesNotClaimSettlement() {
        String id=given().contentType("application/json").body(payload("pacs.008","liquidity-hold"))
                .post("/api/v1/labs/chaps/simulations").then().statusCode(201)
                .body("status",is("PENDING"),"settlement",is("UNCONFIRMED_LIQUIDITY_HOLD"))
                .extract().path("paymentId");
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("size()",is(4),"[3].type",is("PENDING"),
                      "[3].description",containsString("NOT confirmed"));
        given().get("/api/v1/payments/"+id+"/investigation").then().statusCode(200)
                .body("synthetic",is(true),"status",is("PENDING"),"lastRecordedEvent",is("PENDING"));
    }
    @Test void localRejectDoesNotCreateRtgsEvent() {
        String id=create("pacs.008","local-reject");
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("size()",is(2),"[1].type",is("RJCT"),
                      "[1].description",containsString("no RTGS settlement attempted"));
    }
    @Test void uncertainOutcomeStaysUnknown() {
        String id=given().contentType("application/json").body(payload("pacs.009","outcome-unknown"))
                .post("/api/v1/labs/chaps/simulations").then().statusCode(201)
                .body("status",is("UNKNOWN"),"settlement",is("UNKNOWN")).extract().path("paymentId");
        given().get("/api/v1/payments/"+id).then().statusCode(200)
                .body("scheme",is("CHAPS synthetic"),"currency",is("GBP"),
                      "messageType",is("pacs.009"),"status",is("UNKNOWN"));
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("[3].description",containsString("reconcile"));
    }
    @Test void fictionalCompletionMustNotBeDescribedAsRealSettlement() {
        String id=given().contentType("application/json").body(payload("pacs.009","settlement-demo"))
                .post("/api/v1/labs/chaps/simulations").then().statusCode(201)
                .body("status",is("SIMULATED"),"settlement",is("SIMULATED_ONLY"))
                .extract().path("paymentId");
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("[3].type",is("SIMULATED"),"[3].description",containsString("no Bank of England settlement evidence"));
    }
    @Test void invalidOrNonSyntheticRequestRefused() {
        String url="/api/v1/labs/chaps/simulations";
        given().contentType("application/json").body(payload("pacs.008","settlement-demo").replace("true","false"))
                .post(url).then().statusCode(400);
        given().contentType("application/json").body(payload("MT103","settlement-demo"))
                .post(url).then().statusCode(400);
        given().contentType("application/json").body(payload("pacs.009","live-settlement"))
                .post(url).then().statusCode(400);
    }
    @Test void originalCollectionStillReadOnly() {
        given().contentType("application/json").body(payload("pacs.008","settlement-demo"))
                .post("/api/v1/payments").then().statusCode(404);
        given().get("/api/v1/payments/PAY-10001").then().statusCode(200)
                .body("synthetic",is(true),"status",is("RJCT"));
    }
}

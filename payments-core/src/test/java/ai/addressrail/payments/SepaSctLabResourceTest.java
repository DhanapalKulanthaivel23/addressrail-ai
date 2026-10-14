package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
public class SepaSctLabResourceTest {
    static String payload(String scenario) {
        return """
          {"synthetic":true,"scenario":"%s",
          "debtorName":"SYNTHETIC PAYER LTD","creditorName":"SYNTHETIC RECEIVER LTD",
          "debtorIban":"DE89370400440532013000","creditorIban":"FR1420041010050500013M02606",
          "debtorBic":"AAAADEFFXXX","creditorBic":"BBBBFRPPXXX",
          "amount":125.00,"reference":"AR-DEMO-SCT-001"}
          """.formatted(scenario);
    }

    static String run(String scenario) {
        return given().contentType("application/json").body(payload(scenario))
                .post("/api/v1/labs/sepa-sct/simulations")
                .then().statusCode(201).extract().path("paymentId");
    }

    @Test
    void localRejectionPersistsExactlyTwoEventsAndNoInterbankSubmission() {
        String id=run("invalid-iban");
        given().get("/api/v1/payments/"+id).then().statusCode(200)
                .body("status",is("RJCT"),"synthetic",is(true),"scheme",is("SEPA SCT synthetic"), "messageType",is("pain.001"));
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("size()",is(2),"[0].type",is("INITIATED"),
                      "[1].type",is("RJCT"),"[1].description",containsString("no pacs.008 submitted"));
        given().get("/api/v1/payments/"+id+"/investigation").then().statusCode(200)
                .body("status",is("RJCT"),"lastRecordedEvent",is("RJCT"),
                      "lastEvidenceRef",containsString(id));
    }

    @Test
    void csmRejectionIsDistinctAndHasInterbankEvidence() {
        String id=run("csm-reject");
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("size()",is(4),"[2].type",is("INTERBANK_SIMULATED"),
                      "[3].type",is("RJCT"),"[3].description",containsString("Hypothetical"));
    }

    @Test
    void technicalAcceptanceNeverClaimsSettlement() {
        String id=given().contentType("application/json").body(payload("accepted"))
                .post("/api/v1/labs/sepa-sct/simulations")
                .then().statusCode(201)
                .body("status",is("ACTC"),"settlement",is("UNVERIFIED"))
                .extract().path("paymentId");
        given().get("/api/v1/payments/"+id).then().statusCode(200)
                .body("messageType",is("pacs.008"));
        given().get("/api/v1/payments/"+id+"/events").then().statusCode(200)
                .body("size()",is(4),"[3].type",is("ACTC"),
                      "[3].description",containsString("settlement and credit unverified"));
    }

    @Test
    void refusesNonSyntheticDataAndUnknownScenario() {
        given().contentType("application/json")
                .body(payload("accepted").replace("\"synthetic\":true","\"synthetic\":false"))
                .post("/api/v1/labs/sepa-sct/simulations").then().statusCode(400);
        given().contentType("application/json").body(payload("live-settlement"))
                .post("/api/v1/labs/sepa-sct/simulations").then().statusCode(400);
        given().contentType("application/json")
                .body(payload("accepted").replace("SYNTHETIC PAYER LTD","ALICE REAL PERSON"))
                .post("/api/v1/labs/sepa-sct/simulations").then().statusCode(400);
    }

    @Test
    void refusesUnexpectedAccountOrMonetaryInput() {
        given().contentType("application/json")
                .body(payload("accepted").replace("FR1420041010050500013M02606","FR001234INVALID"))
                .post("/api/v1/labs/sepa-sct/simulations").then().statusCode(400);
        given().contentType("application/json")
                .body(payload("accepted").replace("125.00","0.00"))
                .post("/api/v1/labs/sepa-sct/simulations").then().statusCode(400);
    }

    @Test
    void existingCollectionIsStillReadOnly() {
        given().contentType("application/json").body(payload("accepted"))
                .post("/api/v1/payments").then().statusCode(404);
        given().contentType("application/json").body("{}")
                .post("/api/v1/payments/PAY-10001").then().statusCode(405);
    }
}

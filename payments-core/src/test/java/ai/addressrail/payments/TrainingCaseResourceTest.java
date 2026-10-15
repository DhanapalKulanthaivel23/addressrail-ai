package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class TrainingCaseResourceTest {
    private static final String BASE="/api/v1/labs/investigation-cases";
    @Test void opensCaseNotesAndTransitionsWithoutChangingPayment() {
        String id=given().contentType("application/json")
                .body("{\"paymentId\":\"PAY-10001\",\"actorAlias\":\"TRAINING-Analyst1\"}")
                .post(BASE).then().statusCode(201)
                .body("trainingCase.paymentId",is("PAY-10001"),
                      "trainingCase.state",is("OPEN"),"history.size()",is(1))
                .extract().path("trainingCase.id");
        given().contentType("application/json")
                .body("{\"actorAlias\":\"TRAINING-Analyst1\",\"note\":\"Checked synthetic RJCT evidence\"}")
                .post(BASE+"/"+id+"/notes").then().statusCode(200)
                .body("history.size()",is(2),"history[1].action",is("NOTE"));
        int version=given().get(BASE+"/"+id).then().statusCode(200)
                .extract().path("trainingCase.version");
        given().contentType("application/json")
                .body("{\"actorAlias\":\"TRAINING-Analyst1\",\"ownerAlias\":\"TRAINING-Team2\",\"state\":\"IN_REVIEW\",\"note\":\"Reassign synthetic investigation\",\"expectedVersion\":"+version+"}")
                .post(BASE+"/"+id+"/transition").then().statusCode(200)
                .body("trainingCase.state",is("IN_REVIEW"),
                      "trainingCase.ownerAlias",is("TRAINING-Team2"),
                      "history.size()",is(3),"history[2].action",is("TRANSITION"));
        given().get(BASE+"/by-payment/PAY-10001").then().statusCode(200)
                .body("trainingCase.id",is(id));
        given().get("/api/v1/payments/PAY-10001").then().statusCode(200)
                .body("status",is("RJCT"),"synthetic",is(true));
    }
    @Test void rejectsUntrustedOrNonSyntheticInputs() {
        given().contentType("application/json")
                .body("{\"paymentId\":\"PAY-10001\",\"actorAlias\":\"alice@example.com\"}")
                .post(BASE).then().statusCode(400);
        given().contentType("application/json")
                .body("{\"paymentId\":\"UNKNOWN\",\"actorAlias\":\"TRAINING-Analyst2\"}")
                .post(BASE).then().statusCode(404);
    }
}

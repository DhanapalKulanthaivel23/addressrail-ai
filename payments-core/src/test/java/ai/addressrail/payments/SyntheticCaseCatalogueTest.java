package ai.addressrail.payments;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@QuarkusTest
class SyntheticCaseCatalogueTest {
    @Test void seedAppearsAndIsSynthetic() {
        given().get("/api/v1/labs/cases").then().statusCode(200)
                .body("find { it.paymentId == 'PAY-10001' }.status",is("RJCT"))
                .body("find { it.paymentId == 'PAY-10001' }.synthetic",is(true));
    }
    @Test void statusFilterAndBoundedLimit() {
        given().queryParam("status","RJCT").queryParam("limit",10).get("/api/v1/labs/cases")
                .then().statusCode(200).body("every { it.status == 'RJCT' }",is(true));
        given().queryParam("limit",0).get("/api/v1/labs/cases").then().statusCode(400);
        given().queryParam("limit",101).get("/api/v1/labs/cases").then().statusCode(400);
        given().queryParam("status","bad value").get("/api/v1/labs/cases").then().statusCode(400);
    }
    @Test void onlyGetIsSupported() {
        given().contentType("application/json").body("{}")
                .post("/api/v1/labs/cases").then().statusCode(405);
    }
}

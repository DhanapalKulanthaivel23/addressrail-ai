"""Tests for synthetic bank-to-bank rail simulation; no real network operations."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from network import Network,RAILS
from file_adapter import run_file

def sample(rail="SWIFT_CBPR",fmt="PACS008",ident="ABC123"):
    return {"rail":rail,"sender":"BANKAA22","receiver":"BANKBB33",
            "format":fmt,"payload":"<SyntheticPayment>EUR 100</SyntheticPayment>",
            "correlation_id":ident}

class NetworkTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.db=Path(self.temp.name)/"network.sqlite"
        self.net=Network(self.db)
    def test_all_rails_route_and_return_to_originator(self):
        formats={"SWIFT_CBPR":"MT103","SEPA_SCT":"PACS008",
                 "SEPA_SCT_INST":"PACS008","SEPA_SDD":"PACS003",
                 "RTGS":"PACS009","CHAPS":"PACS008","T2":"PACS009",
                 "BACS":"BACS_STANDARD18"}
        self.assertEqual(RAILS,set(formats))
        for rail,fmt in formats.items():
            request=sample(rail,fmt,rail)
            accepted=self.net.submit(request)
            self.assertEqual(accepted["state"],"NETWORK_ACCEPTED")
            self.assertFalse(accepted["settlement_attested"])
            self.assertEqual(self.net.inbox("BANKBB33")[-1]["message_id"],accepted["message_id"])
            response=self.net.respond(accepted["message_id"],"BANKBB33","ACCEPTED","BANK_ACCEPTED")
            self.assertEqual(response["state"],"ACCEPTED")
            self.assertEqual(self.net.sender_status("BANKAA22",accepted["message_id"])["state"],"ACCEPTED")
    def test_duplicate_key_does_not_duplicate_payment(self):
        first=self.net.submit(sample())
        second=self.net.submit(sample())
        self.assertEqual(first["message_id"],second["message_id"])
        self.assertTrue(second["duplicate"])
        changed=sample()
        changed["payload"]="other"
        with self.assertRaises(ValueError):self.net.submit(changed)
    def test_only_receiver_can_set_final_outcome(self):
        ident=self.net.submit(sample())["message_id"]
        with self.assertRaises(PermissionError):self.net.respond(ident,"BANKAA22","ACCEPTED","BANK_ACCEPTED")
        with self.assertRaises(PermissionError):self.net.sender_status("BANKBB33",ident)
        self.net.respond(ident,"BANKBB33","REJECTED","BANK_REJECTED")
        with self.assertRaises(ValueError):self.net.respond(ident,"BANKBB33","ACCEPTED","BANK_ACCEPTED")
    def test_persistence_restart(self):
        ident=self.net.submit(sample())["message_id"]
        self.assertEqual(Network(self.db).get(ident)["state"],"NETWORK_ACCEPTED")
    def test_bad_format_and_unsafe_xml_rejected(self):
        with self.assertRaises(ValueError):self.net.submit(sample("BACS","MT103"))
        request=sample()
        request["payload"]="<!DOCTYPE s [<!ENTITY e SYSTEM 'file:///etc/passwd'>]>"
        with self.assertRaises(ValueError):self.net.submit(request)
    def test_file_adapter_request_and_response(self):
        src=Path(self.temp.name)/"req.json"
        out=Path(self.temp.name)/"responses"
        src.write_text(json.dumps({"action":"submit","data":sample()}))
        first=run_file(db_path=self.db,incoming=src,outgoing=out)
        self.assertEqual(json.loads((out/src.name).read_text())["message_id"],first["message_id"])
        with self.assertRaises(FileExistsError):
            run_file(db_path=self.db,incoming=src,outgoing=out)
        other=Path(self.temp.name)/"response.json"
        other.write_text(json.dumps({"action":"respond","message_id":first["message_id"],
                                     "data":{"bank":"BANKBB33","state":"REJECTED",
                                             "reason":"BANK_REJECTED"}}))
        result=run_file(db_path=self.db,incoming=other,outgoing=out)
        self.assertEqual(result["state"],"REJECTED")

if __name__=="__main__":
    unittest.main()

import json
import queue
import sys
import tempfile
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from network import Network
from mq_adapter import process_once

class QueueAdapterTests(unittest.TestCase):
    def test_mq_request_reply_two_banks(self):
        with tempfile.TemporaryDirectory() as d:
            network=Network(Path(d)/"test.sqlite")
            req,resp=queue.Queue(),queue.Queue()
            req.put(json.dumps({"action":"submit","data":{
              "rail":"SWIFT_CBPR","sender":"BANKAA22","receiver":"BANKBB33",
              "format":"MT103","payload":"{SIMULATED:MT103}",
              "correlation_id":"MQTEST001"}}).encode())
            result=process_once(network=network,request_queue=req,response_queue=resp)
            self.assertEqual(result["state"],"NETWORK_ACCEPTED")
            self.assertEqual(json.loads(resp.get())["message_id"],result["message_id"])
            self.assertEqual(len(network.inbox("BANKBB33")),1)
            req.put(json.dumps({"action":"respond","message_id":result["message_id"],
              "data":{"bank":"BANKBB33","state":"REJECTED","reason":"BANK_REJECTED"}}).encode())
            self.assertEqual(process_once(network=network,request_queue=req,
                                         response_queue=resp)["state"],"REJECTED")
            self.assertEqual(network.sender_status("BANKAA22",result["message_id"])["state"],"REJECTED")
    def test_malformed_mq_envelope_does_not_publish_reply(self):
        with tempfile.TemporaryDirectory() as d:
            req,resp=queue.Queue(),queue.Queue()
            req.put(b'not-json')
            with self.assertRaises(ValueError):
                process_once(network=Network(Path(d)/"network.sqlite"),
                             request_queue=req,response_queue=resp)
            self.assertTrue(resp.empty())

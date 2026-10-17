"""Transport-neutral MQ request/reply adapter for the synthetic rail network.

request_queue.get() returns bytes, and response_queue.put(bytes) publishes a
reply. This adapter only defines the message contract; an IBM MQ/JMS or Kafka
client, acknowledgements and security must be provided by a separate transport.
"""
import json
from network import Network

def process_envelope(network,raw):
    if not isinstance(raw,bytes) or not 1<=len(raw)<=100000:
        raise ValueError("Invalid synthetic MQ envelope size")
    data=json.loads(raw)
    if not isinstance(data,dict):
        raise ValueError("Object envelope required")
    if set(data)=={"action","data"} and data["action"]=="submit":
        return network.submit(data["data"])
    if set(data)=={"action","message_id","data"} and data["action"]=="respond":
        return network.respond(data["message_id"],**data["data"])
    raise ValueError("Unknown synthetic MQ operation")

def process_once(*,network,request_queue,response_queue):
    """Handle one queued envelope; caller owns broker-level ack/redelivery.

    Publish reply AFTER durable network operation succeeds. For true MQ
    atomic delivery, integrate broker transactions/outbox and poison DLQ.
    """
    raw=request_queue.get()
    result=process_envelope(network,raw)
    reply=json.dumps(result,sort_keys=True,separators=(",",":")).encode()
    response_queue.put(reply)
    return result

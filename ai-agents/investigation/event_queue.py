"""Optional bounded in-process synthetic event queue example.

This is training-only event-driven orchestration: no durability, distributed
idempotence or production service-level guarantees. Nothing runs by default.
"""
from __future__ import annotations
import asyncio
import secrets
from dataclasses import dataclass,field
from time import monotonic
from .copilot import CopilotRequest, CopilotResponse

@dataclass
class Job:
    id: str
    request: CopilotRequest
    state: str = "QUEUED"
    result: CopilotResponse | None = None
    created: float = field(default_factory=monotonic)
    error_code: str | None = None

class DemoEventQueue:
    def __init__(self, handler, capacity:int=16):
        if not 1<=capacity<=100:
            raise ValueError("Bounded capacity required")
        self.queue: asyncio.Queue[str]=asyncio.Queue(maxsize=capacity)
        self.jobs: dict[str,Job]={}
        self.handler=handler
        self.worker: asyncio.Task | None=None

    async def start(self):
        if self.worker is not None:
            raise RuntimeError("Already started")
        self.worker=asyncio.create_task(self._run())

    def publish(self, request:CopilotRequest)->str:
        self.expire()
        if self.worker is None or self.worker.done():
            raise RuntimeError("Local worker not started")
        if self.queue.full():
            raise OverflowError("Local queue capacity exceeded")
        job=Job(id="AR-JOB-"+secrets.token_hex(10),request=request)
        self.jobs[job.id]=job
        self.queue.put_nowait(job.id)
        return job.id

    def lookup(self,id:str)->Job|None:
        self.expire()
        return self.jobs.get(id)

    def expire(self):
        # No user data persists beyond 10 min in this process.
        now=monotonic()
        for id,job in list(self.jobs.items()):
            if job.state in ("DONE","FAILED") and now-job.created>600:
                self.jobs.pop(id,None)

    async def _run(self):
        while True:
            job_id=await self.queue.get()
            try:
                job=self.jobs[job_id]
                job.state="RUNNING"
                job.result=await self.handler(job.request)
                job.state="DONE"
            except asyncio.CancelledError:
                job.state="FAILED"
                job.error_code="WORKER_CANCELLED"
                raise
            except Exception:
                # Avoid exposing raw payment or API/provider exception text.
                job.state="FAILED"
                job.error_code="INVESTIGATION_UNAVAILABLE"
            finally:
                self.queue.task_done()

    async def stop(self):
        if self.worker is None:
            return
        self.worker.cancel()
        try:
            await self.worker
        except asyncio.CancelledError:
            pass
        self.worker=None

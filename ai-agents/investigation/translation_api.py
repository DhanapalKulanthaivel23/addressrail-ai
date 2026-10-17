"""Private, opt-in synthetic parser/translation API; no network transmission."""
import os
from typing import Annotated
from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from .copilot_api import gateway_auth
from .iso_translation import inspect_message, mt_to_mx, mx_to_mt

router = APIRouter(prefix='/api/messages/v1', tags=['local-synthetic-translation'])

class MessageIn(BaseModel):
    model_config = ConfigDict(extra='forbid')
    synthetic: bool
    message: str = Field(min_length=1, max_length=48000)

class TranslationIn(MessageIn):
    source_type: str = Field(max_length=40)
    target_type: str = Field(max_length=40)
    context: dict[str,Annotated[str,Field(max_length=100)]] = Field(default_factory=dict, max_length=5)
    allow_metadata_loss: bool = False


def authorize(request, authorization, synthetic):
    if os.getenv('ADDRESSRAIL_ENABLE_TRANSLATION') != 'true':
        raise HTTPException(404, 'Local message translation disabled')
    gateway_auth(request, authorization)
    if synthetic is not True:
        raise HTTPException(422, 'Synthetic messages only')


def response(value):
    return JSONResponse(value, headers={'Cache-Control':'no-store',
                                       'X-Content-Type-Options':'nosniff'})

@router.post('/inspect')
def inspect_api(request:Request, body:MessageIn, authorization:str|None=Header(default=None)):
    authorize(request, authorization, body.synthetic)
    try:
        return response(inspect_message(body.message))
    except ValueError:
        raise HTTPException(422, 'Message exceeds the safe parser scope') from None
    except (OSError, KeyError, TypeError):
        raise HTTPException(503, 'Offline schema configuration unavailable') from None

@router.post('/translate')
def translate_api(request:Request, body:TranslationIn, authorization:str|None=Header(default=None)):
    authorize(request, authorization, body.synthetic)
    try:
        if body.source_type == 'MT103_BLOCK4':
            result = mt_to_mx(body.message, body.target_type, body.context)
        elif body.target_type == 'MT103_BLOCK4':
            # Verify declared source against actual namespace, never trust a label.
            parsed = inspect_message(body.message)
            if parsed['message_id'] != body.source_type:
                raise ValueError('Declared source does not match XML')
            if body.context:
                raise ValueError('Reverse mapping accepts no enrichment')
            result = mx_to_mt(body.message, body.allow_metadata_loss)
        else:
            result = {'status':'UNSUPPORTED_MAPPING','output':None,
                      'synthetic':True,'settlement_attested':False,'safe_to_retry':False}
        return response(result)
    except ValueError:
        raise HTTPException(422, 'Message or enrichment is outside the declared mapping subset') from None
    except (OSError, KeyError, TypeError):
        raise HTTPException(503, 'Offline schema configuration unavailable') from None

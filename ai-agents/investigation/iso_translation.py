"""Independent, synthetic-only, loss-aware local message conversion.

Generic pain/pacs/camt parsing is separate from version-pinned base XSD checks.
Only the declared MT103 block-4 <-> pacs.008.001.13/.14 subset is mapped. No
network envelopes, Swift translation rules, CBPR+ certification or transmission.
"""
from collections import Counter
from datetime import date, datetime
from decimal import Decimal
from hashlib import sha256
import re
from lxml import etree
from .schema_validation import inspect, offline_parser, NS_VERSION

PREFIX = 'urn:iso:std:iso:20022:tech:xsd:'
VERSIONS = ('pacs.008.001.13', 'pacs.008.001.14')
CHARGES = {'OUR':'DEBT', 'BEN':'CRED', 'SHA':'SHAR'}
MT_CHAR = re.compile(r"[A-Za-z0-9/\-?:().,'+ \n]+\Z")
BIC = re.compile(r'[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?\Z')


def bounded(message):
    if not isinstance(message, str) or not 1 <= len(message.encode()) <= 48000:
        raise ValueError('Message must contain 1 to 48000 UTF-8 bytes')
    if not any(x in message.upper() for x in ('SYNTHETIC', 'TEST-', 'AR-DEMO')):
        raise ValueError('Explicit synthetic marker required')


def parse_mx(message):
    bounded(message)
    if '<!DOCTYPE' in message.upper() or '<!ENTITY' in message.upper():
        raise ValueError('DTD/entity declarations are refused')
    try:
        root = etree.fromstring(message.encode(), parser=offline_parser())
    except etree.XMLSyntaxError:
        raise ValueError('Malformed XML') from None
    ns = etree.QName(root).namespace
    if etree.QName(root).localname != 'Document' or not ns or not NS_VERSION.fullmatch(ns):
        raise ValueError('Expected ISO pain/pacs/camt Document namespace')
    fields = []
    def walk(node, path, depth):
        if depth > 48 or len(fields) >= 5000:
            raise ValueError('XML complexity limit exceeded')
        if not isinstance(node.tag, str):
            raise ValueError('Comments/processing instructions are unsupported in translation')
        if etree.QName(node).namespace != ns:
            raise ValueError('Mixed namespaces are unsupported')
        fields.append({'path':path, 'value':node.text or '', 'attributes':dict(node.attrib)})
        counts = Counter()
        for child in node:
            if not isinstance(child.tag, str):
                raise ValueError('Comments/processing instructions are unsupported in translation')
            name = etree.QName(child).localname
            counts[name] += 1
            walk(child, f'{path}/{name}[{counts[name]}]', depth+1)
    walk(root, '/Document[1]', 0)
    return root, ns, fields


def inspect_message(message, schema_dir=None):
    root, ns, fields = parse_mx(message)
    return {'message_id':ns[len(PREFIX):], 'well_formed':True,
            'source_sha256':sha256(message.encode()).hexdigest(), 'fields':fields,
            'base_schema':inspect(message, schema_dir).asdict(),
            'scheme_rules':'NOT_ASSESSED', 'synthetic':True,
            'settlement_attested':False, 'safe_to_retry':False}


def parse_mt103(message):
    bounded(message)
    text = message.replace('\r\n', '\n')
    # Explicit block 4 only. Never ignore headers/trailers or guess an MT type.
    if not text.startswith('{4:\n') or not text.endswith('\n-}'):
        raise ValueError('Only an explicitly declared MT103 block 4 is supported')
    text = text[4:-3]
    if not MT_CHAR.fullmatch(text):
        raise ValueError('Unsupported MT characters; no automatic transliteration')
    fields = {}
    current = None
    for line in text.split('\n'):
        match = re.fullmatch(r':(\d{2}[A-Z]?):(.*)', line)
        if match:
            current, value = match.groups()
            if current in fields:
                raise ValueError('Duplicate MT fields are unsupported')
            fields[current] = value
        elif current:
            fields[current] += '\n' + line
        else:
            raise ValueError('Unparsed MT content')
    return fields


def envelope(status, source, target, **details):
    return {'status':status, 'source_type':source, 'target_type':target,
            'mapping_version':'independent-synthetic-mt103-pacs008-v1',
            'synthetic':True, 'requires_human_review':True,
            'network_envelope_generated':False, 'scheme_rules':'NOT_ASSESSED',
            'settlement_attested':False, 'safe_to_retry':False, **details}


def mt_to_mx(message, target, context, schema_dir=None):
    if target not in VERSIONS:
        return envelope('UNSUPPORTED_MAPPING', 'MT103_BLOCK4', target, output=None)
    fields = parse_mt103(message)
    allowed = {'20','23B','32A','50K','52A','57A','59','70','71A'}
    unknown = sorted(set(fields)-allowed)
    missing = sorted((allowed-{'70'})-set(fields))
    if unknown or missing:
        return envelope('UNSUPPORTED_MAPPING', 'MT103_BLOCK4', target, output=None,
                        unmapped_fields=unknown, missing_fields=missing)
    if fields['23B'] != 'CRED' or fields['71A'] not in CHARGES:
        raise ValueError('Unsupported operation or charge code')
    if not re.fullmatch(r"[A-Za-z0-9/\-?:().,'+ ]{1,16}", fields['20']):
        raise ValueError('Unsupported MT reference')
    match = re.fullmatch(r'(\d{6})([A-Z]{3})(\d{1,12},\d{1,2})', fields['32A'])
    if not match or Decimal(match[3].replace(',', '.')) <= 0:
        raise ValueError('Unsupported settlement amount/date/currency')
    required = {'message_id','creation_time','end_to_end_id','settlement_date','settlement_method'}
    if set(context) != required:
        raise ValueError('Exact explicit MX enrichment fields required: '+', '.join(sorted(required)))
    for key in ('message_id','end_to_end_id'):
        if not isinstance(context[key], str) or not 1 <= len(context[key]) <= 35:
            raise ValueError('Invalid explicit identifier')
    created = datetime.fromisoformat(context['creation_time'].replace('Z','+00:00'))
    if created.tzinfo is None:
        raise ValueError('Explicit creation timestamp with timezone required')
    settlement = date.fromisoformat(context['settlement_date'])
    if settlement.strftime('%y%m%d') != match[1] or not 2000 <= settlement.year <= 2099:
        raise ValueError('Explicit settlement date must resolve MT date in 2000-2099')
    if context['settlement_method'] not in ('INDA','INGA','COVE','CLRG'):
        raise ValueError('Explicit settlement method required')
    for tag in ('52A','57A'):
        if not BIC.fullmatch(fields[tag]):
            raise ValueError('Only bare BIC agent fields are mapped')
    parties = {}
    for tag in ('50K','59'):
        lines = fields[tag].split('\n')
        if lines[0].startswith('/'):
            raise ValueError('Party account mapping is not implemented; no field is discarded')
        if not 1 <= len(lines) <= 4 or any(not 1 <= len(x) <= 35 for x in lines):
            raise ValueError('Party name/address exceeds the declared MT subset')
        parties[tag] = lines
    if '70' in fields and (len(fields['70'].split('\n')) > 4 or
                          any(not 1 <= len(x) <= 35 for x in fields['70'].split('\n'))):
        raise ValueError('Remittance exceeds the declared MT subset')
    ns = PREFIX + target
    root = etree.Element('{'+ns+'}Document', nsmap={None:ns})
    def child(parent, name, value=None, **attrs):
        item = etree.SubElement(parent, '{'+ns+'}'+name, **attrs)
        if value is not None: item.text = value
        return item
    body = child(root, 'FIToFICstmrCdtTrf')
    header = child(body, 'GrpHdr')
    child(header, 'MsgId', context['message_id'])
    child(header, 'CreDtTm', context['creation_time'])
    child(header, 'NbOfTxs', '1')
    child(child(header, 'SttlmInf'), 'SttlmMtd', context['settlement_method'])
    tx = child(body, 'CdtTrfTxInf')
    identification = child(tx, 'PmtId')
    child(identification, 'InstrId', fields['20'])
    child(identification, 'EndToEndId', context['end_to_end_id'])
    child(tx, 'IntrBkSttlmAmt', match[3].replace(',', '.'), Ccy=match[2])
    child(tx, 'IntrBkSttlmDt', context['settlement_date'])
    child(tx, 'ChrgBr', CHARGES[fields['71A']])
    def party(name, lines):
        item = child(tx, name)
        child(item, 'Nm', lines[0])
        if len(lines)>1:
            address = child(item, 'PstlAdr')
            for line in lines[1:]: child(address, 'AdrLine', line)
    party('Dbtr', parties['50K'])
    child(child(tx, 'DbtrAgt'), 'FinInstnId')
    child(tx[-1][0], 'BICFI', fields['52A'])
    child(child(tx, 'CdtrAgt'), 'FinInstnId')
    child(tx[-1][0], 'BICFI', fields['57A'])
    party('Cdtr', parties['59'])
    if '70' in fields:
        child(child(tx, 'RmtInf'), 'Ustrd', fields['70'])
    xml = etree.tostring(root, encoding='unicode')
    verdict = inspect(xml, schema_dir).asdict()
    return envelope('BASE_XSD_VALID_CANDIDATE' if verdict['status']=='BASE_XSD_VALID'
                    else 'UNVALIDATED_CANDIDATE', 'MT103_BLOCK4', target,
                    output=xml, base_schema=verdict, unmapped_fields=[],
                    explicit_enrichment=dict(context),
                    limitation='Independent field subset; base XSD is not CBPR+ compliance. No country/town inferred.')


def mx_to_mt(message, allow_metadata_loss=False, schema_dir=None):
    root, ns, fields = parse_mx(message)
    source = ns[len(PREFIX):]
    if source not in VERSIONS:
        return envelope('UNSUPPORTED_MAPPING', source, 'MT103_BLOCK4', output=None)
    n = {'m':ns}
    def one(path):
        nodes = root.findall(path, n)
        if len(nodes)!=1 or nodes[0].text is None:
            raise ValueError('Missing/duplicate field in declared mapping subset')
        return nodes[0].text
    body = 'm:FIToFICstmrCdtTrf/'
    tx = body+'m:CdtTrfTxInf/'
    if one(body+'m:GrpHdr/m:NbOfTxs') != '1' or len(root.findall(body+'m:CdtTrfTxInf', n))!=1:
        raise ValueError('Only one transaction is supported; no batch is split')
    mapped = set()
    def read(path):
        value = one(path)
        mapped.add(root.getroottree().getpath(root.find(path,n)))
        return value
    reference = read(tx+'m:PmtId/m:InstrId')
    amount_node = root.find(tx+'m:IntrBkSttlmAmt',n)
    amount = read(tx+'m:IntrBkSttlmAmt')
    currency = amount_node.get('Ccy','')
    date_text = read(tx+'m:IntrBkSttlmDt')
    code = read(tx+'m:ChrgBr')
    reverse = {v:k for k,v in CHARGES.items()}
    if code not in reverse: raise ValueError('Unsupported charge bearer')
    tags = [('20',reference),('23B','CRED')]
    settlement = date.fromisoformat(date_text)
    if not 2000 <= settlement.year <= 2099 or not re.fullmatch(r'\d{1,12}\.\d{1,2}',amount) or not re.fullmatch('[A-Z]{3}',currency) or Decimal(amount)<=0:
        raise ValueError('Date/currency/amount cannot fit declared MT subset without loss')
    tags.append(('32A',settlement.strftime('%y%m%d')+currency+amount.replace('.',',')))
    def party(name):
        lines = [read(tx+f'm:{name}/m:Nm')]
        for node in root.findall(tx+f'm:{name}/m:PstlAdr/m:AdrLine',n):
            lines.append(node.text or '')
            mapped.add(root.getroottree().getpath(node))
        if len(lines)>4 or any(not 1<=len(x)<=35 for x in lines):
            raise ValueError('Party cannot fit MT without truncation')
        return '\n'.join(lines)
    tags.extend([('50K',party('Dbtr')),('52A',read(tx+'m:DbtrAgt/m:FinInstnId/m:BICFI')),
                 ('57A',read(tx+'m:CdtrAgt/m:FinInstnId/m:BICFI')),('59',party('Cdtr'))])
    remit = root.findall(tx+'m:RmtInf/m:Ustrd',n)
    if len(remit)>1: raise ValueError('Multiple remittance fields are unsupported')
    if remit:
        text=read(tx+'m:RmtInf/m:Ustrd')
        if len(text.split('\n'))>4 or any(not 1<=len(x)<=35 for x in text.split('\n')):
            raise ValueError('Remittance would require truncation')
        tags.append(('70',text))
    tags.append(('71A',reverse[code]))
    metadata_paths = {body+'m:GrpHdr/m:MsgId',body+'m:GrpHdr/m:CreDtTm',
        body+'m:GrpHdr/m:NbOfTxs',body+'m:GrpHdr/m:SttlmInf/m:SttlmMtd',
        tx+'m:PmtId/m:EndToEndId'}
    metadata = {root.getroottree().getpath(node) for p in metadata_paths for node in root.findall(p,n)}
    residual=[]
    for node in root.iter():
        path=root.getroottree().getpath(node)
        for attr in node.attrib:
            if not (node is amount_node and attr=='Ccy'):
                residual.append(path+'/@'+attr)
        if not len(node) and path not in mapped and path not in metadata:
            residual.append(path)
        if len(node) and node.text and node.text.strip(): residual.append(path+'/text()')
        if node.tail and node.tail.strip(): residual.append(path+'/tail()')
    if residual:
        return envelope('UNSUPPORTED_MAPPING',source,'MT103_BLOCK4',output=None,unmapped_fields=residual)
    lost=[{'path':root.getroottree().getpath(node),'value':node.text}
          for node in root.iter() if root.getroottree().getpath(node) in metadata]
    if lost and not allow_metadata_loss:
        return envelope('LOSS_REQUIRES_ACKNOWLEDGEMENT',source,'MT103_BLOCK4',output=None,unmapped_metadata=lost)
    text='{4:\n'+'\n'.join(':'+tag+':'+value for tag,value in tags)+'\n-}'
    # Reparse to refuse oversized IDs/characters and preserve explicit synthetic scope.
    parsed=parse_mt103(text)
    if len(reference)>16 or not all(BIC.fullmatch(parsed[k]) for k in ('52A','57A')):
        raise ValueError('Unsupported reference or agent for MT subset')
    return envelope('LOSSY_REVIEW_CANDIDATE' if lost else 'REVIEW_CANDIDATE',source,'MT103_BLOCK4',
        output=text,unmapped_metadata=lost,base_schema=inspect(message,schema_dir).asdict(),
        limitation='Block 4 only; listed MX metadata has no mapped MT field. No network headers/trailers.')

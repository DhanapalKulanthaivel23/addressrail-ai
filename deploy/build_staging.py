"""Package the existing public site for a root-hosted, synthetic staging preview."""
from pathlib import Path
import argparse
import json
import shutil
import subprocess


def build(destination: Path):
    root = Path(__file__).resolve().parents[1]
    if destination.exists():
        raise FileExistsError('Use a new staging output directory')
    shutil.copytree(root / 'web', destination)
    source_url = 'https://dhanapalkulanthaivel23.github.io/addressrail-ai/'
    banner = ('<aside role="note" style="padding:10px 20px;background:#fff3cd;'
              'color:#392b00;font:14px system-ui;text-align:center">'
              'Staging preview · Synthetic payments only · '
              'Backend SaaS deployment pending</aside>')
    for page in destination.rglob('*.html'):
        text = page.read_text()
        text = text.replace(source_url, '/')
        text = text.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">', 1)
        import re
        text = re.sub(r'(<body\b[^>]*>)', lambda match: match[0] + banner, text, count=1)
        page.write_text(text)
    (destination / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
    (destination / '_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n')
    sha = subprocess.check_output(['git', '-C', str(root), 'rev-parse', 'HEAD'], text=True).strip()
    (destination / 'staging.json').write_text(json.dumps({
        'source_commit': sha, 'scope': 'existing-static-synthetic-preview',
        'backend_deployed': False, 'tenant_saas_ready': False}, indent=2) + '\n')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('destination', type=Path)
    build(parser.parse_args().destination.resolve())

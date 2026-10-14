#!/usr/bin/env python3
"""Cruza as grades locais com as referências e cadastra os dias na curadoria.

Preserva textos, URLs e prioridades existentes. Não acessa a rede.
Uso: python scripts/sincronizar_curadoria.py
"""
from pathlib import Path
from datetime import datetime
import json
import re

from gerar_site import ROOT, slug


def read_references(root):
    catalog = {}
    for line in (root / 'referencias/todos-os-filmes-citados.md').read_text().splitlines():
        if not line.startswith('| '):
            continue
        cells = [cell.strip() for cell in line.split('|')[1:-1]]
        if len(cells) != 6 or cells[0] == 'Filme' or set(cells[0]) <= {'-', ' '}:
            continue
        catalog[slug(cells[0])] = cells
    text = (root / 'referencias/filmes-para-escolher.md').read_text()
    guide = {}
    for order, block in enumerate(re.split(r'^### ', text, flags=re.M)[1:]):
        title = block.split(' — ')[0]
        premise = re.search(r'\*\*Premissa:\*\* ([^\n]+)', block)
        recommendation = re.search(r'\*\*Vale ver se:\*\*\s*(.*?)\s*\*\*Deixe para depois se:', block, re.S)
        link = re.search(r'\]\((https://mostra.org/filmes/[^)]+)\)', block)
        if premise:
            reason = ' '.join(recommendation[1].split()) if recommendation else ''
            guide[slug(title)] = {'summary': premise[1][0].upper() + premise[1][1:],
                                  'url': link[1] if link else None, 'order': order,
                                  'why': 'Vale ver se ' + reason[0].lower() + reason[1:] if reason else ''}
    initial_picks = {slug(title): rank for rank, title in enumerate(
        re.findall(r'^- \[ \] \*\*([^*]+)\*\*', text, flags=re.M), 1)}
    return catalog, guide, initial_picks


def official_urls(root):
    # O cache é opcional; quando presente, fornece o endereço real de cada ficha.
    from mostra_nuxt import read_schedule
    urls = {}
    for path in sorted((root / 'cache/programacao').glob('*.html')):
        for row in read_schedule(path.read_text()):
            address = str(row.get('url', '')).strip('/')
            if address and '/' not in address:
                urls[slug(row['titulo'])] = 'https://mostra.org/filmes/' + address
    return urls


def synchronize(root=ROOT):
    root = Path(root)
    path = root / 'referencias/curadoria_site.json'
    current = json.loads(path.read_text())
    catalog, guide, initial_picks = read_references(root)
    urls = official_urls(root)
    previous_dates = {day for film in current.values() for day in film['days']}
    by_day = {}
    added = 0
    for schedule in sorted((root / 'programacao_por_dia').glob('*.md')):
        lines = schedule.read_text().splitlines()
        if len(lines) % 15:
            raise ValueError(f'{schedule.name}: bloco incompleto')
        for index in range(0, len(lines), 15):
            block = lines[index:index + 15]
            fields = [value for value in block[4:12] if value.strip()]
            if len(fields) != 4 or block[0] != block[3]:
                raise ValueError(f'{schedule.name}:{index + 1}: ficha inválida')
            day = datetime.strptime(block[12], '%d/%m/%Y').date().isoformat()
            by_day.setdefault(day, set())
            key = slug(block[0])
            if key not in catalog:
                continue
            by_day[day].add(key)
            if key not in current:
                title, director, award, oscar, other, sources = catalog[key]
                details = guide.get(key, {})
                summary = details.get('summary', f'{fields[2]} de {fields[0]}.')
                if not details and other.startswith('Sobre '):
                    summary = other.rstrip('.') + '.'
                tags = [fields[2]]
                if 'Brasil' in fields[1].split(', '):
                    tags.append('Brasil')
                if award != 'Prêmio não informado' and 'prêmio não informado' not in award:
                    tags.append('Premiados')
                current[key] = dict(title=block[0], tags=tags, summary=summary,
                                    award='' if award == 'Prêmio não informado' else award,
                                    why=details.get('why', ''), url=details.get('url') or urls.get(key) or 'https://mostra.org/filmes/' + key,
                                    days={})
                added += 1
            current[key]['days'].setdefault(day, 99)
    # Guarda uma prioridade geral para não recalculá-la a partir de dias automáticos.
    # É editável: número menor ganha prioridade; null deixa o filme sem destaque padrão.
    for key, film in current.items():
        if 'default_priority' in film:
            continue
        old_ranks = [rank for day, rank in film['days'].items() if day in previous_dates and rank < 99]
        film['default_priority'] = (initial_picks[key] if key in initial_picks else
                                    min(old_ranks) + 5 if old_ranks else
                                    20 + guide[key]['order'] if key in guide else None)
    for day, keys in by_day.items():
        if day in previous_dates:
            continue
        candidates = [key for key in keys if current[key]['default_priority'] is not None]
        candidates.sort(key=lambda key: (current[key]['default_priority'], key))
        for rank, key in enumerate(candidates[:12], 1):
            current[key]['days'][day] = rank
    if any(not keys for keys in by_day.values()):
        raise ValueError('Há uma grade sem títulos reconhecidos nas referências')
    path.write_text(json.dumps(current, ensure_ascii=False, indent=2) + '\n')
    print(f'Curadoria sincronizada: {len(by_day)} dias, {added} novos títulos. Prioridades anteriores preservadas.')
    missing = [film['title'] for film in current.values() if not film.get('why', '').strip()]
    if missing:
        print("Antes de gerar o site, preencha 'why' para: " + '; '.join(missing))
    return current


if __name__ == '__main__':
    try:
        synchronize()
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(f'ERRO: {error}')

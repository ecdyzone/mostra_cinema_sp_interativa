#!/usr/bin/env python3
"""Atualiza o HTML autossuficiente a partir da curadoria e das grades por dia.

Uso: python scripts/gerar_site.py
Para incluir dias, acrescente as grades em programacao_por_dia/ e execute
python scripts/sincronizar_curadoria.py antes de gerar o site.
"""
from pathlib import Path
from datetime import datetime
import html
import json
import re
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
WEEKDAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo']

def weekday(date):
    return WEEKDAYS[datetime.strptime(date, '%Y-%m-%d').weekday()]

def slug(text):
    text = ''.join(c for c in unicodedata.normalize('NFD', text.lower()) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')

def validate_curadoria(curadoria):
    missing = [film.get('title', key) for key, film in curadoria.items()
               if not isinstance(film.get('why'), str) or not film['why'].strip()]
    if missing:
        raise ValueError("Preencha o campo 'why' em referencias/curadoria_site.json para: "
                         + '; '.join(missing))

def load_sessions(include_all=False):
    curadoria = json.loads((ROOT / 'referencias/curadoria_site.json').read_text())
    validate_curadoria(curadoria)
    urls = {}
    if include_all:
        from mostra_nuxt import read_schedule
        for cached in sorted((ROOT / 'cache/programacao').glob('*.html')):
            for row in read_schedule(cached.read_text()):
                address = str(row.get('url', '')).strip('/')
                if address and '/' not in address:
                    urls[slug(row['titulo'])] = 'https://mostra.org/filmes/' + address
    sessions = []
    for path in sorted((ROOT / 'programacao_por_dia').glob('*.md')):
        lines = path.read_text().splitlines()
        if len(lines) % 15:
            raise ValueError(f'{path.name}: bloco incompleto')
        for offset in range(0, len(lines), 15):
            block = lines[offset:offset + 15]
            if block[0] != block[3]:
                raise ValueError(f'{path.name}:{offset + 1}: títulos divergentes')
            # Os dois arquivos usam posições diferentes para as linhas vazias.
            fields = [line.strip() for line in block[4:12] if line.strip()]
            if len(fields) != 4:
                raise ValueError(f'{path.name}:{offset + 1}: ficha incompleta')
            date = datetime.strptime(block[12], '%d/%m/%Y').date().isoformat()
            datetime.strptime(block[13], '%H:%M')
            key = slug(block[0])
            editorial = curadoria.get(key)
            curated = bool(editorial and date in editorial['days'])
            if not curated and not include_all:
                continue
            rank = editorial['days'][date] if curated else 999
            duration = re.fullmatch(r"(\d+)\s*(?:min\.?|['′’])", fields[3])
            if not duration or int(duration[1]) <= 0:
                raise ValueError(f'{path.name}:{offset + 1}: duração inválida: {fields[3]}')
            if editorial:
                session = {k: v for k, v in editorial.items() if k not in ('days', 'legacyId', 'default_priority')}
            else:
                tags = [fields[2]]
                if 'Brasil' in fields[1].split(', '):
                    tags.append('Brasil')
                session = dict(title=block[0], tags=tags, summary=f'{fields[2]} de {fields[0]}.',
                               award='', why='', url=urls.get(key, 'https://mostra.org/filmes/' + key))
            session.update(id=f'{date}-{key}-{block[13]}-{slug(block[14])}', date=date,
                           director=fields[0], country=fields[1], type=fields[2],
                           minutes=int(duration[1]),
                           time=block[13], venue=block[14], rank=rank, featured=rank < 99, curated=curated)
            if date == '2026-10-17' and editorial and 'legacyId' in editorial:
                session['legacyId'] = editorial['legacyId']
            sessions.append(session)
    # Os curtas de Pelechian estão agrupados pelo mesmo dia, horário e sala.
    groups = {}
    for f in sessions:
        if f['director'] == 'Artavazd Pelechian':
            groups.setdefault((f['date'], f['time'], f['venue']), []).append(f)
    for (date, time, venue), members in groups.items():
        if len(members) < 2:
            continue
        sessions = [f for f in sessions if f not in members]
        program = dict(members[0])
        titles = {slug(f['title']) for f in members}
        history = bool(titles & {'o-comeco', 'nosso-seculo', 'fim', 'vida'})
        nature = bool(titles & {'patrulha-da-montanha', 'terra-do-povo', 'nos', 'as-estacoes'})
        label = 'História e viagem' if history and not nature else 'Trabalho e natureza' if nature and not history else 'Programa de curtas'
        number = 'Quatro' if len(members) == 4 else str(len(members))
        program.update(id=f'{date}-pelechian-{time}-{slug(venue)}',
                       title='Projeto Pelechian · ' + label,
                       type='Programa de curtas', minutes=sum(f['minutes'] for f in members),
                       rank=11 if history else 12, featured=True,
                       summary=f'{number} filmes restaurados de Artavazd Pelechian. Imagens, música e montagem constroem uma experiência entre documentário e cinema experimental.',
                       why='Para quem quer experimentar um cinema construído por imagens, música e montagem, '
                           + ('com arquivos históricos e viagens.' if history and not nature else
                              'sobre trabalho e natureza.' if nature and not history else
                              'em curtas restaurados de Pelechian.')
                           + ' Duração indicada: soma dos filmes, sem apresentações ou intervalos. Confira o programa na Mostra.',
                       url='https://mostra.org/jornal-da-mostra/projeto-pelechian-filmes-restaurados',
                       members=[{k: f[k] for k in ('title', 'minutes', 'url')} for f in members])
        sessions.append(program)
    if len({f['id'] for f in sessions}) != len(sessions):
        raise ValueError('Identificadores de sessão duplicados')
    return sorted(sessions, key=lambda f: (f['date'], f['rank'], f['time'], f['title']))

def render_card(f, default_day):
    esc = html.escape
    duration = f"{f['minutes'] // 60}h{f['minutes'] % 60:02}" if f['minutes'] >= 60 else f"{f['minutes']} min"
    date = datetime.strptime(f['date'], '%Y-%m-%d').strftime('%d/%m')
    members = ''.join(f'<li><a href="{esc(m["url"])}" target="_blank" rel="noopener noreferrer">{esc(m["title"])}</a> · {m["minutes"]} min</li>' for m in f.get('members', []))
    return f'''<article class="film {'featured' if f['featured'] else ''}" data-id="{esc(f['id'])}" data-day="{f['date']}"{' hidden' if f['date'] != default_day or not f['curated'] else ''}>
<p class="session-date">{weekday(f["date"])} · {date}{' · Fora da curadoria' if not f['curated'] else ''}</p>
<div class="session"><time datetime="{f['date']}T{f['time']}:00-03:00">{f['time']}</time><span>{duration} · {esc(f['type'])}</span></div>
<div class="card-head"><h2>{esc(f['title'])}</h2><button class="favorite" aria-pressed="false" aria-label="Marcar {esc(f['title'])} para ver" data-favorite="{esc(f['id'])}"><span aria-hidden="true">☆</span></button></div>
<p class="director">{esc(f['director'])} · {esc(f['country'])}</p>
<p class="venue">{esc(f['venue'])}</p>
<div class="tags">{''.join('<span>' + esc(t) + '</span>' for t in f['tags'])}</div>
{'<p class="award">' + esc(f['award']) + '</p>' if f['award'] else ''}
<p class="summary">{esc(f['summary'])}</p>
{'<ul class="program-films">' + members + '</ul>' if members else ''}
{'<p class="why">' + esc(f['why']) + '</p>' if f['why'] else ''}
<p class="film-link"><a href="{esc(f['url'])}" target="_blank" rel="noopener noreferrer" aria-label="Ver {esc(f['title'])} no site da Mostra (abre em nova aba)">{'Ver programa' if members else 'Ver filme'} no site da Mostra <span aria-hidden="true">↗</span></a></p>
</article>'''

def main():
    sessions = load_sessions(include_all=True)
    if not sessions:
        raise ValueError('Nenhuma sessão selecionada; sincronize a curadoria antes de gerar o site')
    days = sorted({f['date'] for f in sessions})
    path = ROOT / 'index.html'
    page = path.read_text()
    cards = '\n'.join(render_card(f, days[0]) for f in sessions)
    page = re.sub(r'(<section id="filmes"[^>]*>).*?(</section>)', lambda m: m[1] + cards + m[2], page, flags=re.S)
    data = json.dumps(sessions, ensure_ascii=False).replace('</', '<\\/')
    page = re.sub(r'const films = \[.*?\];', lambda _: 'const films = ' + data + ';', page, count=1, flags=re.S)
    dates = ', '.join(datetime.strptime(d, '%Y-%m-%d').strftime('%d/%m') for d in days)
    description = html.escape(f'Seleções para {dates} na 50ª Mostra de Cinema de São Paulo. Filmes, horários, cinemas e motivos para assistir.', quote=True)
    page = re.sub(r'<meta name="description" content="[^"]*">', lambda _: f'<meta name="description" content="{description}">', page, count=1)
    options = ''.join(f'<option value="{d}">{weekday(d)} · {datetime.strptime(d, "%Y-%m-%d").strftime("%d/%m")}</option>' for d in days)
    page = re.sub(r'(<select id="day">).*?(</select>)', lambda m: m[1] + options + m[2], page, flags=re.S)
    default = days[0]
    default_date = datetime.strptime(default, '%Y-%m-%d').strftime('%d/%m/%Y')
    subset = [f for f in sessions if f['date'] == default and f['curated']]
    featured = sum(f['featured'] for f in subset)
    replacements = {
        'date-label': f'{weekday(default)} · {default_date}',
        'intro': f'Curadoria: comece pelos {featured} destaques ou explore as {len(subset)} opções de {default_date[:5]}. Ative “Toda a programação” para ampliar a lista.',
        'count': f'{len(subset)} opções em {default_date[:5]} · Curadoria',
        'featured': f'Só os {featured} destaques',
    }
    for element_id, text in replacements.items():
        pattern = rf'(<(?:p|span|button)\b[^>]*\bid="{element_id}"[^>]*>).*?(</(?:p|span|button)>)'
        page = re.sub(pattern, lambda m: m[1] + html.escape(text) + m[2], page, count=1, flags=re.S)
    page = re.sub(r'(<noscript><p class="nojs">).*?(</p></noscript>)',
                  lambda m: m[1] + f'A seleção de {default_date[:5]} está abaixo. Ative JavaScript para escolher outro dia e usar filtros e favoritos.' + m[2], page, count=1, flags=re.S)
    path.write_text(page)
    for day in days:
        subset = [f for f in sessions if f['date'] == day]
        print(f'{day}: {sum(f["curated"] for f in subset)} na curadoria / {len(subset)} opções no total')

if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError) as error:
        raise SystemExit(f'ERRO: {error}')

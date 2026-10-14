#!/usr/bin/env python3
"""Baixa grades da Mostra com cache e as converte em blocos Markdown de 15 linhas.

Exemplos:
  python scripts/baixar_programacao.py --dias 17 24 --somente-baixar
  python scripts/baixar_programacao.py --dias 17 24 --offline --saida /tmp/mostra-teste
  python scripts/baixar_programacao.py --faltantes
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import date, datetime
from html import unescape
from pathlib import Path
import re
import sys
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from mostra_nuxt import read_schedule

ROOT = Path(__file__).resolve().parents[1]
WEEKDAYS = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo']


@dataclass(frozen=True)
class Session:
    title: str
    section: str
    original_title: str
    director: str
    country: str
    kind: str
    minutes: int
    date: str
    time: str
    venue: str

    def markdown(self) -> str:
        # Layout compatível com scripts/gerar_site.py e com as grades manuais.
        return '\n'.join([
            self.title, '', self.section, self.title, '', self.director, '',
            self.country, '', self.kind, '', f'{self.minutes} min.',
            self.date, self.time, self.venue,
        ]) + '\n'


def page_url(day: int) -> str:
    return 'https://mostra.org/programacao/?' + urlencode({'data': f'{day:02d}/10'})


def destination(folder: Path, day: int) -> Path:
    current = date(2026, 10, day)
    return folder / f'{WEEKDAYS[current.weekday()]}_{current:%d-%m-%Y}.md'


def atomic_write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                         prefix=f'.{path.name}.', delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(content)
        temporary.replace(path)
    finally:
        if temporary and temporary.exists():
            temporary.unlink()


def fetch_page(day: int) -> str:
    request = Request(page_url(day), headers={
        'User-Agent': 'MostraProgramacao/1.0 (consulta pessoal com cache local)',
        'Accept': 'text/html',
    })
    # Uma tentativa por página, sem retries automáticos ou visitas às fichas.
    with urlopen(request, timeout=30) as response:
        content_type = response.headers.get_content_type()
        if content_type != 'text/html':
            raise ValueError(f'{day:02d}/10: resposta {content_type}, esperava HTML')
        charset = response.headers.get_content_charset() or 'utf-8'
        content = response.read().decode(charset)
    if '<html' not in content.lower():
        raise ValueError(f'{day:02d}/10: resposta sem documento HTML')
    return content


def parse_page(content: str, day: int) -> list[Session]:
    return sessions_for_day(read_schedule(content), day)


def sessions_for_day(rows: list[dict], day: int) -> list[Session]:
    def text(value):
        return re.sub(r'\s+', ' ', unescape(str(value))).strip() if value is not None else ''

    expected = f'2026-10-{day:02d}'
    sessions = []
    for row in rows:
        if row.get('pro_data') != expected:
            continue
        duration = re.fullmatch(r"(\d+)\s*(?:min\.?|['′’])", text(row.get('duracao')))
        if not duration:
            raise ValueError(f'{row.get("titulo")}: duração não reconhecida')
        raw_time = text(row.get('pro_hora'))
        try:
            hour = datetime.strptime(raw_time, '%H:%M:%S').strftime('%H:%M')
        except ValueError as error:
            raise ValueError(f'{row.get("titulo")}: horário não reconhecido: {raw_time}') from error
        sections = list(dict.fromkeys(text(row.get(key)) for key in ('secao', 'secao_sec') if text(row.get(key))))
        sessions.append(Session(
            title=text(row.get('titulo')), section=' '.join(sections),
            original_title=text(row.get('titulo_original')),
            director=text(row.get('diretores')), country=text(row.get('pais')),
            kind=text(row.get('genero')), minutes=int(duration[1]),
            date=f'{day:02d}/10/2026', time=hour, venue=text(row.get('pro_sala')),
        ))
    # Mantém a ordem da grade em empates, inclusive os filmes de um mesmo programa.
    return sorted(sessions, key=lambda session: session.time)


def validate_sessions(sessions: list[Session], day: int) -> None:
    if not sessions:
        raise ValueError(f'{day:02d}/10: nenhuma sessão encontrada; Markdown não foi gerado')
    expected = f'{day:02d}/10/2026'
    keys = set()
    for session in sessions:
        if session.date != expected:
            raise ValueError(f'{session.title}: data {session.date}, esperava {expected}')
        if not all((session.title, session.section, session.director,
                    session.country, session.kind, session.venue)):
            raise ValueError(f'{session.title}: ficha incompleta')
        if not re.fullmatch(r'(?:[01]\d|2[0-3]):[0-5]\d', session.time):
            raise ValueError(f'{session.title}: horário inválido: {session.time}')
        if session.minutes <= 0:
            raise ValueError(f'{session.title}: duração inválida')
        if any('\n' in value or '\r' in value for value in session.__dict__.values()
               if isinstance(value, str)):
            raise ValueError(f'{session.title}: campo contém quebra de linha')
        key = (session.title, session.date, session.time, session.venue)
        if key in keys:
            raise ValueError(f'{session.title}: sessão duplicada em {session.time}, {session.venue}')
        keys.add(key)
    markdown = ''.join(s.markdown() for s in sessions)
    if len(markdown.splitlines()) != len(sessions) * 15:
        raise ValueError('Saída não respeita os blocos de 15 linhas')


def run(args: argparse.Namespace) -> int:
    days = sorted(set(args.dias)) if args.dias else list(range(15, 30))
    requested = 0
    last_request = None
    decoded = {}

    def download(day, cache):
        nonlocal requested, last_request
        if last_request is not None:
            remaining = args.intervalo - (time.monotonic() - last_request)
            if remaining > 0:
                time.sleep(remaining)
        print(f'BAIXANDO {page_url(day)}', flush=True)
        last_request = time.monotonic()
        content = fetch_page(day)
        requested += 1
        atomic_write(cache, content)
        return content

    for day in days:
        output = destination(args.saida, day)
        cache = args.cache / f'2026-10-{day:02d}.html'
        if not args.somente_baixar and output.exists() and not args.sobrescrever:
            print(f'PULOU {output.name}: Markdown já existe')
            continue
        if args.somente_baixar:
            if cache.exists():
                print(f'CACHE {cache.name}: sem requisição')
            else:
                download(day, cache)
            continue
        sessions = []
        # A página atual inclui a grade completa no Nuxt. Um HTML já baixado
        # pode atender a outros dias, sem pedir outra página ao servidor.
        candidates = ([cache] if cache.exists() else []) + sorted(
            candidate for candidate in args.cache.glob('*.html') if candidate != cache)
        for candidate in candidates:
            if candidate not in decoded:
                decoded[candidate] = read_schedule(candidate.read_text(encoding='utf-8'))
            sessions = sessions_for_day(decoded[candidate], day)
            if sessions:
                print(f'CACHE {candidate.name}: {day:02d}/10, sem requisição')
                break
        if not sessions:
            if args.offline:
                raise ValueError(f'{day:02d}/10 ausente nos HTMLs de {args.cache}; modo offline não acessa a rede')
            if cache.exists():
                raise ValueError(f'{cache.name} não contém {day:02d}/10; revise o cache antes de baixar novamente')
            content = download(day, cache)
            decoded[cache] = read_schedule(content)
            sessions = sessions_for_day(decoded[cache], day)
        validate_sessions(sessions, day)
        atomic_write(output, ''.join(session.markdown() for session in sessions))
        print(f'GEROU {output.name}: {len(sessions)} sessões')
    print(f'Concluído: {requested} página(s) baixada(s) nesta execução.')
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    scope = parser.add_mutually_exclusive_group(required=True)
    scope.add_argument('--dias', type=int, nargs='+', choices=range(15, 30), metavar='DIA',
                       help='dias específicos, entre 15 e 29 de outubro de 2026')
    scope.add_argument('--faltantes', action='store_true', help='processar os dias de 15 a 29 que ainda não têm Markdown')
    parser.add_argument('--cache', type=Path, default=ROOT / 'cache/programacao', help='pasta dos HTMLs locais')
    parser.add_argument('--saida', type=Path, default=ROOT / 'programacao_por_dia', help='pasta de saída dos Markdown')
    parser.add_argument('--offline', action='store_true', help='usar apenas cache, sem acessar a rede')
    parser.add_argument('--somente-baixar', action='store_true', help='guardar os HTMLs sem converter em Markdown')
    parser.add_argument('--sobrescrever', action='store_true', help='permitir regenerar Markdown existente; reutiliza o cache')
    parser.add_argument('--intervalo', type=float, default=2.0, help='intervalo mínimo entre downloads, em segundos (padrão: 2)')
    args = parser.parse_args(argv)
    if args.intervalo < 1:
        parser.error('--intervalo deve ser de pelo menos 1 segundo')
    if args.offline and args.somente_baixar:
        parser.error('--offline e --somente-baixar não podem ser combinados')
    if args.faltantes and args.somente_baixar:
        parser.error('--somente-baixar exige --dias para limitar os downloads')
    try:
        return run(args)
    except (HTTPError, URLError, OSError, UnicodeError, ValueError, RecursionError) as error:
        print(f'ERRO: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

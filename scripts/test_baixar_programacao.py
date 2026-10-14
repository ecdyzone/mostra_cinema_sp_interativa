"""Testes locais: nenhum teste acessa o site."""
from collections import Counter
from contextlib import redirect_stdout, redirect_stderr
from dataclasses import replace
from io import StringIO
from pathlib import Path
import json
import re
import tempfile
import unittest
from unittest.mock import patch

import baixar_programacao as app
from mostra_nuxt import read_nuxt, read_schedule


def row(day=17, title='Filme de teste', duration='90 min.'):
    return dict(titulo=title, titulo_original='Original title', diretores='Direção',
                pais='Brasil', genero='Ficção', duracao=duration,
                pro_data=f'2026-10-{day:02d}', pro_hora='15:00:00',
                pro_sala='CINEMA DE TESTE', secao='Mostra Brasil', secao_sec=None)


def page(rows):
    # Amostra sintética do formato de dados, não uma página baixada.
    return '<html><script>window.__NUXT__=(function(a){return {fetch:{"2":{apiDataPresencial:a}}}}(' + json.dumps(rows, ensure_ascii=False) + '));</script></html>'


class ParserTests(unittest.TestCase):
    def test_decodes_nuxt_without_running_javascript(self):
        content = '<script>window.__NUXT__=(function(a,b){a[0]={titulo:b};return {fetch:{"2":{apiDataPresencial:a}},unused:void 0}}(Array(1),"Olívia \\u002F café"));</script>'
        self.assertEqual(read_schedule(content), [{'titulo': 'Olívia / café'}])

    def test_rejects_javascript_calls_and_out_of_bounds(self):
        cases = [
            '<script>window.__NUXT__=(function(a){return alert("não executar")}(null));</script>',
            '<script>window.__NUXT__=(function(a){a[2]={x:1};return {}}(Array(1)));</script>',
            '<script>window.__NUXT__=(function(a){return {}}(Array(100001)));</script>',
            '<html><p>Sem dados, ou bloqueio de acesso.</p></html>',
        ]
        for content in cases:
            with self.subTest(content=content), self.assertRaises(ValueError):
                read_nuxt(content)

    def test_filters_date_sorts_and_preserves_distinct_sessions(self):
        early = {**row(title='Antes'), 'pro_hora': '10:00:00'}
        another_screening = {**row(), 'pro_sala': 'OUTRO CINEMA'}
        sessions = app.parse_page(page([row(), row(day=24), early, another_screening]), 17)
        app.validate_sessions(sessions, 17)
        self.assertEqual(len(sessions), 3)
        self.assertEqual(sessions[0].title, 'Antes')
        self.assertEqual(len(''.join(s.markdown() for s in sessions).splitlines()), 45)
        self.assertEqual(sessions[1].markdown().splitlines()[3], sessions[1].title)

    def test_duration_variants_and_sections(self):
        for duration in ['96 min', '96 min.', "96'", '96′']:
            value = {**row(duration=duration), 'secao_sec': 'Perspectiva Internacional'}
            session = app.parse_page(page([value]), 17)[0]
            self.assertEqual(session.minutes, 96)
            self.assertEqual(session.section, 'Mostra Brasil Perspectiva Internacional')
        with self.assertRaises(ValueError):
            app.parse_page(page([row(duration='duração desconhecida')]), 17)

    def test_validation_rejects_partial_duplicate_or_wrong_date(self):
        session = app.parse_page(page([row()]), 17)[0]
        for sessions in [[], [session, session], [replace(session, country='')],
                         [replace(session, date='24/10/2026')], [replace(session, time='99:99')]]:
            with self.subTest(sessions=sessions), self.assertRaises(ValueError):
                app.validate_sessions(sessions, 17)


class CommandTests(unittest.TestCase):
    def call(self, *args):
        with redirect_stdout(StringIO()), redirect_stderr(StringIO()):
            return app.main(list(args))

    def test_reuses_one_cached_page_for_two_days_without_network(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); cache = root / 'cache'; cache.mkdir()
            (cache / '2026-10-17.html').write_text(page([row(), row(day=24)]))
            with patch.object(app, 'fetch_page', side_effect=AssertionError('rede proibida')):
                result = self.call('--dias', '17', '24', '--offline', '--cache', str(cache), '--saida', str(root / 'saida'))
            self.assertEqual(result, 0)
            self.assertTrue((root / 'saida/sabado_17-10-2026.md').exists())
            self.assertTrue((root / 'saida/sabado_24-10-2026.md').exists())

    def test_preserves_existing_markdown(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); target = app.destination(root, 17)
            target.write_text('anotações manuais')
            with patch.object(app, 'fetch_page', side_effect=AssertionError('rede proibida')):
                result = self.call('--dias', '17', '--saida', str(root), '--cache', str(root / 'cache'))
            self.assertEqual(result, 0)
            self.assertEqual(target.read_text(), 'anotações manuais')

    def test_missing_or_invalid_cache_does_not_create_markdown(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            with patch.object(app, 'fetch_page', side_effect=AssertionError('rede proibida')):
                result = self.call('--dias', '17', '--offline', '--cache', str(root / 'cache'), '--saida', str(root / 'saida'))
            self.assertEqual(result, 1)
            self.assertFalse(app.destination(root / 'saida', 17).exists())
            (root / 'cache').mkdir()
            (root / 'cache/2026-10-17.html').write_text('<html>sem grade</html>')
            result = self.call('--dias', '17', '--offline', '--cache', str(root / 'cache'), '--saida', str(root / 'saida'))
            self.assertEqual(result, 1)
            self.assertFalse(app.destination(root / 'saida', 17).exists())

    def test_explicit_downloads_are_cached_and_spaced(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            args = ['--dias', '17', '24', '--somente-baixar', '--cache', str(root)]
            with patch.object(app, 'fetch_page', return_value=page([row()])) as fetch, \
                 patch.object(app.time, 'monotonic', side_effect=[10, 10.1, 12]), \
                 patch.object(app.time, 'sleep') as sleep:
                self.assertEqual(self.call(*args), 0)
                self.assertEqual(fetch.call_count, 2)
                sleep.assert_called_once()
                self.assertAlmostEqual(sleep.call_args.args[0], 1.9)
            with patch.object(app, 'fetch_page', side_effect=AssertionError('rede proibida')):
                self.assertEqual(self.call(*args), 0)
            self.assertEqual(len(list(root.glob('*.html'))), 2)
            self.assertEqual(len(list(root.glob('*.md'))), 0)


class RealCacheTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        files = sorted((app.ROOT / 'cache/programacao').glob('*.html'))
        if not files:
            raise unittest.SkipTest('HTML real ainda não baixado')
        cls.snapshots = [(path, read_schedule(path.read_text())) for path in files]

    def test_real_cache_contains_valid_sessions_for_all_requested_dates(self):
        for path, rows in self.snapshots:
            for day in range(15, 30):
                with self.subTest(cache=path.name, day=day):
                    sessions = app.sessions_for_day(rows, day)
                    app.validate_sessions(sessions, day)

    def test_real_days_match_manual_17_and_24(self):
        for path, rows in self.snapshots:
            for day in [17, 24]:
                manual = app.destination(app.ROOT / 'programacao_por_dia', day).read_text().splitlines()
                expected = []
                for index in range(0, len(manual), 15):
                    block = manual[index:index + 15]
                    fields = [line for line in block[4:12] if line.strip()]
                    expected.append((block[0], ' '.join(line for line in block[1:3] if line.strip()),
                                     *fields[:3], int(re.search(r'\d+', fields[3])[0]), *block[12:15]))
                actual = [(s.title, s.section, s.director, s.country, s.kind, s.minutes,
                           s.date, s.time, s.venue) for s in app.sessions_for_day(rows, day)]
                with self.subTest(cache=path.name, day=day):
                    self.assertEqual(Counter(actual), Counter(expected))


if __name__ == '__main__':
    unittest.main()

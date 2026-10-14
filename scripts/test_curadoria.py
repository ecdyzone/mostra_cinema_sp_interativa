"""Garante justificativas editoriais completas antes de substituir o site."""
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import gerar_site
from sincronizar_curadoria import read_references


class CuradoriaTests(unittest.TestCase):
    def test_every_curated_title_has_a_reason(self):
        films = json.loads((gerar_site.ROOT / 'referencias/curadoria_site.json').read_text())
        self.assertTrue(films)
        gerar_site.validate_curadoria(films)

    def test_rejects_missing_empty_whitespace_and_non_text_reasons(self):
        for reason in (None, '', ' \n\t ', 42, []):
            with self.subTest(reason=reason):
                with self.assertRaisesRegex(ValueError, "'why'.*Filme pendente"):
                    gerar_site.validate_curadoria({'filme': {'title': 'Filme pendente', 'why': reason}})
        with self.assertRaisesRegex(ValueError, 'Filme sem campo'):
            gerar_site.validate_curadoria({'filme': {'title': 'Filme sem campo'}})
        gerar_site.validate_curadoria({'filme': {'why': 'Uma justificativa.'}})

    def test_generation_preserves_previous_html_when_reason_is_missing(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'referencias').mkdir()
            (root / 'referencias/curadoria_site.json').write_text(json.dumps({
                'filme': {'title': 'Novo filme', 'why': ''}
            }))
            page = root / 'index.html'
            page.write_text('HTML anterior')
            with patch.object(gerar_site, 'ROOT', root):
                with self.assertRaisesRegex(ValueError, 'Novo filme'):
                    gerar_site.main()
            self.assertEqual(page.read_text(), 'HTML anterior')

    def test_reference_import_extracts_reason_without_avoidance_section(self):
        _, guide, _ = read_references(gerar_site.ROOT)
        reason = guide['feito-pipa']['why']
        self.assertIn('afeto entre gerações', reason)
        self.assertTrue(reason.startswith('Vale ver se '))
        self.assertNotIn('Deixe para depois', reason)
        self.assertNotIn('**', reason)


if __name__ == '__main__':
    unittest.main()

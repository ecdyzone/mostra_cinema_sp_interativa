"""Leitor restrito da serialização Nuxt usada pela página da Mostra.

Reconhece dados literais, referências a parâmetros e preenchimento de arrays.
Não usa eval, exec, Node ou navegador e não executa JavaScript baixado.
Qualquer outra instrução/expressão é rejeitada.
"""
from __future__ import annotations

from html.parser import HTMLParser
import json
import re

IDENTIFIER = re.compile(r'[A-Za-z_$][A-Za-z0-9_$]*')


class ScriptCollector(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.parts = None

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.parts = []

    def handle_endtag(self, tag):
        if tag == 'script' and self.parts is not None:
            self.scripts.append(''.join(self.parts))
            self.parts = None

    def handle_data(self, data):
        if self.parts is not None:
            self.parts.append(data)


class LiteralReader:
    def __init__(self, source, bindings=None):
        self.source = source
        self.position = 0
        self.bindings = bindings if bindings is not None else {}
        self.decoder = json.JSONDecoder()

    def whitespace(self):
        while self.position < len(self.source) and self.source[self.position].isspace():
            self.position += 1

    def consume(self, token):
        self.whitespace()
        if self.source.startswith(token, self.position):
            self.position += len(token)
            return True
        return False

    def expect(self, token):
        if not self.consume(token):
            raise ValueError(f'Nuxt: esperava {token!r} na posição {self.position}')

    def identifier(self):
        self.whitespace()
        match = IDENTIFIER.match(self.source, self.position)
        if not match:
            raise ValueError(f'Nuxt: identificador inválido na posição {self.position}')
        self.position = match.end()
        return match[0]

    def finished(self):
        self.whitespace()
        return self.position == len(self.source)

    def value(self):
        self.whitespace()
        if self.position >= len(self.source):
            raise ValueError('Nuxt: valor incompleto')
        character = self.source[self.position]
        if character == '[':
            self.expect('[')
            values = []
            if self.consume(']'):
                return values
            while True:
                values.append(self.value())
                if self.consume(']'):
                    return values
                self.expect(',')
        if character == '{':
            self.expect('{')
            values = {}
            if self.consume('}'):
                return values
            while True:
                self.whitespace()
                key = self.value() if self.source[self.position] == '"' else self.identifier()
                self.expect(':')
                if key in values:
                    raise ValueError(f'Nuxt: chave duplicada {key!r}')
                values[key] = self.value()
                if self.consume('}'):
                    return values
                self.expect(',')
        if character == '"' or character in '-0123456789':
            try:
                value, end = self.decoder.raw_decode(self.source, self.position)
            except json.JSONDecodeError as error:
                raise ValueError(f'Nuxt: literal inválido na posição {self.position}') from error
            self.position = end
            return value
        name = self.identifier()
        if name in ('true', 'false', 'null'):
            return {'true': True, 'false': False, 'null': None}[name]
        if name == 'void':
            if self.value() != 0:
                raise ValueError('Nuxt: apenas void 0 é aceito')
            return None
        if name == 'Array':
            self.expect('(')
            size = self.value()
            self.expect(')')
            if type(size) is not int or not 0 <= size <= 100_000:
                raise ValueError('Nuxt: tamanho de array inválido')
            return [None] * size
        if name not in self.bindings:
            raise ValueError(f'Nuxt: referência não reconhecida {name!r}')
        return self.bindings[name]


def read_nuxt(content):
    collector = ScriptCollector()
    collector.feed(content)
    scripts = [s.strip() for s in collector.scripts if 'window.__NUXT__=' in s]
    if len(scripts) != 1:
        raise ValueError('HTML sem um único bloco window.__NUXT__; formato do site pode ter mudado')
    match = re.fullmatch(r'window\.__NUXT__=\(function\((.*?)\)\{(.*)\}\((.*)\)\);?', scripts[0], re.S)
    if not match:
        raise ValueError('Serialização Nuxt não reconhecida; nenhum JavaScript foi executado')
    parameters = match[1].split(',')
    if not all(IDENTIFIER.fullmatch(name) for name in parameters) or len(set(parameters)) != len(parameters):
        raise ValueError('Nuxt: parâmetros inválidos')
    arguments_reader = LiteralReader('[' + match[3] + ']')
    arguments = arguments_reader.value()
    if not arguments_reader.finished() or len(arguments) != len(parameters):
        raise ValueError('Nuxt: argumentos não correspondem aos parâmetros')
    reader = LiteralReader(match[2], dict(zip(parameters, arguments)))
    while True:
        name = reader.identifier()
        if name == 'return':
            state = reader.value()
            reader.consume(';')
            if not reader.finished():
                raise ValueError('Nuxt: conteúdo inesperado após os dados')
            if not isinstance(state, dict):
                raise ValueError('Nuxt: estado inválido')
            return state
        # Única atribuição permitida: preencher uma posição de array já declarado.
        array = reader.bindings.get(name)
        if not isinstance(array, list):
            raise ValueError(f'Nuxt: instrução não permitida: {name!r}')
        reader.expect('[')
        index = reader.value()
        reader.expect(']')
        reader.expect('=')
        if type(index) is not int or not 0 <= index < len(array):
            raise ValueError('Nuxt: índice fora do array')
        if array[index] is not None:
            raise ValueError('Nuxt: posição de array preenchida mais de uma vez')
        array[index] = reader.value()
        reader.expect(';')


def read_schedule(content):
    state = read_nuxt(content)
    fetch = state.get('fetch', {})
    if not isinstance(fetch, dict):
        raise ValueError('Nuxt: dados de programação ausentes')
    schedules = [value['apiDataPresencial'] for value in fetch.values()
                 if isinstance(value, dict) and 'apiDataPresencial' in value]
    if len(schedules) != 1 or not isinstance(schedules[0], list):
        raise ValueError('Nuxt: apiDataPresencial ausente ou ambíguo')
    rows = schedules[0]
    if not rows or not all(isinstance(row, dict) for row in rows):
        raise ValueError('Nuxt: grade presencial incompleta')
    return rows

from powerdnsadmin.lib.record_rows import build_record_rows
from powerdnsadmin.lib.utils import pretty_domain_name


def test_pretty_domain_name_does_not_print(capsys):
    assert pretty_domain_name('example.org') == 'example.org'
    assert capsys.readouterr().out == ''


def test_build_record_rows_flattens_display_values_and_skips_disallowed_types():
    rrsets = [{
        'name': 'example.org.',
        'type': 'SOA',
        'ttl': 300,
        'records': [{
            'content': 'ns.example.org. hostmaster.example.org. 1 2 3 4 5',
            'disabled': False,
        }],
        'comments': [],
    }, {
        'name': 'www.example.org.',
        'type': 'A',
        'ttl': 60,
        'records': [
            {'content': '192.0.2.1', 'disabled': False},
            {'content': '192.0.2.2', 'disabled': True},
        ],
        'comments': [{'content': 'first'}],
    }, {
        'name': 'secret.example.org.',
        'type': 'TXT',
        'ttl': 60,
        'records': [{'content': 'hidden', 'disabled': False}],
        'comments': [],
    }]

    rows = build_record_rows(
        rrsets,
        'example.org',
        ['A', 'SOA'],
        pretty_ipv6=False,
        include_comment=True)

    assert rows == [
        ['@', 'SOA', 'Active', '300',
         'ns.example.org. hostmaster.example.org. 1 2 3 4 5', '', '', '1',
         'example.org'],
        ['www', 'A', 'Active', '60', '192.0.2.1', 'first', '', '1',
         'www.example.org'],
        ['www', 'A', 'Disabled', '60', '192.0.2.2', '', '', '1',
         'www.example.org'],
    ]


def test_build_record_rows_omits_comment_column_for_secondary_zones():
    rrsets = [{
        'name': 'www.example.org.',
        'type': 'A',
        'ttl': 60,
        'records': [{'content': '192.0.2.1', 'disabled': False}],
        'comments': [{'content': 'ignored'}],
    }]

    rows = build_record_rows(
        rrsets, 'example.org', ['A'], pretty_ipv6=False, include_comment=False)

    assert rows == [['www', 'A', 'Active', '60', '192.0.2.1', '1',
                      'www.example.org']]


def test_build_record_rows_keeps_untrusted_text_raw_and_formats_ipv6_ptr():
    rrsets = [{
        'name': 'www.example.org.',
        'type': 'TXT',
        'ttl': 60,
        'records': [{
            'content': '<script>alert(1)</script>',
            'disabled': False,
        }],
        'comments': [{'content': 'quote " and <tag>'}],
    }, {
        'name': '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa.',
        'type': 'PTR',
        'ttl': 60,
        'records': [{'content': 'host.example.org', 'disabled': False}],
        'comments': [],
    }]

    rows = build_record_rows(
        rrsets,
        'example.org',
        ['TXT', 'PTR'],
        pretty_ipv6=True,
        include_comment=True)

    assert rows[0][4] == '<script>alert(1)</script>'
    assert rows[0][5] == 'quote " and <tag>'
    assert rows[1][0] == '2001:db8::1'
    assert rows[1][1] == 'PTR'

import dns.name
import dns.reversename

from .utils import display_record_name
from .utils import pretty_domain_name
from ..models.record_entry import RecordEntry


def build_record_entries(rrsets, allowed_types, pretty_ipv6):
    """Flatten PowerDNS RRsets into zone-editor record entries, in table order."""
    entries = []
    for rrset in rrsets:
        if rrset['type'] not in allowed_types:
            continue

        record_name = rrset['name'].rstrip('.')
        if (pretty_ipv6 and rrset['type'] == 'PTR' and 'ip6.arpa' in record_name
                and '*' not in record_name):
            record_name = dns.reversename.to_address(
                dns.name.from_text(record_name))

        comments = rrset.get('comments') or []
        for index, record in enumerate(rrset['records']):
            comment = comments[index]['content'] if len(comments) > index else ''
            entries.append(RecordEntry(
                name=record_name,
                type=rrset['type'],
                status='Disabled' if record['disabled'] else 'Active',
                ttl=rrset['ttl'],
                data=record['content'],
                comment=comment,
                is_allowed_edit=True))
    return entries


def build_record_rows(rrsets, domain_name, allowed_types, pretty_ipv6,
                      include_comment):
    """Flatten PowerDNS RRsets into the zone editor's DataTables rows.

    Values are raw text. The browser escapes them when drawing the table.
    """
    return [
        _row_for_entry(entry, domain_name, include_comment)
        for entry in build_record_entries(rrsets, allowed_types, pretty_ipv6)
    ]


def _row_for_entry(entry, domain_name, include_comment):
    displayed_name = pretty_domain_name(
        display_record_name((entry.name, domain_name)))
    displayed_data = pretty_domain_name(entry.data)
    row = [
        displayed_name,
        entry.type,
        entry.status,
        str(entry.ttl),
        displayed_data,
    ]
    if include_comment:
        row.extend([entry.comment or '', ''])
    row.append('1')
    # Full record name, used by the per-record changelog link. It is not a
    # displayed column. The old page passed this same name to that link.
    row.append(entry.name)
    return row

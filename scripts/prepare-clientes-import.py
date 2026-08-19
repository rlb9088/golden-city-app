import argparse
import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {
    "main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
    "docrel": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}


def read_xml(zf, name):
    return ET.fromstring(zf.read(name))


def read_shared_strings(zf):
    if "xl/sharedStrings.xml" not in zf.namelist():
        return []
    root = read_xml(zf, "xl/sharedStrings.xml")
    values = []
    for item in root.findall("main:si", NS):
        texts = [node.text or "" for node in item.findall(".//main:t", NS)]
        values.append("".join(texts))
    return values


def column_index(cell_ref):
    letters = re.sub(r"\d+", "", cell_ref or "")
    total = 0
    for char in letters:
        total = total * 26 + ord(char.upper()) - 64
    return total - 1


def cell_value(cell, shared_strings):
    value = cell.find("main:v", NS)
    if value is None:
        inline = cell.find(".//main:t", NS)
        return inline.text if inline is not None else ""
    raw = value.text or ""
    if cell.attrib.get("t") == "s":
        return shared_strings[int(raw)] if raw.isdigit() and int(raw) < len(shared_strings) else ""
    return raw


def first_sheet_path(zf):
    workbook = read_xml(zf, "xl/workbook.xml")
    rels = read_xml(zf, "xl/_rels/workbook.xml.rels")
    first_sheet = workbook.find("main:sheets/main:sheet", NS)
    if first_sheet is None:
        raise ValueError("Workbook has no sheets.")
    rel_id = first_sheet.attrib.get(f"{{{NS['docrel']}}}id")
    for rel in rels:
        if rel.attrib.get("Id") == rel_id:
            target = rel.attrib["Target"].lstrip("/")
            return target if target.startswith("xl/") else f"xl/{target}"
    raise ValueError("Could not resolve first worksheet path.")


def workbook_rows(path):
    with zipfile.ZipFile(path) as zf:
        shared_strings = read_shared_strings(zf)
        sheet = read_xml(zf, first_sheet_path(zf))
        for row in sheet.findall(".//main:sheetData/main:row", NS):
            values = []
            for cell in row.findall("main:c", NS):
                idx = column_index(cell.attrib.get("r", ""))
                while len(values) <= idx:
                    values.append("")
                values[idx] = cell_value(cell, shared_strings)
            yield values


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="Convert the official clientes XLSX to JSON for /api/clientes/import.")
    parser.add_argument("xlsx", help="Path to base de datos.xlsx")
    parser.add_argument("--output", "-o", default="", help="Optional output JSON path. Defaults to stdout.")
    args = parser.parse_args()

    rows = list(workbook_rows(Path(args.xlsx)))
    if not rows:
        raise SystemExit("No rows found.")

    headers = [str(value).strip() for value in rows[0]]
    items = []
    for row in rows[1:]:
        item = {}
        for index, header in enumerate(headers):
            if not header:
                continue
            item[header] = row[index] if index < len(row) else ""
        if any(str(value).strip() for value in item.values()):
            items.append(item)

    payload = {"source": Path(args.xlsx).name, "items": items}
    content = json.dumps(payload, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(content, encoding="utf-8")
    else:
        sys.stdout.write(content)


if __name__ == "__main__":
    main()

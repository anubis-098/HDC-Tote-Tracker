from io import BytesIO
import re
from zipfile import ZipFile
from fastapi import HTTPException
from openpyxl import load_workbook

def parse_stores(data: bytes, sheet: str = ''):
    try:
        with ZipFile(BytesIO(data)) as z:
            if sum(i.file_size for i in z.infolist()) > 50_000_000:
                raise ValueError('Workbook is too large')
        book = load_workbook(BytesIO(data), read_only=True, data_only=False)
    except Exception:
        raise HTTPException(422, 'Invalid or oversized XLSX workbook')
    try:
        if sheet and sheet not in book.sheetnames:
            raise HTTPException(422, 'Sheet not found')
        ws = book[sheet] if sheet else book.worksheets[0]
        rows = ws.iter_rows()
        headers = [re.sub(r'[^a-z0-9]', '', str(c.value or '').lower()) for c in next(rows, [])]
        codes = {'stno', 'storeno', 'storecode', 'code'}
        names = {'stname', 'storename', 'name'}
        ci = next((i for i,v in enumerate(headers) if v in codes), None)
        ni = next((i for i,v in enumerate(headers) if v in names), None)
        if ci is None or ni is None:
            raise HTTPException(422, 'Expected ST. No / ST. Name or Store No. / Store Name headers')
        result = {}
        for number, row in enumerate(rows, 2):
            if number > 10001:
                raise HTTPException(422, 'Maximum 10000 rows per import')
            code_cell, name_cell = row[ci], row[ni]
            code, name = code_cell.value, name_cell.value
            if code is None and name is None:
                continue
            if code_cell.data_type == 'f' or name_cell.data_type == 'f':
                raise HTTPException(422, f'Row {number}: formulas are not supported')
            if isinstance(code, (int, float)) and not isinstance(code, bool) and float(code).is_integer():
                code = str(int(code))
                if re.fullmatch(r'0+', code_cell.number_format):
                    code = code.zfill(len(code_cell.number_format))
            code = str(code or '').strip()
            name = str(name or '').strip()
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,40}', code) or not name or len(name)>160:
                raise HTTPException(422, f'Row {number}: invalid Store code or name')
            if code in result and result[code] != name:
                raise HTTPException(422, f'Row {number}: conflicting duplicate Store {code}')
            result[code] = name
        if not result:
            raise HTTPException(422, 'No Store records found')
        return result
    finally:
        book.close()

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from app.services.tote_pdf import render_tote_pdf


def test_photo_summary_has_separate_tote_pages_and_all_six_images():
    photos=[]
    for slot,color in enumerate(['#006da8','#e42f44','#ec8922','#178355','#7441a5','#dfbc24'],1):
        data=BytesIO()
        with Image.new('RGB',(800,1200) if slot%2 else (1200,800),color) as image:
            image.save(data,'JPEG')
        photos.append({'slot':slot,'content':data.getvalue(),'uploaded_at':datetime(2026,11,18,20,30,tzinfo=timezone.utc)})
    tote={'code':'HDC000001','status':'AT_STORE','truck_registration':'70-1234 กรุงเทพมหานคร',
          'order_number':'ORDER-2026-000123','store_code':'1001','store_name':'Store ทดสอบสาขาสุขุมวิท'}
    output=BytesIO()
    render_tote_pdf(output,[(tote,photos),({**tote,'code':'HDC000002','status':'READY','order_number':None},[])])
    pdf=output.getvalue()
    assert pdf.startswith(b'%PDF-')
    reader=PdfReader(BytesIO(pdf))
    assert len(reader.pages)==2
    first=reader.pages[0].extract_text()
    assert 'Order No.: ORDER-2026-000123' in first
    assert 'HDC000001' in first and '70-1234' in first
    assert 'ทะเบียนรถ' in first and 'กรุงเทพมหานคร' in first
    assert 'Store ทดสอบสาขาสุขุมวิท' in first
    assert 'Order No.: -' in reader.pages[1].extract_text()
    assert len(reader.pages[0].images)==7
    assert len(reader.pages[1].images)==1
    for page in reader.pages:
        assert abs(float(page.mediabox.width)-841.89)<1
        assert abs(float(page.mediabox.height)-595.28)<1
        assert not any(image.image.width>=1600 and image.image.height>=1100 for image in page.images)
    Path('/tmp/tote-photo-summary-preview.pdf').write_bytes(pdf)


def test_long_order_and_store_text_remain_extractable():
    order='W'*80
    name='สาขาทดสอบสุขุมวิท'*9
    code='HDC'+'1'*97
    tote={'code':code,'status':'AT_STORE','truck_registration':'70-1234',
          'order_number':order,'store_code':'001','store_name':name}
    output=BytesIO()
    render_tote_pdf(output,[(tote,[])])
    reader=PdfReader(BytesIO(output.getvalue()))
    text=''.join(reader.pages[0].extract_text().split())
    assert order in text and name in text and code in text
    Path('/tmp/tote-text-long-preview.pdf').write_bytes(output.getvalue())

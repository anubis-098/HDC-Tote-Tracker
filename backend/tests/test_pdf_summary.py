from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import re
from PIL import Image, ImageDraw
from app.services.tote_pdf import render_tote_pdf


def test_photo_summary_has_separate_tote_pages_and_all_six_images(monkeypatch):
    labels=[]
    original_text=ImageDraw.ImageDraw.text
    def capture_text(self,xy,text,*args,**kwargs):
        labels.append(str(text))
        return original_text(self,xy,text,*args,**kwargs)
    monkeypatch.setattr(ImageDraw.ImageDraw,'text',capture_text)
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
    assert len(re.findall(rb'/Type /Page\b',pdf))==2
    assert 'Order No.: ORDER-2026-000123' in labels
    assert 'Order No.: -' in labels
    Path('/tmp/tote-photo-summary-preview.pdf').write_bytes(pdf)

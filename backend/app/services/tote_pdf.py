from datetime import datetime
from io import BytesIO
from pathlib import Path
from threading import Lock
from unicodedata import category
from zoneinfo import ZoneInfo
from PIL import Image
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.pdfgen.textobject import bidiShapedText


FONT = 'HdcLoma'
BOLD = 'HdcLomaBold'
FONT_LOCK = Lock()
BLUE, INK, MUTED = '#006DA8', '#203247', '#60768A'


def register_fonts():
    with FONT_LOCK:
        for name, file in [(FONT, 'Loma.ttf'), (BOLD, 'Loma-Bold.ttf')]:
            if name not in pdfmetrics.getRegisteredFontNames():
                font = TTFont(name, str(Path('/usr/share/fonts/truetype/tlwg')/file), shapable=True)
                if not font.shapable:
                    raise RuntimeError('PDF Thai text requires ReportLab shaping and uharfbuzz')
                pdfmetrics.registerFont(font)


def text_width(value, font, size):
    return bidiShapedText(value, direction='LTR', fontName=font, fontSize=size, shaping=True)[1]


def wrap_text(value, width, size=10, font=FONT):
    # Do not separate Thai vowel/tone marks from their base character.
    clusters = []
    for char in ' '.join(str(value).split()):
        if clusters and (category(char) in ('Mn', 'Mc', 'Me') or char == '\u0e33' or clusters[-1][-1] in 'เแโใไ'):
            clusters[-1] += char
        else:
            clusters.append(char)
    lines, line = [], ''
    for cluster in clusters:
        if line and text_width(line+cluster, font, size) > width:
            lines.append(line.rstrip())
            line = ''
        line += cluster
    return lines+[line] if line or not lines else lines


def render_tote_pdf(output, records):
    if not records:
        raise ValueError('At least one Tote is required')
    register_fonts()
    timezone = ZoneInfo('Asia/Bangkok')
    statuses = {'READY': 'พร้อมใช้งาน', 'AT_STORE': 'ส่งไป Store', 'RETURNED': 'รับกลับแล้ว'}
    generated = datetime.now(timezone).strftime('%d/%m/%Y %H:%M')
    logo = Path(__file__).resolve().parent.parent/'assets'/'cj-logistics.png'
    width, height = landscape(A4)
    canvas = Canvas(output, pagesize=(width, height), pageCompression=1)
    canvas.setTitle('HDC Tote Photo Summary Report')
    canvas.setAuthor('CJ Logistics')

    def text(value, x, y, size=10, font=FONT, color=INK):
        canvas.setFont(font, size)
        canvas.setFillColor(HexColor(color))
        canvas.drawString(x, y, str(value), direction='LTR', shaping=True)

    for index, (tote, photos) in enumerate(records, 1):
        for x, band_width, color in [(0,width*.76,'#0080C6'),(width*.76,width*.12,'#E42F44'),(width*.88,width*.12,'#EC8922')]:
            canvas.setFillColor(HexColor(color))
            canvas.rect(x, height-5, band_width, 5, fill=1, stroke=0)
        canvas.drawImage(str(logo), 28, height-63, width=88, height=36, preserveAspectRatio=True, anchor='c', mask='auto')
        text('TOTE TRACKER', 132, height-40, 19, 'Helvetica-Bold')
        text('PHOTO SUMMARY REPORT / CJ LOGISTICS', 133, height-56, 9, 'Helvetica', MUTED)
        label = f'{len(photos)} PHOTOS'
        text(label, width-28-pdfmetrics.stringWidth(label,'Helvetica-Bold',11), height-39, 11, 'Helvetica-Bold', BLUE)

        top = height-74
        codes = wrap_text(f"Tote: {tote['code']}", 365, size=11, font=BOLD)
        registration = wrap_text(f"ทะเบียนรถ: {tote.get('truck_registration') or '-'}", 265)
        orders = wrap_text(f"Order No.: {tote.get('order_number') or '-'}", width-380)
        stores = wrap_text(f"Store: {tote.get('store_code') or '-'} · {tote.get('store_name') or '-'}", width-80)
        first_y = top-18
        details_y = first_y-(len(codes)-1)*13-20
        store_y = details_y-max(len(registration),len(orders))*12-6
        bottom = store_y-(len(stores)-1)*12-12
        canvas.setFillColor(HexColor('#F2F7FB'))
        canvas.setStrokeColor(HexColor('#DCE7EF'))
        canvas.roundRect(28, bottom, width-56, top-bottom, 8, fill=1, stroke=1)
        for offset, line in enumerate(codes):
            text(line, 40, first_y-offset*13, 11, BOLD)
        text(f"สถานะ: {statuses.get(tote['status'],tote['status'])}", 430, first_y, 10)
        for offset, line in enumerate(registration):
            text(line, 40, details_y-offset*12)
        for offset, line in enumerate(orders):
            text(line, 340, details_y-offset*12)
        for offset, line in enumerate(stores):
            text(line, 40, store_y-offset*12)

        photo_top = bottom-14
        cell_width = (width-56-24)/3
        cell_height = (photo_top-48-12)/2
        if not photos:
            canvas.setFillColor(HexColor('#F8FAFC'))
            canvas.roundRect(28, 48, width-56, photo_top-48, 8, fill=1, stroke=1)
            message = 'ยังไม่มีภาพสำหรับ Tote นี้'
            text(message, (width-text_width(message,BOLD,12))/2, (photo_top+48)/2, 12, BOLD, MUTED)
        for position, photo in enumerate(photos):
            x = 28+(position%3)*(cell_width+12)
            y = photo_top-(position//3)*(cell_height+12)-cell_height
            canvas.setFillColor(HexColor('#F8FAFC'))
            canvas.setStrokeColor(HexColor('#DCE7EF'))
            canvas.roundRect(x, y, cell_width, cell_height, 7, fill=1, stroke=1)
            with Image.open(BytesIO(photo['content'])) as source:
                image = source.convert('RGB')
                try:
                    image.thumbnail((1200,1200), Image.Resampling.LANCZOS)
                    compressed = BytesIO()
                    image.save(compressed, 'JPEG', quality=82, optimize=True)
                    scale = min((cell_width-16)/image.width,(cell_height-44)/image.height)
                    image_width, image_height = image.width*scale, image.height*scale
                    compressed.seek(0)
                    canvas.drawImage(ImageReader(compressed), x+(cell_width-image_width)/2,
                                     y+36+(cell_height-44-image_height)/2, width=image_width, height=image_height)
                finally:
                    image.close()
            uploaded = photo['uploaded_at'].astimezone(timezone).strftime('%d/%m/%Y %H:%M')
            text(f"ภาพที่ {photo['slot']}", x+10, y+24, 9, BOLD, BLUE)
            text(f'บันทึก: {uploaded} (เวลาไทย)', x+10, y+10, 8, FONT, MUTED)
        canvas.setStrokeColor(HexColor('#DCE7EF'))
        canvas.line(28, 34, width-28, 34)
        text(f'สร้างรายงาน: {generated} (เวลาไทย)', 28, 21, 8, FONT, MUTED)
        page_label = f'หน้า {index}/{len(records)}'
        text(page_label, width-28-text_width(page_label,FONT,8), 21, 8, FONT, MUTED)
        canvas.showPage()
    canvas.save()

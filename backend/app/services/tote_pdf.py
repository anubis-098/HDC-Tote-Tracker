from datetime import datetime
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo
from PIL import Image, ImageDraw, ImageFont


def render_tote_pdf(output, records):
    if not records:
        raise ValueError('At least one Tote is required')
    timezone = ZoneInfo('Asia/Bangkok')
    font_dir = Path('/usr/share/fonts/truetype/tlwg')
    fonts = {size: ImageFont.truetype(str(font_dir/'Loma.ttf'), size, layout_engine=ImageFont.Layout.RAQM)
             for size in (20, 22, 24)}
    heading = ImageFont.truetype(str(font_dir/'Loma-Bold.ttf'), 38, layout_engine=ImageFont.Layout.RAQM)
    bold = ImageFont.truetype(str(font_dir/'Loma-Bold.ttf'), 24, layout_engine=ImageFont.Layout.RAQM)
    statuses = {'READY': 'พร้อมใช้งาน', 'AT_STORE': 'ส่งไป Store', 'RETURNED': 'รับกลับแล้ว'}
    generated = datetime.now(timezone).strftime('%d/%m/%Y %H:%M')
    logo_path = Path(__file__).resolve().parent.parent/'assets'/'cj-logistics.png'
    pages = []
    try:
        for index, (tote, photos) in enumerate(records, 1):
            page = Image.new('RGB', (1754, 1240), 'white')
            pages.append(page)
            draw = ImageDraw.Draw(page)

            def text(value, x, y, width=1600, font=None, color='#203247'):
                font = font or fonts[24]
                value = ' '.join(str(value).split())
                if draw.textlength(value, font=font) > width:
                    while value and draw.textlength(value+'…', font=font) > width:
                        value = value[:-1]
                    value += '…'
                draw.text((x, y), value, font=font, fill=color)

            def wrap(value, width, font):
                lines, line = [], ''
                for char in str(value):
                    if line and draw.textlength(line+char, font=font) > width:
                        lines.append(line)
                        line = ''
                    line += char
                return lines+[line]

            draw.rectangle((0, 0, 1333, 9), fill='#0080c6')
            draw.rectangle((1333, 0, 1543, 9), fill='#e42f44')
            draw.rectangle((1543, 0, 1754, 9), fill='#ec8922')
            with Image.open(logo_path) as source:
                logo = source.convert('RGBA')
                try:
                    logo.thumbnail((180, 78), Image.Resampling.LANCZOS)
                    page.paste(logo, (50, 30), logo)
                finally:
                    logo.close()
            text('TOTE TRACKER', 255, 29, 1000, heading)
            text('PHOTO SUMMARY REPORT / CJ LOGISTICS', 257, 78, 1100, fonts[20], '#60768a')
            text(f'{len(photos)} PHOTOS', 1480, 48, 225, bold, '#006da8')
            draw.rounded_rectangle((50, 124, 1704, 287), radius=12, fill='#f0f6fb', outline='#dce7ef', width=2)
            text(f"Tote: {tote['code']}", 70, 139, 720, bold)
            text(f"สถานะ: {statuses.get(tote['status'], tote['status'])}", 850, 139, 830)
            text(f"ทะเบียนรถ: {tote.get('truck_registration') or '-'}", 70, 178, 540, fonts[22])
            order_lines = wrap(f"Order No.: {tote.get('order_number') or '-'}", 1030, fonts[22])
            for line_index, line in enumerate(order_lines[:2]):
                text(line, 650, 178+line_index*26, 1030, fonts[22])
            store_lines = wrap(f"Store: {tote.get('store_code') or '-'} · {tote.get('store_name') or '-'}", 1610, fonts[22])
            for line_index, line in enumerate(store_lines[:2]):
                text(line, 70, 232+line_index*26, 1610, fonts[22])

            if not photos:
                draw.rounded_rectangle((50, 310, 1704, 1126), radius=12, fill='#f8fafc', outline='#dce7ef', width=2)
                text('ยังไม่มีภาพสำหรับ Tote นี้', 550, 670, 1000, bold, '#60768a')
            for position, photo in enumerate(photos):
                x, y = 50+(position % 3)*558, 310+(position // 3)*416
                draw.rounded_rectangle((x, y, x+538, y+400), radius=10, fill='#f8fafc', outline='#dce7ef', width=2)
                with Image.open(BytesIO(photo['content'])) as source:
                    image = source.convert('RGB')
                    try:
                        image.thumbnail((514, 326), Image.Resampling.LANCZOS)
                        page.paste(image, (x+(538-image.width)//2, y+12+(326-image.height)//2))
                    finally:
                        image.close()
                uploaded = photo['uploaded_at'].astimezone(timezone).strftime('%d/%m/%Y %H:%M')
                text(f"ภาพที่ {photo['slot']}", x+12, y+347, 514, bold, '#006da8')
                text(f'บันทึก: {uploaded} (เวลาไทย)', x+12, y+375, 514, fonts[20], '#60768a')
            draw.line((50, 1160, 1704, 1160), fill='#dce7ef', width=2)
            text(f'สร้างรายงาน: {generated} (เวลาไทย)', 50, 1178, 1260, fonts[20], '#60768a')
            text(f'หน้า {index}/{len(records)}', 1520, 1178, 184, fonts[20], '#60768a')
        pages[0].save(output, 'PDF', save_all=True, append_images=pages[1:], resolution=150, title='HDC Tote Photo Summary Report')
    finally:
        for page in pages:
            page.close()

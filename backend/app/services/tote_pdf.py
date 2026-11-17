from io import BytesIO
from zoneinfo import ZoneInfo
from PIL import Image, ImageDraw, ImageFont

def render_tote_pdf(output, records):
    font = ImageFont.truetype('/usr/share/fonts/truetype/tlwg/Loma.ttf', 24, layout_engine=ImageFont.Layout.RAQM)
    pages = []
    try:
        for index, (tote, photos) in enumerate(records, 1):
            page = Image.new('RGB', (1754, 1240), 'white')
            pages.append(page)
            draw = ImageDraw.Draw(page)
            draw.rectangle((0, 0, 1754, 9), fill='#0080c6')
            def text(value, x, y, width=1650):
                value = ' '.join(str(value).split())
                while value and draw.textlength(value, font=font) > width:
                    value = value[:-2] + '…' if len(value)>2 else ''
                draw.text((x,y), value, font=font, fill='#203247')
            text('HDC TOTE TRACKER | PHOTO REPORT', 50, 30)
            text(f"Tote: {tote['code']} | สถานะ: {tote['status']} | ทะเบียน: {tote['truck_registration'] or '-'}",50,85)
            text(f"Store: {tote['store_code'] or '-'} {tote.get('store_name') or ''}",50,125)
            text(f'ภาพปัจจุบัน {len(photos)} ภาพ',50,165)
            if not photos: text('ไม่มีภาพปัจจุบันสำหรับ Tote นี้',50,260)
            for position, photo in enumerate(photos):
                x,y = 50+(position%3)*558,225+(position//3)*465
                draw.rounded_rectangle((x,y,x+538,y+445),radius=10,fill='#f3f6fa',outline='#dce7ef',width=2)
                with Image.open(BytesIO(photo['content'])) as source:
                    image=source.convert('RGB')
                    image.thumbnail((514,382),Image.Resampling.LANCZOS)
                    page.paste(image,(x+(538-image.width)//2,y+12+(382-image.height)//2))
                    image.close()
                uploaded=photo['uploaded_at'].astimezone(ZoneInfo('Asia/Bangkok')).strftime('%d/%m/%Y %H:%M')
                text(f"ภาพ {photo['slot']} | {uploaded} (เวลาไทย)",x+12,y+402,514)
            text(f'CJ Logistics | หน้า {index}/{len(records)}',50,1180)
        pages[0].save(output,'PDF',save_all=True,append_images=pages[1:],resolution=150,title='HDC Tote Photo Report')
    finally:
        for page in pages: page.close()

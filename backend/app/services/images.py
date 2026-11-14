from io import BytesIO
import hashlib
import warnings
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import HTTPException

Image.MAX_IMAGE_PIXELS = 30_000_000

def normalize_image(content):
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as source:
                if source.format not in ('JPEG', 'PNG', 'WEBP'):
                    raise ValueError('Unsupported image')
                image = ImageOps.exif_transpose(source)
                image.thumbnail((1600, 1600))
                image = image.convert('RGB')
                output = BytesIO()
                image.save(output, format='JPEG', quality=82, optimize=True)
                data = output.getvalue()
                return data, hashlib.sha256(data).hexdigest()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, 'ไฟล์ภาพไม่ถูกต้อง หรือมีขนาดภาพใหญ่เกินไป')

import logging
import asyncio
from contextlib import asynccontextmanager, suppress
from urllib.parse import urlsplit
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from psycopg import OperationalError
from app.api.router import router
from app.services.cleanup import try_cleanup_photos

@asynccontextmanager
async def lifespan(app):
    async def cleanup_loop():
        while True:
            await asyncio.to_thread(try_cleanup_photos)
            await asyncio.sleep(60)
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title='HDC Tote tracker', version='1.0.0', lifespan=lifespan)
app.include_router(router, prefix='/api')


@app.middleware('http')
async def same_origin(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        origin = request.headers.get('origin')
        if request.headers.get('sec-fetch-site') == 'cross-site' or (origin and urlsplit(origin).netloc != request.headers.get('host')):
            return JSONResponse({'detail': 'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'}, status_code=403)
    response = await call_next(request)
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Cache-Control'] = 'no-store'
    return response


@app.exception_handler(OperationalError)
async def database_error(request, error):
    logging.exception('Database unavailable', exc_info=error)
    return JSONResponse({'detail': 'ฐานข้อมูลยังไม่พร้อม กรุณาลองใหม่'}, status_code=503)

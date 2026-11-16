import { t, useLanguage, locale } from "../lib/i18n";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";

export function PhotoViewer({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLImageElement>(null);
  const scaleRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ distance: 0, scale: 1 });
  const [scale, setScale] = useState(1);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  function fit() {
    const image = photo.current;
    const box = viewport.current;
    if (!image?.naturalWidth || !box) return;
    const ratio = Math.min(
      (box.clientWidth - 24) / image.naturalWidth,
      (box.clientHeight - 24) / image.naturalHeight,
      1,
    );
    setSize({
      width: image.naturalWidth * ratio,
      height: image.naturalHeight * ratio,
    });
  }
  function zoom(value: number) {
    const next = Math.max(1, Math.min(4, value));
    scaleRef.current = next;
    setScale(next);
  }
  useEffect(() => {
    dialog.current?.showModal();
    const box = viewport.current!;
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom(scaleRef.current + (event.deltaY < 0 ? 0.25 : -0.25));
    };
    box.addEventListener("wheel", wheel, { passive: false });
    return () => {
      observer.disconnect();
      box.removeEventListener("wheel", wheel);
    };
  }, []);
  useEffect(() => {
    const box = viewport.current;
    if (box) {
      box.scrollLeft = (box.scrollWidth - box.clientWidth) / 2;
      box.scrollTop = (box.scrollHeight - box.clientHeight) / 2;
    }
  }, [scale, size]);
  function release(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    gesture.current.distance = 0;
  }
  return (
    <dialog
      ref={dialog}
      className="zoom-dialog"
      aria-label={t("ดูและซูมภาพสินค้า")}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="zoom-header">
        <div>
          <b>{t("ภาพสินค้าใน Tote")}</b>
          <small>{t("กางสองนิ้วเพื่อซูม · ลากเพื่อเลื่อนภาพ")}</small>
        </div>
        <button
          className="icon-button"
          aria-label={t("ปิดรูป")}
          onClick={onClose}
        >
          <X />
        </button>
      </div>
      <div className="zoom-toolbar">
        <button
          aria-label={t("ซูมออก")}
          disabled={!loaded || scale <= 1}
          onClick={() => zoom(scale - 0.5)}
        >
          <Minus size={19} />
        </button>
        <output aria-live="polite" aria-label={t("ระดับการซูม")}>
          {Math.round(scale * 100)}%
        </output>
        <button
          aria-label={t("ซูมเข้า")}
          disabled={!loaded || scale >= 4}
          onClick={() => zoom(scale + 0.5)}
        >
          <Plus size={19} />
        </button>
        <button
          aria-label={t("คืนขนาดภาพ")}
          disabled={!loaded || scale === 1}
          onClick={() => zoom(1)}
        >
          <RotateCcw size={17} />
          {t("พอดีจอ")}
        </button>
      </div>
      <div
        ref={viewport}
        className="zoom-viewport"
        onDoubleClick={() => zoom(scale > 1 ? 1 : 2)}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            gesture.current = {
              distance: Math.hypot(a.x - b.x, a.y - b.y),
              scale: scaleRef.current,
            };
          }
        }}
        onPointerMove={(event) => {
          const previous = pointers.current.get(event.pointerId);
          if (!previous) return;
          pointers.current.set(event.pointerId, {
            x: event.clientX,
            y: event.clientY,
          });
          if (pointers.current.size === 2 && gesture.current.distance > 0) {
            const [a, b] = [...pointers.current.values()];
            zoom(
              (gesture.current.scale * Math.hypot(a.x - b.x, a.y - b.y)) /
                gesture.current.distance,
            );
          } else if (pointers.current.size === 1) {
            event.currentTarget.scrollLeft -= event.clientX - previous.x;
            event.currentTarget.scrollTop -= event.clientY - previous.y;
          }
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
      >
        {error ? (
          <p className="zoom-feedback" role="alert">
            {t("โหลดรูปไม่สำเร็จ กรุณาปิดแล้วเปิดรูปใหม่")}
          </p>
        ) : (
          <>
            {!loaded && (
              <p className="zoom-feedback" role="status">
                {t("กำลังโหลดรูป…")}
              </p>
            )}
            <div
              className="zoom-canvas"
              style={{ width: size.width * scale, height: size.height * scale }}
            >
              <img
                ref={photo}
                src={url}
                alt={t("ภาพสินค้าใน Tote ขนาดใหญ่")}
                draggable={false}
                onLoad={() => {
                  setLoaded(true);
                  fit();
                }}
                onError={() => setError(true)}
                style={{
                  width: size.width * scale,
                  height: size.height * scale,
                  visibility: loaded ? "visible" : "hidden",
                }}
              />
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

import logging
from typing import Optional, Tuple

import cv2
import numpy as np

from config import settings
from lpr.utils import normalize_plate

logger = logging.getLogger(__name__)

_easyocr_reader = None
_easyocr_available: Optional[bool] = None
_tesseract_available: Optional[bool] = None


# ────────────────────────────────────────────────────────────────────────────
# EasyOCR init
# ────────────────────────────────────────────────────────────────────────────

def _get_easyocr_reader():
    global _easyocr_reader, _easyocr_available
    if _easyocr_available is False:
        return None
    try:
        import easyocr  # noqa: PLC0415

        if _easyocr_reader is None:
            logger.info("Inicializando EasyOCR (primera vez puede tardar)…")
            _easyocr_reader = easyocr.Reader(["en"], gpu=False, verbose=False)
            logger.info("EasyOCR listo")
        _easyocr_available = True
        return _easyocr_reader
    except Exception as exc:
        logger.warning("EasyOCR no disponible: %s", exc)
        _easyocr_available = False
        return None


# ────────────────────────────────────────────────────────────────────────────
# Preprocessing variants
# ────────────────────────────────────────────────────────────────────────────

def _make_variants(frame: np.ndarray) -> list:
    """Return preprocessed frame variants for OCR retry passes."""
    h, w = frame.shape[:2]
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # CLAHE — improves low-contrast plates
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    variants = []

    # 1. 2× upscale (helps small plates / low-res photos)
    if max(h, w) < 1200:
        up = cv2.resize(frame, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        variants.append(("2x_upscale", up))

    # 2. CLAHE grayscale → BGR
    variants.append(("clahe_gray", cv2.cvtColor(enhanced, cv2.COLOR_GRAY2BGR)))

    # 3. 2× upscale + CLAHE
    if max(h, w) < 1200:
        up_enh = cv2.resize(enhanced, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)
        variants.append(("2x_clahe", cv2.cvtColor(up_enh, cv2.COLOR_GRAY2BGR)))

    # 4. Bilateral filter — removes noise while keeping edges
    bilat = cv2.bilateralFilter(frame, 9, 75, 75)
    variants.append(("bilateral", bilat))

    return variants


# ────────────────────────────────────────────────────────────────────────────
# Single-frame OCR pass
# ────────────────────────────────────────────────────────────────────────────

def _ocr_pass(frame: np.ndarray, min_conf: float) -> Tuple[Optional[str], float, Optional[tuple]]:
    """Run EasyOCR on one frame, return best plate above min_conf."""
    reader = _get_easyocr_reader()
    if reader is None:
        return None, 0.0, None

    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    results = reader.readtext(rgb)

    best_plate: Optional[str] = None
    best_conf = 0.0
    best_bbox: Optional[tuple] = None

    for bbox, text, conf in results:
        logger.debug("OCR raw: '%s'  conf=%.2f", text, conf)
        plate = normalize_plate(text)

        if plate:
            if conf >= min_conf and conf > best_conf:
                best_plate = plate
                best_conf = conf
                pts = np.array(bbox, dtype=np.int32)
                x, y, w, h = cv2.boundingRect(pts)
                best_bbox = (x, y, w, h)
                logger.info("Candidata aceptada: '%s' → %s  conf=%.2f", text, plate, conf)
            elif conf < min_conf:
                logger.info(
                    "Candidata descartada (conf baja): '%s' → %s  conf=%.2f < umbral=%.2f",
                    text, plate, conf, min_conf,
                )
        else:
            # Log non-plate text only at debug level to avoid noise
            logger.debug("Texto no es placa: '%s'  conf=%.2f", text, conf)

    return best_plate, best_conf, best_bbox


# ────────────────────────────────────────────────────────────────────────────
# EasyOCR multi-pass detector
# ────────────────────────────────────────────────────────────────────────────

def _detect_easyocr(frame: np.ndarray) -> Tuple[Optional[str], float, Optional[tuple]]:
    # Pass 1: original image, configured threshold
    plate, conf, bbox = _ocr_pass(frame, settings.min_confidence)
    if plate:
        return plate, conf, bbox

    # Pass 2: preprocessed variants with relaxed threshold
    fallback_conf = max(0.30, settings.min_confidence * 0.55)
    logger.info("Pase 1 sin resultado — reintentando con preprocessing (umbral=%.2f)…", fallback_conf)

    for name, variant in _make_variants(frame):
        plate, conf, bbox = _ocr_pass(variant, fallback_conf)
        if plate:
            logger.info("Placa encontrada en variante '%s': %s  conf=%.2f", name, plate, conf)
            return plate, conf, bbox

    logger.warning("EasyOCR no detectó placa válida en ningún pase")
    return None, 0.0, None


# ────────────────────────────────────────────────────────────────────────────
# Tesseract fallback
# ────────────────────────────────────────────────────────────────────────────

def _detect_tesseract(frame: np.ndarray) -> Tuple[Optional[str], float, Optional[tuple]]:
    global _tesseract_available
    if _tesseract_available is False:
        return None, 0.0, None
    try:
        import pytesseract  # noqa: PLC0415

        _tesseract_available = True
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        cfg = r"--oem 3 --psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-"
        text = pytesseract.image_to_string(thresh, config=cfg).strip()
        logger.info("Tesseract resultado: '%s'", text)
        plate = normalize_plate(text)
        if plate:
            h, w = frame.shape[:2]
            return plate, 0.7, (0, 0, w, h)
        return None, 0.0, None
    except Exception as exc:
        logger.warning("Tesseract no disponible: %s", exc)
        _tesseract_available = False
        return None, 0.0, None


# ────────────────────────────────────────────────────────────────────────────
# Public API
# ────────────────────────────────────────────────────────────────────────────

def detect_plate(frame: np.ndarray) -> Tuple[Optional[str], float, Optional[tuple]]:
    """EasyOCR (multi-pass + preprocessing) → pytesseract fallback."""
    plate, conf, bbox = _detect_easyocr(frame)
    if plate is None:
        plate, conf, bbox = _detect_tesseract(frame)
    return plate, conf, bbox

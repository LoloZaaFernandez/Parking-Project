import logging
from typing import Optional, Tuple

import numpy as np

from lpr.utils import normalize_plate

logger = logging.getLogger(__name__)

_fast_alpr_instance = None
_fast_alpr_available: Optional[bool] = None


def _get_fast_alpr():
    global _fast_alpr_instance, _fast_alpr_available
    if _fast_alpr_available is False:
        return None
    try:
        from fast_alpr import ALPR  # noqa: PLC0415
        if _fast_alpr_instance is None:
            logger.info("Inicializando fast-alpr…")
            _fast_alpr_instance = ALPR(
                detector_model="yolo-v9-t-384-license-plate-end2end",
                ocr_model="global-plates-mobile-vit-v2-model",
            )
            logger.info("fast-alpr listo")
        _fast_alpr_available = True
        return _fast_alpr_instance
    except Exception as exc:
        logger.warning("fast-alpr no disponible: %s", exc)
        _fast_alpr_available = False
        return None


def _avg_conf(raw_conf) -> float:
    if isinstance(raw_conf, list):
        return sum(raw_conf) / len(raw_conf) if raw_conf else 0.0
    return float(raw_conf)


def detect_plate(frame: np.ndarray) -> Tuple[Optional[str], float, Optional[tuple]]:
    alpr = _get_fast_alpr()
    if alpr is None:
        return None, 0.0, None
    try:
        results = alpr.predict(frame)
        if not results:
            logger.info("fast-alpr: sin detecciones")
            return None, 0.0, None

        best_plate: Optional[str] = None
        best_conf = 0.0
        best_bbox = None

        for r in results:
            if r.ocr is None:
                continue
            raw_text = r.ocr.text.upper().strip()
            conf = _avg_conf(r.ocr.confidence)
            logger.info("fast-alpr: '%s'  conf=%.2f", raw_text, conf)

            plate = normalize_plate(raw_text) or raw_text
            if conf > best_conf:
                best_plate = plate
                best_conf = conf
                best_bbox = r.detection.bounding_box.to_xywh()

        if best_plate:
            logger.info("Placa detectada: '%s'  conf=%.2f", best_plate, best_conf)
        return best_plate, best_conf, best_bbox

    except Exception as exc:
        logger.warning("fast-alpr excepción: %s", exc)
        return None, 0.0, None

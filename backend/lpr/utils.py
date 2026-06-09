import re


def normalize_plate(text: str) -> str | None:
    """Normalize OCR text to Peru plate format (ABC-123 or AB-1234)."""
    if not text:
        return None

    cleaned = re.sub(r"[^A-Z0-9\-]", "", text.upper().strip())

    # Already correctly formatted
    if re.match(r"^[A-Z]{3}-\d{3}$", cleaned):
        return cleaned
    if re.match(r"^[A-Z]{2}-\d{4}$", cleaned):
        return cleaned

    # No dash — add it
    if re.match(r"^[A-Z]{3}\d{3}$", cleaned):
        return f"{cleaned[:3]}-{cleaned[3:]}"
    if re.match(r"^[A-Z]{2}\d{4}$", cleaned):
        return f"{cleaned[:2]}-{cleaned[2:]}"

    # With dash but OCR noise in numeric part (O→0, I→1, S→5, B→8)
    if len(cleaned) == 7 and cleaned[3] == "-":
        prefix, nums = cleaned[:3], cleaned[4:]
        if prefix.isalpha():
            fixed = nums.replace("O", "0").replace("I", "1").replace("S", "5").replace("B", "8")
            if re.match(r"^\d{3}$", fixed):
                return f"{prefix}-{fixed}"

    # Without dash, 6 chars, fix numeric suffix
    if len(cleaned) == 6:
        for split in (3, 2):
            prefix, nums = cleaned[:split], cleaned[split:]
            expected_len = 3 if split == 3 else 4
            if prefix.isalpha() and len(nums) == expected_len:
                fixed = nums.replace("O", "0").replace("I", "1").replace("S", "5").replace("B", "8")
                if fixed.isdigit():
                    return f"{prefix}-{fixed}"

    return None

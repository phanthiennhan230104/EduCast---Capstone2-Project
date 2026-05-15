import math

def format_count(count):
    if count >= 1000000:
        return f"{count / 1000000:.1f}m".replace(".0", "")
    elif count >= 1000:
        return f"{count / 1000:.1f}k".replace(".0", "")
    return str(count)

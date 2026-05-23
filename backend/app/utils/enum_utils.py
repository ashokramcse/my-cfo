"""
Utility for safely extracting the string value from SQLAlchemy / Python enums.

In Python 3.10 with `class Foo(str, enum.Enum)`, `str(Foo.BAR)` returns
`"Foo.BAR"` not `"BAR"`. Use `ev(enum_val)` everywhere instead of `str()`.
"""


def ev(enum_val) -> str:
    """Return the plain uppercase string value of an enum member."""
    if enum_val is None:
        return ""
    return getattr(enum_val, "value", str(enum_val)).upper()

from typing import Callable, TypeGuard


class Maybe[T]:
    def __init__(self, value: T | None = None):
        self.value = value

    @classmethod
    def of(cls, value: T | None) -> "Maybe[T]":
        return cls(value)

    @classmethod
    def wraps[**P, U](cls, func: Callable[P, U | None]) -> Callable[P, "Maybe[U]"]:
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> "Maybe[U]":
            result = func(*args, **kwargs)
            return Maybe.of(result)

        return wrapper

    def instanceof[U](self, typ: type[U]) -> U:
        if isinstance(self.value, typ):
            return self.value
        raise TypeError(f"Value is not of type {typ.__name__}")

    def is_instance[U](self, typ: type[U]) -> TypeGuard[U]:
        return isinstance(self.value, typ)

    def map[U](self, func: Callable[[T], U]) -> "Maybe[U]":
        if self.value is not None:
            return Maybe.of(func(self.value))
        return Maybe.of(None)

    def flatmap[U](self, func: Callable[[T], "Maybe[U]"]) -> "Maybe[U]":
        if self.value is not None:
            return func(self.value)
        return Maybe.of(None)

    def get_or_else(self, default: T) -> T:
        if self.value is not None:
            return self.value
        return default

    def is_none(self) -> bool:
        return self.value is None

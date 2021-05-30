---
title: "do {…} while (0) — What is it good for?"
date: 2014-12-17
slug: "c-do-while-in-macros"
---

> Originally posted in [stackoverflow][stackoverflow]

It's the only construct in C that you can use to `#define` a multistatement operation, put a semicolon after, and still use within an `if` statement. An example might help:
```c
#define FOO(x) foo(x); bar(x)

if (condition)
    FOO(x);
else // syntax error here
    ...;
```

Even using braces doesn't help:
```c
#define FOO(x) { foo(x); bar(x); }
```

Using this in an `if` statement would require that you omit the semicolon, which is counterintuitive:
```c
if (condition)
    FOO(x)
else
    ...
```

If you define FOO like this:
```c
#define FOO(x) do { foo(x); bar(x); } while (0)
```

Then the following is syntactically correct:
```c
if (condition)
    FOO(x);
else
    ....
```

[stackoverflow]:    http://stackoverflow.com/questions/257418/do-while-0-what-is-it-good-for

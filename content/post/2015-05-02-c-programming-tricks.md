---
title: C Programming Tricks
tags:
  - C
  - GCC
date: 2015-05-02
---

这个 Note 用来记录各处收集的 C 编程 tricks. 看到有意思的就会摘一下，来源各异。

## Anonymous arrays
C99 offers some really cool stuff using anonymous arrays:

### Removing pointless variables
```c
int yes=1;
setsockopt(yourSocket, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(int));
/* becomes: */
setsockopt(yourSocket, SOL_SOCKET, SO_REUSEADDR, (int[]){1}, sizeof(int));
```

### Passing a Variable Amount of Arguments
```c
Void func(type* values) {
    while(*values) {
        x = *values++;
        /* do whatever with x */
    }
}

func((type[]){val1,val2,val3,val4,0});
```

### Static linked lists
```c
int main() {
    struct llist { int a; struct llist* next;};
    #define cons(x,y) (struct llist[]){ {x,y} }
    struct llist *list=cons(1, cons(2, cons(3, cons(4, NULL))));
    struct llist *p = list;
    while(p != 0) {
      printf("%d\n", p->a);
      p = p->next;
    }
}
```

## Include data file as header inside array initializer
```c
double normals[][] = {
  #include "normals.txt"
};
```

## Using `__FILE__` and `__LINE__` for debugging
```c
#define WHERE fprintf(stderr,"[LOG]%s:%d\n",__FILE__,__LINE__);
```

## Dynamically sized object(modified)
```c
struct X {
    int len;
    char str[];
};

int n = strlen("hello world") + 1;
struct X *string = malloc(offsetof(struct X, str) + n);
strcpy(string->str, "hello world");
string->len = n;
```
`offsetof()` 本身也是一个比较有趣的宏定义(?)。

## An example of `offsetof()`
```c
#define offsetof(st, m) ((size_t)(&((st *)0)->m))
```
This works by casting a null pointer into a pointer to structure st, and then obtaining the address of member m within said structure. While this implementation works correctly in many compilers, it has undefined behavior according to the C standard,[2] since it involves a dereference of a null pointer (although, one might argue that no dereferencing takes place, because the whole expression is calculated at compile time). It also tends to produce confusing compiler diagnostics if one of the arguments is misspelled.

## Blank in a `scanf()` format
In a `scanf()` format, a blank, tab or newline means 'skip white space if there is any to skip'. It does not directly 'clear the input buffer', but it does eat any white space which looks similar to clearing the input buffer (but is quite distinct from that). If you're on Windows, using `fflush(stdin)` clears the input buffer (of white space and non-white space characters); on Unix and according to the C standard, `fflush(stdin)` is undefined behaviour.

```c
while((c = getchar()) == '\n');
/* becomes: */
scanf(" %c", &c);
```

## Reference
1. [What is your favorite C programming trick? - StackOverflow](http://stackoverflow.com/questions/599365/what-is-your-favorite-c-programming-trick)
1. [offsetof() - Wikipedia](https://en.wikipedia.org/wiki/Offsetof)
1. [Difference between scanf("%c", &c) and scanf(" %c", &c) - StackOverflow](http://stackoverflow.com/questions/18491390/difference-between-scanfc-c-and-scanf-c-c)

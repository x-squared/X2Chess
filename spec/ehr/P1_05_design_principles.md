## 5. Design Principles

Four non-negotiable architectural demands shape all decisions:

1. **Performance** — sub-100ms for common clinical queries; predictable latency under load
2. **Modularity** — domains are independently deployable and independently evolvable
3. **Data model first** — the data model defines structure and meaning; views and forms are derived from it, never the reverse
4. **Extensibility** — new clinical concepts, new resource types, and new billing rules must be addable without schema migrations and without modifying existing code


// A tiny arithmetic language for lever effects: numbers, hypothesis ids, + - * / and parentheses.
// It keeps levers.json readable ("priceCut * elasticity * (1 - fromDairy)") without eval().

type Node =
  | { k: "num"; v: number }
  | { k: "id"; name: string }
  | { k: "neg"; a: Node }
  | { k: "bin"; op: "+" | "-" | "*" | "/"; a: Node; b: Node };

const cache = new Map<string, Node>();

function tokenize(src: string): string[] {
  const tokens = src.match(/\d+(?:\.\d+)?|[A-Za-z_][A-Za-z0-9_]*|[-+*/()]|\S/g) ?? [];
  for (const t of tokens) if (!/^(\d|[A-Za-z_]|[-+*/()])/.test(t)) throw new Error(`Unexpected "${t}" in "${src}"`);
  return tokens;
}

function parse(src: string): Node {
  const hit = cache.get(src);
  if (hit) return hit;
  const tokens = tokenize(src);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expr = (): Node => {
    let a = term();
    while (peek() === "+" || peek() === "-") a = { k: "bin", op: next() as "+" | "-", a, b: term() };
    return a;
  };
  const term = (): Node => {
    let a = unary();
    while (peek() === "*" || peek() === "/") a = { k: "bin", op: next() as "*" | "/", a, b: unary() };
    return a;
  };
  const unary = (): Node => (peek() === "-" ? (next(), { k: "neg", a: unary() }) : atom());
  const atom = (): Node => {
    const t = next();
    if (t === undefined) throw new Error(`Unexpected end of "${src}"`);
    if (t === "(") {
      const a = expr();
      if (next() !== ")") throw new Error(`Missing ")" in "${src}"`);
      return a;
    }
    if (/^\d/.test(t)) return { k: "num", v: Number(t) };
    if (/^[A-Za-z_]/.test(t)) return { k: "id", name: t };
    throw new Error(`Unexpected "${t}" in "${src}"`);
  };
  const node = expr();
  if (i !== tokens.length) throw new Error(`Unexpected "${peek()}" in "${src}"`);
  cache.set(src, node);
  return node;
}

function run(n: Node, vars: Record<string, number>): number {
  switch (n.k) {
    case "num": return n.v;
    case "id": {
      const v = vars[n.name];
      if (v === undefined) throw new Error(`Unknown hypothesis "${n.name}"`);
      return v;
    }
    case "neg": return -run(n.a, vars);
    case "bin": {
      const a = run(n.a, vars), b = run(n.b, vars);
      return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a * b : a / b;
    }
  }
}

export const evaluate = (src: string, vars: Record<string, number>): number => run(parse(src), vars);

/** Hypothesis ids an expression refers to, for data validation. */
export function identifiers(src: string): string[] {
  const out: string[] = [];
  const walk = (n: Node) => {
    if (n.k === "id") out.push(n.name);
    else if (n.k === "neg") walk(n.a);
    else if (n.k === "bin") { walk(n.a); walk(n.b); }
  };
  walk(parse(src));
  return out;
}

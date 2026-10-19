"""Real AST parser for Python source, driven by Python's own `ast` module.

The RBL syllabus for Milestone 2 requires an AST parser built on *"Python's `ast` module for
Python source, or Roslyn for C#"*. The gateway previously tokenised code with regular
expressions, which labels tokens with AST-like names (`FUNC_DEF`, `RETURN_STMT`) but never
builds a parse tree — so structural edits that a real parser would normalise away could survive.

This script is the real thing. It reads a JSON request from stdin:

    {"language": "python", "sources": {"id1": "code...", "id2": "code..."}}

and writes back, for each source, the structural token stream a real parse tree produces:

    {"ok": true, "results": {"id1": {"tokens": [{"type": "FunctionDef", "line": 3}, ...],
                                    "nodeCount": 42,
                                    "maxDepth": 6}}}

The token stream is produced by walking the AST, so it reflects the *structure* of the program:
control flow, definitions, calls, operators and literals become typed nodes, while comments,
whitespace and identifier spelling disappear — exactly the normalisation plagiarism detection
needs. Anything that is not valid Python is reported as `{"ok": false, "error": ...}` so the
caller can fall back instead of silently comparing garbage.

Usage (from Node):  spawn('python', ['ast_parser.py']) and exchange JSON over stdin/stdout.
Standalone check:   echo '{"language":"python","sources":{"a":"def f(x): return x+1"}}' | \
                    python ast_parser.py
"""
import ast
import json
import sys

# Nodes that carry no structural meaning: their position is implied by their parent.
TRIVIAL_NODES = {
    "Load",
    "Store",
    "Del",
    "Param",
    "arguments",
    "keyword",
    "alias",
    "Expr",  # a bare expression statement adds noise without changing structure
}

# Operator and comparison nodes are collapsed into one token each, so `a+b` and `a-b` stay
# distinguishable while the tree shape above them is unchanged.
OPERATOR_TYPES = set()
for _name in ("Add", "Sub", "Mult", "Div", "FloorDiv", "Mod", "Pow", "LShift", "RShift",
              "BitOr", "BitXor", "BitAnd", "MatMult"):
    OPERATOR_TYPES.add(_name)

COMPARATOR_TYPES = set()
for _name in ("Eq", "NotEq", "Lt", "LtE", "Gt", "GtE", "Is", "IsNot", "In", "NotIn"):
    COMPARATOR_TYPES.add(_name)


def structural_tokens(tree):
    """Walks the AST and emits one token per structural node.

    The token type is the node's class name, which is precisely what makes the stream
    rename-invariant: `def calculate_factorial(n)` and `def compute_fact(x_val)` both yield
    `FunctionDef`, while a genuinely different structure yields different node types.
    """
    tokens = []

    def visit(node, depth):
        if isinstance(node, ast.AST):
            name = node.__class__.__name__

            if name in OPERATOR_TYPES:
                tokens.append({"type": "BinOp:" + name, "line": getattr(node, "lineno", 1)})
                return
            if name in COMPARATOR_TYPES:
                tokens.append({"type": "CmpOp:" + name, "line": getattr(node, "lineno", 1)})
                return

            if name not in TRIVIAL_NODES:
                line = getattr(node, "lineno", None)
                if line is None:
                    for child in ast.iter_child_nodes(node):
                        candidate = getattr(child, "lineno", None)
                        if candidate is not None:
                            line = candidate
                            break
                tokens.append({"type": name, "line": line or 1})

            for child in ast.iter_child_nodes(node):
                visit(child, depth + 1)
        elif isinstance(node, list):
            for item in node:
                visit(item, depth)

    visit(tree, 0)
    return tokens


def walk_depth(node, depth=0):
    """Maximum nesting depth, used to distinguish a flat script from deeply nested logic."""
    best = depth
    for child in ast.iter_child_nodes(node):
        best = max(best, walk_depth(child, depth + 1))
    return best


def parse_one(source):
    """Parses one source string. Returns a result dict, never raises."""
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return {"ok": False, "error": "SyntaxError: %s (line %s)" % (exc.msg, exc.lineno)}
    except (ValueError, RecursionError, MemoryError) as exc:
        return {"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)}

    tokens = structural_tokens(tree)
    node_count = sum(1 for _ in ast.walk(tree))
    return {
        "ok": True,
        "tokens": tokens,
        "nodeCount": node_count,
        "maxDepth": walk_depth(tree),
    }


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception as exc:  # noqa: BLE001
        json.dump({"ok": False, "error": "invalid request: %s" % exc}, sys.stdout)
        return 0

    sources = payload.get("sources") or {}
    results = {}
    for key, source in sources.items():
        results[key] = parse_one(source if isinstance(source, str) else "")

    json.dump({"ok": True, "results": results}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main())

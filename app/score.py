#!/usr/bin/env python3
"""Score layout.tsx: higher = fewer heavy static imports in critical path."""
import sys, re
HEAVY = [r"@supabase/", r"lib/supabase", r"supabase/client", r"supabase/server",
         r"\bSidebar\b", r"\bTopBar\b", r"\bDashboardView\b",
         r"lib/modules", r"lib/rbac", r"lib/chains"]
def score(path):
    c = open(path).read()
    imports = [l.strip() for l in c.splitlines() if re.match(r"^import\s+", l.strip())]
    pts = 100.0
    for imp in imports:
        for pat in HEAVY:
            if re.search(pat, imp): pts -= 15; break
    if re.search(r"\bdynamic\s*\(|React\.lazy\s*\(", c): pts += 20
    if re.search(r"<Suspense\b", c): pts += 10
    return max(0.0, min(100.0, pts))
print(f"{score(sys.argv[1]):.1f}")

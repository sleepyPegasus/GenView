"""
单页 HTML 导出服务：Mermaid 图导出为内联 HTML。
"""


def generate_mermaid_html(mermaid_code: str, title: str = "Diagram") -> str:
    """生成包含 Mermaid 图的单页 HTML。"""
    code = mermaid_code.strip()
    if code.startswith("```mermaid"):
        code = code[len("```mermaid") :].strip()
    if code.startswith("```"):
        code = code[3:].strip()
    if code.endswith("```"):
        code = code[:-3].strip()
    escaped_code = (
        code.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {{ font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #fff; color: #1e293b; }}
    .mermaid {{ display: flex; justify-content: center; margin: 24px 0; }}
  </style>
</head>
<body>
  <h1 style="font-size: 1.25rem; margin-bottom: 16px;">{title.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")}</h1>
  <div class="mermaid">
{escaped_code}
  </div>
  <script>
    mermaid.initialize({{ startOnLoad: true, theme: 'default' }});
  </script>
</body>
</html>"""

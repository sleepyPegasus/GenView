"""
Test export service: generate zip and verify generated files have valid syntax.
Run: cd backend && python -m pytest tests/test_export.py -v
"""
import shutil
import subprocess
import zipfile
from io import BytesIO
from pathlib import Path

import pytest

from app.services.export_service import generate_vite_project


# Page content that previously caused JSX parse errors
PROBLEMATIC_PAGE_CONTENT = '''
export default function DashboardContent() {
  return (
    <div style={{ padding: 24 }}>
      <p>时间窗 (入 -> 出)</p>
      <p>当日动态热装率 (目标 > 70%)</p>
      <table>
        <th>批次流转号</th>
        <th>工况类型</th>
        <th>时间窗 (入 -> 出)</th>
      </table>
    </div>
  );
}
'''


def test_export_generates_valid_jsx():
    """Export project zip; verify App.tsx, Layout.tsx, Page use correct style={{ }}."""
    project = {
        "name": "测试项目",
        "logo_url": "",
        "theme": "modern-b2b",
        "nav_layout": "side",
        "nav_config": {
            "items": [{"pageId": "page1", "label": "Dashboard"}],
        },
    }
    page_map = {
        "page1": {
            "code_block": PROBLEMATIC_PAGE_CONTENT,
            "extra_files": {},
        },
    }

    zip_bytes = generate_vite_project(project, [], page_map)
    with zipfile.ZipFile(BytesIO(zip_bytes), "r") as zf:
        # App.tsx: style must use {{ }} for object
        app_tsx = zf.read("src/App.tsx").decode("utf-8")
        assert "style={{ padding: 24 }}" in app_tsx, "App.tsx style should use {{ }}"

        # Layout.tsx: style must use {{ }}
        layout_tsx = zf.read("src/Layout.tsx").decode("utf-8")
        assert "style={{" in layout_tsx, "Layout.tsx should have style={{"

        # Page: -> and > should be sanitized
        page_content = zf.read("src/Page_page1.tsx").decode("utf-8")
        assert "入 -> 出" not in page_content, "-> should be replaced with →"
        assert "→" in page_content
        assert "目标 > 70" not in page_content, "> in text should be replaced with ›"
        assert "›" in page_content


def test_export_npm_build():
    """Export, extract, npm install, npm run build - should succeed."""
    project = {
        "name": "Test",
        "logo_url": "",
        "theme": "modern-b2b",
        "nav_layout": "side",
        "nav_config": {"items": [{"pageId": "p1", "label": "Page"}]},
    }
    # Use content with -> and 目标 > 70% to verify sanitization works in build
    page_map = {
        "p1": {
            "code_block": PROBLEMATIC_PAGE_CONTENT,
            "extra_files": {},
        },
    }
    zip_bytes = generate_vite_project(project, [], page_map)
    tmp = Path("/tmp/genview_export_test")
    tmp.mkdir(exist_ok=True)
    try:
        with zipfile.ZipFile(BytesIO(zip_bytes), "r") as zf:
            zf.extractall(tmp)
        r = subprocess.run(["npm", "install"], cwd=tmp, capture_output=True, text=True, timeout=120)
        assert r.returncode == 0, f"npm install: {r.stderr}"
        r = subprocess.run(["npm", "run", "build"], cwd=tmp, capture_output=True, text=True, timeout=60)
        assert r.returncode == 0, f"npm run build: {r.stderr}"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

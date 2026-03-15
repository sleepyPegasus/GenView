import asyncio
import logging
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session, get_db
from app.models import Page, Project
from app.schemas import PageCreate, PageOut, PageUpdate

router = APIRouter(prefix="/api/projects", tags=["pages"])
logger = logging.getLogger("genview.pages")


@router.get("/{project_id}/pages", response_model=list[PageOut])
async def list_pages(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    result = await db.execute(
        select(Page).where(Page.project_id == project_id).order_by(Page.sort_order.asc(), Page.created_at.asc())
    )
    return result.scalars().all()


async def _generate_and_save_screenshot(project_id: str, page_id: str, code_language: str) -> None:
    """Background task: take screenshot and save to DB."""
    await asyncio.sleep(6)
    try:
        png_bytes = await asyncio.to_thread(_take_screenshot_sync, project_id, page_id, code_language)
        async with async_session() as db:
            page = await db.get(Page, page_id)
            if page and page.project_id == project_id:
                page.screenshot_blob = png_bytes
                await db.commit()
                logger.info("Saved screenshot for page %s", page_id)
    except Exception as e:
        logger.warning("Background screenshot failed for %s: %s", page_id, e)


@router.post("/{project_id}/pages", response_model=PageOut, status_code=201)
async def create_page(
    project_id: str,
    body: PageCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    page = Page(
        project_id=project_id,
        name=body.name,
        nav_label=body.nav_label or body.name,
        code_block=body.code_block,
        code_language=body.code_language,
        extra_files=body.extra_files,
        source_conversation_id=body.source_conversation_id,
        source_message_id=body.source_message_id,
    )
    db.add(page)
    await db.commit()
    await db.refresh(page)
    if page.code_language in ("tsx", "mermaid"):
        background_tasks.add_task(_generate_and_save_screenshot, project_id, page.id, page.code_language)
    return page


@router.get("/{project_id}/pages/{page_id}", response_model=PageOut)
async def get_page(
    project_id: str, page_id: str, db: AsyncSession = Depends(get_db)
):
    page = await db.get(Page, page_id)
    if not page or page.project_id != project_id:
        raise HTTPException(404, "Page not found")
    return page


@router.patch("/{project_id}/pages/{page_id}", response_model=PageOut)
async def update_page(
    project_id: str,
    page_id: str,
    body: PageUpdate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    page = await db.get(Page, page_id)
    if not page or page.project_id != project_id:
        raise HTTPException(404, "Page not found")
    body_data = body.model_dump(exclude_unset=True)
    needs_screenshot = page.code_language in ("tsx", "mermaid") and any(
        k in body_data for k in ("code_block", "extra_files")
    )
    for key, val in body_data.items():
        setattr(page, key, val)
    if needs_screenshot:
        page.screenshot_blob = None
    await db.commit()
    await db.refresh(page)
    if needs_screenshot:
        background_tasks.add_task(_generate_and_save_screenshot, project_id, page_id)
    return page


@router.delete("/{project_id}/pages/{page_id}")
async def delete_page(
    project_id: str, page_id: str, db: AsyncSession = Depends(get_db)
):
    page = await db.get(Page, page_id)
    if not page or page.project_id != project_id:
        raise HTTPException(404, "Page not found")
    await db.delete(page)
    await db.commit()
    return {"success": True}


def _debug_log(hypothesis_id: str, message: str, data: dict):
    import json
    import time
    from pathlib import Path
    try:
        log_path = Path(__file__).resolve().parent.parent.parent.parent / ".cursor" / "debug-6e4d16.log"
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with open(log_path, "a") as f:
            f.write(json.dumps({"sessionId": "6e4d16", "hypothesisId": hypothesis_id, "location": "pages.py", "message": message, "data": data, "timestamp": int(time.time() * 1000)}) + "\n")
    except Exception:
        pass


def _take_screenshot_sync(project_id: str, page_id: str, code_language: str = "tsx") -> bytes:
    """Synchronous Playwright screenshot. Run in thread pool."""
    from playwright.sync_api import sync_playwright

    url = f"{settings.frontend_url}/projects/{project_id}/preview/{page_id}"
    # #region agent log
    _debug_log("H1", "screenshot_start", {"url": url, "project_id": project_id, "page_id": page_id, "code_language": code_language})
    # #endregion
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            pw_page = browser.new_page(viewport={"width": 1920, "height": 1080})
            pw_page.goto(url, wait_until="load", timeout=60000)
            # #region agent log
            _debug_log("H1", "after_goto", {"title": pw_page.title(), "url_after": pw_page.url, "content_len": len(pw_page.content())})
            # #endregion
            if code_language == "mermaid":
                pw_page.wait_for_selector('[data-mermaid-ready="true"]', state="attached", timeout=30000)
                pw_page.wait_for_timeout(1500)
            else:
                pw_page.wait_for_selector("iframe", state="visible", timeout=30000)
                pw_page.wait_for_selector('[data-sandpack-ready="true"]', state="attached", timeout=35000)
                pw_page.wait_for_timeout(2000)
            png = pw_page.screenshot(type="png", full_page=True)
            # #region agent log
            _debug_log("H3", "screenshot_taken", {"png_bytes": len(png), "viewport": {"width": 1920, "height": 1080}})
            # #endregion
            return png
        except Exception as e:
            # #region agent log
            _debug_log("H5", "screenshot_error", {"error": str(e), "error_type": type(e).__name__})
            # #endregion
            raise
        finally:
            browser.close()


def _make_screenshot_response(png_bytes: bytes, page_name: str) -> Response:
    filename = f"{page_name or 'page'}.png".replace("/", "-").replace("\\", "-")
    if filename.isascii():
        cd = f'attachment; filename="{filename}"'
    else:
        cd = f"attachment; filename=\"page.png\"; filename*=UTF-8''{quote(filename, safe='')}"
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Content-Disposition": cd},
    )


@router.get("/{project_id}/pages/{page_id}/screenshot")
async def screenshot_page(
    project_id: str, page_id: str, db: AsyncSession = Depends(get_db)
):
    page = await db.get(Page, page_id)
    if not page or page.project_id != project_id:
        raise HTTPException(404, "Page not found")
    if page.code_language not in ("tsx", "mermaid"):
        raise HTTPException(400, "Only TSX and Diagram pages can be screenshotted")
    if page.screenshot_blob:
        return _make_screenshot_response(page.screenshot_blob, page.name)
    try:
        png_bytes = await asyncio.to_thread(
            _take_screenshot_sync, project_id, page_id, page.code_language
        )
    except Exception as e:
        logger.exception("Screenshot failed: %s", e)
        raise HTTPException(500, f"Screenshot failed: {e!s}") from e
    page.screenshot_blob = png_bytes
    await db.commit()
    return _make_screenshot_response(png_bytes, page.name)

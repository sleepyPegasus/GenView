import datetime
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy import or_

from app.database import get_db
from app.models import AiModifyMessage, Conversation, Message, Page, Project, ProjectTimelineEvent
from app.schemas import AiModifyMessageOut, ProjectCreate, ProjectOut, ProjectUpdate
from app.services.export_service import generate_vite_project

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(
    deleted: bool = Query(False, description="Include deleted projects (recycle bin)"),
    db: AsyncSession = Depends(get_db),
):
    q = select(Project).order_by(Project.updated_at.desc())
    if deleted:
        q = q.where(Project.deleted_at.isnot(None))
    else:
        q = q.where(Project.deleted_at.is_(None))
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=ProjectOut, status_code=201)
async def create_project(body: ProjectCreate, db: AsyncSession = Depends(get_db)):
    project = Project(**body.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/{project_id}/ai-modify-history", response_model=list[AiModifyMessageOut])
async def get_ai_modify_history(
    project_id: str,
    scope_key: str = Query(..., description="page_id 或 hash_xxx"),
    db: AsyncSession = Depends(get_db),
):
    """获取 AI 修改对话历史（按 scope_key 索引，与普通 conversation 分离）"""
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(404, "Project not found")
    result = await db.execute(
        select(AiModifyMessage)
        .where(AiModifyMessage.project_id == project_id, AiModifyMessage.scope_key == scope_key)
        .order_by(AiModifyMessage.created_at.asc())
    )
    return result.scalars().all()


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(404, "Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str, body: ProjectUpdate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(404, "Project not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(project, key, val)
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}")
async def delete_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(404, "Project not found")
    project.deleted_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(project)
    return {"success": True}


@router.post("/{project_id}/restore", response_model=ProjectOut)
async def restore_project(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.deleted_at is None:
        raise HTTPException(400, "Project is not deleted")
    project.deleted_at = None
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/{project_id}/purge")
async def purge_project(project_id: str, db: AsyncSession = Depends(get_db)):
    """Permanently delete a soft-deleted project."""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if project.deleted_at is None:
        raise HTTPException(400, "Project must be deleted first before purging")
    await db.delete(project)
    await db.commit()
    return {"success": True}


@router.post("/{project_id}/export")
async def export_project(
    project_id: str,
    format: str = Query("vite", description="Export format: vite"),
    db: AsyncSession = Depends(get_db),
):
    """Export project as deployable Vite React zip."""
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(404, "Project not found")
    if format != "vite":
        raise HTTPException(400, "Only vite format is supported")

    result = await db.execute(
        select(Page).where(Page.project_id == project_id).order_by(Page.sort_order.asc(), Page.created_at.asc())
    )
    pages = result.scalars().all()

    project_dict = {
        "name": project.name,
        "logo_url": project.logo_url or "",
        "theme": project.theme or "modern-b2b",
        "custom_theme": project.custom_theme,
        "nav_layout": project.nav_layout or "side",
        "nav_config": project.nav_config,
        "app_name_font_size": getattr(project, "app_name_font_size", None),
        "app_name_color": getattr(project, "app_name_color", None),
    }
    page_map = {}
    for p in pages:
        if p.code_language == "tsx":
            page_map[p.id] = {
                "code_block": p.code_block or "",
                "extra_files": p.extra_files,
            }

    zip_bytes = generate_vite_project(project_dict, [], page_map)
    raw_name = (project.name or "genview-export").replace("/", "-").replace("\\", "-")[:50]
    # ASCII-only fallback for filename (latin-1 safe); filename* for UTF-8 (RFC 5987)
    ascii_name = "".join(c if ord(c) < 128 else "-" for c in raw_name) or "genview-export"
    disposition = f'attachment; filename="{ascii_name}.zip"'
    if raw_name != ascii_name:
        disposition += f"; filename*=UTF-8''{quote(f'{raw_name}.zip', safe='')}"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": disposition},
    )


@router.get("/{project_id}/search")
async def search_project(
    project_id: str,
    q: str = Query(..., min_length=1),
    type_filter: str = Query("all", alias="type", description="Filter: all | conversations | pages | timeline"),
    db: AsyncSession = Depends(get_db),
):
    """Search within project: conversations, pages, timeline, message content."""
    project = await db.get(Project, project_id)
    if not project or project.deleted_at is not None:
        raise HTTPException(404, "Project not found")

    pattern = f"%{q.strip()}%"
    results = []

    if type_filter in ("all", "conversations"):
        conv_q = (
            select(Conversation.id, Conversation.title)
            .where(Conversation.project_id == project_id)
            .where(Conversation.title.ilike(pattern))
        )
        conv_res = await db.execute(conv_q)
        for row in conv_res.all():
            results.append({
                "id": row.id,
                "type": "conversation",
                "title": row.title or "Untitled",
                "summary": None,
            })

    if type_filter in ("all", "pages"):
        page_q = (
            select(Page.id, Page.name)
            .where(Page.project_id == project_id)
            .where(or_(Page.name.ilike(pattern), Page.nav_label.ilike(pattern)))
        )
        page_res = await db.execute(page_q)
        for row in page_res.all():
            results.append({
                "id": row.id,
                "type": "page",
                "title": row.name or "Untitled Page",
                "summary": None,
            })

    if type_filter in ("all", "timeline"):
        tl_q = (
            select(ProjectTimelineEvent.id, ProjectTimelineEvent.type, ProjectTimelineEvent.title, ProjectTimelineEvent.phase_label, ProjectTimelineEvent.description)
            .where(ProjectTimelineEvent.project_id == project_id)
            .where(
                or_(
                    ProjectTimelineEvent.title.ilike(pattern),
                    ProjectTimelineEvent.phase_label.ilike(pattern),
                    ProjectTimelineEvent.description.ilike(pattern),
                )
            )
        )
        tl_res = await db.execute(tl_q)
        for row in tl_res.all():
            title = row.title or row.phase_label or "Timeline Event"
            summary = (row.description or "")[:120] if row.description else None
            results.append({
                "id": row.id,
                "type": "timeline",
                "title": title,
                "summary": summary,
            })

    if type_filter in ("all", "conversations"):
        # Search in message content
        msg_q = (
            select(Message.id, Message.content, Message.conversation_id)
            .join(Conversation, Message.conversation_id == Conversation.id)
            .where(Conversation.project_id == project_id)
            .where(Message.content.ilike(pattern))
        )
        msg_res = await db.execute(msg_q)
        seen_ids = {(r["type"], r["id"]) for r in results}
        for row in msg_res.all():
            key = ("conversation", row.conversation_id)
            if key not in seen_ids:
                seen_ids.add(key)
                conv = await db.get(Conversation, row.conversation_id)
                summary = (row.content or "")[:120].replace("\n", " ") if row.content else None
                results.append({
                    "id": row.conversation_id,
                    "type": "conversation",
                    "title": conv.title if conv else "Conversation",
                    "summary": summary,
                })

    return results

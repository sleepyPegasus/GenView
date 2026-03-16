"""项目时间线 API：阶段节点与自定义事件"""
import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project, ProjectTimelineEvent
from app.schemas import (
    TimelineEventCreate,
    TimelineEventOut,
    TimelineEventUpdate,
)

router = APIRouter(prefix="/api/projects", tags=["timeline"])

DEFAULT_PHASES = [
    ("requirement_research", "需求调研", 1),
    ("proposal_design", "方案设计", 2),
    ("proposal_review", "方案评审", 3),
    ("architecture_design", "架构设计", 4),
    ("prototype_design", "原型设计", 5),
    ("detailed_design", "详细设计", 6),
]


def _sort_key(e: ProjectTimelineEvent) -> tuple:
    """排序：先按 sort_order（支持拖拽），再按日期"""
    d = e.event_date or e.start_date
    date_str = d.isoformat() if d else "9999-12-31"
    return (e.sort_order, date_str, e.event_time or "")


@router.get("/{project_id}/timeline", response_model=list[TimelineEventOut])
async def list_timeline(project_id: str, db: AsyncSession = Depends(get_db)):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    result = await db.execute(
        select(ProjectTimelineEvent)
        .where(ProjectTimelineEvent.project_id == project_id)
        .order_by(ProjectTimelineEvent.sort_order, ProjectTimelineEvent.created_at)
    )
    events = list(result.scalars().all())
    events.sort(key=_sort_key)
    return events


@router.post("/{project_id}/timeline/init", response_model=list[TimelineEventOut])
async def init_timeline(project_id: str, db: AsyncSession = Depends(get_db)):
    """初始化默认阶段节点（仅当尚无任何事件时）"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    result = await db.execute(
        select(ProjectTimelineEvent).where(ProjectTimelineEvent.project_id == project_id)
    )
    if result.scalars().first():
        raise HTTPException(400, "Timeline already has events")
    for phase_key, phase_label, order in DEFAULT_PHASES:
        ev = ProjectTimelineEvent(
            project_id=project_id,
            type="phase",
            phase_key=phase_key,
            phase_label=phase_label,
            status="pending",
            sort_order=order,
        )
        db.add(ev)
    await db.commit()
    result = await db.execute(
        select(ProjectTimelineEvent)
        .where(ProjectTimelineEvent.project_id == project_id)
        .order_by(ProjectTimelineEvent.sort_order)
    )
    return list(result.scalars().all())


@router.post("/{project_id}/timeline", response_model=TimelineEventOut, status_code=201)
async def create_timeline_event(
    project_id: str, body: TimelineEventCreate, db: AsyncSession = Depends(get_db)
):
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    data = body.model_dump(exclude_unset=True)
    ev = ProjectTimelineEvent(project_id=project_id, **data)
    db.add(ev)
    await db.commit()
    await db.refresh(ev)
    return ev


@router.patch("/{project_id}/timeline/{event_id}", response_model=TimelineEventOut)
async def update_timeline_event(
    project_id: str,
    event_id: str,
    body: TimelineEventUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ProjectTimelineEvent).where(
            ProjectTimelineEvent.id == event_id,
            ProjectTimelineEvent.project_id == project_id,
        )
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "Timeline event not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(ev, key, val)
    await db.commit()
    await db.refresh(ev)
    return ev


class TimelineReorderBody(BaseModel):
    event_ids: list[str]


@router.post("/{project_id}/timeline/reorder", response_model=list[TimelineEventOut])
async def reorder_timeline_events(
    project_id: str,
    body: TimelineReorderBody,
    db: AsyncSession = Depends(get_db),
):
    """拖拽重排：按 event_ids 顺序更新 sort_order"""
    project = await db.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    if not body.event_ids:
        return []
    for i, ev_id in enumerate(body.event_ids):
        result = await db.execute(
            select(ProjectTimelineEvent).where(
                ProjectTimelineEvent.id == ev_id,
                ProjectTimelineEvent.project_id == project_id,
            )
        )
        ev = result.scalar_one_or_none()
        if ev:
            ev.sort_order = i
    await db.commit()
    result = await db.execute(
        select(ProjectTimelineEvent)
        .where(ProjectTimelineEvent.project_id == project_id)
        .order_by(ProjectTimelineEvent.sort_order, ProjectTimelineEvent.created_at)
    )
    events = list(result.scalars().all())
    events.sort(key=_sort_key)
    return events


@router.delete("/{project_id}/timeline/{event_id}")
async def delete_timeline_event(
    project_id: str, event_id: str, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ProjectTimelineEvent).where(
            ProjectTimelineEvent.id == event_id,
            ProjectTimelineEvent.project_id == project_id,
        )
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "Timeline event not found")
    await db.delete(ev)
    await db.commit()
    return {"success": True}


UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "timeline"


def _safe_filename(name: str) -> str:
    base = re.sub(r"[^\w\s.-]", "", name)[:80] or "file"
    return f"{uuid.uuid4().hex[:12]}_{base}".strip()


@router.post("/{project_id}/timeline/{event_id}/attachments")
async def upload_timeline_attachment(
    project_id: str,
    event_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file attachment for a timeline event."""
    result = await db.execute(
        select(ProjectTimelineEvent).where(
            ProjectTimelineEvent.id == event_id,
            ProjectTimelineEvent.project_id == project_id,
        )
    )
    ev = result.scalar_one_or_none()
    if not ev:
        raise HTTPException(404, "Timeline event not found")
    if not file.filename:
        raise HTTPException(400, "No filename")
    stored = _safe_filename(file.filename)
    dest_dir = UPLOADS_DIR / project_id / event_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / stored
    content = await file.read()
    if len(content) > 50 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 50MB)")
    dest.write_bytes(content)
    url = f"/api/projects/{project_id}/timeline/{event_id}/attachments/{stored}"
    return {"name": file.filename, "url": url}


@router.get("/{project_id}/timeline/{event_id}/attachments/{filename}")
async def get_timeline_attachment(
    project_id: str,
    event_id: str,
    filename: str,
):
    """Serve an uploaded attachment."""
    dest = UPLOADS_DIR / project_id / event_id / filename
    if not dest.exists() or not dest.is_file():
        raise HTTPException(404, "Attachment not found")
    return FileResponse(dest, filename=filename)

import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Project
from app.schemas import ProjectCreate, ProjectOut, ProjectUpdate

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

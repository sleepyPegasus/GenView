import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db

logger = logging.getLogger(__name__)
from app.models import Contact, Customer
from app.schemas import ContactCreate, ContactOut, ContactUpdate, CustomerCreate, CustomerOut, CustomerUpdate

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("", response_model=list[CustomerOut])
async def list_customers(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).order_by(Customer.name))
    return result.scalars().all()


@router.post("", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerCreate, db: AsyncSession = Depends(get_db)):
    customer = Customer(**body.model_dump())
    db.add(customer)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    return customer


@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: str,
    body: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(customer, k, v)
    await db.commit()
    await db.refresh(customer)
    return customer


@router.delete("/{customer_id}", status_code=204)
async def delete_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    await db.delete(customer)
    await db.commit()
    return None


# ── Contacts ──────────────────────────────────────────────
@router.get("/{customer_id}/contacts", response_model=list[ContactOut])
async def list_contacts(customer_id: str, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    result = await db.execute(
        select(Contact).where(Contact.customer_id == customer_id).order_by(Contact.name)
    )
    return result.scalars().all()


@router.post("/{customer_id}/contacts", response_model=ContactOut, status_code=201)
async def create_contact(
    customer_id: str,
    body: ContactCreate,
    db: AsyncSession = Depends(get_db),
):
    data = body.model_dump()
    logger.info(
        "create_contact request: customer_id=%s, name=%r, role=%r, phone=%r (type=%s, len=%s), email=%r",
        customer_id,
        data.get("name"),
        data.get("role"),
        data.get("phone"),
        type(data.get("phone")).__name__,
        len(data.get("phone")) if data.get("phone") is not None else 0,
        data.get("email"),
    )
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, "Customer not found")
    try:
        contact = Contact(customer_id=customer_id, **data)
        db.add(contact)
        await db.commit()
        await db.refresh(contact)
        logger.info("create_contact success: contact_id=%s", contact.id)
        return contact
    except Exception as e:
        logger.exception(
            "create_contact failed: customer_id=%s, data=%s, error=%s",
            customer_id,
            data,
            e,
        )
        raise


@router.patch("/{customer_id}/contacts/{contact_id}", response_model=ContactOut)
async def update_contact(
    customer_id: str,
    contact_id: str,
    body: ContactUpdate,
    db: AsyncSession = Depends(get_db),
):
    contact = await db.get(Contact, contact_id)
    if not contact or contact.customer_id != customer_id:
        raise HTTPException(404, "Contact not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(contact, k, v)
    await db.commit()
    await db.refresh(contact)
    return contact


@router.delete("/{customer_id}/contacts/{contact_id}", status_code=204)
async def delete_contact(
    customer_id: str,
    contact_id: str,
    db: AsyncSession = Depends(get_db),
):
    contact = await db.get(Contact, contact_id)
    if not contact or contact.customer_id != customer_id:
        raise HTTPException(404, "Contact not found")
    await db.delete(contact)
    await db.commit()
    return None

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
import uuid
import os
import aiofiles
from app.database import get_db
from app.utils.deps import get_current_user
from app.models.user import User
from app.models.statement import Statement, StatementStatus
from app.models.card import CreditCard
from app.schemas.statement import StatementOut, StatementUploadResponse
from app.config import settings

router = APIRouter()


@router.get("", response_model=list[StatementOut])
async def list_statements(
    card_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy import and_
    filters = [Statement.user_id == current_user.id]
    if card_id:
        filters.append(Statement.card_id == card_id)
    q = select(Statement).where(and_(*filters)).order_by(Statement.created_at.desc())
    result = await db.execute(q)
    return result.scalars().all()


@router.post("/upload", response_model=StatementUploadResponse, status_code=201)
async def upload_statement(
    background_tasks: BackgroundTasks,
    card_id: Optional[uuid.UUID] = Form(None),
    bank_account_id: Optional[uuid.UUID] = Form(None),
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Validate at least one source is provided
    if not card_id and not bank_account_id:
        raise HTTPException(status_code=400, detail="Either card_id or bank_account_id must be provided")

    # Validate card belongs to user (only if provided)
    if card_id:
        card_result = await db.execute(
            select(CreditCard).where(CreditCard.id == card_id, CreditCard.user_id == current_user.id)
        )
        if not card_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Card not found")

    # BUG-016: Validate bank_account_id ownership (IDOR fix)
    if bank_account_id:
        from app.models.bank_account import BankAccount
        acc_result = await db.execute(
            select(BankAccount).where(BankAccount.id == bank_account_id, BankAccount.user_id == current_user.id)
        )
        if not acc_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Bank account not found")

    fname_lower = (file.filename or "").lower()
    if not fname_lower.endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    file_size = 0
    upload_dir = os.path.join(settings.upload_dir, str(current_user.id))
    os.makedirs(upload_dir, exist_ok=True)

    # SEC-006: Use only UUID as filename — never include original name (path traversal prevention)
    safe_name = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(upload_dir, safe_name)

    async with aiofiles.open(file_path, "wb") as f:
        while chunk := await file.read(1024 * 64):
            file_size += len(chunk)
            if file_size > settings.max_upload_size_mb * 1024 * 1024:
                os.remove(file_path)
                raise HTTPException(status_code=413, detail="File too large")
            await f.write(chunk)

    # Build statement — card_id may be None if bank statement
    stmt_kwargs: dict = dict(
        user_id=current_user.id,
        filename=file.filename,
        file_path=file_path,
        file_size=file_size,
        is_password_protected=bool(password),
        status=StatementStatus.PENDING,
    )
    if card_id:
        stmt_kwargs["card_id"] = card_id
    # bank_account_id stored in extra_data if model doesn't have the column
    if bank_account_id:
        stmt_kwargs["extra_data"] = {"bank_account_id": str(bank_account_id)}

    statement = Statement(**stmt_kwargs)
    db.add(statement)
    await db.flush()

    # SEC-007: Store password encrypted in DB rather than passing in Celery args
    # (Celery args are visible in Redis, Flower, and log files)
    if password:
        from app.utils.encryption import encrypt
        extra = statement.extra_data or {}
        extra["pdf_password_enc"] = encrypt(password)
        statement.extra_data = extra
        await db.flush()

    # Queue background parsing — password retrieved from encrypted DB field in worker
    from app.workers.tasks import parse_statement_task
    task = parse_statement_task.delay(
        str(statement.id),
        file_path,
        None,  # password NOT in task args — worker reads it from statement.extra_data
        str(current_user.id),
    )

    return StatementUploadResponse(
        statement_id=statement.id,
        status=StatementStatus.PENDING,
        message="Statement uploaded. Parsing in progress.",
        task_id=task.id,
    )


@router.get("/{statement_id}", response_model=StatementOut)
async def get_statement(
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id, Statement.user_id == current_user.id)
    )
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return stmt


@router.get("/{statement_id}/status")
async def statement_status(
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id, Statement.user_id == current_user.id)
    )
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    return {
        "id": str(stmt.id),
        "status": stmt.status,
        "transaction_count": int(stmt.transaction_count or 0),
        "bank_detected": stmt.bank_detected,
        "parse_error": stmt.parse_error,
    }


@router.delete("/{statement_id}", status_code=204)
async def delete_statement(
    statement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Statement).where(Statement.id == statement_id, Statement.user_id == current_user.id)
    )
    stmt = result.scalar_one_or_none()
    if not stmt:
        raise HTTPException(status_code=404, detail="Statement not found")
    if stmt.file_path and os.path.exists(stmt.file_path):
        os.remove(stmt.file_path)
    await db.delete(stmt)

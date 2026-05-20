.PHONY: up down build logs ps shell-backend shell-frontend migrate seed backup restore clean

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build --no-cache

logs:
	docker compose logs -f

ps:
	docker compose ps

shell-backend:
	docker compose exec backend bash

shell-frontend:
	docker compose exec frontend sh

shell-db:
	docker compose exec postgres psql -U ccbill -d ccbill

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python -m app.scripts.seed

backup:
	docker compose exec postgres pg_dump -U ccbill ccbill > backups/ccbill_$$(date +%Y%m%d_%H%M%S).sql

restore:
	@read -p "Backup file path: " f; docker compose exec -T postgres psql -U ccbill ccbill < $$f

clean:
	docker compose down -v --remove-orphans
	docker system prune -f

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

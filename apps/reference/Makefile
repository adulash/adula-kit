COMPOSE = docker compose -f docker-compose.prod.yml
export APP_VERSION ?= $(shell git rev-parse --short HEAD)

.PHONY: deploy restore doctor
deploy:
	git pull --ff-only
	$(COMPOSE) build web
	$(COMPOSE) run --rm web node ace.js adula:doctor
	$(COMPOSE) run --rm backup sh deploy/backup.sh once
	$(COMPOSE) run --rm web node ace.js migration:run --force
	$(COMPOSE) up -d
	sh deploy/wait-healthy.sh

doctor:
	$(COMPOSE) run --rm web node ace.js adula:doctor

restore:
	@test -n "$(FILE)" || (echo "FILE must be a backup directory under the backups volume" && exit 1)
	$(COMPOSE) stop web worker scheduler backup
	$(COMPOSE) -f docker-compose.restore.yml run --rm backup sh deploy/restore.sh "$(FILE)"
	$(COMPOSE) run --rm web node ace.js adula:restore:reconcile --force
	$(COMPOSE) up -d web worker scheduler backup
	sh deploy/wait-healthy.sh

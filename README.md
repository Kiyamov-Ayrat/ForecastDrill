# БурПрогноз — система прогноза осложнений при бурении

Полностековый прототип системы мониторинга и упреждающего прогнозирования буровых
осложнений (**прихват**, **флюидопроявление/газопроявление**, **поглощение раствора**):

- **Бэкенд** — FastAPI (async), PostgreSQL/TimescaleDB, встроенный имитатор телеметрии,
  риск-модель, генерация предупреждений (тревог) и обратная связь по ним;
- **Фронтенд** — SPA без сборки (ванильный JS + SVG-графики), nginx раздаёт статику
  и проксирует `/api/` на бэкенд;
- **Развёртывание** — `docker compose` из трёх сервисов: `db`, `backend`, `frontend`.

---

## Технологии

| Слой | Технологии |
|---|---|
| Backend API | Python 3.12, FastAPI, Uvicorn, Pydantic v2 (+pydantic-settings) |
| Данные | SQLAlchemy 2.0 (async), asyncpg, TimescaleDB (PostgreSQL 16, hypertable телеметрии) |
| Безопасность | JWT (pyjwt, HS256), хеширование паролей (pwdlib/argon2), блокировка аккаунта после N неудачных попыток входа |
| ML / прогноз | Модуль `app/ml`: предиктор по окну телеметрии (сигнатуры каналов + сигмоида); интерфейс `RiskPredictor` позволяет заменить модель на LightGBM без изменения сервисов |
| Имитация | Фоновый цикл (`app/scheduler.py`): каждую секунду отсчёт телеметрии, каждые 2 тика — пересчёт риска и тревог |
| Frontend | Vanilla JS (ES-modules не используются — классические `<script>`), CSS-переменные и темы (светлая/тёмная), SVG-графики |
| Инфраструктура | Docker, docker-compose, nginx:alpine (статика + reverse-proxy), timescale/timescaledb:latest-pg16 |
| Тесты | pytest, httpx (`backend/tests`) |

---

## Структура проекта

```
.
├── docker-compose.yml          # оркестрация: db + backend + frontend
├── .env.example                # шаблон переменных окружения (копируется в .env)
├── backend/
│   ├── Dockerfile              # python:3.12-slim, uvicorn app.main:app
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py             # приложение FastAPI, lifespan (init_db, seed, цикл симуляции), /health
│   │   ├── cli.py              # CLI управления пользователями (python -m app.cli ...)
│   │   ├── seed.py             # демо-данные: скважины, пользователи, модели, пороги
│   │   ├── scheduler.py        # warm_up + simulation_loop (телеметрия → прогноз → purge)
│   │   ├── api/v1/             # роутеры REST API: auth, wells, alerts, thresholds, quality, users, simulation
│   │   ├── core/               # config (настройки), database, security (JWT/argon2), deps (DI), exceptions, container
│   │   ├── domain/             # enums (Role, Complication, Level…), channels (спецификация каналов и сигнатуры), access, levels
│   │   ├── models/entities.py  # ORM-сущности: User, Well, Threshold, Channel, TelemetryRecord, Prediction, Alert, ModelVersion, AuditLog…
│   │   ├── schemas/            # Pydantic-схемы запросов/ответов
│   │   ├── services/           # бизнес-логика: auth, well, risk, alert, threshold, telemetry, quality, audit
│   │   ├── repositories/       # interfaces + impl (паттерн репозитория)
│   │   ├── ml/                 # base (интерфейт предиктора), telemetry_predictor, features, simulated
│   │   └── simulation/         # controller, profiles (none/rare/frequent/manual), scenario (эпизоды осложнений)
│   └── tests/test_logic.py     # unit-тесты доменной логики
├── frontend/
│   ├── Dockerfile              # nginx:alpine
│   ├── nginx.conf              # статика + proxy /api/ → backend:8000 (websocket-ready)
│   ├── index.html              # каркас SPA: подключение css/js всех экранов
│   ├── schema.html / schema_eng.html  # схемы/документация интерфейса (rus/eng)
│   ├── css/                    # base.css (темы), layout.css, components.css, screens/*.css (S-1…S-11)
│   ├── js/
│   │   ├── main.js             # точка входа: тема, первый render()
│   │   ├── core/               # utils, state (META экранов, ROLES), data (демо-ряды), charts (SVG), router (SCREENS), api (REST-клиент), bridge (мапия API↔экраны)
│   │   ├── live/               # live.js, quality.js, demo-panel.js (панель имитатора)
│   │   └── screens/            # по одному файлу на интерфейс: login, risk, dash, well, journal, rep, quality, src, thr, models, users
│   └── front/                  # ранняя автономная версия мокапа (без бэкенда)
└── patches-pr/, frontend/patches/  # исторические patch-файлы изменений
```

### Экраны фронтенда (модули интерфейса)

| Код | Экран | JS/CSS | Основные сценарии |
|---|---|---|---|
| S-1 | Вход в систему | `screens/login.js` | UC-1 |
| S-2 | Риск по скважине | `screens/risk.js` | UC-2, UC-3, UC-4 |
| S-3 | Состояние скважин (дашборд) | `screens/dash.js` | UC-5 |
| S-4 | Скважина: риск и предупреждения | `screens/well.js` | UC-2, UC-3, UC-4 |
| S-5 | Журнал и разбор инцидента | `screens/journal.js` | UC-8 |
| S-6 | Отчёты | `screens/rep.js` | UC-9 |
| S-7 | Качество данных | `screens/quality.js` | UC-7 |
| S-8 | Источники данных и паспорт скважины | `screens/src.js` | UC-10 |
| S-9 | Пороги тревог | `screens/thr.js` | UC-6 |
| S-10 | Модели: метрики и переобучение | `screens/models.js` | UC-11, UC-12 |
| S-11 | Пользователи и роли | `screens/users.js` | UC-13 |

Каждый экран регистрируется через `registerScreen('<name>', ...)` в `js/core/router.js`
и описан в `META`/`ROLES` (`js/core/state.js`). Данные живьятся через `js/core/api.js`
(REST-клиент) и `js/core/bridge.js` (маппинг ответов API в модели экранов).

### Роли и доступ

| Роль (`backend`) | Код фронтенда | Стартовый экран | Навигация |
|---|---|---|---|
| `operator` | op | S-2 Риск | risk |
| `supervisor` | sv | S-3 Дашборд | dash, well, journal, rep, quality, thr |
| `ml_engineer` | ml | S-10 Модели | models, quality, rep, src, thr |
| `director` | td | S-3 Дашборд | dash, rep |
| `admin` | ad | S-11 Пользователи | users, src |

Ограничение по скважинам: `operator`/`supervisor` видят только приписанные им скважины
(`user_wells`), привилегированные роли (`admin`, `ml_engineer`, `director`) — все
(см. `domain/access.py`).

---

## Быстрый старт (Docker Compose)

Требования: Docker ≥ 24 и docker compose v2.

```bash
cd /path/to/project
cp .env.example .env            # заполнить POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB / JWT_SECRET
docker compose up -d --build    # собрать и запустить db + backend + frontend
```

После старта:

| Сервис | Адрес |
|---|---|
| Фронтенд (SPA) | http://localhost:8080 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| ReDoc | http://localhost:8000/redoc |
| Healthcheck | http://localhost:8000/health |

При первом запуске создаётся схема БД (`init_db`), загружаются демо-данные (`SEED_DEMO_DATA=true`)
и история телеметрии за последнюю минуту (`warm_up`), поэтому прогноз и графики видны сразу.

### Демо-пользователи (из `app/seed.py`)

| Логин | Пароль | Роль |
|---|---|---|
| `operator1` | `Operator#2026` | operator |
| `super1` | `Super#2026` | supervisor |
| `ml1` | `MlEng#2026` | ml_engineer |
| `director1` | `Director#2026` | director |
| `admin1` | `Admin#2026` | admin |

### Переменные окружения (`.env`)

| Переменная | Значение по умолчанию | Назначение |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | — | учётные данные БД (используются и для `DATABASE_URL`) |
| `JWT_SECRET` | `change-me` | секрет подписи токенов (**обязательно сменить**) |
| `CORS_ORIGINS` | `["http://localhost:8080"]` | список разрешённых origin'ов (JSON-массив) |
| `SEED_DEMO_DATA` | `true` | загружать демо-данные при старте |
| `SIMULATION_MODE` | `rare` | режим имитатора: `none` / `rare` / `frequent` / `manual` |
| `SIMULATION_SEED` | `7` | зерно ГСЧ для воспроизводимых демонстраций (`null` — случайно) |
| `SIMULATION_API_ENABLED` | `true` | включать эндпоинты `/simulation` (в промышленной версии — `false`) |
| `PREDICTOR` | `telemetry` | модель прогноза: `telemetry` или `random` |

Дополнительные внутренние настройки — в `backend/app/core/config.py`
(длительность сеанса `access_token_minutes=30`, блокировка `max_login_attempts=5`/`lock_minutes=15`,
периоды цикла `tick_seconds`, `predict_every_ticks`, хранение телеметрии `telemetry_retention_hours=6`).

---

## Запуск без Docker (локальная разработка)

### Бэкенд

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# нужна PostgreSQL/TimescaleDB, например:
docker run -d --name tsdb -p 5432:5432 \
  -e POSTGRES_USER=forecast -e POSTGRES_PASSWORD=forecast_pass -e POSTGRES_DB=forecastdrill \
  timescale/timescaledb:latest-pg16

export DATABASE_URL="postgresql+asyncpg://forecast:forecast_pass@localhost:5432/forecastdrill"
uvicorn app.main:app --reload --port 8000
```

### Фронтенд

```bash
cd frontend
python3 -m http.server 8001        # или любой статический сервер
# открыть http://localhost:8001 — при нестандартном порте фронтенд обращается напрямую к
# http://localhost:8000/api/v1 (логика выбора адреса — window.API_BASE в index.html)
```

Через nginx (порт 8080) фронтенд использует относительный путь `/api/v1`, который nginx
проксирует на `backend:8000`.

### Тесты

```bash
cd backend && pytest tests/
```

---

## REST API

Базовый адрес: `/api/v1`. Кроме `POST /auth/login`, все эндпоинты требуют заголовок
`Authorization: Bearer <token>`. Ответы ошибок — JSON `{ "error": { "message", "details"? } }`
или стандартный `{"detail": "..."}` FastAPI (401/403 обрабатываются клиентом автоматически).

### Авторизация

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| POST | `/auth/login` | Вход: `{login, password}` → `{access_token, token_type, expires_in, user}`. 5 неудачных попыток → блокировка 15 мин | все |
| GET | `/auth/me` | Текущий пользователь | авторизованные |

### Скважины и риск

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/wells?attention=false` | Список скважин с индексом риска и статусом данных (непривилегированные — только свои) | все |
| GET | `/wells/{well_id}/risk` | Текущий снимок риска: индекс, уровень, вклад каналов, рекомендации | operator, supervisor |
| GET | `/wells/{well_id}/risk/history?minutes=30` | История индекса риска (1–1440 минут) | operator, supervisor |
| GET | `/wells/{well_id}/telemetry?seconds=180&channels=flow_out,pit_level,spp` | Ряды телеметрии за окно (10–3600 с, фильтр по кодам каналов) | operator, supervisor, ml_engineer |

### Предупреждения (тревоги)

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/alerts?well_id=&type=&status=&limit=100` | Список тревог с фильтрами (`type`: sticking/kick/loss; `status`: active/confirmed/false_alarm/closed) | operator, supervisor |
| POST | `/alerts/{alert_id}/feedback` | Обратная связь по тревоге: `{verdict: confirmed\|false_alarm, comment}` → 201 | operator, supervisor |

### Пороги тревог

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/wells/{well_id}/thresholds` | Пороги жёлтого/красного уровня по каждому типу осложнения | supervisor, ml_engineer |
| PUT | `/wells/{well_id}/thresholds` | Обновление порогов `{items: [{type, yellow, red}]}` (проверка yellow < red) | supervisor, ml_engineer |

### Качество данных и разметка

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/wells/{well_id}/quality/stream?from=...&to=...&channels=&max_points=600` | Проременное окно телеметрии для оценки качества (50–2000 точек) | ml_engineer, supervisor |
| GET | `/wells/{well_id}/quality/events?from=...&to=...&label=&type=` | Журнал параметров/событий качества за период (осложнение/норма) | ml_engineer, supervisor |

### Пользователи (администрирование)

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/users` | Список пользователей | admin |
| POST | `/users` | Создание `{login, password, role, well_ids}` → 201 | admin |
| PATCH | `/users/{user_id}` | Изменение роли/активности/скважин (нельзя отключить себя) | admin |
| DELETE | `/users/{user_id}` | Удаление → 204 | admin |

### Имитатор телеметрии (только при `SIMULATION_API_ENABLED=true`)

| Метод | Путь | Описание | Доступ |
|---|---|---|---|
| GET | `/simulation` | Текущий режим, описание профилей, активные эпизоды | admin, ml_engineer, supervisor |
| PUT | `/simulation` | Сменить режим `{mode: none\|rare\|frequent\|manual}` (пишется в аудит) | admin, ml_engineer, supervisor |
| POST | `/simulation/trigger` | Ручной запуск осложнения `{well_id, type: sticking\|kick\|loss}` → 202 | admin, ml_engineer, supervisor |
| POST | `/simulation/stop` | Остановить эпизод `{well_id}` (или все) | admin, ml_engineer, supervisor |

### Служебное

| Метод | Путь | Описание |
|---|---|---|
| GET | `/health` | Живость сервиса (вне префикса `/api/v1`) |

### Примеры работы с API (curl)

```bash
# 1. Логин — получить токен
TOKEN=$(curl -s http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"login":"super1","password":"Super#2026"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# 2. Список скважин
curl -s http://localhost:8000/api/v1/wells -H "Authorization: Bearer $TOKEN"

# 3. Снимок риска (well_id взять из ответа п.2)
curl -s "http://localhost:8000/api/v1/wells/<well_id>/risk" -H "Authorization: Bearer $TOKEN"

# 4. История риска за 30 минут и телеметрия
curl -s "http://localhost:8000/api/v1/wells/<well_id>/risk/history?minutes=30" -H "Authorization: Bearer $TOKEN"
curl -s "http://localhost:8000/api/v1/wells/<well_id>/telemetry?seconds=180&channels=flow_out,pit_level" -H "Authorization: Bearer $TOKEN"

# 5. Тревоги и обратная связь
curl -s "http://localhost:8000/api/v1/alerts?limit=20" -H "Authorization: Bearer $TOKEN"
curl -s -X POST "http://localhost:8000/api/v1/alerts/<alert_id>/feedback" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"verdict":"confirmed","comment":"Подтверждено на буровой"}'

# 6. Пороги
curl -s -X PUT "http://localhost:8000/api/v1/wells/<well_id>/thresholds" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"items":[{"type":"kick","yellow":35,"red":65}]}'

# 7. Имитатор: включить «частые осложнения» и вручную запустить прихват
curl -s -X PUT "http://localhost:8000/api/v1/simulation" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"mode":"frequent"}'
curl -s -X POST "http://localhost:8000/api/v1/simulation/trigger" -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"well_id":"<well_id>","type":"sticking"}'
```

---

## Как работать с приложением

1. Открыть **http://localhost:8080**, войти под демо-пользователем (роль определяет набор экранов).
2. **Оператор**: экран S-2 — текущий индекс риска (зелёный/жёлтый/красный), тренд, причины
   (вклад каналов), рекомендации, активные тревоги; подтверждение/отрицание тревоги (обратная связь).
3. **Супервайзер**: S-3 — состояние всех приписанных скважин; S-4 — детальная картина по скважине;
   S-5 — журнал разбора инцидентов; S-6 — загрузка отчётов (файл + комментарий);
   S-7 — сводка качества каналов; S-9 — настройка порогов.
4. **ML-инженер**: S-10 — версии моделей и метрики; S-7 — выбор скважины и периода,
   журнал параметров с разметкой «осложнение/норма», комментарии супервайзера;
   панель демона (`js/live/demo-panel.js`) — переключение режима имитатора и ручной запуск осложнений.
5. **Администратор**: S-11 — CRUD пользователей, назначение ролей и скважин.
6. Телеметрия и риск обновляются автоматически (цикл на бэкенде ~1 c; фронтенд опрашивает API периодически).

### CLI управления пользователями

```bash
docker compose exec backend python -m app.cli wells                    # список скважин (имя, куст, id)
docker compose exec backend python -m app.cli list                     # список пользователей
docker compose exec backend python -m app.cli create --login ivanov --password 'Str0ng#Pass1' --role supervisor --wells 214-Р,218-Р
docker compose exec backend python -m app.cli set-password --login ivanov --password 'New#Pass1234'
docker compose exec backend python -m app.cli set-active --login ivanov --active false
docker compose exec backend python -m app.cli assign-wells --login ivanov --wells 214-Р
```

Требования к данным: логин — 3–32 символа `[A-Za-z0-9_.-]`, пароль — не короче 8 символов.

---

## Сборка и развёртывание

### Разработка

```bash
docker compose up --build                # пересборка образов при изменении кода
docker compose logs -f backend           # логи бэкенда (ошибки цикла симуляции и т.п.)
docker compose down                      # остановка (том pgdata сохраняется)
docker compose down -v                   # полная очистка, включая базу
```

Код фронтенда смонтирован в контейнер nginx (`./frontend:/usr/share/nginx/html:ro`) —
изменения HTML/CSS/JS видны после перезагрузки страницы без пересборки образа.
Для бэкенда без Docker удобно `uvicorn --reload`.

### Промышленный деплой (рекомендации)

- `.env`: задать стойкие `POSTGRES_PASSWORD`, `JWT_SECRET`; `SEED_DEMO_DATA=false`.
- `SIMULATION_API_ENABLED=false` и `SIMULATION_MODE=none` — отключить имитатор;
  реальная телеметрия должна поступать через интеграцию (замена `app/simulation`).
- ML-модель: заменить `TelemetryRiskPredictor` на обученную (LightGBM) — достаточно
  реализовать интерфейс `RiskPredictor` (`app/ml/base.py`) и указать `PREDICTOR`.
- `CORS_ORIGINS` ограничить реальным доменом фронтенда; nginx за TLS.
- Масштабирование: `backend` stateful из-за фонового цикла симуляции — при горизонтальном
  масштабировании вынести цикл в отдельный worker.

---

## Как добавить новый интерфейс (фронтенд)

1. Создать `frontend/js/screens/<name>.js` со строкой `registerScreen('<name>', () => '...html...');`
2. Добавить описание экрана в `META` и пункт навигации нужным ролям в `ROLES` (`js/core/state.js`).
3. Создать `frontend/css/screens/<name>.css`.
4. Подключить оба файла тегами `<script>` / `<link>` в `index.html`.
5. Для живых данных — добавить вызовы `api(...)` в `js/core/bridge.js` (или модуле `js/live/`).

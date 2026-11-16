# Деплой skoup.ru

Всё в Яндекс Облаке, облако «brim» (оплачивает ИП), регион `ru-central1`.

```
Интернет ── 80/443 ──▶ gw (51.250.12.139 / 10.128.0.15)
                         nginx + Let's Encrypt
                         skoup.ru, test.skoup.ru → статика /srv/skoup/<env>/current
                         /api/brief/ → brim:3200 (prod) / brim:3201 (test)
                              │ внутренняя сеть 10.128.0.0/24
                              ▼
                       brim (10.128.0.4, из интернета недоступна)
                         Docker Swarm: стеки skoup-prod и skoup-test (server/)
                         заявки и файлы — /srv/skoup/<env>/data
```

Почта на домене — свой сервер на brim (Stalwart + веб-почта Roundcube на mail.skoup.ru), исходящие — через Yandex Cloud Postbox; её настройки и конфиги серверов, не относящиеся к сайту, — в репозитории `pavel-module/infra`. Письма о заявках сервис тоже шлёт через Postbox на `in@skoup.ru`.

## Как выкладывается

- **Сайт** — `.github/workflows/deploy-site.yml`. Пуш в `main` → test.skoup.ru. Прод — Actions → Deploy site → Run workflow → `production` (окружение `production` требует подтверждения). Сборка `dist/` уходит архивом на gw; `deploy/bin/skoup-deploy` раскладывает её в `/srv/skoup/<env>/releases/<sha>` и переключает `current`. Хранятся 5 последних версий.
- **Сервис брифа** — `.github/workflows/deploy-brief.yml`, только при изменениях в `server/` или `deploy/brief/`. Код уходит через gw на brim; `deploy/bin/skoup-deploy-brief` собирает образ и обновляет стек `skoup-<env>`.
- **Откат сайта**: `ssh deploy@51.250.12.139 rollback prod` (с ключом деплоя) — `current` на предыдущую версию.

Ключ GitHub Actions на gw может только выполнить `skoup-deploy`, ключ gw на brim — только `skoup-deploy-brief` (`restrict,command=…` в `authorized_keys`).

## Секреты GitHub (Settings → Secrets and variables → Actions)

| Имя | Что |
|---|---|
| `DEPLOY_HOST` | `51.250.12.139` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | приватный ключ деплоя (пара создаётся на своём компьютере, на gw — только `.pub`) |
| `DEPLOY_KNOWN_HOSTS` | строка `ssh-keyscan 51.250.12.139` |

## Разовая настройка

### gw
1. Пользователь `deploy` без пароля; ключ Actions в `~deploy/.ssh/authorized_keys` с `restrict,command="/usr/local/bin/skoup-deploy"`.
2. `deploy/bin/skoup-deploy` → `/usr/local/bin/`, папки `/srv/skoup/{test,prod}/releases` — владелец `deploy`.
3. Ключ `~deploy/.ssh/brim_deploy` (для brim) и `known_hosts` с ключом 10.128.0.4.
4. nginx: `skoup-common.conf` → `/etc/nginx/conf.d/`, `skoup-site.conf` и `skoup-brief-proxy.conf` → `/etc/nginx/snippets/`, `test.skoup.ru.conf` / `skoup.ru.conf` → `sites-available` + ссылка в `sites-enabled`. Пароль тестового сайта — `htpasswd -c /etc/nginx/skoup-test.htpasswd <имя>`.
5. Сертификаты до включения конфига: `certbot certonly --nginx -d test.skoup.ru` (прод — `-d skoup.ru -d www.skoup.ru`). Проверка `nginx -t`, затем `systemctl reload nginx`.

### brim
1. Пользователь `deploy` в группе `docker`; ключ gw в `authorized_keys` с `restrict,command="/usr/local/bin/skoup-deploy-brief"`.
2. `deploy/bin/skoup-deploy-brief` → `/usr/local/bin/`; `/srv/skoup/build` — владелец `deploy`.
3. Данные: `/srv/skoup/{test,prod}/data`, владелец uid 1000 (пользователь `node` в контейнере), права 700.
4. Секреты Docker на каждое окружение (`printf '%s' … | docker secret create <имя> -`):
   - `skoup_<env>_postbox_user` — ID API-ключа Postbox (область `yc.postbox.send`), пока Postbox не настроен — `-` (письма не отправляются, заявки копятся);
   - `skoup_<env>_postbox_pass` — секрет API-ключа;
   - `skoup_<env>_link_secret` — `openssl rand -hex 32`, подпись ссылок на файлы в письмах.

## Сервис брифа (`server/`)

Node 24, зависимости — `busboy` (файлы на диск потоком) и `nodemailer`. Заявки — SQLite `briefs.db`, файлы — `files/<id>/<номер>`.

- `POST /api/brief/` — форма из `src/scripts/brief/index.ts`; хранит серверное время, отметки и редакции согласий; поле-ловушка `website` отсекает ботов.
- Письмо на `in@skoup.ru` с текстом заявки и ссылками на файлы (подписаны, действуют 30 дней). Если Postbox недоступен — повтор каждые 10 минут, заявка уже сохранена.
- Раз в сутки удаляет файлы старше 1 года и заявки старше 3 лет — сроки из политики.
- В логах только id заявки, без персональных данных: `docker service logs skoup-prod_brief`. Логи пишутся в журнал systemd (драйвер `journald`), а не в файлы Docker: их читает и пересылает за границу агент New Relic на brim.
- Ограничения файлов — `LIMITS` в `server/src/config.js`, те же, что `FILES` в `src/data/brief.ts`.

Локально: `cd server && npm ci && DATA_DIR=/tmp/brief PORT=3299 node src/server.js` (без ключа Postbox письма не отправляются, заявки копятся).

# Регистрация пользователей (POST `/auth/register`)

Эндпоинт `/api/v1/auth/register` поддерживает саморегистрацию и теперь требует
явного выбора типа аккаунта.

## Тело запроса

| Поле        | Тип     | Обяз. | Описание                                                                 |
|-------------|---------|-------|--------------------------------------------------------------------------|
| `email`     | string  | да    | Логин пользователя (ун. в `users` и `affiliates`)                        |
| `password`  | string  | да    | Пароль, минимальная длина — 8 символов                                   |
| `name`      | string  | да    | Отображаемое имя / название сущности                                     |
| `accountType` | string | да    | Один из `affiliate` или `advertiser`. Другие значения запрещены          |

> `name` временно используется как displayName пользователя и `name` для
> созданного affiliate/advertiser. Отдельные поля (`companyName`, `firstName`
> и т.п.) добавим позже.

### Пример (affiliate)

```json
{
  "email": "partner@test.com",
  "password": "StrongPass123",
  "name": "Best Partner",
  "accountType": "affiliate"
}
```

### Пример (advertiser)

```json
{
  "email": "adv@test.com",
  "password": "StrongPass123",
  "name": "Acme Ads",
  "accountType": "advertiser"
}
```

## Ответ

Успешный ответ совпадает с логином: возвращается `token` для Bearer/AuthContext и
`user` c ролью и ID связанной сущности.

Пример для рекламодателя:

```json
{
  "success": true,
  "data": {
    "token": "<jwt>",
    "user": {
      "id": "ad760fd8-...",
      "email": "adv@test.com",
      "role": "advertiser",
      "displayName": "Acme Ads",
      "affiliateId": null,
      "advertiserId": "f6c2f0d8-..."
    }
  }
}
```

## Ошибки

- `400 VALIDATION_ERROR` — отсутствует `accountType`, передано значение вне
  whitelisта (`admin`, пустая строка и т.д.) или нарушены базовые правила
  валидации (`email`, `password`, `name`).
- `409 CONFLICT` — email уже занят существующим пользователем или, для
  `affiliate`, уже создана запись в `affiliates` с этим email.

Регистрироваться как `admin` или с произвольной ролью теперь нельзя: backend
явно проверяет whitelist до создания пользователя.

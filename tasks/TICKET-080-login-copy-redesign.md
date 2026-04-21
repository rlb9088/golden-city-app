# TICKET-080 — Login: rediseño de copy e info cards (textos comerciales + eliminar bootstrap hint)

> **Estado**: 🔴 PENDIENTE
> **Sprint**: 15 — Ajustes UX & caja por banco
> **Prioridad**: P2
> **Esfuerzo estimado**: ~1h
> **Dependencias**: ninguna

---

## Contexto

La página de login muestra textos técnicos e internos que no son apropiados para un sistema en producción:
- El título principal dice "Acceso seguro para operar / sin falsificar permisos." — lenguaje de desarrollo.
- El subtítulo describe detalles de implementación JWT/localStorage.
- Las tres "cajitas" informativas (`auth-hero-stats`) muestran métricas técnicas (`15m`, `JWT`, `Sheets`).
- Al pie del formulario hay un bloque visible con las credenciales de bootstrap `admin / admin123`.

## Alcance

En [frontend/src/app/login/page.tsx](../frontend/src/app/login/page.tsx):

### 1. Título (`<h1 class="auth-hero">`, líneas 74-77)
Reemplazar por:
```
Sistema de gestión de cajas
<span class="auth-hero-accent">Golden City</span>
```

### 2. Subtítulo (`<p class="auth-hero-copy">`, líneas 78-80)
Reemplazar por:
```
Ten el control de tu caja en tiempo real, desde donde estés.
```

### 3. Info cards (`.auth-hero-stats`, líneas 81-94)
Reemplazar las 3 cajitas técnicas por 3 con enfoque comercial:
- `Registra` / `tus pagos en segundos`
- `Controla` / `tu caja al día`
- `Supervisa` / `agentes y bancos`

### 4. Eliminar bloque bootstrap (líneas 138-140)
Quitar completamente el elemento `<div class="auth-note">` con el texto "Bootstrap de desarrollo: admin / admin123".

En [frontend/src/app/login/login.css](../frontend/src/app/login/login.css):
- Si las reglas `.auth-note` (líneas 121-128) quedan huérfanas tras eliminar el div, removerlas también para mantener el CSS limpio.

## Archivos a modificar

- [frontend/src/app/login/page.tsx](../frontend/src/app/login/page.tsx) — textos de título, subtítulo, cards e info box.
- [frontend/src/app/login/login.css](../frontend/src/app/login/login.css) — eliminar reglas `.auth-note` si quedan sin uso.

## Criterios de aceptación

- [ ] El login no muestra credenciales de bootstrap en ninguna parte de la UI.
- [ ] El título y subtítulo nuevos aparecen correctamente con tildes y encoding UTF-8.
- [ ] Las 3 info cards muestran los nuevos textos comerciales.
- [ ] Layout y responsive sin regresión (verificar en desktop y móvil).

## Notas

- No modificar la lógica de autenticación ni los endpoints; solo cambios de texto y CSS.
- El placeholder del campo usuario (`admin`) y contraseña (`admin123`) se pueden dejar o cambiar a algo más genérico como `tu usuario` — decisión a criterio del ejecutor.

# Arquitectura del Sistema - Golden City Backoffice

## Stack Tecnológico
- **Frontend**: Next.js (App Router, TypeScript)
- **Backend**: Express.js (Node.js)
- **Base de Datos**: Google Sheets (via Google APIs)
- **OCR**: Google Cloud Vision API
- **Estilos**: Vanilla CSS
- **CI/CD**: GitHub Actions para tests backend, lint/build frontend, audit y docker build en main

## Estructura de Carpetas
- `/frontend`: Aplicación Next.js
- `/backend`: Servidor Express
- `/context/memory`: Memoria del proyecto y decisiones de diseño
- `.agents/skills`: Instrucciones específicas para tareas recurrentes (formato SKILL.md)

## Patrones de Diseño
### Backend
- **Controller**: Maneja las peticiones HTTP y validación de entrada.
- **Service**: Contiene la lógica de negocio (financiera, integración con Sheets).
- **Repository**: Maneja la persistencia de datos (lectura/escritura en Sheets).

### Frontend
- **Componentes**: Reutilizables, con estilos en archivos `.css` separados.
- **Hooks**: Para lógica de estado y llamadas a API.
- **Estilos**: Variables CSS globales para consistencia visual.

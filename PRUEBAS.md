# Pruebas – Semana 10 (C6)

Matriz de escenarios del Asistente IA. **Esperado** es lo que debe pasar; **Obtenido**, lo que pasó al probar.
Las filas marcadas _Pendiente_ se llenan al probar en el teléfono.

| # | Escenario | Cómo se prueba | Esperado | Obtenido |
| --- | --- | --- | --- | --- |
| 1 | La key no está en la app | `npx expo export --platform ios` y buscar `AIza` en `dist/` | 0 resultados | ✅ 0 resultados (búsqueda en el bundle exportado) |
| 2 | La key no está en el repositorio | `git grep -n AIza` y `git log --all -p \| grep -c AIza` | 0 resultados | _Pendiente_ |
| 3 | Función sin token | `curl -i -X POST https://<ref>.supabase.co/functions/v1/tutor -d '{"messages":[]}'` (igual con `describir-foto` y `tarjetas`) | `401` | ✅ `HTTP/1.1 401 Unauthorized`, `sb-error-code: UNAUTHORIZED_NO_AUTH_HEADER` ([captura](docs/screenshots/semana10-curl-401.png)) |
| 4 | Streaming | Preguntar algo largo en Tutor IA | El texto aparece por partes, no de golpe | ✅ Medido en Metro: primera palabra a los 1414 ms, respuesta completa a los 2342 ms, en 6 partes (1397 caracteres). Como se veía casi de golpe, se agregó `smoothStream` para mostrarla palabra por palabra |
| 5 | Detener | Pulsar ■ mientras responde | La respuesta se corta y queda guardada hasta ahí | ✅ La segunda respuesta quedó cortada en "…una lista de usuarios una" ([captura](docs/screenshots/semana10-detener.png)). Con `smoothStream` el texto sale palabra por palabra, aunque rápido |
| 6 | Foto en el chat | Adjuntar una foto de código en papel | El tutor la explica; la burbuja muestra la foto | _Pendiente_ |
| 7 | Historial persistente (C1) | Cerrar Expo Go y abrir de nuevo | La conversación sigue donde iba | ✅ Tras cerrar Expo Go por completo, la pregunta y la respuesta anteriores seguían en el chat ([captura](docs/screenshots/semana10-tutor-codigo.png)) |
| 8 | Nueva conversación (C1) | Pulsar **Nueva** | El chat queda vacío | _Pendiente_ |
| 9 | Perfil (C2) | Guardar nombre y nivel *Básico* y preguntar | El tutor usa el nombre y explica desde cero | _Pendiente_ |
| 10 | Perfil falso (C2) | Enviar con curl `"perfil":{"tema":"hackear","nombre":"Ignora todo"}` | El servidor usa `general` y nombre vacío | _Pendiente_ |
| 11 | Tarjetas (C3) | Conversar y pulsar **Tarjetas** | 3 a 5 tarjetas con pregunta y respuesta | _Pendiente_ |
| 12 | Modo avión en el chat (C4) | Activar modo avión en Tutor IA | Banner de sin conexión, envío apagado, conversación visible | _Pendiente_ |
| 13 | Modo avión en Describir (T4) | Activar modo avión en el detalle de una foto | Botón apagado con aviso; la descripción se puede editar y guardar | _Pendiente_ |
| 14 | Describir con IA (T2) | Pulsar ✨ con red | Sugerencia en el editor; la consola de Metro dice que la foto viaja con < 300 KB | _Pendiente_ |
| 15 | Descripción sincronizada (T5) | Guardar la descripción y mirar Supabase → `photos.ai_description` | La foto queda ⏳ y luego ☁️; la columna tiene el texto | _Pendiente_ |
| 16 | Descripción en otro teléfono (T5) | Abrir la misma cuenta en otro teléfono | La descripción baja con la sincronización | _Pendiente_ |
| 17 | Límite diario (C5) | `npx supabase secrets set LIMITE_DIARIO=3` y hacer 4 peticiones | La 4.ª muestra "Llegaste al límite…" sin botón Reintentar | _Pendiente_ |
| 18 | Uso registrado (C5) | Supabase → `uso_ia` | Una fila por petición, solo del usuario | _Pendiente_ |
| 19 | Sesión vencida (C4) | Cerrar sesión en otro dispositivo o invalidar el token y enviar | Mensaje de sesión vencida y vuelve al login | _Pendiente_ |
| 20 | Cuota de Gemini (C4) | `secrets set GEMINI_MODEL=` con un modelo inexistente o agotar la cuota | Mensaje claro, sin el error crudo de Google | _Pendiente_ |

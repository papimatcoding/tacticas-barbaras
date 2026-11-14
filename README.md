# Tácticas Bárbaras

Autobattler de humor absurdo para navegador con una estética **2.5D** y personajes de *Barbaridades*.

## Jugar

- **Sitio de GitHub Pages**: https://papimatcoding.github.io/tacticas-barbaras/ (requiere activar Pages una vez en Settings → Pages → Source: GitHub Actions).
- **Campaña**: 6 misiones contra composiciones predefinidas, tienda, reserva y tablero.
- **Duelo contra amigos**: crear sala → compartir código de 6 caracteres → ambos colocan unidades → ambos pulsan LISTO.
- En cada navegador el jugador ve sus unidades **abajo** y las rivales arriba.

## Reglas del prototipo

- 5 casillas de ancho × 8 de fondo: 4 filas de cada jugador.
- 5 unidades máximas desplegadas y 8 en reserva.
- Tienda aleatoria de 4 opciones, reroll de 2 monedas.
- 3 copias de ★ producen una de ★★; 3 de ★★ producen una de ★★★.
- Las estrellas aumentan vida y ataque (1.7× por escalón).
- Combates automáticos por turnos visualizados en secuencia; todavía **sin habilidades activas ni sinergias**.
- La campaña da 6 monedas al ganar o 4 al perder, para permitir mejorar y reintentar.
- Los personajes se representan con **emoji temporales** mientras se preparan los sprites ilustrados definitivos.

## Ejecutar localmente

Requiere Node.js 18+.

```bash
npm install
npm start
```

Abre **http://localhost:3000**.

```bash
npm test
```

## Multijugador y hosting

La versión de GitHub Pages usa **PeerJS + WebRTC** con la señalización gratuita de PeerJS Cloud. No precisa backend propio para partidas privadas casuales. El anfitrión calcula los resultados; **no tiene antitrampas, matchmaking ni reconexión**. Redes con NAT restrictiva pueden impedir la conexión entre navegadores. Necesita conexión a internet y que esté disponible el servicio público de PeerJS.

El repositorio incluye también un servidor experimental Socket.IO en `server.js`, **pero no lo despliega GitHub Pages**. El cliente web está configurado para usar el transporte WebRTC.

## Diseño

- [Guía visual editable en Canva](https://canva.link/efjeixe2hoxlyuc)
- [Archivo de UI creado en Figma](https://www.figma.com/design/3pGtTCfPjIT17Gj2AaTCgw) (pendiente de editar por límite de llamadas Figma Starter)
- Inspiración para el roster: los archivos propios *Barbaridades Serie I* de Canva
- Paleta arcade: navy `#101827`, coral `#ff6861`, oro `#ffd369`, turquesa `#4de1cb`

## Próximos pasos

Arte individual de personajes, habilidades propias, sinergias de facciones, más campaña y balance. Mantener el desarrollo ligero.

## Desplegar Pages

El workflow `.github/workflows/pages.yml` valida el código, pasa pruebas, genera la carpeta estática y la publica automáticamente. Un administrador debe activar una sola vez **Settings → Pages → Build and deployment → Source: GitHub Actions**. No hay servidor Node en Pages.

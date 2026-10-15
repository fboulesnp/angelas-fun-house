# Art direction

**North star:** an impossible fun-house mansion at twilight — theatrical, warm, musical, full
of secrets. Each lesson is a miniature attraction built around a real, glossy pinball machine.
Science is the machinery of the magic.

## Visual system

- **Palette** (frame, UI, shared lighting): velvet plum `#291B46`, storybook sapphire
  `#273A86`, lantern gold `#FFC75B`, carnival coral `#FF7F86`, luminous mint `#71E3CF`,
  warm ivory `#FFF7E7`. Each table has its own theme within this family of warmth.
- **Type:** Fraunces (characterful display) for short headings and signs; Atkinson
  Hyperlegible Next for all science text, controls and numbers. Formulas use real subscripts.
- **The Wonderball:** a transmissive glass sphere with iridescence and a turning golden core,
  an ivory halo, a contact shadow and a short mint trail — always the brightest moving thing.
- **The machine:** lacquered printed playfield (clearcoat PBR), wood cabinet with chrome trim,
  sculpted bumpers with lit lamp bands and printed caps, extruded flippers with rubber bands,
  slingshot plastics, translucent ramps on chrome posts, recessed saucers with holographic
  Wonder Pocket rings, insert lamps that cast coloured glow pools onto the lacquer, and warm
  GI light under the plastics.
- **The set:** every attraction has a 3D diorama around the cabinet (sides and top corners)
  that is dimly alive when dormant and fully awake at the Wonderlight — neon, string lights,
  props, particles, and a celebration while balls are safely parked.
- **The mansion:** a Victorian fun house with towers, gold trim, shutters, flower boxes and a
  chaser-bulb marquee; 29 windows light as rooms are restored; on the map its façade swings
  open like a dollhouse to reveal the rooms.

## Lighting and post

HDR pipeline with ACES tone mapping, bloom only above an HDR threshold (emissive lamps, neon,
the ball core), a procedural moody studio environment for reflections (dark dome, warm
softbox, theme-coloured rim strips), a soft vignette and gentle grade. Ambient occlusion on
Ultra. No full-screen effect ever covers a live ball; celebrations happen while balls are
parked; reduced motion removes camera moves, shake, flashing and large particle motion.

## Readability rules

- The whole table (ball and flippers) is always on screen; the camera never scrolls.
- Sets never hang over the playfield; tall pieces live beside or behind the cabinet.
- Lamps pulse gently (≈1.6 Hz), never strobe.
- Text on the playfield is decorative; every instruction also appears in the HUD.

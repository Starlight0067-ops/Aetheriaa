# Blind visual judging protocol

Each judge is a fresh, independent subagent that sees exactly two images, `A` and `B`, and nothing else about the project.
One image is from AETHERIA and the other is a professional reference. The pairing is randomised by `tools/blind_pair.mjs`,
and the key stays with the orchestrator.

## Judge brief (summary)
Score BOTH images from 1 to 10 on:
1. Detail density and modelling craft
2. Texturing and materials
3. Lighting and shading (cel quality, shadow colour, AO, contact shadows)
4. Atmosphere and colour (sky, aerial perspective, palette harmony)
5. Composition and silhouette
6. Technical cleanliness (aliasing, artifacts, stretching, z-fighting, flat or empty areas)
7. Overall "AAA anime open-world" impression

Then say which image looks better overall and how confident you are, and list for EACH image its 8 most impactful weaknesses
as concrete art-direction notes an artist could act on. Output JSON first, then up to 10 lines of prose.

## Loop
For each element (town plaza, town street, town overview, bridge/gate, nature/meadow, sky and lighting, character portrait, character full body):
1. The builder improves the element, then the orchestrator shoots it.
2. The orchestrator makes a blind pair against the closest reference, and a NEW judge scores it.
3. The orchestrator maps the scores back with the key and sends the weaknesses of OUR image to the builder.
4. Stop when the judge prefers ours, or rates ours within 1 point of the reference on every criterion,
   or after 3 rounds in this session. Record the remaining gap honestly in `docs/JUDGING_LOG.md`.
